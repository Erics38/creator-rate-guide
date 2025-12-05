/**
 * DynamoDB Service Layer
 *
 * Purpose: Provides reusable functions for DynamoDB operations
 * Why we need this: Separates database logic from Lambda handlers (clean architecture)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  PutCommandInput,
  QueryCommandInput,
  GetCommandInput,
  UpdateCommandInput,
  DeleteCommandInput
} from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
// Why DocumentClient? It automatically converts between JavaScript types and DynamoDB types
// (e.g., number → N, string → S)
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Table name from environment variable (set by CDK)
const TABLE_NAME = process.env.TABLE_NAME || 'InfluencerCollaborations';

/**
 * DynamoDB Service
 * All database operations in one place for easy testing and reuse
 */
export const dynamoService = {
  /**
   * Save a collaboration item to DynamoDB
   * @param item - Full collaboration data with PK, SK, and all fields
   */
  async putItem(item: Record<string, any>) {
    const params: PutCommandInput = {
      TableName: TABLE_NAME,
      Item: item
    };

    await docClient.send(new PutCommand(params));
    return item;
  },

  /**
   * Query all collaborations for a user
   * Uses partition key to get all items efficiently
   * @param userId - User identifier (currently "global")
   */
  async queryByUserId(userId: string) {
    const params: QueryCommandInput = {
      TableName: TABLE_NAME,
      // Query by partition key (PK)
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `userId#${userId}`,
        ':sk': 'COLLAB#'  // Only get collaboration items (not other types)
      },
      // Sort newest first (reverse chronological order)
      ScanIndexForward: false
    };

    const result = await docClient.send(new QueryCommand(params));
    return result.Items || [];
  },

  /**
   * Get a specific collaboration by ID
   * Requires both PK and SK (full primary key)
   * @param userId - User identifier
   * @param sk - Sort key (COLLAB#<timestamp>#<id>)
   */
  async getItemByKey(userId: string, sk: string) {
    const params: GetCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        PK: `userId#${userId}`,
        SK: sk
      }
    };

    const result = await docClient.send(new GetCommand(params));
    return result.Item;
  },

  /**
   * Update an existing collaboration (e.g., add actual results)
   * @param userId - User identifier
   * @param sk - Sort key
   * @param updates - Fields to update
   */
  async updateItem(userId: string, sk: string, updates: Record<string, any>) {
    // Build update expression dynamically from updates object
    // Example: { actualViews: 12000, notes: "Great!" }
    // Becomes: "SET actualViews = :actualViews, notes = :notes"
    const updateExpressionParts: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      updateExpressionParts.push(`${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = value;
    });

    const params: UpdateCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        PK: `userId#${userId}`,
        SK: sk
      },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'  // Return updated item
    };

    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
  },

  /**
   * Delete a collaboration
   * @param userId - User identifier
   * @param sk - Sort key
   */
  async deleteItem(userId: string, sk: string) {
    const params: DeleteCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        PK: `userId#${userId}`,
        SK: sk
      }
    };

    await docClient.send(new DeleteCommand(params));
    return { deleted: true };
  }
};
