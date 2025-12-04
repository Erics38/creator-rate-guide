export interface CalculationHistory {
  id: string;
  creatorName: string;
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
  actualViews?: number;
  actualPrice?: number;
  dateCalculated: Date;
  datePosted?: Date;
  notes?: string;
}

export class CalculationHistoryService {
  private static STORAGE_KEY = 'calculation_history';

  static saveCalculation(data: Omit<CalculationHistory, 'id' | 'dateCalculated'>): CalculationHistory {
    const calculations = this.getCalculations();
    
    const newCalculation: CalculationHistory = {
      ...data,
      id: Date.now().toString(),
      dateCalculated: new Date(),
    };

    calculations.push(newCalculation);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(calculations));
    return newCalculation;
  }

  static getCalculations(): CalculationHistory[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];
    
    return JSON.parse(stored).map((item: any) => ({
      ...item,
      dateCalculated: new Date(item.dateCalculated),
      datePosted: item.datePosted ? new Date(item.datePosted) : undefined,
    }));
  }

  static updateCalculation(id: string, updates: Partial<CalculationHistory>): void {
    const calculations = this.getCalculations();
    const index = calculations.findIndex(c => c.id === id);
    
    if (index !== -1) {
      calculations[index] = { ...calculations[index], ...updates };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(calculations));
    }
  }

  static deleteCalculation(id: string): void {
    const calculations = this.getCalculations();
    const filtered = calculations.filter(c => c.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  static getCalculationsByCreator(creatorName: string): CalculationHistory[] {
    return this.getCalculations().filter(c => 
      c.creatorName.toLowerCase().includes(creatorName.toLowerCase())
    );
  }

  static calculateAccuracy(projected: number, actual: number): number {
    if (projected === 0) return 0;
    const difference = Math.abs(projected - actual);
    const accuracy = Math.max(0, 100 - (difference / projected) * 100);
    return Math.round(accuracy * 100) / 100;
  }

  static getInsights(): {
    totalCalculations: number;
    averageAccuracy: number;
    completedCollaborations: number;
    pendingCollaborations: number;
    topPerformingCreators: Array<{
      name: string;
      accuracy: number;
      collaborations: number;
    }>;
  } {
    const calculations = this.getCalculations();
    const completed = calculations.filter(c => c.actualViews !== undefined);
    
    const averageAccuracy = completed.length > 0 
      ? completed.reduce((sum, c) => sum + this.calculateAccuracy(c.projectedViews, c.actualViews!), 0) / completed.length
      : 0;

    // Group by creator and calculate performance
    const creatorPerformance = new Map<string, { accuracy: number; count: number; accuracies: number[] }>();
    
    completed.forEach(calc => {
      const accuracy = this.calculateAccuracy(calc.projectedViews, calc.actualViews!);
      const existing = creatorPerformance.get(calc.creatorName) || { accuracy: 0, count: 0, accuracies: [] };
      existing.accuracies.push(accuracy);
      existing.count += 1;
      existing.accuracy = existing.accuracies.reduce((sum, acc) => sum + acc, 0) / existing.accuracies.length;
      creatorPerformance.set(calc.creatorName, existing);
    });

    const topPerformingCreators = Array.from(creatorPerformance.entries())
      .map(([name, data]) => ({
        name,
        accuracy: Math.round(data.accuracy * 100) / 100,
        collaborations: data.count
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);

    return {
      totalCalculations: calculations.length,
      averageAccuracy: Math.round(averageAccuracy * 100) / 100,
      completedCollaborations: completed.length,
      pendingCollaborations: calculations.length - completed.length,
      topPerformingCreators
    };
  }
}