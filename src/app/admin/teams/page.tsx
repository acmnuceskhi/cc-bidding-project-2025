/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface TeamWithDetails {
  teamId: string;
  name?: string;
  rank: number;
  batch?: string;
  memberCount: number;
  status: "available" | "sold";
  soldToHouseName?: string;
  soldPrice?: number;
  houseId?: string;
}

interface Bid {
  _id: string;
  teamId: string;
  houseId: string;
  amount: number;
  timestamp: string;
}

interface House {
  houseId?: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
}

interface Team {
  teamId: string;
  name?: string;
  rank: number;
  batch?: string;
  memberCount: number;
  houseId?: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [sortBy, setSortBy] = useState<
    "price-asc" | "price-desc" | "rank"
  >("rank");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "available" | "sold"
  >("all");
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [teamToRelease, setTeamToRelease] = useState<TeamWithDetails | null>(
    null
  );
  const [isReleasing, setIsReleasing] = useState(false);

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

  // Helper function to find winning bid for a team
  const findWinningBid = (teamId: string, bids: Bid[]): Bid | null => {
    const teamBids = bids.filter((b) => b.teamId === teamId);
    if (teamBids.length === 0) return null;

    // Sort by amount (desc) then by timestamp (asc) to get highest bid, earliest wins ties
    return teamBids.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    })[0];
  };

  const fetchTeamsData = async () => {
    try {
      // Fetch teams, houses, and bids in parallel
      const [teamsRes, housesRes, bidsRes] = await Promise.all([
        fetchWithAuth("/api/teams", { method: "GET" }),
        fetchWithAuth("/api/houses", { method: "GET" }),
        fetchWithAuth("/api/bids", { method: "GET" }),
      ]);

      const [teamsData, houses, bids] = await Promise.all([
        teamsRes.json(),
        housesRes.json(),
        bidsRes.json(),
      ]);

      // Ensure all data are arrays
      if (!Array.isArray(teamsData) || !Array.isArray(houses) || !Array.isArray(bids)) {
        console.error("API did not return arrays:", { teamsData, houses, bids });
        setTeams([]);
        return;
      }

      // Build team data with winning bids
      const teamsWithDetails: TeamWithDetails[] = teamsData.map(
        (team: Team) => {
          if (team.houseId) {
            const house = houses.find(
              (h: House) =>
                h.houseId?.toString() === team.houseId?.toString()
            );

            const winningBid = findWinningBid(team.teamId, bids);

            console.log(`Team ${team.rank}:`, {
              teamId: team.teamId,
              name: team.name,
              houseId: team.houseId,
              houseName: house?.name,
              winningBid: winningBid?.amount
            });

            return {
              teamId: team.teamId,
              name: team.name,
              rank: team.rank,
              batch: team.batch,
              memberCount: team.memberCount,
              status: "sold",
              soldToHouseName: house ? house.name : "Unknown",
              soldPrice: winningBid?.amount,
              houseId: team.houseId,
            };
          } else {
            return {
              teamId: team.teamId,
              name: team.name,
              rank: team.rank,
              batch: team.batch,
              memberCount: team.memberCount,
              status: "available",
            };
          }
        }
      );

      setTeams(teamsWithDetails);
      setHouses(houses);
    } catch (error) {
      console.error("Failed to fetch teams data:", error);
    }
  };

  useEffect(() => {
    fetchTeamsData();
  }, []);

  // Manual assign form state
  const [selectedHouseId, setSelectedHouseId] = useState<string | undefined>(undefined);
  const [assignAmount, setAssignAmount] = useState<number | undefined>(undefined);
  const [isAssigning, setIsAssigning] = useState(false);
  const [houseLimits, setHouseLimits] = useState<any | null>(null);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);

  const handleAssign = async (teamId: string) => {
    if (!selectedHouseId || assignAmount === undefined || assignAmount === null) {
      alert("Please choose a house and enter an amount");
      return;
    }
    // Fetch limits for this team+house and validate client-side before submitting
    try {
      setIsLoadingLimits(true);
      const q = new URLSearchParams({ houseId: selectedHouseId, teamId });
      const res = await fetchWithAuth(`/api/admin/assign-team/limits?${q.toString()}`, { method: "GET" });
      const limits = await res.json();
      setHouseLimits(limits);
      if (!res.ok) {
        alert(`Unable to fetch limits: ${limits.error || limits.message}`);
        setIsLoadingLimits(false);
        return;
      }
      const { minBid, computedMax } = limits as any;
      if (assignAmount < minBid) {
        alert(`Amount is below minimum allowed: ${minBid}`);
        setIsLoadingLimits(false);
        return;
      }
      if (assignAmount > computedMax) {
        alert(`Amount exceeds safe maximum: ${computedMax}`);
        setIsLoadingLimits(false);
        return;
      }
    } catch (err) {
      console.error("Error fetching limits:", err);
    } finally {
      setIsLoadingLimits(false);
    }
    setIsAssigning(true);
    try {
      const res = await fetchWithAuth("/api/admin/assign-team", {
        method: "POST",
        body: JSON.stringify({ teamId, houseId: selectedHouseId, amount: Number(assignAmount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Failed to assign team: ${data.error || data.message || 'unknown error'}`);
      } else {
        // Refresh teams list (socket events should also update clients)
        await fetchTeamsData();
        alert(`Team assigned successfully to house`);
      }
    } catch (err) {
      console.error("Assign error:", err);
      alert("Failed to assign team. See console for details.");
    } finally {
      setIsAssigning(false);
    }
  };

  // --- Sorting + Filtering logic ---
  const getSortedTeams = () => {
    const filtered = teams.filter((t) => {
      if (filterStatus === "all") return true;
      return t.status === filterStatus;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return (a.soldPrice || 0) - (b.soldPrice || 0);
        case "price-desc":
          return (b.soldPrice || 0) - (a.soldPrice || 0);
        case "rank":
        default:
          return a.rank - b.rank;
      }
    });
  };

  const sortedTeams = getSortedTeams();
  const availableCount = teams.filter((t) => t.status === "available").length;
  const soldCount = teams.filter((t) => t.status === "sold").length;

  // Handle team release
  const handleReleaseClick = (team: TeamWithDetails) => {
    setTeamToRelease(team);
    setShowReleaseDialog(true);
  };

  const handleReleaseConfirm = async () => {
    if (!teamToRelease) return;

    setIsReleasing(true);
    try {
      const response = await fetchWithAuth(
        `/api/teams/${teamToRelease.teamId}/release`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Success - refresh teams data
        setShowReleaseDialog(false);
        setTeamToRelease(null);

        // Refresh the teams list
        await fetchTeamsData();

        alert(`Team released successfully! ${data.houseName} refunded $${data.refundAmount}`);
      } else {
        alert(`Failed to release team: ${data.error}`);
      }
    } catch (error) {
      console.error("Error releasing team:", error);
      alert("Failed to release team. Please try again.");
    } finally {
      setIsReleasing(false);
    }
  };

  const handleReleaseCancel = () => {
    setShowReleaseDialog(false);
    setTeamToRelease(null);
  };

  // --- UI remains identical ---
  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_20px_#FFD700]">
          👥 All Teams
        </h1>
        <p className="text-gray-300">Complete roster of qualified teams</p>
      </div>

      {/* Manual Assign Controls */}
      <div className="bg-black/40 rounded-xl p-4 border-2 border-[#FFD700]/30 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm text-gray-300 mb-1">Select House</label>
            <select
              value={selectedHouseId}
              onChange={(e) => setSelectedHouseId(e.target.value || undefined)}
              className="w-full bg-gray-800/90 text-white border-2 border-[#FFD700]/30 rounded-lg px-3 py-2"
            >
              <option value="">-- Select House --</option>
              {houses.map((h) => (
                <option key={h.houseId} value={h.houseId}>{h.name} (Remaining: ${h.remainingBudget})</option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className="block text-sm text-gray-300 mb-1">Amount</label>
            <input
              type="number"
              min={0}
              value={assignAmount ?? ""}
              onChange={(e) => setAssignAmount(e.target.value === "" ? undefined : Number(e.target.value))}
              className="w-full bg-gray-800/90 text-white border-2 border-[#FFD700]/30 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-400">Choose an available team below then click <span className="font-semibold text-[#FFD700]">Assign</span>.</div>
          </div>
        </div>
      </div>
      {/* Limits helper */}
      {selectedHouseId && (
        <div className="mb-6 bg-black/30 rounded-xl p-4 border border-[#FFD700]/20">
          <h4 className="text-sm text-gray-300 mb-2 font-semibold">Assignment guidance for selected house</h4>
          {isLoadingLimits ? (
            <div className="text-gray-400">Checking limits...</div>
          ) : houseLimits ? (
            // If API returned per-batch mapping
            houseLimits.batches ? (
              <div className="text-sm text-gray-300">
                {Object.entries(houseLimits.batches).map(([batch, info]: any) => (
                  <div key={batch} className="flex justify-between items-center py-1">
                    <div>Batch {batch}</div>
                    <div className="text-right">
                      <div>Slots left: <span className="font-semibold">{info.teamsLeftToBuy}</span></div>
                      <div>Min bid: <span className="font-semibold">${info.minBid}</span></div>
                      <div>Safe max: <span className="font-semibold">${info.computedMax}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-300">
                <div>Batch: <span className="font-semibold">{houseLimits.batch || 'N/A'}</span></div>
                <div>Slots left: <span className="font-semibold">{houseLimits.teamsLeftToBuy}</span></div>
                <div>Min bid: <span className="font-semibold">${houseLimits.minBid}</span></div>
                <div>Safe max: <span className="font-semibold">${houseLimits.computedMax}</span></div>
              </div>
            )
          ) : (
            <div className="text-sm text-gray-400">Select a house to see assignment guidance.</div>
          )}
        </div>
      )}

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
                      {team.name || `Team #${team.rank}`}
                    </h3>
                    {team.batch && (
                      <p className="text-sm text-gray-300">
                        Batch {team.batch}
                      </p>
                    )}
                    <p className="text-sm text-gray-400">
                      {team.memberCount} members
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-gray-600">
                  {team.status === "available" ? (
                    <div className="text-center">
                      <span className="inline-block bg-blue-600/90 text-white px-4 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                        ✨ Available
                      </span>
                      <div className="mt-4">
                        <button
                          onClick={() => handleAssign(team.teamId)}
                          disabled={!selectedHouseId || assignAmount === undefined || isAssigning}
                          className="mt-2 w-full bg-[#FFD700] hover:bg-[#FFCF3A] text-black px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAssigning ? "Assigning..." : "Assign to Selected House"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-300 mb-2">Sold to</p>
                      <div className="flex items-center justify-between bg-black/60 rounded-lg p-3 border border-[#FFD700]/30 mb-3">
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
                      
                      {/* Release Team Button */}
                      <button
                        onClick={() => handleReleaseClick(team)}
                        className="w-full bg-red-600/90 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                      >
                        🔓 Release Team
                      </button>
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

      {/* Release Team Confirmation Dialog */}
      {showReleaseDialog && teamToRelease && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-red-500/50 rounded-xl p-8 max-w-md w-full shadow-[0_0_40px_rgba(239,68,68,0.5)]">
            <h2 className="text-2xl font-bold text-red-400 mb-4 text-center">
              ⚠️ Release Team?
            </h2>
            
            <div className="space-y-3 mb-6 bg-black/40 rounded-lg p-4 border border-red-500/30">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Team:</span>
                <span className="text-white font-bold text-lg">{teamToRelease.name || `#${teamToRelease.rank}`}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Current House:</span>
                <span className="text-[#FFD700] font-bold">
                  {teamToRelease.soldToHouseName}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Refund Amount:</span>
                <span className="text-green-400 font-bold text-xl">
                  ${teamToRelease.soldPrice}
                </span>
              </div>
            </div>
            
            <p className="text-gray-300 text-center mb-6">
              This action will release {teamToRelease.name || `Team #${teamToRelease.rank}`} from{" "}
              <span className="text-[#FFD700] font-semibold">
                {teamToRelease.soldToHouseName}
              </span>{" "}
              and refund <span className="text-green-400 font-semibold">${teamToRelease.soldPrice}</span> to their budget.
            </p>
            
            <div className="flex gap-4">
              <button
                onClick={handleReleaseCancel}
                disabled={isReleasing}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              
              <button
                onClick={handleReleaseConfirm}
                disabled={isReleasing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReleasing ? "Releasing..." : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
