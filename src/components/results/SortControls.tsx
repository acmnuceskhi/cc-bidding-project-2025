import { memo } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, GraduationCap, Clock } from "lucide-react";

type SortOption = "price" | "batch" | "time";

interface SortControlsProps {
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
}

export const SortControls = memo(function SortControls({ sortBy, onSortChange }: SortControlsProps) {
  return (
    <div
      className="flex flex-wrap justify-center gap-3 md:gap-4"
      role="group"
      aria-label="Sort teams by"
    >
      <Button
        variant={sortBy === "price" ? "default" : "outline"}
        size="lg"
        onClick={() => onSortChange("price")}
        className={`min-h-[44px] min-w-[44px] transition-all ${
          sortBy === "price"
            ? "bg-yellow-500 text-black hover:bg-yellow-600"
            : "border-yellow-500/50 text-black hover:bg-yellow-500/10"
        }`}
        aria-label="Sort by price"
        aria-pressed={sortBy === "price"}
      >
        <DollarSign className="h-5 w-5 mr-2" aria-hidden="true" />
        <span className="hidden sm:inline">Sort by Price</span>
      </Button>

      <Button
        variant={sortBy === "batch" ? "default" : "outline"}
        size="lg"
        onClick={() => onSortChange("batch")}
        className={`min-h-[44px] min-w-[44px] transition-all ${
          sortBy === "batch"
            ? "bg-yellow-500 text-black hover:bg-yellow-600"
            : "border-yellow-500/50 text-black hover:bg-yellow-500/10"
        }`}
        aria-label="Sort by batch"
        aria-pressed={sortBy === "batch"}
      >
        <GraduationCap className="h-5 w-5 mr-2" aria-hidden="true" />
        <span className="hidden sm:inline">Sort by Batch</span>
      </Button>

      <Button
        variant={sortBy === "time" ? "default" : "outline"}
        size="lg"
        onClick={() => onSortChange("time")}
        className={`min-h-[44px] min-w-[44px] transition-all ${
          sortBy === "time"
            ? "bg-yellow-500 text-black hover:bg-yellow-600"
            : "border-yellow-500/50 text-black hover:bg-yellow-500/10"
        }`}
        aria-label="Sort by bid time"
        aria-pressed={sortBy === "time"}
      >
        <Clock className="h-5 w-5 mr-2" aria-hidden="true" />
        <span className="hidden sm:inline">Sort by Bid Time</span>
      </Button>
    </div>
  );
});
