/**
 * Lambda Handler: Get Collaborations
 *
 * Purpose: API endpoint to retrieve all collaborations for a user
 * Triggered by: GET /collaborations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoService } from '../services/dynamoService';

/**
 * Extract user ID from Cognito JWT token
 * API Gateway adds this to event.requestContext.authorizer.claims
 */
function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;
  return claims?.sub || 'global';  // Fallback to 'global' if no auth (for backwards compatibility)
}

/**
 * Main Lambda handler function
 * AWS calls this when API Gateway receives a GET request
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Received request:', JSON.stringify(event, null, 2));

  try {
    // Get userId from Cognito JWT token
    const userId = getUserId(event);

    // Query DynamoDB for all collaborations
    // Returns items sorted by date (newest first)
    const items = await dynamoService.queryByUserId(userId);

    // Transform DynamoDB items to frontend format
    // Remove DynamoDB-specific fields (PK, SK) and format dates
    const collaborations = items.map((item: any) => ({
      id: item.id,
      creatorName: item.creatorName,
      averageViews: item.averageViews,
      lowestViews: item.lowestViews,
      targetCPM: item.targetCPM,
      projectedViews: item.projectedViews,
      recommendedPrice: item.recommendedPrice,
      confidence: item.confidence,
      reasoning: item.reasoning,
      priceRange: {
        min: item.priceRangeMin,
        max: item.priceRangeMax
      },
      dateCalculated: item.dateCalculated,
      // Optional fields (only include if present)
      ...(item.actualViews && { actualViews: item.actualViews }),
      ...(item.actualPrice && { actualPrice: item.actualPrice }),
      ...(item.datePosted && { datePosted: item.datePosted }),
      ...(item.notes && { notes: item.notes }),
      ...(item.accuracy && { accuracy: item.accuracy })
    }));

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'  // CORS
      },
      body: JSON.stringify({
        message: 'Collaborations retrieved successfully',
        count: collaborations.length,
        data: collaborations
      })
    };

  } catch (error) {
    console.error('Error retrieving collaborations:', error);

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
