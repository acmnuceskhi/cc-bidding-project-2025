/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface TeamWithDetails {
  teamId: string;
  rank: number;
  batch?: string;
  memberCount: number;
  status: "available" | "sold";
  soldToHouseName?: string;
  soldPrice?: number;
  roundNumber?: number;
  houseId?: string;
}

interface Round {
  _id: string;
  teamId: string;
  winningBid?: number;
  roundNumber: number;
  finalized?: boolean;
}

interface House {
  houseId?: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
}

interface Team {
  teamId: string;
  rank: number;
  batch?: string;
  memberCount: number;
  houseId?: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [sortBy, setSortBy] = useState<
    "round" | "price-asc" | "price-desc" | "rank"
  >("rank");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "available" | "sold"
  >("all");

  // Function to get house background image
  const getHouseBackground = (houseName?: string) => {
    if (!houseName) return "/temple-out.jpg";

    const houseMap: Record<string, string> = {
      "Lord Shen": "/lord-shen.jpg",
      "Dragon Warrior": "/dragon-warrior.jpg",
      "Master Oogway": "/master-oogway.jpg",
      "Tai Lung": "/tai-lung.jpg",
    };
    return houseMap[houseName] || "/temple-out.jpg";
  };

  useEffect(() => {
    async function fetchData() {
      try {
        // --- Fetch all data in parallel ---
        const [teamsRes, roundsRes, housesRes] = await Promise.all([
          fetchWithAuth("/api/teams", { method: "GET" }),
          fetchWithAuth("/api/rounds", { method: "GET" }),
          fetchWithAuth("/api/houses", { method: "GET" }),
        ]);

        const [teamsData, rounds, houses] = await Promise.all([
          teamsRes.json(),
          roundsRes.json(),
          housesRes.json(),
        ]);

        // Ensure all data are arrays
        if (!Array.isArray(teamsData) || !Array.isArray(rounds) || !Array.isArray(houses)) {
          console.error("API did not return arrays:", { teamsData, rounds, houses });
          setTeams([]);
          return;
        }

        // --- Build team data ---
        const teamsWithDetails: TeamWithDetails[] = teamsData.map(
          (team: Team) => {
            const round = rounds.find(
              (r: Round) => r.teamId === team.teamId
            );

            if (team.houseId) {
              const house = houses.find(
                (h: House) =>
                  h.houseId?.toString() === team.houseId?.toString()
              );
              return {
                teamId: team.teamId,
                rank: team.rank,
                batch: team.batch,
                memberCount: team.memberCount,
                status: "sold",
                soldToHouseName: house ? house.name : "Unknown",
                soldPrice: round?.winningBid,
                roundNumber: round?.roundNumber,
                houseId: team.houseId,
              };
            } else {
              return {
                teamId: team.teamId,
                rank: team.rank,
                batch: team.batch,
                memberCount: team.memberCount,
                status: "available",
              };
            }
          }
        );

        setTeams(teamsWithDetails);
      } catch (error) {
        console.error("Failed to fetch teams data:", error);
      }
    }

    fetchData();
  }, []);

  // --- Sorting + Filtering logic ---
  const getSortedTeams = () => {
    const filtered = teams.filter((t) => {
      if (filterStatus === "all") return true;
      return t.status === filterStatus;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "round":
          return (a.roundNumber || 999) - (b.roundNumber || 999);
        case "price-asc":
          return (a.soldPrice || 0) - (b.soldPrice || 0);
        case "price-desc":
          return (b.soldPrice || 0) - (a.soldPrice || 0);
        case "rank":
          return a.rank - b.rank;
        default:
          return 0;
      }
    });
  };

  const sortedTeams = getSortedTeams();
  const availableCount = teams.filter((t) => t.status === "available").length;
  const soldCount = teams.filter((t) => t.status === "sold").length;

  // --- UI remains identical ---
  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_20px_#FFD700]">
          👥 All Teams
        </h1>
        <p className="text-gray-300">Complete roster of qualified teams</p>
      </div>

      {/* Filters and sorting */}
      <div className="bg-black/40 rounded-xl p-6 border-2 border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)] backdrop-blur-md">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            {["all", "available", "sold"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                  filterStatus === status
                    ? status === "sold"
                      ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                      : status === "available"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                        : "bg-gradient-to-r from-[#FFD700] to-[#FFB800] text-black shadow-[0_0_20px_rgba(255,215,0,0.5)]"
                    : "bg-gray-700/80 text-gray-300 hover:bg-gray-600/80"
                }`}
              >
                {status === "all"
                  ? `All (${teams.length})`
                  : status === "available"
                    ? `Available (${availableCount})`
                    : `Recruited (${soldCount})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-300 font-semibold">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-800/90 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.2)]"
            >
              <option value="rank">Rank (Best to Worst)</option>
              <option value="round">Round Number</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="price-asc">Price (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedTeams.map((team, index) => {
          const backgroundImage =
            team.status === "sold" && team.soldToHouseName
              ? getHouseBackground(team.soldToHouseName)
              : "/temple-out.jpg";

          return (
            <div
              key={team.teamId || `team-${index}`}
              className="relative rounded-xl p-6 border-2 shadow-lg transform hover:scale-105 transition-all overflow-hidden"
              style={{
                backgroundImage: `url('${backgroundImage}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Opacity overlay */}
              <div
                className={`absolute inset-0 ${
                  team.status === "available"
                    ? "bg-gray-900/80 backdrop-blur-[2px]"
                    : "bg-black/70 backdrop-blur-[2px]"
                }`}
              ></div>

              {/* Neon border for sold teams */}
              {team.status === "sold" && (
                <div className="absolute inset-0 border-2 border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.5)]"></div>
              )}
              {team.status === "available" && (
                <div className="absolute inset-0 border-2 border-gray-500"></div>
              )}

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-20 h-20 rounded-full border-4 border-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.5)] bg-gradient-to-br from-yellow-600 to-orange-600 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-black">#{team.rank}</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white drop-shadow-[0_0_10px_#000000]">
                      Team #{team.rank}
                    </h3>
                    {team.batch && (
                      <p className="text-sm text-gray-300">
                        Batch {team.batch}
                      </p>
                    )}
                    <p className="text-sm text-gray-400">
                      {team.memberCount} members
                    </p>
                    {team.roundNumber && (
                      <p className="text-sm text-gray-300">
                        Round {team.roundNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-gray-600">
                  {team.status === "available" ? (
                    <div className="text-center">
                      <span className="inline-block bg-blue-600/90 text-white px-4 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                        ✨ Available
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-300 mb-2">Sold to</p>
                      <div className="flex items-center justify-between bg-black/60 rounded-lg p-3 border border-[#FFD700]/30">
                        <div>
                          <p className="font-bold text-[#FFD700] text-lg drop-shadow-[0_0_10px_#FFD700]">
                            {team.soldToHouseName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-400 drop-shadow-[0_0_10px_#22C55E]">
                            ${team.soldPrice}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedTeams.length === 0 && (
        <div className="text-center py-12 bg-black/40 rounded-xl border-2 border-dashed border-gray-600 backdrop-blur-sm">
          <p className="text-xl text-gray-400">
            No teams match your filters
          </p>
        </div>
      )}
    </div>
  );
}
