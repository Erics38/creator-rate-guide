import { collaborationsApi, CollaborationApiData } from '../api/collaborationsApi';

export interface CollaborationData {
  id: string;
  creatorName: string;
  averageViews: number;
  lowestViews: number;
  targetCPM: number;

  // Prediction data (when calculation is saved)
  projectedViews: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string;
  priceRange: {
    min: number;
    max: number;
  };
  dateCalculated: Date;

  // Actual results (when real data is added)
  actualViews?: number;
  actualPrice?: number;
  datePosted?: Date;
  notes?: string;

  // Computed fields
  accuracy?: number; // calculated when actualViews is available
}

export class UnifiedDataService {
  private static STORAGE_KEY = 'collaboration_data_unified';
  private static USE_API = true; // Toggle to enable/disable API (falls back to localStorage)

  /**
   * Save a new collaboration calculation
   * Saves to both API (primary) and localStorage (backup)
   */
  static async saveCalculation(data: Omit<CollaborationData, 'id' | 'dateCalculated' | 'accuracy'>): Promise<CollaborationData> {
    const newCollaboration: CollaborationData = {
      ...data,
      id: Date.now().toString(), // Will be replaced by backend ID
      dateCalculated: new Date(),
    };

    // Try to save to API first
    if (this.USE_API) {
      try {
        // Convert to API format
        const apiData: CollaborationApiData = {
          creatorName: data.creatorName,
          averageViews: data.averageViews,
          lowestViews: data.lowestViews,
          targetCPM: data.targetCPM,
          projectedViews: data.projectedViews,
          recommendedPrice: data.recommendedPrice,
          confidence: data.confidence,
          reasoning: data.reasoning,
          priceRange: data.priceRange,
          actualViews: data.actualViews,
          actualPrice: data.actualPrice,
          datePosted: data.datePosted?.toISOString(),
          notes: data.notes,
        };

        // Save to API
        const saved = await collaborationsApi.saveCollaboration(apiData);

        // Convert API response back to local format
        const savedCollaboration: CollaborationData = {
          id: saved.id || newCollaboration.id,
          creatorName: saved.creatorName,
          averageViews: saved.averageViews,
          lowestViews: saved.lowestViews,
          targetCPM: saved.targetCPM,
          projectedViews: saved.projectedViews,
          recommendedPrice: saved.recommendedPrice,
          confidence: saved.confidence,
          reasoning: saved.reasoning,
          priceRange: saved.priceRange,
          dateCalculated: saved.dateCalculated ? new Date(saved.dateCalculated) : new Date(),
          actualViews: saved.actualViews,
          actualPrice: saved.actualPrice,
          datePosted: saved.datePosted ? new Date(saved.datePosted) : undefined,
          notes: saved.notes,
          accuracy: saved.actualViews ? this.calculateAccuracy(saved.projectedViews, saved.actualViews) : undefined,
        };

        // Also save to localStorage as backup
        this.saveToLocalStorage(savedCollaboration);

        return savedCollaboration;

      } catch (error) {
        console.error('Failed to save to API, falling back to localStorage:', error);
        // Fall through to localStorage save
      }
    }

    // Fallback: Save to localStorage only
    const collaborations = await this.getCollaborations();
    collaborations.push(newCollaboration);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(collaborations));
    return newCollaboration;
  }

  /**
   * Get all collaborations
   * Loads from API (primary) with localStorage fallback
   */
  static async getCollaborations(): Promise<CollaborationData[]> {
    // Try to get from API first
    if (this.USE_API) {
      try {
        const apiData = await collaborationsApi.getCollaborations();

        // Convert API data to local format
        const collaborations: CollaborationData[] = apiData.map(item => ({
          id: item.id || Date.now().toString(),
          creatorName: item.creatorName,
          averageViews: item.averageViews,
          lowestViews: item.lowestViews,
          targetCPM: item.targetCPM,
          projectedViews: item.projectedViews,
          recommendedPrice: item.recommendedPrice,
          confidence: item.confidence,
          reasoning: item.reasoning,
          priceRange: item.priceRange,
          dateCalculated: item.dateCalculated ? new Date(item.dateCalculated) : new Date(),
          actualViews: item.actualViews,
          actualPrice: item.actualPrice,
          datePosted: item.datePosted ? new Date(item.datePosted) : undefined,
          notes: item.notes,
          accuracy: item.actualViews ? this.calculateAccuracy(item.projectedViews, item.actualViews) : undefined,
        }));

        // Sync to localStorage for backup
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(collaborations));

        return collaborations;

      } catch (error) {
        console.error('Failed to load from API, falling back to localStorage:', error);
        // Fall through to localStorage
      }
    }

    // Fallback: Get from localStorage
    return this.getFromLocalStorage();
  }

  /**
   * Helper: Get data from localStorage (includes migration from old formats)
   */
  private static getFromLocalStorage(): CollaborationData[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);

    // Parse existing data
    const existingData: CollaborationData[] = stored ? JSON.parse(stored).map((item: any) => ({
      ...item,
      dateCalculated: new Date(item.dateCalculated),
      datePosted: item.datePosted ? new Date(item.datePosted) : undefined,
      accuracy: item.actualViews ? this.calculateAccuracy(item.projectedViews, item.actualViews) : undefined,
    })) : [];

    // Always try to merge old data (will skip duplicates)
    const mergedData = this.mergeOldData(existingData);

    // If we merged new data, save it
    if (mergedData.length > existingData.length) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mergedData));
    }

    return mergedData;
  }

  /**
   * Helper: Save single item to localStorage
   */
  private static saveToLocalStorage(collaboration: CollaborationData): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const existing: CollaborationData[] = stored ? JSON.parse(stored) : [];

    // Check if already exists (update) or new (add)
    const index = existing.findIndex(c => c.id === collaboration.id);
    if (index !== -1) {
      existing[index] = collaboration;
    } else {
      existing.push(collaboration);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existing));
  }

  private static mergeOldData(existingData: CollaborationData[]): CollaborationData[] {
    const merged = [...existingData];
    const existingIds = new Set(existingData.map(d => d.id));
    
    // Migrate from calculation_history
    const oldCalculations = localStorage.getItem('calculation_history');
    if (oldCalculations) {
      const parsed = JSON.parse(oldCalculations);
      parsed.forEach((item: any) => {
        if (!existingIds.has(item.id)) {
          merged.push({
            id: item.id,
            creatorName: item.creatorName,
            averageViews: item.averageViews,
            lowestViews: item.lowestViews,
            targetCPM: item.targetCPM,
            projectedViews: item.projectedViews,
            recommendedPrice: item.recommendedPrice,
            confidence: item.confidence,
            reasoning: item.reasoning,
            priceRange: item.priceRange,
            dateCalculated: new Date(item.dateCalculated),
            actualViews: item.actualViews,
            actualPrice: item.actualPrice,
            datePosted: item.datePosted ? new Date(item.datePosted) : undefined,
            notes: item.notes,
            accuracy: item.actualViews ? this.calculateAccuracy(item.projectedViews, item.actualViews) : undefined,
          });
          existingIds.add(item.id);
        }
      });
    }
    
    // Migrate from influencer_historical_data (avoid duplicates by checking creator + date)
    const oldHistorical = localStorage.getItem('influencer_historical_data');
    if (oldHistorical) {
      const parsed = JSON.parse(oldHistorical);
      parsed.forEach((item: any) => {
        const exists = existingIds.has(item.id) || merged.some(m => 
          m.creatorName === item.creatorName && 
          Math.abs(new Date(m.dateCalculated).getTime() - new Date(item.date).getTime()) < 60000
        );
        
        if (!exists) {
          merged.push({
            id: item.id,
            creatorName: item.creatorName,
            averageViews: item.averageViews,
            lowestViews: item.lowestViews,
            targetCPM: item.targetCPM,
            projectedViews: item.predictedViews,
            recommendedPrice: item.paidAmount,
            confidence: item.accuracy || 60,
            reasoning: "Migrated from historical data",
            priceRange: { min: item.paidAmount * 0.8, max: item.paidAmount * 1.2 },
            dateCalculated: new Date(item.date),
            actualViews: item.actualViews,
            actualPrice: item.paidAmount,
            accuracy: item.accuracy,
          });
          existingIds.add(item.id);
        }
      });
    }
    
    return merged;
  }

  /**
   * Update an existing collaboration
   * Updates both API (primary) and localStorage (backup)
   */
  static async updateCollaboration(id: string, updates: Partial<CollaborationData>): Promise<void> {
    // Try to update via API first
    if (this.USE_API) {
      try {
        // Convert updates to API format
        const apiUpdates: Partial<CollaborationApiData> = {
          actualViews: updates.actualViews,
          actualPrice: updates.actualPrice,
          datePosted: updates.datePosted?.toISOString(),
          notes: updates.notes,
        };

        await collaborationsApi.updateCollaboration(id, apiUpdates);

        // Also update localStorage
        const collaborations = await this.getCollaborations();
        const index = collaborations.findIndex(c => c.id === id);

        if (index !== -1) {
          collaborations[index] = { ...collaborations[index], ...updates };
          // Recalculate accuracy if actualViews is being updated
          if (updates.actualViews && collaborations[index].projectedViews) {
            collaborations[index].accuracy = this.calculateAccuracy(
              collaborations[index].projectedViews,
              updates.actualViews
            );
          }
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(collaborations));
        }

        return;
      } catch (error) {
        console.error('Failed to update via API, falling back to localStorage:', error);
        // Fall through to localStorage update
      }
    }

    // Fallback: Update localStorage only
    const collaborations = await this.getCollaborations();
    const index = collaborations.findIndex(c => c.id === id);

    if (index !== -1) {
      collaborations[index] = { ...collaborations[index], ...updates };
      // Recalculate accuracy if actualViews is being updated
      if (updates.actualViews && collaborations[index].projectedViews) {
        collaborations[index].accuracy = this.calculateAccuracy(
          collaborations[index].projectedViews,
          updates.actualViews
        );
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(collaborations));
    }
  }

  /**
   * Delete a collaboration
   * Deletes from both API (primary) and localStorage (backup)
   */
  static async deleteCollaboration(id: string): Promise<void> {
    // Try to delete via API first
    if (this.USE_API) {
      try {
        await collaborationsApi.deleteCollaboration(id);

        // Also delete from localStorage
        const collaborations = await this.getCollaborations();
        const filtered = collaborations.filter(c => c.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));

        return;
      } catch (error) {
        console.error('Failed to delete via API, falling back to localStorage:', error);
        // Fall through to localStorage delete
      }
    }

    // Fallback: Delete from localStorage only
    const collaborations = await this.getCollaborations();
    const filtered = collaborations.filter(c => c.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  static async getCollaborationsByCreator(creatorName: string): Promise<CollaborationData[]> {
    const collaborations = await this.getCollaborations();
    return collaborations.filter(c =>
      c.creatorName.toLowerCase().includes(creatorName.toLowerCase())
    );
  }

  static calculateAccuracy(projected: number, actual: number): number {
    if (projected === 0) return 0;
    const difference = Math.abs(projected - actual);
    const accuracy = Math.max(0, 100 - (difference / projected) * 100);
    return Math.round(accuracy * 100) / 100;
  }

  // Enhanced prediction algorithm using unified data
  // Note: This runs LOCALLY in the browser for fast predictions
  static async getSmartProjection(averageViews: number, lowestViews: number): Promise<{
    projectedViews: number;
    confidence: number;
    reasoning: string;
  }> {
    const collaborations = await this.getCollaborations();
    const completedCollaborations = collaborations.filter(c => c.actualViews !== undefined);
    
    if (completedCollaborations.length < 3) {
      // Fallback to original algorithm
      const projectedViews = Math.round((lowestViews * 0.7) + (averageViews * 0.3));
      return {
        projectedViews,
        confidence: 60,
        reasoning: "Using base algorithm (need more completed collaborations for improved accuracy)"
      };
    }

    // Get creator performance category
    const category = this.getCreatorCategory(averageViews);
    
    // Calculate dynamic performance coefficients
    const coefficients = this.calculateDynamicCoefficients(completedCollaborations);
    
    // Find weighted similar creators with trend analysis
    const similarCreators = this.findSimilarCreators(completedCollaborations, averageViews, lowestViews);
    
    if (similarCreators.length >= 2) {
      // Use category-specific and weighted similar creators
      const weightedData = this.calculateWeightedPerformance(similarCreators);
      const trendMultiplier = this.getTrendMultiplier(similarCreators);
      
      // Use dynamic ratio instead of fixed 70/30
      const optimalRatio = coefficients.category[category] || coefficients.conservative;
      const baseProjection = Math.round((lowestViews * optimalRatio.lowest) + (averageViews * optimalRatio.average));
      const adjustedProjection = Math.round(baseProjection * weightedData.performanceRatio * trendMultiplier);
      
      return {
        projectedViews: Math.max(lowestViews * 0.5, adjustedProjection),
        confidence: Math.min(95, 65 + weightedData.confidence),
        reasoning: `${category} creator: ${similarCreators.length} similar matches, ${weightedData.confidence.toFixed(1)}% weighted accuracy, ${trendMultiplier > 1 ? 'trending up' : trendMultiplier < 1 ? 'trending down' : 'stable trend'}`
      };
    }

    // Use category-specific overall trends with confidence weighting
    const weightedOverall = this.calculateWeightedPerformance(completedCollaborations);
    const categoryData = completedCollaborations.filter(c => this.getCreatorCategory(c.averageViews) === category);
    
    const useCategory = categoryData.length >= 3;
    const targetData = useCategory ? categoryData : completedCollaborations;
    const categoryWeighted = useCategory ? this.calculateWeightedPerformance(categoryData) : weightedOverall;
    
    const optimalRatio = coefficients.category[category] || coefficients.conservative;
    const baseProjection = Math.round((lowestViews * optimalRatio.lowest) + (averageViews * optimalRatio.average));
    const adjustedProjection = Math.round(baseProjection * categoryWeighted.performanceRatio);
    
    return {
      projectedViews: Math.max(lowestViews * 0.5, adjustedProjection),
      confidence: Math.min(90, 60 + categoryWeighted.confidence),
      reasoning: useCategory 
        ? `${category} category trend: ${targetData.length} collaborations, ${categoryWeighted.confidence.toFixed(1)}% weighted accuracy`
        : `Overall trend: ${completedCollaborations.length} collaborations, ${weightedOverall.confidence.toFixed(1)}% weighted accuracy`
    };
  }

  // Helper methods (same as HistoricalDataService but adapted for unified data)
  private static getCreatorCategory(averageViews: number): 'micro' | 'mid' | 'macro' {
    if (averageViews < 50000) return 'micro';
    if (averageViews < 500000) return 'mid';
    return 'macro';
  }

  private static calculateDynamicCoefficients(collaborations: CollaborationData[]) {
    const highAccuracy = collaborations.filter(c => c.accuracy && c.accuracy > 80);
    const lowAccuracy = collaborations.filter(c => c.accuracy && c.accuracy < 60);
    
    const conservative = this.calculateOptimalRatio(highAccuracy.length > 0 ? highAccuracy : collaborations);
    const aggressive = this.calculateOptimalRatio(lowAccuracy.length > 0 ? lowAccuracy : collaborations);
    
    const categories = {
      micro: this.calculateOptimalRatio(collaborations.filter(c => this.getCreatorCategory(c.averageViews) === 'micro')),
      mid: this.calculateOptimalRatio(collaborations.filter(c => this.getCreatorCategory(c.averageViews) === 'mid')),
      macro: this.calculateOptimalRatio(collaborations.filter(c => this.getCreatorCategory(c.averageViews) === 'macro'))
    };

    return { conservative, aggressive, category: categories };
  }

  private static calculateOptimalRatio(data: CollaborationData[]) {
    if (data.length === 0) return { lowest: 0.7, average: 0.3 };
    
    let bestRatio = { lowest: 0.7, average: 0.3 };
    let bestAccuracy = 0;
    
    for (let lowestWeight = 0.4; lowestWeight <= 0.9; lowestWeight += 0.1) {
      const avgWeight = 1 - lowestWeight;
      let totalAccuracy = 0;
      
      data.forEach(collab => {
        if (collab.actualViews) {
          const wouldPredict = (collab.lowestViews * lowestWeight) + (collab.averageViews * avgWeight);
          const accuracy = this.calculateAccuracy(wouldPredict, collab.actualViews);
          totalAccuracy += accuracy;
        }
      });
      
      const avgAccuracy = totalAccuracy / data.length;
      if (avgAccuracy > bestAccuracy) {
        bestAccuracy = avgAccuracy;
        bestRatio = { lowest: lowestWeight, average: avgWeight };
      }
    }
    
    return bestRatio;
  }

  private static findSimilarCreators(collaborations: CollaborationData[], averageViews: number, lowestViews: number) {
    return collaborations.filter(c => {
      const avgDiff = Math.abs(c.averageViews - averageViews) / averageViews;
      const lowDiff = Math.abs(c.lowestViews - lowestViews) / lowestViews;
      
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

  private static calculateWeightedPerformance(collaborations: CollaborationData[]) {
    if (collaborations.length === 0) return { performanceRatio: 1, confidence: 0 };
    
    const now = new Date();
    let totalWeight = 0;
    let weightedRatio = 0;
    let weightedAccuracy = 0;
    
    collaborations.forEach(collab => {
      if (collab.actualViews && collab.accuracy) {
        const monthsOld = (now.getTime() - collab.dateCalculated.getTime()) / (1000 * 60 * 60 * 24 * 30);
        const recencyWeight = Math.max(0.1, 1 - (monthsOld / 12));
        const accuracyWeight = Math.max(0.1, collab.accuracy / 100);
        const weight = recencyWeight * accuracyWeight;
        
        const ratio = collab.projectedViews > 0 ? collab.actualViews / collab.projectedViews : 1;
        
        weightedRatio += ratio * weight;
        weightedAccuracy += collab.accuracy * weight;
        totalWeight += weight;
      }
    });
    
    return {
      performanceRatio: totalWeight > 0 ? weightedRatio / totalWeight : 1,
      confidence: totalWeight > 0 ? weightedAccuracy / totalWeight : 0
    };
  }

  private static getTrendMultiplier(collaborations: CollaborationData[]): number {
    if (collaborations.length < 4) return 1;
    
    const sorted = [...collaborations].sort((a, b) => a.dateCalculated.getTime() - b.dateCalculated.getTime());
    const recent = sorted.slice(-3);
    const older = sorted.slice(0, -3);
    
    const recentPerf = recent.reduce((sum, c) => {
      return c.actualViews ? sum + (c.actualViews / c.projectedViews) : sum;
    }, 0) / recent.length;
    
    const olderPerf = older.reduce((sum, c) => {
      return c.actualViews ? sum + (c.actualViews / c.projectedViews) : sum;
    }, 0) / older.length;
    
    const trend = recentPerf / olderPerf;
    return Math.min(1.2, Math.max(0.8, trend));
  }

  static async getInsights(): Promise<{
    totalCollaborations: number;
    completedCollaborations: number;
    pendingCollaborations: number;
    averageAccuracy: number;
    bestPerformingRange: string;
    topPerformingCreators: Array<{
      name: string;
      accuracy: number;
      collaborations: number;
    }>;
    recommendations: string[];
  }> {
    const collaborations = await this.getCollaborations();
    const completed = collaborations.filter(c => c.actualViews !== undefined);
    
    if (collaborations.length === 0) {
      return {
        totalCollaborations: 0,
        completedCollaborations: 0,
        pendingCollaborations: 0,
        averageAccuracy: 0,
        bestPerformingRange: "No data",
        topPerformingCreators: [],
        recommendations: ["Start using the calculator to track predictions"]
      };
    }

    const averageAccuracy = completed.length > 0 
      ? completed.reduce((sum, c) => sum + (c.accuracy || 0), 0) / completed.length
      : 0;

    // Group by creator for top performers
    const creatorPerformance = new Map<string, { accuracy: number; count: number; accuracies: number[] }>();
    
    completed.forEach(calc => {
      if (calc.accuracy) {
        const existing = creatorPerformance.get(calc.creatorName) || { accuracy: 0, count: 0, accuracies: [] };
        existing.accuracies.push(calc.accuracy);
        existing.count += 1;
        existing.accuracy = existing.accuracies.reduce((sum, acc) => sum + acc, 0) / existing.accuracies.length;
        creatorPerformance.set(calc.creatorName, existing);
      }
    });

    const topPerformingCreators = Array.from(creatorPerformance.entries())
      .map(([name, data]) => ({
        name,
        accuracy: Math.round(data.accuracy * 100) / 100,
        collaborations: data.count
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);

    // Find best performing view range
    const ranges = [
      { min: 0, max: 10000, name: "0-10K" },
      { min: 10000, max: 50000, name: "10K-50K" },
      { min: 50000, max: 100000, name: "50K-100K" },
      { min: 100000, max: 500000, name: "100K-500K" },
      { min: 500000, max: Infinity, name: "500K+" }
    ];

    const rangePerformance = ranges.map(range => {
      const inRange = completed.filter(c => 
        c.actualViews && c.actualViews >= range.min && c.actualViews < range.max
      );
      const avgAccuracy = inRange.length > 0 
        ? inRange.reduce((sum, c) => sum + (c.accuracy || 0), 0) / inRange.length 
        : 0;
      
      return { ...range, accuracy: avgAccuracy, count: inRange.length };
    });

    const bestRange = rangePerformance.reduce((best, current) => 
      current.accuracy > best.accuracy ? current : best
    );

    const recommendations = [];
    
    if (completed.length === 0) {
      recommendations.push("Add actual results to your predictions to enable learning");
    } else if (averageAccuracy < 70) {
      recommendations.push("Consider adjusting your prediction parameters - current accuracy is below 70%");
    }
    
    if (collaborations.length < 10) {
      recommendations.push("Keep tracking more collaborations to improve prediction accuracy");
    }

    const pendingCount = collaborations.length - completed.length;
    if (pendingCount > 5) {
      recommendations.push(`You have ${pendingCount} pending collaborations - update them with actual results`);
    }

    return {
      totalCollaborations: collaborations.length,
      completedCollaborations: completed.length,
      pendingCollaborations: pendingCount,
      averageAccuracy: Math.round(averageAccuracy * 100) / 100,
      bestPerformingRange: bestRange.name,
      topPerformingCreators,
      recommendations
    };
  }
}