/**
 * API Client for Collaborations
 *
 * Purpose: Connect frontend to AWS Lambda backend via API Gateway
 * Wraps fetch calls with error handling and type safety
 */

// API base URL - will be set via environment variable
const API_BASE = import.meta.env.VITE_API_URL || 'https://k0oldo3mk1.execute-api.us-east-1.amazonaws.com/prod';

/**
 * Interface matching the data we send to/receive from API
 * This matches the format expected by Lambda functions
 */
export interface CollaborationApiData {
  // Core identification
  id?: string;  // Optional because backend generates this
  creatorName: string;

  // Input parameters (what user entered)
  averageViews: number;
  lowestViews: number;
  targetCPM: number;

  // Prediction results (from algorithm)
  projectedViews: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string;
  priceRange: {
    min: number;
    max: number;
  };

  // Timestamps
  dateCalculated?: string;  // Backend adds this

  // Optional fields (if provided)
  actualViews?: number;
  actualPrice?: number;
  datePosted?: string;
  notes?: string;
  accuracy?: number;
}

/**
 * API response format for save operation
 */
interface SaveResponse {
  message: string;
  data: CollaborationApiData;
}

/**
 * API response format for get operation
 */
interface GetResponse {
  message: string;
  count: number;
  data: CollaborationApiData[];
}

/**
 * Collaborations API Client
 * All API calls in one place for easy maintenance
 */
export const collaborationsApi = {
  /**
   * Save a new collaboration to the backend
   * @param data - Collaboration data to save
   * @returns Saved collaboration with server-generated ID and timestamp
   */
  async saveCollaboration(data: CollaborationApiData): Promise<CollaborationApiData> {
    try {
      console.log('API: Saving collaboration to backend...', data);

      const response = await fetch(`${API_BASE}/collaborations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `API error: ${response.status} ${response.statusText}`
        );
      }

      const result: SaveResponse = await response.json();
      console.log('API: Collaboration saved successfully', result.data);

      return result.data;

    } catch (error) {
      console.error('API: Failed to save collaboration', error);
      throw new Error(
        error instanceof Error
          ? `Failed to save: ${error.message}`
          : 'Failed to save collaboration'
      );
    }
  },

  /**
   * Get all collaborations for the current user
   * @returns Array of collaborations sorted by date (newest first)
   */
  async getCollaborations(): Promise<CollaborationApiData[]> {
    try {
      console.log('API: Fetching collaborations from backend...');

      const response = await fetch(`${API_BASE}/collaborations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `API error: ${response.status} ${response.statusText}`
        );
      }

      const result: GetResponse = await response.json();
      console.log(`API: Fetched ${result.count} collaborations successfully`);

      return result.data;

    } catch (error) {
      console.error('API: Failed to fetch collaborations', error);
      throw new Error(
        error instanceof Error
          ? `Failed to load: ${error.message}`
          : 'Failed to load collaborations'
      );
    }
  }
};
