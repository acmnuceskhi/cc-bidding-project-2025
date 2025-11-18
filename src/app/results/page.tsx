"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchPublic } from "@/lib/fetchPublic";
import { SortControls, HouseCard, LoadingState, ErrorState } from "@/components/results";

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
  const [error, setError] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("price");

  // Memoize the sort handler to prevent unnecessary re-renders
  const handleSortChange = useCallback((newSortBy: SortOption) => {
    setSortBy(newSortBy);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(false);
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
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sort teams based on selected option - memoized for performance
  const getSortedTeams = useMemo(() => {
    return (teams: TeamWithDetails[]) => {
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
  }, [sortBy]);

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
        {/* Page Header with proper spacing and hierarchy */}
        <header className="space-y-8 mb-12">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
              ☯︎ Bidding Results ☯︎
            </h1>
          </div>
          <SortControls sortBy={sortBy} onSortChange={handleSortChange} />
        </header>

        {/* Conditional rendering for loading, error, and content states */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={fetchData} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 transition-opacity duration-300 ease-in-out">
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

        {/* Page Footer with proper spacing */}
        <footer className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            May the strongest house prevail ☯︎
          </p>
        </footer>
      </div>
    </div>
  );
}
