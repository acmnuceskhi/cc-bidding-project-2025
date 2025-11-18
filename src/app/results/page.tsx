"use client";

import { useEffect, useState } from "react";
import { fetchPublic } from "@/lib/fetchPublic";
import { SortControls, HouseCard } from "@/components/results";

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

type SortOption = "price" | "batch" | "time";

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

export default function FinalTeamsPage() {
  const [houses, setHouses] = useState<HouseWithTeams[]>([]);
  const [previousHouseTeamCounts, setPreviousHouseTeamCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("price");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [housesRes, teamsRes] = await Promise.all([
          fetchPublic("/api/houses", { method: "GET" }),
          fetchPublic("/api/teams", { method: "GET" }),
        ]);

        const [housesData, teamsData]: [House[], TeamWithDetails[]] =
          await Promise.all([housesRes.json(), teamsRes.json()]);

        console.log("Houses data:", housesData);
        console.log("Teams data:", teamsData);

        // Assign teams to their respective houses
        const housesWithTeams: HouseWithTeams[] = housesData.map(
          (house) => {
            const houseIdStr = house._id ? String(house._id) : house.houseId;
            const matchedTeams = teamsData.filter(
              (t) => t.houseId && String(t.houseId) === houseIdStr
            );
            console.log(`House ${house.name} (${houseIdStr}):`, matchedTeams);
            return {
              ...house,
              teams: matchedTeams,
            };
          }
        );

        console.log("Houses with teams:", housesWithTeams);

        // Track previous team counts per house so we can animate only
        // when a house gains teams (i.e. wins something new).
        setPreviousHouseTeamCounts((prev) => {
          const updated: Record<string, number> = { ...prev };
          for (const h of housesWithTeams) {
            const key = (h._id ? String(h._id) : h.houseId) || h.name;
            updated[key] = h.teams.length;
          }
          return updated;
        });

        setHouses(housesWithTeams);
      } catch (error) {
        console.error("Failed to fetch final teams data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Sort teams based on selected option
  const getSortedTeams = (teams: TeamWithDetails[]) => {
    const sorted = [...teams];
    switch (sortBy) {
      case "price":
        return sorted.sort((a, b) => {
          const priceA = a.soldPrice ?? 0;
          const priceB = b.soldPrice ?? 0;
          return priceB - priceA;
        });
      case "batch":
        return sorted.sort((a, b) => {
          const batchA = a.batch || "";
          const batchB = b.batch || "";
          return batchA.localeCompare(batchB);
        });
      case "time":
        return sorted.sort((a, b) => {
          const timeA = a.bidTimestamp ? new Date(a.bidTimestamp).getTime() : 0;
          const timeB = b.bidTimestamp ? new Date(b.bidTimestamp).getTime() : 0;
          return timeA - timeB; // Earlier bids first
        });
      default:
        return sorted;
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/arena-background.jpg')" }}
      />
      
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/75" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-yellow-500 mb-2 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
            ☯︎ Final Teams Line-Up ☯︎
          </h1>
          <p className="text-gray-300">View all teams acquired by each house</p>
        </div>

        <div className="mb-6">
          <SortControls sortBy={sortBy} onSortChange={setSortBy} />
        </div>

        {loading ? (
          <div className="text-center text-yellow-400 py-12">
            Loading teams...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {houses.map((house, index) => {
              const hasTeams = house.teams && house.teams.length > 0;
              const houseKey = (house._id ? String(house._id) : house.houseId) || house.name;
              const prevCount = previousHouseTeamCounts[houseKey] ?? 0;
              const isNewlyGained = hasTeams && house.teams.length > prevCount;
              
              return (
                <HouseCard
                  key={house.houseId || `house-${index}`}
                  house={house}
                  sortedTeams={getSortedTeams(house.teams)}
                  isNewlyGained={isNewlyGained}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
