import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, User, Eye, DollarSign, TrendingUp, Edit, Trash2, CheckCircle, Clock, Target } from "lucide-react";
import { CalculationHistoryService, CalculationHistory } from "@/utils/CalculationHistoryService";
import { format } from "date-fns";

interface CalculationHistoryProps {
  refreshKey?: number;
}

export const CalculationHistoryComponent = ({ refreshKey }: CalculationHistoryProps) => {
  const [calculations, setCalculations] = useState<CalculationHistory[]>([]);
  const [selectedCalculation, setSelectedCalculation] = useState<CalculationHistory | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form state for editing
  const [actualViews, setActualViews] = useState("");
  const [actualPrice, setActualPrice] = useState("");
  const [datePosted, setDatePosted] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadCalculations();
  }, [refreshKey]);

  const loadCalculations = () => {
    const data = CalculationHistoryService.getCalculations();
    setCalculations(data.sort((a, b) => b.dateCalculated.getTime() - a.dateCalculated.getTime()));
  };

  const filteredCalculations = calculations.filter(calc => 
    calc.creatorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditCalculation = (calculation: CalculationHistory) => {
    setSelectedCalculation(calculation);
    setActualViews(calculation.actualViews?.toString() || "");
    setActualPrice(calculation.actualPrice?.toString() || "");
    setDatePosted(calculation.datePosted ? format(calculation.datePosted, "yyyy-MM-dd") : "");
    setNotes(calculation.notes || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCalculation) return;

    const updates: Partial<CalculationHistory> = {
      actualViews: actualViews ? parseFloat(actualViews) : undefined,
      actualPrice: actualPrice ? parseFloat(actualPrice) : undefined,
      datePosted: datePosted ? new Date(datePosted) : undefined,
      notes: notes || undefined,
    };

    CalculationHistoryService.updateCalculation(selectedCalculation.id, updates);
    loadCalculations();
    setIsEditDialogOpen(false);
  };

  const handleDeleteCalculation = (id: string) => {
    CalculationHistoryService.deleteCalculation(id);
    loadCalculations();
  };

  const getAccuracy = (calculation: CalculationHistory) => {
    if (!calculation.actualViews) return null;
    return CalculationHistoryService.calculateAccuracy(calculation.projectedViews, calculation.actualViews);
  };

  const getStatusBadge = (calculation: CalculationHistory) => {
    if (calculation.actualViews !== undefined) {
      const accuracy = getAccuracy(calculation);
      if (accuracy && accuracy >= 80) {
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Excellent</Badge>;
      } else if (accuracy && accuracy >= 60) {
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Target className="w-3 h-3 mr-1" />Good</Badge>;
      } else {
        return <Badge className="bg-red-100 text-red-800 border-red-200"><TrendingUp className="w-3 h-3 mr-1" />Needs Review</Badge>;
      }
    }
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Calculation History</h2>
          <p className="text-muted-foreground">Track your pricing calculations and compare with actual results</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Search by Creator Name</Label>
          <Input
            id="search"
            placeholder="Search creators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Calculations List */}
      <div className="space-y-4">
        {filteredCalculations.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No calculations yet</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "No calculations found for this search." : "Start calculating pricing to see your history here."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredCalculations.map((calculation) => (
            <Card key={calculation.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {calculation.creatorName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(calculation.dateCalculated, "MMM d, yyyy")}
                      </span>
                      {calculation.datePosted && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Posted {format(calculation.datePosted, "MMM d, yyyy")}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(calculation)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCalculation(calculation)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Calculation</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this calculation for {calculation.creatorName}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCalculation(calculation.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Projected Views</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {calculation.projectedViews.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Recommended Price</p>
                    <p className="font-semibold flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${calculation.recommendedPrice}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="font-semibold">{calculation.confidence}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Target CPM</p>
                    <p className="font-semibold">${calculation.targetCPM}</p>
                  </div>
                </div>

                {calculation.actualViews && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Actual Views</p>
                        <p className="font-semibold text-green-600">
                          {calculation.actualViews.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Actual Price</p>
                        <p className="font-semibold text-green-600">
                          ${calculation.actualPrice || 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Accuracy</p>
                        <p className="font-semibold">
                          {getAccuracy(calculation)?.toFixed(1)}%
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Difference</p>
                        <p className={`font-semibold ${
                          calculation.actualViews > calculation.projectedViews 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {calculation.actualViews > calculation.projectedViews ? '+' : ''}
                          {((calculation.actualViews - calculation.projectedViews) / calculation.projectedViews * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {calculation.notes && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm bg-muted p-2 rounded">{calculation.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Calculation Results</DialogTitle>
            <DialogDescription>
              Add actual results for {selectedCalculation?.creatorName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actual-views">Actual Views</Label>
              <Input
                id="actual-views"
                type="number"
                placeholder="e.g., 15000"
                value={actualViews}
                onChange={(e) => setActualViews(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual-price">Actual Price Paid ($)</Label>
              <Input
                id="actual-price"
                type="number"
                placeholder="e.g., 300"
                value={actualPrice}
                onChange={(e) => setActualPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-posted">Date Posted</Label>
              <Input
                id="date-posted"
                type="date"
                value={datePosted}
                onChange={(e) => setDatePosted(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this collaboration..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSaveEdit} className="flex-1">
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};