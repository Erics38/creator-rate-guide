/**
 * Lambda Handler: Update Collaboration
 *
 * Purpose: API endpoint to update an existing collaboration
 * Triggered by: PUT /collaborations/{id}
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
 * AWS calls this when API Gateway receives a PUT request
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

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const userId = getUserId(event);

    // Build updates object (only include fields that are provided)
    const updates: Record<string, any> = {};

    if (body.actualViews !== undefined) updates.actualViews = body.actualViews;
    if (body.actualPrice !== undefined) updates.actualPrice = body.actualPrice;
    if (body.datePosted !== undefined) updates.datePosted = body.datePosted;
    if (body.notes !== undefined) updates.notes = body.notes;

    // Add computed fields
    if (body.actualViews && body.projectedViews) {
      updates.accuracy = calculateAccuracy(body.projectedViews, body.actualViews);
    }
    updates.hasActualData = body.actualViews !== undefined;

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'No fields to update'
        })
      };
    }

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

    // Update in DynamoDB
    const updated = await dynamoService.updateItem(userId, collaboration.SK, updates);

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Collaboration updated successfully',
        data: updated
      })
    };

  } catch (error) {
    console.error('Error updating collaboration:', error);

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

/**
 * Calculate accuracy percentage
 */
function calculateAccuracy(projected: number, actual: number): number {
  if (projected === 0) return 0;
  const difference = Math.abs(projected - actual);
  const accuracy = Math.max(0, 100 - (difference / projected) * 100);
  return Math.round(accuracy * 100) / 100;
}
