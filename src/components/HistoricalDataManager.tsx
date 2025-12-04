import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, History, Trash2, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { HistoricalDataService, type HistoricalData } from "@/utils/HistoricalDataService";

interface HistoricalDataManagerProps {
  onDataUpdate: () => void;
}

export const HistoricalDataManager = ({ onDataUpdate }: HistoricalDataManagerProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    creatorName: "",
    averageViews: "",
    lowestViews: "",
    predictedViews: "",
    actualViews: "",
    targetCPM: "20",
    paidAmount: "",
  });
  const { toast } = useToast();

  const collaborations = HistoricalDataService.getCollaborations();
  const insights = HistoricalDataService.getInsights();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      creatorName: formData.creatorName,
      averageViews: parseFloat(formData.averageViews),
      lowestViews: parseFloat(formData.lowestViews),
      predictedViews: parseFloat(formData.predictedViews),
      actualViews: parseFloat(formData.actualViews),
      targetCPM: parseFloat(formData.targetCPM),
      paidAmount: parseFloat(formData.paidAmount),
      date: new Date(),
    };

    const saved = HistoricalDataService.saveCollaboration(data);
    
    setFormData({
      creatorName: "",
      averageViews: "",
      lowestViews: "",
      predictedViews: "",
      actualViews: "",
      targetCPM: "20",
      paidAmount: "",
    });
    
    setIsDialogOpen(false);
    onDataUpdate();
    
    toast({
      title: "Collaboration Added",
      description: `Added ${saved.creatorName} with ${saved.accuracy.toFixed(1)}% prediction accuracy`,
    });
  };

  const handleDelete = (id: string) => {
    HistoricalDataService.deleteCollaboration(id);
    onDataUpdate();
    toast({
      title: "Collaboration Deleted",
      description: "Historical data has been removed",
    });
  };

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historical Data
            </CardTitle>
            <CardDescription>
              Track past collaborations to improve predictions
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Add Collaboration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Historical Collaboration</DialogTitle>
                <DialogDescription>
                  Add data from a completed partnership to improve future predictions
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="creator-name">Creator Name</Label>
                    <Input
                      id="creator-name"
                      value={formData.creatorName}
                      onChange={(e) => setFormData(prev => ({ ...prev, creatorName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="avg-views">Average Views</Label>
                    <Input
                      id="avg-views"
                      type="number"
                      value={formData.averageViews}
                      onChange={(e) => setFormData(prev => ({ ...prev, averageViews: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="low-views">Lowest Views</Label>
                    <Input
                      id="low-views"
                      type="number"
                      value={formData.lowestViews}
                      onChange={(e) => setFormData(prev => ({ ...prev, lowestViews: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="predicted-views">Predicted Views</Label>
                    <Input
                      id="predicted-views"
                      type="number"
                      value={formData.predictedViews}
                      onChange={(e) => setFormData(prev => ({ ...prev, predictedViews: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="actual-views">Actual Views</Label>
                    <Input
                      id="actual-views"
                      type="number"
                      value={formData.actualViews}
                      onChange={(e) => setFormData(prev => ({ ...prev, actualViews: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-cpm">Target CPM ($)</Label>
                    <Input
                      id="target-cpm"
                      type="number"
                      step="0.01"
                      value={formData.targetCPM}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetCPM: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="paid-amount">Amount Paid ($)</Label>
                    <Input
                      id="paid-amount"
                      type="number"
                      value={formData.paidAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, paidAmount: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1">
                    Add Collaboration
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {collaborations.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No historical data yet. Add past collaborations to improve predictions.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Insights Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total Collaborations</p>
                <p className="text-xl font-bold">{insights.totalCollaborations}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Accuracy</p>
                <p className="text-xl font-bold text-primary">{insights.averageAccuracy.toFixed(1)}%</p>
              </div>
            </div>

            {/* Recent Collaborations */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Recent Collaborations</h4>
              {collaborations.slice(-5).reverse().map((collab) => (
                <div key={collab.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{collab.creatorName}</p>
                    <p className="text-sm text-muted-foreground">
                      Predicted: {collab.predictedViews.toLocaleString()} → Actual: {collab.actualViews.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right mr-3">
                    <p className={`text-sm font-medium ${collab.accuracy >= 80 ? 'text-success' : collab.accuracy >= 60 ? 'text-warning' : 'text-destructive'}`}>
                      {collab.accuracy.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">accuracy</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(collab.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};