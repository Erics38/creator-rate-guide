export interface HistoricalData {
  id: string;
  creatorName: string;
  averageViews: number;
  lowestViews: number;
  predictedViews: number;
  actualViews: number;
  targetCPM: number;
  paidAmount: number;
  date: Date;
  accuracy: number; // how close prediction was to actual
}

export class HistoricalDataService {
  private static STORAGE_KEY = 'influencer_historical_data';

  static saveCollaboration(data: Omit<HistoricalData, 'id' | 'accuracy'>): HistoricalData {
    const collaborations = this.getCollaborations();
    const accuracy = this.calculateAccuracy(data.predictedViews, data.actualViews);
    
    const newData: HistoricalData = {
      ...data,
      id: Date.now().toString(),
      accuracy,
    };

    collaborations.push(newData);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(collaborations));
    return newData;
  }

  static getCollaborations(): HistoricalData[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];
    
    return JSON.parse(stored).map((item: any) => ({
      ...item,
      date: new Date(item.date),
    }));
  }

  static deleteCollaboration(id: string): void {
    const collaborations = this.getCollaborations();
    const filtered = collaborations.filter(c => c.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  static calculateAccuracy(predicted: number, actual: number): number {
    if (predicted === 0) return 0;
    const difference = Math.abs(predicted - actual);
    const accuracy = Math.max(0, 100 - (difference / predicted) * 100);
    return Math.round(accuracy * 100) / 100;
  }

  // Enhanced prediction algorithm using historical data with dynamic coefficients
  static getSmartProjection(averageViews: number, lowestViews: number): {
    projectedViews: number;
    confidence: number;
    reasoning: string;
  } {
    const collaborations = this.getCollaborations();
    
    if (collaborations.length < 3) {
      // Fallback to original algorithm
      const projectedViews = Math.round((lowestViews * 0.7) + (averageViews * 0.3));
      return {
        projectedViews,
        confidence: 60,
        reasoning: "Using base algorithm (need more historical data for improved accuracy)"
      };
    }

    // Get creator performance category
    const category = this.getCreatorCategory(averageViews);
    
    // Calculate dynamic performance coefficients
    const coefficients = this.calculateDynamicCoefficients(collaborations);
    
    // Find weighted similar creators with trend analysis
    const similarCreators = this.findSimilarCreators(collaborations, averageViews, lowestViews);
    
    if (similarCreators.length >= 2) {
      // Use category-specific and weighted similar creators
      const weightedData = this.calculateWeightedPerformance(similarCreators);
      const trendMultiplier = this.getTrendMultiplier(similarCreators);
      
      // Use dynamic ratio instead of fixed 70/30
      const optimalRatio = coefficients.category[category] || coefficients.conservative;
      const baseProjection = Math.round((lowestViews * optimalRatio.lowest) + (averageViews * optimalRatio.average));
      const adjustedProjection = Math.round(baseProjection * weightedData.performanceRatio * trendMultiplier);
      
      return {
        projectedViews: Math.max(lowestViews * 0.5, adjustedProjection), // Sanity check: never less than 50% of lowest
        confidence: Math.min(95, 65 + weightedData.confidence),
        reasoning: `${category} creator: ${similarCreators.length} similar matches, ${weightedData.confidence.toFixed(1)}% weighted accuracy, ${trendMultiplier > 1 ? 'trending up' : trendMultiplier < 1 ? 'trending down' : 'stable trend'}`
      };
    }

    // Use category-specific overall trends with confidence weighting
    const weightedOverall = this.calculateWeightedPerformance(collaborations);
    const categoryData = collaborations.filter(c => this.getCreatorCategory(c.averageViews) === category);
    
    const useCategory = categoryData.length >= 3;
    const targetData = useCategory ? categoryData : collaborations;
    const categoryWeighted = useCategory ? this.calculateWeightedPerformance(categoryData) : weightedOverall;
    
    const optimalRatio = coefficients.category[category] || coefficients.conservative;
    const baseProjection = Math.round((lowestViews * optimalRatio.lowest) + (averageViews * optimalRatio.average));
    const adjustedProjection = Math.round(baseProjection * categoryWeighted.performanceRatio);
    
    return {
      projectedViews: Math.max(lowestViews * 0.5, adjustedProjection),
      confidence: Math.min(90, 60 + categoryWeighted.confidence),
      reasoning: useCategory 
        ? `${category} category trend: ${targetData.length} collaborations, ${categoryWeighted.confidence.toFixed(1)}% weighted accuracy`
        : `Overall trend: ${collaborations.length} collaborations, ${weightedOverall.confidence.toFixed(1)}% weighted accuracy`
    };
  }

  // Categorize creators by view ranges for better predictions
  private static getCreatorCategory(averageViews: number): 'micro' | 'mid' | 'macro' {
    if (averageViews < 50000) return 'micro';
    if (averageViews < 500000) return 'mid';
    return 'macro';
  }

  // Calculate dynamic performance coefficients from historical data
  private static calculateDynamicCoefficients(collaborations: HistoricalData[]) {
    const highAccuracy = collaborations.filter(c => c.accuracy > 80);
    const lowAccuracy = collaborations.filter(c => c.accuracy < 60);
    
    // Calculate optimal ratios for different accuracy levels
    const conservative = this.calculateOptimalRatio(highAccuracy.length > 0 ? highAccuracy : collaborations);
    const aggressive = this.calculateOptimalRatio(lowAccuracy.length > 0 ? lowAccuracy : collaborations);
    
    // Category-specific coefficients
    const categories = {
      micro: this.calculateOptimalRatio(collaborations.filter(c => this.getCreatorCategory(c.averageViews) === 'micro')),
      mid: this.calculateOptimalRatio(collaborations.filter(c => this.getCreatorCategory(c.averageViews) === 'mid')),
      macro: this.calculateOptimalRatio(collaborations.filter(c => this.getCreatorCategory(c.averageViews) === 'macro'))
    };

    return {
      conservative,
      aggressive,
      category: categories
    };
  }

  // Calculate optimal lowest/average ratio from performance data
  private static calculateOptimalRatio(data: HistoricalData[]) {
    if (data.length === 0) return { lowest: 0.7, average: 0.3 };
    
    // Analyze what ratio would have given best predictions
    let bestRatio = { lowest: 0.7, average: 0.3 };
    let bestAccuracy = 0;
    
    // Test different ratios
    for (let lowestWeight = 0.4; lowestWeight <= 0.9; lowestWeight += 0.1) {
      const avgWeight = 1 - lowestWeight;
      let totalAccuracy = 0;
      
      data.forEach(collab => {
        const wouldPredict = (collab.lowestViews * lowestWeight) + (collab.averageViews * avgWeight);
        const accuracy = this.calculateAccuracy(wouldPredict, collab.actualViews);
        totalAccuracy += accuracy;
      });
      
      const avgAccuracy = totalAccuracy / data.length;
      if (avgAccuracy > bestAccuracy) {
        bestAccuracy = avgAccuracy;
        bestRatio = { lowest: lowestWeight, average: avgWeight };
      }
    }
    
    return bestRatio;
  }

  // Find similar creators with improved matching
  private static findSimilarCreators(collaborations: HistoricalData[], averageViews: number, lowestViews: number) {
    return collaborations.filter(c => {
      // Multi-tier similarity matching
      const avgDiff = Math.abs(c.averageViews - averageViews) / averageViews;
      const lowDiff = Math.abs(c.lowestViews - lowestViews) / lowestViews;
      
      // Tight match (±20%) or loose match (±40%) if few tight matches
      const tightMatch = avgDiff <= 0.2 && lowDiff <= 0.2;
      const looseMatch = avgDiff <= 0.4 && lowDiff <= 0.4;
      
      const tightMatches = collaborations.filter(tc => {
        const tAvgDiff = Math.abs(tc.averageViews - averageViews) / averageViews;
        const tLowDiff = Math.abs(tc.lowestViews - lowestViews) / lowestViews;
        return tAvgDiff <= 0.2 && tLowDiff <= 0.2;
      });
      
      return tightMatches.length >= 3 ? tightMatch : looseMatch;
    });
  }

  // Calculate weighted performance with recency and accuracy weighting
  private static calculateWeightedPerformance(collaborations: HistoricalData[]) {
    if (collaborations.length === 0) return { performanceRatio: 1, confidence: 0 };
    
    const now = new Date();
    let totalWeight = 0;
    let weightedRatio = 0;
    let weightedAccuracy = 0;
    
    collaborations.forEach(collab => {
      const monthsOld = (now.getTime() - collab.date.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const recencyWeight = Math.max(0.1, 1 - (monthsOld / 12)); // Decay over 12 months
      const accuracyWeight = Math.max(0.1, collab.accuracy / 100);
      const weight = recencyWeight * accuracyWeight;
      
      const ratio = collab.predictedViews > 0 ? collab.actualViews / collab.predictedViews : 1;
      
      weightedRatio += ratio * weight;
      weightedAccuracy += collab.accuracy * weight;
      totalWeight += weight;
    });
    
    return {
      performanceRatio: totalWeight > 0 ? weightedRatio / totalWeight : 1,
      confidence: totalWeight > 0 ? weightedAccuracy / totalWeight : 0
    };
  }

  // Get trend multiplier based on recent performance
  private static getTrendMultiplier(collaborations: HistoricalData[]): number {
    if (collaborations.length < 4) return 1;
    
    const sorted = [...collaborations].sort((a, b) => a.date.getTime() - b.date.getTime());
    const recent = sorted.slice(-3);
    const older = sorted.slice(0, -3);
    
    const recentPerf = recent.reduce((sum, c) => sum + (c.actualViews / c.predictedViews), 0) / recent.length;
    const olderPerf = older.reduce((sum, c) => sum + (c.actualViews / c.predictedViews), 0) / older.length;
    
    const trend = recentPerf / olderPerf;
    
    // Cap the trend impact to ±20%
    return Math.min(1.2, Math.max(0.8, trend));
  }

  static getInsights(): {
    totalCollaborations: number;
    averageAccuracy: number;
    bestPerformingRange: string;
    recommendations: string[];
  } {
    const collaborations = this.getCollaborations();
    
    if (collaborations.length === 0) {
      return {
        totalCollaborations: 0,
        averageAccuracy: 0,
        bestPerformingRange: "No data",
        recommendations: ["Add historical collaboration data to improve predictions"]
      };
    }

    const averageAccuracy = collaborations.reduce((sum, c) => sum + c.accuracy, 0) / collaborations.length;
    
    // Find best performing view range
    const ranges = [
      { min: 0, max: 10000, name: "0-10K" },
      { min: 10000, max: 50000, name: "10K-50K" },
      { min: 50000, max: 100000, name: "50K-100K" },
      { min: 100000, max: 500000, name: "100K-500K" },
      { min: 500000, max: Infinity, name: "500K+" }
    ];

    const rangePerformance = ranges.map(range => {
      const inRange = collaborations.filter(c => 
        c.actualViews >= range.min && c.actualViews < range.max
      );
      const avgAccuracy = inRange.length > 0 
        ? inRange.reduce((sum, c) => sum + c.accuracy, 0) / inRange.length 
        : 0;
      
      return { ...range, accuracy: avgAccuracy, count: inRange.length };
    });

    const bestRange = rangePerformance.reduce((best, current) => 
      current.accuracy > best.accuracy ? current : best
    );

    const recommendations = [];
    
    if (averageAccuracy < 70) {
      recommendations.push("Consider adjusting your prediction algorithm - current accuracy is below 70%");
    }
    
    if (collaborations.length < 10) {
      recommendations.push("Add more historical data to improve prediction accuracy");
    }

    const recentCollabs = collaborations.slice(-5);
    const recentAccuracy = recentCollabs.reduce((sum, c) => sum + c.accuracy, 0) / recentCollabs.length;
    
    if (recentAccuracy > averageAccuracy + 10) {
      recommendations.push("Your recent predictions are improving - keep using current approach");
    } else if (recentAccuracy < averageAccuracy - 10) {
      recommendations.push("Recent predictions are less accurate - consider reviewing your method");
    }

    return {
      totalCollaborations: collaborations.length,
      averageAccuracy: Math.round(averageAccuracy * 100) / 100,
      bestPerformingRange: bestRange.name,
      recommendations
    };
  }
}