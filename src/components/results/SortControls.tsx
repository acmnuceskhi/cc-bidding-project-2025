import { Button } from "@/components/ui/button";
import { DollarSign, GraduationCap, Clock } from "lucide-react";

type SortOption = "price" | "batch" | "time";

interface SortControlsProps {
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
}

export function SortControls({ sortBy, onSortChange }: SortControlsProps) {
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
        className="min-h-[44px] min-w-[44px] transition-all"
        aria-label="Sort by price"
        aria-pressed={sortBy === "price"}
      >
        <span className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Sort by Price</span>
          <span className="sm:hidden sr-only">Price</span>
        </span>
      </Button>

      <Button
        variant={sortBy === "batch" ? "default" : "outline"}
        size="lg"
        onClick={() => onSortChange("batch")}
        className="min-h-[44px] min-w-[44px] transition-all"
        aria-label="Sort by batch"
        aria-pressed={sortBy === "batch"}
      >
        <span className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Sort by Batch</span>
          <span className="sm:hidden sr-only">Batch</span>
        </span>
      </Button>

      <Button
        variant={sortBy === "time" ? "default" : "outline"}
        size="lg"
        onClick={() => onSortChange("time")}
        className="min-h-[44px] min-w-[44px] transition-all"
        aria-label="Sort by bid time"
        aria-pressed={sortBy === "time"}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Sort by Bid Time</span>
          <span className="sm:hidden sr-only">Time</span>
        </span>
      </Button>
    </div>
  );
}
