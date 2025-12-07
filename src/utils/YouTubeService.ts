/**
 * YouTube Data Extraction Service
 *
 * Handles YouTube Shorts and video data extraction using YouTube Data API v3
 * FREE tier: 10,000 quota units per day per API key
 */

const YOUTUBE_API_KEY_STORAGE = 'youtube_api_key';
const API_URL = import.meta.env.VITE_API_URL;

interface YouTubeVideoStats {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  thumbnailUrl: string;
}

export class YouTubeService {
  /**
   * Save YouTube API key to localStorage
   */
  static saveApiKey(apiKey: string): void {
    localStorage.setItem(YOUTUBE_API_KEY_STORAGE, apiKey);
  }

  /**
   * Get saved YouTube API key from localStorage
   */
  static getApiKey(): string | null {
    return localStorage.getItem(YOUTUBE_API_KEY_STORAGE);
  }

  /**
   * Clear saved YouTube API key
   */
  static clearApiKey(): void {
    localStorage.removeItem(YOUTUBE_API_KEY_STORAGE);
  }

  /**
   * Check if a URL is a YouTube URL
   */
  static isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com|youtu\.be)/.test(url);
  }

  /**
   * Extract YouTube video data using our backend Lambda
   */
  static async extractVideoData(url: string, apiKey?: string): Promise<{
    success: boolean;
    data?: YouTubeVideoStats;
    error?: string;
  }> {
    try {
      const keyToUse = apiKey || this.getApiKey();

      if (!keyToUse) {
        return {
          success: false,
          error: 'No YouTube API key provided. Please enter your API key in settings.',
        };
      }

      const response = await fetch(`${API_URL}/extract/youtube`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          apiKey: keyToUse,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429) {
          return {
            success: false,
            error: 'YouTube API quota exceeded. Try again tomorrow or use a different API key.',
          };
        }

        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid YouTube API key. Please check your API key and try again.',
          };
        }

        return {
          success: false,
          error: result.error || result.message || 'Failed to extract YouTube data',
        };
      }

      return {
        success: true,
        data: result.data,
      };

    } catch (error) {
      console.error('YouTube extraction error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.',
      };
    }
  }

  /**
   * Test if a YouTube API key is valid
   */
  static async testApiKey(apiKey: string): Promise<boolean> {
    // Test with a well-known YouTube video ID (YouTube's own video)
    const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video
    const result = await this.extractVideoData(testUrl, apiKey);
    return result.success;
  }

  /**
   * Get instructions for obtaining a free YouTube API key
   */
  static getApiKeyInstructions(): string {
    return `
To get a FREE YouTube API key:
1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable "YouTube Data API v3"
4. Go to "Credentials" and create an API key
5. Copy the API key and paste it here

Free tier: 10,000 quota units per day (≈100 video lookups)
    `.trim();
  }
}
