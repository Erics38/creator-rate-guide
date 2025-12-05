import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
      pointInTimeRecovery: false,  // Can enable later if needed
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
        allowOrigins: apigateway.Cors.ALL_ORIGINS,  // TODO: Restrict to your domain in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Create /collaborations endpoint
    const collaborations = api.root.addResource('collaborations');

    // POST /collaborations → saveCollaborationFn
    collaborations.addMethod('POST', new apigateway.LambdaIntegration(saveCollaborationFn));

    // GET /collaborations → getCollaborationsFn
    collaborations.addMethod('GET', new apigateway.LambdaIntegration(getCollaborationsFn));

    // ==========================================
    // OUTPUTS
    // ==========================================

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
  }
}
