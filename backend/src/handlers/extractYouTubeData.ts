/**
 * YouTube Data Extraction Lambda Handler
 *
 * Extracts view counts and engagement metrics from YouTube Shorts
 * Uses YouTube Data API v3 (FREE tier: 10,000 quota units/day)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface YouTubeVideoStats {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  thumbnailUrl: string;
}

/**
 * Extract video ID from various YouTube URL formats:
 * - https://youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID?feature=share
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Fetch video statistics from YouTube Data API
 */
async function fetchYouTubeStats(videoId: string, apiKey: string): Promise<YouTubeVideoStats> {
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorData: any = await response.json();
    throw new Error(`YouTube API error: ${errorData.error?.message || response.statusText}`);
  }

  const data: any = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found or is private');
  }

  const video = data.items[0];
  const stats = video.statistics;
  const snippet = video.snippet;

  return {
    videoId,
    title: snippet.title,
    viewCount: parseInt(stats.viewCount || '0'),
    likeCount: parseInt(stats.likeCount || '0'),
    commentCount: parseInt(stats.commentCount || '0'),
    publishedAt: snippet.publishedAt,
    thumbnailUrl: snippet.thumbnails.default.url,
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('YouTube extraction request:', {
    method: event.httpMethod,
    path: event.path,
  });

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };

  try {
    // Handle OPTIONS request (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: '',
      };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { url, apiKey } = body;

    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required field: url' }),
      };
    }

    if (!apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required field: apiKey',
          message: 'Get your free YouTube API key at https://console.cloud.google.com/'
        }),
      };
    }

    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid YouTube URL',
          message: 'Please provide a valid YouTube Shorts or video URL'
        }),
      };
    }

    // Fetch video statistics
    const stats = await fetchYouTubeStats(videoId, apiKey);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: stats,
      }),
    };

  } catch (error: any) {
    console.error('YouTube extraction error:', error);

    // Check if it's a quota exceeded error
    if (error.message?.includes('quotaExceeded')) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          error: 'YouTube API quota exceeded',
          message: 'Daily quota limit reached. Try again tomorrow or use a different API key.',
        }),
      };
    }

    // Check if it's an invalid API key error
    if (error.message?.includes('API key not valid') || error.message?.includes('invalid')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Invalid API key',
          message: 'Please check your YouTube API key and try again.',
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'An error occurred while extracting YouTube data',
        message: error.message || 'Please try again later',
      }),
    };
  }
};
