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
    <div className="flex items-start gap-3 p-3 rounded-lg bg-black/40 hover:bg-black/50 transition-colors border border-white/10">
      {/* Rank Badge */}
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-black">#{team.rank}</span>
      </div>
      
      {/* Team Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-semibold text-sm text-white truncate">
          {team.name || `Team #${team.rank}`}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-300">
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
        
        {/* Stats Badges */}
        {(team.successfulAttempts !== undefined || team.totalPoints !== undefined) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {team.successfulAttempts !== undefined && (
              <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                {team.successfulAttempts} solved
              </Badge>
            )}
            {team.totalPoints !== undefined && (
              <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                <Star className="h-3 w-3 mr-1" />
                {team.totalPoints} pts
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Price */}
      {team.soldPrice !== undefined && (
        <div className="text-sm font-bold text-yellow-400 shrink-0">
          ${team.soldPrice.toLocaleString()}
        </div>
      )}
    </div>
  );
}
