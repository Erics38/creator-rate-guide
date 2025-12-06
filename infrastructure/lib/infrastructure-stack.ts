import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import * as path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==========================================
    // COGNITO USER POOL
    // ==========================================
    const userPool = new cognito.UserPool(this, 'InfluencerRatesUserPool', {
      userPoolName: 'InfluencerRatesUsers',
      selfSignUpEnabled: true,  // Allow users to sign up themselves
      signInAliases: {
        email: true,  // Users can sign in with email
      },
      autoVerify: {
        email: true,  // Auto-verify email addresses
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,  // Keep it simple for MVP
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // Don't delete users if stack is destroyed
    });

    // User Pool Client (for frontend authentication)
    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: {
        userPassword: true,  // Enable username/password auth
        userSrp: true,  // Secure Remote Password protocol (recommended)
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,  // OAuth 2.0 authorization code flow
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
    });

    // ==========================================
    // DYNAMODB TABLE
    // ==========================================
    const collaborationsTable = new dynamodb.Table(this, 'CollaborationsTable', {
      tableName: 'InfluencerCollaborations',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // On-demand pricing (free tier friendly)
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // Don't delete table if stack is destroyed
      pointInTimeRecovery: true,  // Enable backup and restore
      encryption: dynamodb.TableEncryption.AWS_MANAGED,  // Enable encryption at rest (free)
    });

    // ==========================================
    // LAMBDA FUNCTIONS
    // ==========================================

    // Lambda: Save Collaboration
    // Triggered by: POST /collaborations
    const saveCollaborationFn = new lambda.Function(this, 'SaveCollaborationFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,  // Node.js 18 runtime
      handler: 'saveCollaboration.handler',  // File: saveCollaboration.ts, export: handler
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/handlers')),  // Built code location
      environment: {
        TABLE_NAME: collaborationsTable.tableName  // Pass table name to Lambda
      },
      timeout: cdk.Duration.seconds(10),  // Max execution time
      memorySize: 512,  // MB of RAM (affects performance and cost)
    });

    // Grant Lambda permission to write to DynamoDB
    collaborationsTable.grantWriteData(saveCollaborationFn);

    // Lambda: Get Collaborations
    // Triggered by: GET /collaborations
    const getCollaborationsFn = new lambda.Function(this, 'GetCollaborationsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getCollaborations.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/handlers')),
      environment: {
        TABLE_NAME: collaborationsTable.tableName
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
    });

    // Grant Lambda permission to read from DynamoDB
    collaborationsTable.grantReadData(getCollaborationsFn);

    // Lambda: Update Collaboration
    // Triggered by: PUT /collaborations/{id}
    const updateCollaborationFn = new lambda.Function(this, 'UpdateCollaborationFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'updateCollaboration.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/handlers')),
      environment: {
        TABLE_NAME: collaborationsTable.tableName
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
    });

    // Grant Lambda permission to read and write to DynamoDB
    collaborationsTable.grantReadWriteData(updateCollaborationFn);

    // Lambda: Delete Collaboration
    // Triggered by: DELETE /collaborations/{id}
    const deleteCollaborationFn = new lambda.Function(this, 'DeleteCollaborationFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'deleteCollaboration.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/handlers')),
      environment: {
        TABLE_NAME: collaborationsTable.tableName
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
    });

    // Grant Lambda permission to read and write to DynamoDB
    collaborationsTable.grantReadWriteData(deleteCollaborationFn);

    // ==========================================
    // API GATEWAY
    // ==========================================

    // Create REST API
    // This gives us HTTPS endpoints that trigger our Lambda functions
    const api = new apigateway.RestApi(this, 'InfluencerRatesAPI', {
      restApiName: 'Influencer Rates API',
      description: 'API for influencer collaboration pricing calculator',
      // CORS configuration (allows frontend to call API from different domain)
      defaultCorsPreflightOptions: {
        // Restrict to production domain for security
        allowOrigins: ['https://rateq.netlify.app', 'http://localhost:8080'],  // Production + local dev
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      // Rate limiting to prevent abuse
      deployOptions: {
        throttlingRateLimit: 100,  // Requests per second
        throttlingBurstLimit: 200,  // Burst capacity
      },
    });

    // Cognito Authorizer for API Gateway
    // This validates JWT tokens from Cognito before allowing API access
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // Create /collaborations endpoint
    const collaborations = api.root.addResource('collaborations');

    // POST /collaborations → saveCollaborationFn (requires auth)
    collaborations.addMethod('POST', new apigateway.LambdaIntegration(saveCollaborationFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /collaborations → getCollaborationsFn (requires auth)
    collaborations.addMethod('GET', new apigateway.LambdaIntegration(getCollaborationsFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Create /collaborations/{id} endpoint for UPDATE and DELETE
    const collaborationById = collaborations.addResource('{id}');

    // PUT /collaborations/{id} → updateCollaborationFn (requires auth)
    collaborationById.addMethod('PUT', new apigateway.LambdaIntegration(updateCollaborationFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // DELETE /collaborations/{id} → deleteCollaborationFn (requires auth)
    collaborationById.addMethod('DELETE', new apigateway.LambdaIntegration(deleteCollaborationFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ==========================================
    // MONITORING & ALARMS
    // ==========================================

    // SNS Topic for alarm notifications
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'RateQ Alarm Notifications',
      topicName: 'RateQAlarms',
    });

    // Lambda Error Alarms (one for each function)
    const lambdaFunctions = [
      { name: 'SaveCollaboration', fn: saveCollaborationFn },
      { name: 'GetCollaborations', fn: getCollaborationsFn },
      { name: 'UpdateCollaboration', fn: updateCollaborationFn },
      { name: 'DeleteCollaboration', fn: deleteCollaborationFn },
    ];

    lambdaFunctions.forEach(({ name, fn }) => {
      // Alarm for function errors
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        alarmName: `RateQ-${name}-Errors`,
        metric: fn.metricErrors({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,  // Alert if 5+ errors in 5 minutes
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: `${name} function is experiencing errors`,
      });
      errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

      // Alarm for function throttling
      const throttleAlarm = new cloudwatch.Alarm(this, `${name}ThrottleAlarm`, {
        alarmName: `RateQ-${name}-Throttled`,
        metric: fn.metricThrottles({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,  // Alert if 10+ throttles in 5 minutes
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: `${name} function is being throttled`,
      });
      throttleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
    });

    // API Gateway 4xx Error Alarm (client errors)
    const api4xxAlarm = new cloudwatch.Alarm(this, 'Api4xxErrorAlarm', {
      alarmName: 'RateQ-API-4xx-Errors',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: api.restApiName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 50,  // Alert if 50+ 4xx errors in 5 minutes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'API is receiving many client errors (4xx)',
    });
    api4xxAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // API Gateway 5xx Error Alarm (server errors)
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxErrorAlarm', {
      alarmName: 'RateQ-API-5xx-Errors',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: api.restApiName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,  // Alert if 10+ 5xx errors in 5 minutes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'API is experiencing server errors (5xx)',
    });
    api5xxAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // DynamoDB Read/Write Throttle Alarms
    const dynamoReadThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoReadThrottleAlarm', {
      alarmName: 'RateQ-DynamoDB-ReadThrottle',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ReadThrottleEvents',
        dimensionsMap: {
          TableName: collaborationsTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,  // Alert on any throttling
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'DynamoDB table read operations are being throttled',
    });
    dynamoReadThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    const dynamoWriteThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoWriteThrottleAlarm', {
      alarmName: 'RateQ-DynamoDB-WriteThrottle',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'WriteThrottleEvents',
        dimensionsMap: {
          TableName: collaborationsTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,  // Alert on any throttling
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'DynamoDB table write operations are being throttled',
    });
    dynamoWriteThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    // ==========================================
    // OUTPUTS
    // ==========================================

    // Output Cognito info (frontend needs these!)
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'InfluencerRatesUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'InfluencerRatesUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      description: 'Cognito User Pool Domain',
    });

    // Output DynamoDB table info
    new cdk.CfnOutput(this, 'TableName', {
      value: collaborationsTable.tableName,
      description: 'DynamoDB table name for collaborations',
      exportName: 'InfluencerCollaborationsTableName',
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: collaborationsTable.tableArn,
      description: 'DynamoDB table ARN',
    });

    // Output API Gateway URL (important - frontend needs this!)
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'InfluencerRatesApiUrl',
    });

    // Output individual Lambda function names for debugging
    new cdk.CfnOutput(this, 'SaveCollaborationFunctionName', {
      value: saveCollaborationFn.functionName,
      description: 'Save Collaboration Lambda function name',
    });

    new cdk.CfnOutput(this, 'GetCollaborationsFunctionName', {
      value: getCollaborationsFn.functionName,
      description: 'Get Collaborations Lambda function name',
    });

    new cdk.CfnOutput(this, 'UpdateCollaborationFunctionName', {
      value: updateCollaborationFn.functionName,
      description: 'Update Collaboration Lambda function name',
    });

    new cdk.CfnOutput(this, 'DeleteCollaborationFunctionName', {
      value: deleteCollaborationFn.functionName,
      description: 'Delete Collaboration Lambda function name',
    });

    // Output SNS Topic ARN for alarm notifications
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarm notifications - subscribe your email here',
      exportName: 'RateQAlarmTopicArn',
    });
  }
}
