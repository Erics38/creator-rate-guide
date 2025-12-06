/**
 * Lambda Handler: Save Collaboration
 *
 * Purpose: API endpoint to save a new collaboration calculation
 * Triggered by: POST /collaborations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoService } from '../services/dynamoService';
import { createCollaborationSchema } from '../validation/collaborationSchema';

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
 * AWS calls this when API Gateway receives a POST request
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Log request for debugging (non-sensitive fields only)
  console.log('Save collaboration request:', {
    method: event.httpMethod,
    path: event.path,
    userId: event.requestContext.authorizer?.claims?.sub,
  });

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Validate and sanitize input with Zod
    const validationResult = createCollaborationSchema.safeParse(body);

    if (!validationResult.success) {
      console.warn('Validation failed:', validationResult.error.issues);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Invalid input data',
          details: validationResult.error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
      };
    }

    // Use validated data (automatically sanitized by Zod)
    const validatedBody = validationResult.data;

    // Generate unique ID and timestamps
    const id = Date.now().toString();
    const now = new Date().toISOString();

    // Determine creator category based on average views
    // This helps with querying and analytics later
    const creatorCategory = body.averageViews < 50000 ? 'micro'
                           : body.averageViews < 500000 ? 'mid'
                           : 'macro';

    // Determine view range for grouping
    const viewsRange = body.averageViews < 10000 ? '0-10K'
                      : body.averageViews < 50000 ? '10K-50K'
                      : body.averageViews < 100000 ? '50K-100K'
                      : body.averageViews < 500000 ? '100K-500K'
                      : '500K+';

    // Build DynamoDB item
    const userId = getUserId(event);
    const item = {
      // DynamoDB keys
      PK: `userId#${userId}`,
      SK: `COLLAB#${now}#${id}`,

      // Core identification
      id,
      creatorName: validatedBody.creatorName,

      // Input parameters (validated)
      averageViews: validatedBody.averageViews,
      lowestViews: validatedBody.lowestViews,
      targetCPM: validatedBody.targetCPM,

      // Prediction results (validated)
      projectedViews: validatedBody.projectedViews,
      recommendedPrice: validatedBody.recommendedPrice,
      confidence: validatedBody.confidence,
      reasoning: validatedBody.reasoning,
      priceRangeMin: validatedBody.priceRange.min,
      priceRangeMax: validatedBody.priceRange.max,
      dateCalculated: now,

      // Computed fields for queries
      creatorCategory,
      viewsRange,
      creatorNameLower: validatedBody.creatorName.toLowerCase(),
      hasActualData: false,

      // Optional fields (if provided)
      ...(validatedBody.actualViews && { actualViews: validatedBody.actualViews }),
      ...(validatedBody.actualPrice && { actualPrice: validatedBody.actualPrice }),
      ...(validatedBody.datePosted && { datePosted: validatedBody.datePosted }),
      ...(validatedBody.notes && { notes: validatedBody.notes }),
      ...(validatedBody.accuracy && { accuracy: validatedBody.accuracy })
    };

    // Save to DynamoDB
    await dynamoService.putItem(item);

    // Return success response
    return {
      statusCode: 201,  // 201 = Created
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Collaboration saved successfully',
        data: item
      })
    };

  } catch (error) {
    // Log detailed error for debugging (CloudWatch only)
    console.error('Error saving collaboration:', error);

    // Return sanitized error (no technical details exposed to client)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'An error occurred while saving the collaboration. Please try again.'
      })
    };
  }
};
