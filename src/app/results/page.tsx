"use client";

import { useEffect, useState } from "react";
import { fetchPublic } from "@/lib/fetchPublic";
import { SortControls } from "@/components/results";

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
    <div
      className="min-h-screen bg-cover bg-center flex flex-col items-center justify-start text-white"
      style={{ backgroundImage: "url('/arena-background.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      <div className="relative z-10 w-full max-w-7xl p-8 text-center">
        <h1 className="text-5xl font-extrabold text-[#FFD700] drop-shadow-[0_0_20px_#FFD700] mb-8">
          ☯︎ Final Teams Line-Up ☯︎
        </h1>

        {/* Sorting Controls */}
        <div className="mb-8 px-4">
          <SortControls sortBy={sortBy} onSortChange={setSortBy} />
        </div>

        {loading ? (
          <div className="text-yellow-400 text-lg animate-pulse mt-12">
            Loading teams...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {houses.map((house, index) => {
              const getHouseBackground = (houseName: string) => {
                const houseMap: Record<string, string> = {
                  "Lord Shen": "/lord-shen.jpg",
                  "Dragon Warrior": "/dragon-warrior.jpg",
                  "Master Oogway": "/master-oogway.jpg",
                  "Tai Lung": "/tai-lung.jpg",
                };
                return houseMap[houseName] || "/arena-background.jpg";
              };
              const hasTeams = house.teams && house.teams.length > 0;
              const houseKey = (house._id ? String(house._id) : house.houseId) || house.name;
              const prevCount = previousHouseTeamCounts[houseKey] ?? 0;
              const isNewlyGained = hasTeams && house.teams.length > prevCount;
              
              return (
                <div
                  key={house.houseId || `house-${index}`}
                  className={`relative p-6 rounded-2xl border transition-transform overflow-hidden ${
                    isNewlyGained
                      ? "border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.8)] animate-pulse"
                      : hasTeams
                        ? "border-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.5)]"
                        : "border-[#FFD700]/40 shadow-[0_0_25px_rgba(255,215,0,0.3)] hover:scale-105"
                  }`}
                >
                  {/* Background image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${getHouseBackground(house.name)}')` }}
                  ></div>
                  
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <h2
                      className="text-2xl font-bold mb-4 drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]"
                      style={{ color: house.color || "#FFD700" }}
                    >
                      House of {house.name}
                    </h2>

                {house.teams.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 text-sm text-gray-200">
                    {getSortedTeams(house.teams).map((team, tIndex) => (
                      <div
                        key={
                          team.teamId ||
                          `team-${team.rank}-${tIndex}`
                        }
                        className="p-3 bg-black/30 rounded-lg border border-white/10 hover:bg-black/50 transition-all"
                      >
                        <div className="flex items-center space-x-3">
                          {/* Team Rank Badge */}
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center flex-shrink-0 border-2 border-white/40">
                            <span className="text-lg font-bold text-black">#{team.rank}</span>
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-white">
                              {team.name || `Team #${team.rank}`}
                            </div>
                            <div className="text-xs text-gray-300">
                              Batch: {team.batch} • {team.memberCount} members
                            </div>
                            {team.soldPrice !== undefined && (
                              <div className="mt-1 text-sm font-semibold text-[#FFD700]">
                                💰 Sold for: ${team.soldPrice.toLocaleString()}
                              </div>
                            )}
                            {team.successfulAttempts !== undefined && (
                              <div className="mt-1 text-xs text-green-400">
                                ✓ {team.successfulAttempts} solved
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-4">
                    No teams yet
                  </div>
                )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-16 text-gray-400 text-sm">
          Powered by <span className="text-[#FFD700]">CC Bidding System</span>
        </footer>
      </div>
    </div>
  );
}
