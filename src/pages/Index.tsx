import { PricingCalculator } from "@/components/PricingCalculator";
import { Auth } from "@/components/Auth";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Show login/signup if user is not authenticated
  if (!user) {
    return <Auth />;
  }

  // Show calculator if user is authenticated
  return <PricingCalculator />;
};

export default Index;
