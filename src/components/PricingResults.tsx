import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Eye, Target, Brain } from "lucide-react";

interface PricingData {
  averageViews: number;
  lowestViews: number;
  targetCPM: number;
  projectedViews: number;
  recommendedPrice: number;
  confidence?: number;
  reasoning?: string;
  priceRange: {
    min: number;
    max: number;
  };
}

interface PricingResultsProps {
  data: PricingData;
}

export const PricingResults = ({ data }: PricingResultsProps) => {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const calculateEffectiveCPM = () => {
    return ((data.recommendedPrice / data.projectedViews) * 1000).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <Card className="shadow-medium border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Target className="h-5 w-5" />
            Recommended Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="mb-2 text-3xl font-bold text-foreground">
              {formatCurrency(data.recommendedPrice)}
            </div>
            <p className="text-muted-foreground">
              Based on {formatNumber(data.projectedViews)} projected views
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                Effective CPM: ${calculateEffectiveCPM()}
              </Badge>
              {data.confidence && (
                <Badge 
                  variant="secondary" 
                  className={`${
                    data.confidence >= 80 
                      ? 'bg-success/10 text-success border-success/20' 
                      : data.confidence >= 60 
                        ? 'bg-warning/10 text-warning border-warning/20'
                        : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  <Brain className="h-3 w-3 mr-1" />
                  {data.confidence.toFixed(0)}% Confidence
                </Badge>
              )}
            </div>
            {data.reasoning && (
              <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>AI Reasoning:</strong> {data.reasoning}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Price Range */}
      <Card className="shadow-soft">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Negotiation Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {formatCurrency(data.priceRange.min)}
              </div>
              <p className="text-xs text-muted-foreground">Minimum</p>
            </div>
            <div className="flex-1 mx-4">
              <div className="h-2 bg-muted rounded-full relative">
                <div className="h-2 bg-gradient-primary rounded-full w-full"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 bg-primary rounded-full border-2 border-background"></div>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {formatCurrency(data.priceRange.max)}
              </div>
              <p className="text-xs text-muted-foreground">Maximum</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Breakdown */}
      <Card className="shadow-soft">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Calculation Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Average Views</span>
              <span className="font-medium">{formatNumber(data.averageViews)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Lowest Views</span>
              <span className="font-medium">{formatNumber(data.lowestViews)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Projected Views</span>
              <span className="font-medium text-primary">{formatNumber(data.projectedViews)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Target CPM</span>
              <span className="font-medium">${data.targetCPM}</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Algorithm:</strong> Uses 70% weight on lowest views + 30% weight on average views for conservative, realistic projections.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};