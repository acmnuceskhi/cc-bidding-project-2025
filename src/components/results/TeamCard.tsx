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
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:bg-card/70 transition-colors">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start gap-4">
          {/* Rank Badge - Subtask 4.2 */}
          <Badge 
            variant="default" 
            className="h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center text-lg md:text-xl font-bold shrink-0 bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black border-2 border-white/40"
          >
            #{team.rank}
          </Badge>
          
          {/* Team Info */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Team Name - Subtask 4.3 */}
            <h4 className="text-base md:text-lg font-semibold truncate text-white">
              {team.name || `Team #${team.rank}`}
            </h4>
            
            {/* Meta Information - Subtask 4.3 */}
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <GraduationCap className="h-4 w-4" />
                {team.batch}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {team.memberCount} members
              </span>
            </div>
            
            {/* Price Display - Subtask 4.4 */}
            {team.soldPrice !== undefined && (
              <div className="text-lg md:text-xl font-bold text-primary">
                ${team.soldPrice.toLocaleString()}
              </div>
            )}
            
            {/* Stats Badges - Subtask 4.5 */}
            <div className="flex flex-wrap gap-2">
              {team.successfulAttempts !== undefined && (
                <Badge variant="success" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {team.successfulAttempts} solved
                </Badge>
              )}
              {team.totalPoints !== undefined && (
                <Badge variant="warning" className="text-xs">
                  <Star className="h-3 w-3 mr-1" />
                  {team.totalPoints} pts
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
