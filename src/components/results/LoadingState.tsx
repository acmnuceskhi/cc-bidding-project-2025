import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="relative overflow-hidden border-2 border-yellow-500/30 bg-transparent p-6">
          {/* Background Image Layer */}
          <div className="absolute inset-0 bg-cover bg-center opacity-30" />
          
          {/* Dark overlay for better contrast */}
          <div className="absolute inset-0 bg-black/80" />
          
          {/* Content */}
          <div className="relative z-10">
            <Skeleton className="mb-4 h-8 w-3/4 bg-gray-700" />
            <Skeleton className="mb-6 h-4 w-1/2 bg-gray-700" />
            <div className="space-y-3">
              <Skeleton className="h-24 w-full bg-gray-700" />
              <Skeleton className="h-24 w-full bg-gray-700" />
              <Skeleton className="h-24 w-full bg-gray-700" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
