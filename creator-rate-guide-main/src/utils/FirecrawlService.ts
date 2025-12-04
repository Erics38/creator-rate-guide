interface ScrapeResponse {
  success: true;
  data: {
    markdown: string;
    html: string;
    metadata: any;
  };
}

export class FirecrawlService {
  // No API key needed for built-in fetching
  static saveApiKey(_apiKey: string): void {
    // API key not needed for built-in scraping
  }

  static getApiKey(): string | null {
    return 'built-in'; // Always return a value to indicate functionality is available
  }

  static clearApiKey(): void {
    // API key not needed for built-in scraping
  }

  static async testApiKey(_apiKey: string): Promise<boolean> {
    return true; // Built-in functionality is always available
  }

  static async scrapeCreatorProfile(url: string): Promise<{ success: boolean; error?: string; data?: string }> {
    try {
      // Use the browser's fetch to call Lovable's website fetching API
      const response = await fetch('/api/lovable/website-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          format: 'markdown'
        })
      });

      if (!response.ok) {
        // If the API doesn't exist or fails, try alternative approach
        const altResponse = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
        if (altResponse.ok) {
          const data = await altResponse.text();
          return {
            success: true,
            data: data
          };
        }
        
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.content) {
        return {
          success: true,
          data: data.content
        };
      } else {
        throw new Error(data.error || 'No content returned');
      }

    } catch {
      // Return a clear error message about why real scraping failed
      return {
        success: false,
        error: `Unable to scrape data from the provided URL. Social media platforms often block automated access for privacy and security reasons.`
      };
    }
  }

  // Extract view counts from scraped content
  static extractViewCounts(markdown: string): number[] {
    const viewCounts: number[] = [];
    
    // Various patterns to match view counts on different platforms
    const patterns = [
      // Instagram, TikTok, YouTube patterns
      /(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?[KMB]?)\s*(?:views?|Views?|VIEWS?)/gi,
      /(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?[KMB]?)\s*(?:visualizações|visualizations)/gi,
      // Number + K/M/B pattern
      /(\d+(?:\.\d+)?[KMB])\s*(?:views?|Views?)/gi,
    ];

    patterns.forEach(pattern => {
      const matches = markdown.matchAll(pattern);
      for (const match of matches) {
        const viewStr = match[1];
        const viewCount = this.parseViewCount(viewStr);
        if (viewCount > 0) {
          viewCounts.push(viewCount);
        }
      }
    });

    // Remove duplicates and sort
    const uniqueViews = [...new Set(viewCounts)].sort((a, b) => b - a);
    
    // Return the most recent 30 (or fewer)
    return uniqueViews.slice(0, 30);
  }

  private static parseViewCount(viewStr: string): number {
    // Remove commas and convert to lowercase
    const clean = viewStr.replace(/,/g, '').toLowerCase();
    
    if (clean.includes('k')) {
      return Math.round(parseFloat(clean.replace('k', '')) * 1000);
    }
    if (clean.includes('m')) {
      return Math.round(parseFloat(clean.replace('m', '')) * 1000000);
    }
    if (clean.includes('b')) {
      return Math.round(parseFloat(clean.replace('b', '')) * 1000000000);
    }
    
    return parseInt(clean) || 0;
  }
}