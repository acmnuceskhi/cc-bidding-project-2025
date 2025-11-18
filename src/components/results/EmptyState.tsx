import { Users } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-sm text-muted-foreground">No teams yet</p>
    </div>
  );
}
