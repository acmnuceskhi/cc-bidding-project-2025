import { memo } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cardVariants, teamContainerVariants, stackingCardVariants, prefersReducedMotion } from "@/lib/animations";
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

// Map house names to background images
const getHouseBackground = (houseName: string): string => {
  const houseMap: Record<string, string> = {
    "Lord Shen": "/lord-shen.jpg",
    "Dragon Warrior": "/dragon-warrior.jpg",
    "Master Oogway": "/master-oogway.jpg",
    "Tai Lung": "/tai-lung.jpg",
  };
  return houseMap[houseName] || "/arena-background.jpg";
};

export const HouseCard = memo(function HouseCard({ house, sortedTeams, isNewlyGained = false }: HouseCardProps) {
  const hasTeams = house.teams && house.teams.length > 0;
  const reducedMotion = prefersReducedMotion();
  
  return (
    <motion.div
      variants={reducedMotion ? {} : cardVariants}
      whileHover={reducedMotion ? {} : "hover"}
    >
      <Card 
        className={`relative overflow-hidden border-2 transition-all duration-300 ${
          isNewlyGained
            ? "border-yellow-500 shadow-lg shadow-yellow-500/50"
            : "border-yellow-500/30 hover:border-yellow-500/50"
        }`}
      >
        {/* Background Image Layer */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url('${getHouseBackground(house.name)}')` }}
        />
        
        {/* Dark overlay for better contrast */}
        <div className="absolute inset-0 bg-black/80" />
        
        {/* Content */}
        <div className="relative z-10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle 
                className="text-xl font-bold drop-shadow-lg"
                style={{ color: house.color || "#FFD700" }}
              >
                {house.name}
              </CardTitle>
              <Badge variant="secondary" className="shrink-0">
                {house.teams.length}
              </Badge>
            </div>
            <div className="text-sm text-gray-400">
              ${house.remainingBudget.toLocaleString()} remaining
            </div>
          </CardHeader>
          
          <CardContent>
            {hasTeams ? (
              <motion.div
                className="space-y-3"
                initial="hidden"
                animate="visible"
                variants={reducedMotion ? {} : teamContainerVariants}
              >
                {sortedTeams.map((team, index) => (
                  <motion.div
                    key={team.teamId}
                    custom={index}
                    variants={reducedMotion ? {} : stackingCardVariants}
                  >
                    <TeamCard team={team} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
});
