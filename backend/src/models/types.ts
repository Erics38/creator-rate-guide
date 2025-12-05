/**
 * Data models for Influencer Rate Calculator backend
 */

export interface CollaborationData {
  // DynamoDB Keys
  PK: string;  // Partition key: "userId#global"
  SK: string;  // Sort key: "COLLAB#<timestamp>#<id>"

  // Core identification
  id: string;
  creatorName: string;

  // Input parameters
  averageViews: number;
  lowestViews: number;
  targetCPM: number;

  // Prediction results (calculated)
  projectedViews: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string;
  priceRangeMin: number;
  priceRangeMax: number;
  dateCalculated: string;  // ISO 8601 format

  // Optional: Actual results (added later)
  actualViews?: number;
  actualPrice?: number;
  datePosted?: string;  // ISO 8601 format
  notes?: string;

  // Computed field
  accuracy?: number;
}

export interface PredictionInput {
  averageViews: number;
  lowestViews: number;
  targetCPM: number;
}

export interface PredictionOutput {
  projectedViews: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string;
  priceRange: {
    min: number;
    max: number;
  };
}
