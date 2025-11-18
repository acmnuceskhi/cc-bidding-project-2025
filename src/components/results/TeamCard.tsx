import { memo } from "react";
import { GraduationCap, CheckCircle, Clock } from "lucide-react";

interface Team {
  teamId: string;
  name?: string | null;
  rank: number;
  batch: string;
  memberCount: number;
  houseId?: string;
  successfulAttempts?: number;
  unsuccessfulAttempts?: number;
  totalPoints?: number;
  totalPenalty?: number;
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

export const TeamCard = memo(function TeamCard({ team }: TeamCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-black/40 hover:bg-black/50 transition-colors border border-white/10">
        {/* Rank Badge */}
        <div className="h-10 sm:h-11 w-10 sm:w-11 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shrink-0">
          <span className="text-sm sm:text-base font-bold text-black">#{team.rank}</span>
        </div>
        
        {/* Team Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm sm:text-base text-white truncate">
            {team.name || `Team #${team.rank}`}
          </div>
          <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-300">
            <span className="flex items-center gap-0.5">
              <GraduationCap className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              {team.batch}
            </span>
            {team.successfulAttempts !== undefined && (
              <>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-green-400">
                  <CheckCircle className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  {team.successfulAttempts}
                </span>
              </>
            )}
            {team.unsuccessfulAttempts !== undefined && team.unsuccessfulAttempts > 0 && (
              <span className="text-gray-400">
                (-{team.unsuccessfulAttempts})
              </span>
            )}
            {team.totalPenalty !== undefined && team.totalPenalty > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-blue-400">
                  <Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  {team.totalPenalty}
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Price */}
        {team.soldPrice !== undefined && (
          <div className="text-sm sm:text-base font-bold text-yellow-400 shrink-0">
            ${team.soldPrice.toLocaleString()}
          </div>
        )}
      </div>
  );
});
