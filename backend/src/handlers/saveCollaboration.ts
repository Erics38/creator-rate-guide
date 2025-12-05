/**
 * Lambda Handler: Save Collaboration
 *
 * Purpose: API endpoint to save a new collaboration calculation
 * Triggered by: POST /collaborations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoService } from '../services/dynamoService';

/**
 * Main Lambda handler function
 * AWS calls this when API Gateway receives a POST request
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Log request for debugging (visible in CloudWatch)
  console.log('Received request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    // API Gateway sends data as JSON string in event.body
    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    // These come from the frontend after calculation
    const requiredFields = [
      'creatorName',
      'averageViews',
      'lowestViews',
      'targetCPM',
      'projectedViews',
      'recommendedPrice',
      'confidence',
      'reasoning',
      'priceRange'
    ];

    const missingFields = requiredFields.filter(field => !body[field]);
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'  // CORS header (allow frontend to call)
        },
        body: JSON.stringify({
          error: 'Missing required fields',
          missing: missingFields
        })
      };
    }

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
    // PK/SK structure allows efficient queries by user
    const item = {
      // DynamoDB keys
      PK: 'userId#global',  // Later: use real user IDs from authentication
      SK: `COLLAB#${now}#${id}`,  // Sortable by date, unique by ID

      // Core identification
      id,
      creatorName: body.creatorName,

      // Input parameters (what user entered)
      averageViews: body.averageViews,
      lowestViews: body.lowestViews,
      targetCPM: body.targetCPM,

      // Prediction results (from ML algorithm)
      projectedViews: body.projectedViews,
      recommendedPrice: body.recommendedPrice,
      confidence: body.confidence,
      reasoning: body.reasoning,
      priceRangeMin: body.priceRange.min,
      priceRangeMax: body.priceRange.max,
      dateCalculated: now,

      // Computed fields for queries
      creatorCategory,
      viewsRange,
      creatorNameLower: body.creatorName.toLowerCase(),
      hasActualData: false,  // No actual results yet

      // Optional fields (if provided)
      ...(body.actualViews && { actualViews: body.actualViews }),
      ...(body.actualPrice && { actualPrice: body.actualPrice }),
      ...(body.datePosted && { datePosted: body.datePosted }),
      ...(body.notes && { notes: body.notes }),
      ...(body.accuracy && { accuracy: body.accuracy })
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
    // Log error for debugging
    console.error('Error saving collaboration:', error);

    // Return error response
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
