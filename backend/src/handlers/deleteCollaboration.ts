/**
 * Lambda Handler: Delete Collaboration
 *
 * Purpose: API endpoint to delete a collaboration
 * Triggered by: DELETE /collaborations/{id}
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoService } from '../services/dynamoService';

/**
 * Extract user ID from Cognito JWT token
 * API Gateway adds this to event.requestContext.authorizer.claims
 */
function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;
  return claims?.sub || 'global';  // Fallback to 'global' if no auth
}

/**
 * Main Lambda handler function
 * AWS calls this when API Gateway receives a DELETE request
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Received request:', JSON.stringify(event, null, 2));

  try {
    // Get collaboration ID from path parameters
    const collaborationId = event.pathParameters?.id;
    if (!collaborationId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing collaboration ID in path'
        })
      };
    }

    const userId = getUserId(event);

    // Find the collaboration's SK (we need to query for it)
    const allCollaborations = await dynamoService.queryByUserId(userId);
    const collaboration = allCollaborations.find(c => c.id === collaborationId);

    if (!collaboration) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Collaboration not found'
        })
      };
    }

    // Delete from DynamoDB
    await dynamoService.deleteItem(userId, collaboration.SK);

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Collaboration deleted successfully',
        deletedId: collaborationId
      })
    };

  } catch (error) {
    console.error('Error deleting collaboration:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
