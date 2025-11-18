import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, CheckCircle, Star } from "lucide-react";

interface Team {
  teamId: string;
  name?: string | null;
  rank: number;
  batch: string;
  memberCount: number;
  houseId?: string;
  successfulAttempts?: number;
  totalPoints?: number;
}

interface TeamWithDetails extends Team {
  status: "available" | "sold";
  soldTo?: string;
  soldToHouseName?: string;
  soldPrice?: number;
  bidTimestamp?: string;
  roundNumber?: number;
}

interface TeamCardProps {
  team: TeamWithDetails;
}

export function TeamCard({ team }: TeamCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      {/* Rank Badge */}
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-black">#{team.rank}</span>
      </div>
      
      {/* Team Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">
          {team.name || `Team #${team.rank}`}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {team.batch}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {team.memberCount}
          </span>
        </div>
      </div>
      
      {/* Price */}
      {team.soldPrice !== undefined && (
        <div className="text-sm font-bold text-yellow-500 shrink-0">
          ${team.soldPrice.toLocaleString()}
        </div>
      )}
    </div>
  );
}
