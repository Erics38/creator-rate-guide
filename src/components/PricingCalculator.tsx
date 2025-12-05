import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calculator, TrendingUp, DollarSign, Eye, Brain, History, Save, User } from "lucide-react";
import { PricingResults } from "./PricingResults";
import { ProfileScraper } from "./ProfileScraper";
import { UnifiedDataService } from "@/utils/UnifiedDataService";
import { UnifiedCollaborationHistory } from "@/components/UnifiedCollaborationHistory";
import { useToast } from "@/hooks/use-toast";

interface PricingData {
  averageViews: number;
  lowestViews: number;
  targetCPM: number;
  projectedViews: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string;
  priceRange: {
    min: number;
    max: number;
  };
}

export const PricingCalculator = () => {
  const [averageViews, setAverageViews] = useState<string>("");
  const [lowestViews, setLowestViews] = useState<string>("");
  const [targetCPM, setTargetCPM] = useState<string>("20");
  const [results, setResults] = useState<PricingData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Force refresh when historical data updates
  const handleDataUpdate = () => {
    setRefreshKey(prev => prev + 1);
    if (results) {
      calculatePricing(); // Recalculate with new historical data
    }
  };

  const handleViewsExtracted = (average: number, lowest: number) => {
    setAverageViews(average.toString());
    setLowestViews(lowest.toString());
  };

  const calculatePricing = async () => {
    const avgViews = parseFloat(averageViews);
    const lowViews = parseFloat(lowestViews);
    const cpm = parseFloat(targetCPM);

    if (!avgViews || !lowViews || !cpm) return;

    setIsCalculating(true);
    try {
      // Use enhanced algorithm with historical data (runs locally in browser)
      const smartProjection = await UnifiedDataService.getSmartProjection(avgViews, lowViews);

      // Calculate recommended price based on smart projected views
      const recommendedPrice = Math.round((smartProjection.projectedViews / 1000) * cpm);

      // Create a narrower range around the recommended price (±15% for high confidence, ±25% for low)
      const rangeVariation = smartProjection.confidence > 75 ? 0.15 : 0.25;
      const minPrice = Math.round(recommendedPrice * (1 - rangeVariation));
      const maxPrice = Math.round(recommendedPrice * (1 + rangeVariation));

      setResults({
        averageViews: avgViews,
        lowestViews: lowViews,
        targetCPM: cpm,
        projectedViews: smartProjection.projectedViews,
        confidence: smartProjection.confidence,
        reasoning: smartProjection.reasoning,
        recommendedPrice,
        priceRange: {
          min: minPrice,
          max: maxPrice,
        },
      });
    } catch (error) {
      console.error('Error calculating pricing:', error);
      toast({
        title: "Calculation Error",
        description: "Failed to calculate pricing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const clearForm = () => {
    setAverageViews("");
    setLowestViews("");
    setTargetCPM("20");
    setResults(null);
    setCreatorName("");
  };

  const handleSaveCalculation = async () => {
    if (!results) return;

    const name = creatorName.trim();
    if (!name) {
      toast({
        title: "Missing Information",
        description: "Please enter a creator name before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await UnifiedDataService.saveCalculation({
        creatorName: name,
        averageViews: results.averageViews,
        lowestViews: results.lowestViews,
        targetCPM: results.targetCPM,
        projectedViews: results.projectedViews,
        recommendedPrice: results.recommendedPrice,
        confidence: results.confidence,
        reasoning: results.reasoning,
        priceRange: results.priceRange,
      });

      toast({
        title: "Calculation Saved",
        description: `Saved calculation for ${name} to cloud database`,
      });

      setIsSaveDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error saving calculation:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save to cloud. Saved locally as backup.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-gradient-primary p-3">
              <Calculator className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mb-2 text-4xl font-bold text-foreground">
            Influencer Pricing Calculator
          </h1>
          <p className="text-lg text-muted-foreground">
            Smart pricing with auto-scraping and historical data learning
          </p>
        </div>

        <Tabs defaultValue="calculator" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calculator" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Calculator
            </TabsTrigger>
            <TabsTrigger value="scraper" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Auto-Extract
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Collaboration History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="space-y-6">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Input Form */}
              <Card className="shadow-medium">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Creator Metrics
                  </CardTitle>
                  <CardDescription>
                    Enter the creator's performance data to calculate fair pricing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="creator-name" className="text-sm font-medium">
                      Creator Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="creator-name"
                        type="text"
                        placeholder="e.g., @influencer_name"
                        value={creatorName}
                        onChange={(e) => setCreatorName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="average-views" className="text-sm font-medium">
                      Average Views (Last 20-30 Posts)
                    </Label>
                    <div className="relative">
                      <Eye className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="average-views"
                        type="number"
                        placeholder="e.g., 15000"
                        value={averageViews}
                        onChange={(e) => setAverageViews(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lowest-views" className="text-sm font-medium">
                      Lowest Views (Recent Posts)
                    </Label>
                    <div className="relative">
                      <Eye className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="lowest-views"
                        type="number"
                        placeholder="e.g., 8000"
                        value={lowestViews}
                        onChange={(e) => setLowestViews(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target-cpm" className="text-sm font-medium">
                      Target CPM ($)
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="target-cpm"
                        type="number"
                        step="0.01"
                        placeholder="20.00"
                        value={targetCPM}
                        onChange={(e) => setTargetCPM(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4">
                    <div className="flex gap-3">
                      <Button
                        onClick={calculatePricing}
                        className="flex-1 bg-gradient-primary text-primary-foreground hover:opacity-90"
                        disabled={!averageViews || !lowestViews || !targetCPM || isCalculating}
                      >
                        {isCalculating ? "Calculating..." : "Calculate Pricing"}
                      </Button>
                      {results && creatorName.trim() && (
                        <Button
                          onClick={handleSaveCalculation}
                          variant="outline"
                          className="px-6"
                          disabled={isSaving}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                      )}
                      {results && !creatorName.trim() && (
                        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="px-6">
                              <Save className="w-4 h-4 mr-2" />
                              Save
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Save Calculation</DialogTitle>
                              <DialogDescription>
                                Enter the creator's name to save this calculation for future reference.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="save-creator-name">Creator Name</Label>
                                <div className="relative">
                                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    id="save-creator-name"
                                    placeholder="e.g., @influencer_name"
                                    value={creatorName}
                                    onChange={(e) => setCreatorName(e.target.value)}
                                    className="pl-10"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-3 pt-4">
                                <Button onClick={handleSaveCalculation} className="flex-1" disabled={isSaving}>
                                  {isSaving ? "Saving..." : "Save Calculation"}
                                </Button>
                                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)} disabled={isSaving}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    <Button
                      onClick={clearForm}
                      variant="outline"
                      className="w-full"
                    >
                      Clear All Fields
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Results */}
              {results ? (
                <PricingResults data={results} />
              ) : (
                <Card className="shadow-medium">
                  <CardContent className="flex h-full items-center justify-center p-12">
                    <div className="text-center">
                      <div className="mb-4 rounded-full bg-muted p-4 inline-block">
                        <Calculator className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-foreground">
                        Ready to Calculate
                      </h3>
                      <p className="text-muted-foreground">
                        Enter creator metrics to see pricing recommendations
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="scraper">
            <div className="grid gap-8 lg:grid-cols-2">
              <ProfileScraper onViewsExtracted={handleViewsExtracted} />
              <Card className="shadow-medium">
                <CardContent className="flex h-full items-center justify-center p-12">
                  <div className="text-center">
                    <div className="mb-4 rounded-full bg-muted p-4 inline-block">
                      <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                      Auto-Extract View Data
                    </h3>
                    <p className="text-muted-foreground">
                      Enter a creator's profile URL to automatically extract view counts
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <UnifiedCollaborationHistory refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};