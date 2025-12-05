import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table for Influencer Collaborations
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

    // Output table name for easy reference
    new cdk.CfnOutput(this, 'TableName', {
      value: collaborationsTable.tableName,
      description: 'DynamoDB table name for collaborations',
      exportName: 'InfluencerCollaborationsTableName',
    });

    // Output table ARN
    new cdk.CfnOutput(this, 'TableArn', {
      value: collaborationsTable.tableArn,
      description: 'DynamoDB table ARN',
    });
  }
}
