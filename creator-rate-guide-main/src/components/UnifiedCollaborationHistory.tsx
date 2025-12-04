import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Search, Edit2, Trash2, Calendar, DollarSign, Eye, TrendingUp, Users, Target, Award } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { UnifiedDataService, type CollaborationData } from "@/utils/UnifiedDataService";

interface UnifiedCollaborationHistoryProps {
  refreshKey?: number;
}

export const UnifiedCollaborationHistory = ({ refreshKey }: UnifiedCollaborationHistoryProps) => {
  const [collaborations, setCollaborations] = useState<CollaborationData[]>([]);
  const [editingCollaboration, setEditingCollaboration] = useState<CollaborationData | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadCollaborations();
  }, [refreshKey]);

  const loadCollaborations = () => {
    const data = UnifiedDataService.getCollaborations();
    setCollaborations(data.sort((a, b) => b.dateCalculated.getTime() - a.dateCalculated.getTime()));
  };

  const filteredCollaborations = collaborations.filter(collab =>
    collab.creatorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditCollaboration = (collab: CollaborationData) => {
    setEditingCollaboration(collab);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollaboration) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const actualViews = parseFloat(formData.get('actualViews') as string);
    const actualPrice = parseFloat(formData.get('actualPrice') as string);
    const datePosted = formData.get('datePosted') as string;
    const notes = formData.get('notes') as string;

    UnifiedDataService.updateCollaboration(editingCollaboration.id, {
      actualViews: actualViews || undefined,
      actualPrice: actualPrice || undefined,
      datePosted: datePosted ? new Date(datePosted) : undefined,
      notes: notes || undefined,
    });

    setIsEditDialogOpen(false);
    setEditingCollaboration(null);
    loadCollaborations();

    toast({
      title: "Collaboration Updated",
      description: `Updated results for ${editingCollaboration.creatorName}`,
    });
  };

  const handleDeleteCollaboration = (id: string) => {
    UnifiedDataService.deleteCollaboration(id);
    loadCollaborations();
    toast({
      title: "Collaboration Deleted",
      description: "Collaboration has been removed from history",
    });
  };

  const getAccuracy = (projected: number, actual?: number): number => {
    return actual ? UnifiedDataService.calculateAccuracy(projected, actual) : 0;
  };

  const getStatusBadge = (projected: number, actual?: number) => {
    if (!actual) {
      return <Badge variant="secondary">Pending</Badge>;
    }

    const accuracy = getAccuracy(projected, actual);
    if (accuracy >= 90) return <Badge className="bg-success text-success-foreground">Excellent</Badge>;
    if (accuracy >= 70) return <Badge className="bg-warning text-warning-foreground">Good</Badge>;
    return <Badge variant="destructive">Needs Review</Badge>;
  };

  const insights = UnifiedDataService.getInsights();

  return (
    <div className="space-y-6">
      {/* Insights Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Collaboration Analytics
          </CardTitle>
          <CardDescription>
            Track your prediction accuracy and collaboration performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Users className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{insights.totalCollaborations}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Target className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold">{insights.completedCollaborations}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Calendar className="h-6 w-6 text-warning mx-auto mb-2" />
              <p className="text-2xl font-bold">{insights.pendingCollaborations}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Award className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{insights.averageAccuracy}%</p>
              <p className="text-sm text-muted-foreground">Accuracy</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collaboration History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Collaboration History</CardTitle>
              <CardDescription>
                Showing {filteredCollaborations.length} of {collaborations.length} collaborations
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search creators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCollaborations.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {collaborations.length === 0 
                  ? "No collaborations yet. Start by using the calculator to track predictions."
                  : "No collaborations match your search."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCollaborations.map((collab) => (
                <Card key={collab.id} className="border-l-4 border-l-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold text-lg">{collab.creatorName}</h3>
                          {getStatusBadge(collab.projectedViews, collab.actualViews)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Projected Views</p>
                            <p className="font-medium">{collab.projectedViews.toLocaleString()}</p>
                          </div>
                          {collab.actualViews && (
                            <div>
                              <p className="text-muted-foreground">Actual Views</p>
                              <p className="font-medium">{collab.actualViews.toLocaleString()}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">Recommended Price</p>
                            <p className="font-medium">${collab.recommendedPrice.toLocaleString()}</p>
                          </div>
                          {collab.actualPrice && (
                            <div>
                              <p className="text-muted-foreground">Actual Price</p>
                              <p className="font-medium">${collab.actualPrice.toLocaleString()}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">Confidence</p>
                            <p className="font-medium">{collab.confidence}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Target CPM</p>
                            <p className="font-medium">${collab.targetCPM}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Date Calculated</p>
                            <p className="font-medium">{collab.dateCalculated.toLocaleDateString()}</p>
                          </div>
                          {collab.datePosted && (
                            <div>
                              <p className="text-muted-foreground">Date Posted</p>
                              <p className="font-medium">{collab.datePosted.toLocaleDateString()}</p>
                            </div>
                          )}
                        </div>

                        {collab.actualViews && (
                          <div className="mt-3 p-2 bg-muted/50 rounded">
                            <p className="text-sm text-muted-foreground">Accuracy</p>
                            <p className="font-semibold text-primary">{getAccuracy(collab.projectedViews, collab.actualViews).toFixed(1)}%</p>
                          </div>
                        )}

                        {collab.notes && (
                          <div className="mt-3">
                            <p className="text-sm text-muted-foreground">Notes</p>
                            <p className="text-sm">{collab.notes}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCollaboration(collab)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          {collab.actualViews ? 'Edit' : 'Add Results'}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Collaboration</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this collaboration with {collab.creatorName}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCollaboration(collab.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Collaboration Results</DialogTitle>
            <DialogDescription>
              Add actual performance data for {editingCollaboration?.creatorName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actualViews">Actual Views</Label>
              <div className="relative">
                <Eye className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="actualViews"
                  name="actualViews"
                  type="number"
                  placeholder="Enter actual views"
                  defaultValue={editingCollaboration?.actualViews || ""}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualPrice">Actual Price Paid ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="actualPrice"
                  name="actualPrice"
                  type="number"
                  placeholder="Enter actual price paid"
                  defaultValue={editingCollaboration?.actualPrice || ""}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="datePosted">Date Posted</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="datePosted"
                  name="datePosted"
                  type="date"
                  defaultValue={editingCollaboration?.datePosted?.toISOString().split('T')[0] || ""}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Add any notes about this collaboration..."
                defaultValue={editingCollaboration?.notes || ""}
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                Save Results
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};