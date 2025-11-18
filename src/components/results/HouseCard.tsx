import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamCard } from "./TeamCard";
import { EmptyState } from "./EmptyState";

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

interface House {
  houseId?: string;
  _id?: string | { toString: () => string };
  name: string;
  totalBudget: number;
  remainingBudget: number;
  color?: string;
}

interface HouseWithTeams extends House {
  teams: TeamWithDetails[];
}

interface HouseCardProps {
  house: HouseWithTeams;
  sortedTeams: TeamWithDetails[];
  isNewlyGained?: boolean;
}

export function HouseCard({ house, sortedTeams, isNewlyGained = false }: HouseCardProps) {
  const hasTeams = house.teams && house.teams.length > 0;
  
  return (
    <Card 
      className={`bg-card/95 backdrop-blur border-2 transition-all duration-300 ${
        isNewlyGained
          ? "border-yellow-500 shadow-lg shadow-yellow-500/50"
          : "border-border hover:border-yellow-500/50"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle 
            className="text-xl font-bold"
            style={{ color: house.color || "#FFD700" }}
          >
            {house.name}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {house.teams.length}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          ${house.remainingBudget.toLocaleString()} remaining
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {hasTeams ? (
          sortedTeams.map((team) => (
            <TeamCard key={team.teamId} team={team} />
          ))
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
}
