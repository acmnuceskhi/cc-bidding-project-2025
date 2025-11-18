import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

interface RefreshButtonProps {
  onRefresh: () => void;
  isLoading?: boolean;
}

export const RefreshButton = memo(function RefreshButton({ onRefresh, isLoading = false }: RefreshButtonProps) {
  const [isRotating, setIsRotating] = useState(false);

  const handleClick = () => {
    setIsRotating(true);
    onRefresh();
    setTimeout(() => setIsRotating(false), 600);
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleClick}
      disabled={isLoading || isRotating}
      className="min-h-[44px] min-w-[44px] border-yellow-500/50 text-black hover:bg-yellow-500/10 transition-all"
      aria-label="Refresh data from database"
      title="Refresh data from database"
    >
      <RotateCw 
        className={`h-5 w-5 ${isRotating ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
    </Button>
  );
});
