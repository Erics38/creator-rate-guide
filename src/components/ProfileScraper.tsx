import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Globe, TrendingDown, AlertCircle, Youtube } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { FirecrawlService } from "@/utils/FirecrawlService";
import { YouTubeService } from "@/utils/YouTubeService";

interface ScrapingResultsProps {
  onViewsExtracted: (average: number, lowest: number) => void;
}

export const ProfileScraper = ({ onViewsExtracted }: ScrapingResultsProps) => {
  const [profileUrl, setProfileUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [extractedData, setExtractedData] = useState<{viewCounts: number[], average: number, lowest: number} | null>(null);
  const { toast } = useToast();

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Firecrawl API key",
        variant: "destructive",
      });
      return;
    }

    const isValid = await FirecrawlService.testApiKey(apiKey);
    if (isValid) {
      FirecrawlService.saveApiKey(apiKey);
      setShowApiKeyInput(false);
      toast({
        title: "Success",
        description: "API key saved successfully",
      });
    } else {
      toast({
        title: "Error",
        description: "Invalid API key. Please check and try again.",
        variant: "destructive",
      });
    }
  };

  const handleScrape = async () => {
    if (!profileUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a profile URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await FirecrawlService.scrapeCreatorProfile(profileUrl);
      
      if (result.success && result.data) {
        const viewCounts = FirecrawlService.extractViewCounts(result.data);
        
        if (viewCounts.length === 0) {
          toast({
            title: "No Data Found",
            description: "Could not extract view counts from this profile. Try a different URL or platform.",
            variant: "destructive",
          });
          return;
        }

        const average = Math.round(viewCounts.reduce((sum, views) => sum + views, 0) / viewCounts.length);
        const lowest = Math.min(...viewCounts);

        setExtractedData({ viewCounts, average, lowest });
        onViewsExtracted(average, lowest);
        
        toast({
          title: "Success",
          description: `Extracted ${viewCounts.length} posts. Average: ${average.toLocaleString()}, Lowest: ${lowest.toLocaleString()}`,
        });
      } else {
        toast({
          title: "Scraping Failed",
          description: result.error || "Failed to scrape profile",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showApiKeyInput) {
    return (
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Setup Auto-Scraping
          </CardTitle>
        <CardDescription>
          Built-in scraping is available - no API key required
        </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Firecrawl API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="fc-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Built-in scraping functionality - no external API required
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleApiKeySubmit} className="flex-1">
              Save API Key
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowApiKeyInput(false)}
              className="px-6"
            >
              Skip for Now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Auto-Extract Views
            </CardTitle>
            <CardDescription>
              Automatically scrape view counts from creator profiles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-url">Creator Profile URL</Label>
              <Input
                id="profile-url"
                type="url"
                placeholder="https://instagram.com/creator or https://tiktok.com/@creator"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleScrape}
                disabled={isLoading || !profileUrl.trim()}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <TrendingDown className="mr-2 h-4 w-4" />
                    Extract Views
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowApiKeyInput(true)}
                className="px-6"
              >
                Settings
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Supports Instagram, TikTok, YouTube, and other major platforms. 
                The tool will analyze recent posts to find view counts automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {extractedData && (
        <div className="w-80">
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="text-lg">Extracted Data</CardTitle>
              <CardDescription>View counts from recent posts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <div className="text-sm text-muted-foreground">Average Views</div>
                  <div className="text-xl font-bold text-primary">{extractedData.average.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <div className="text-sm text-muted-foreground">Lowest Views</div>
                  <div className="text-xl font-bold text-destructive">{extractedData.lowest.toLocaleString()}</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">All View Counts ({extractedData.viewCounts.length} posts)</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {extractedData.viewCounts.map((views, index) => (
                    <div 
                      key={index} 
                      className={`text-sm p-2 rounded ${views === extractedData.lowest ? 'bg-destructive/20 text-destructive font-medium' : 'bg-muted/50'}`}
                    >
                      Post {index + 1}: {views.toLocaleString()} views
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};