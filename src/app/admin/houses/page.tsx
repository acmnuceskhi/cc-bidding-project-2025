/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
// import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { fetchWithAuth } from "@/lib/fetchWithAuth"; // make sure this exists

interface PlayerWithPrice extends Participant {
  purchasePrice?: number;
}

interface filteredParticipant {
  participantId: string;
  name: string;
  picture?: string;
  houseId: string;
  purchasePrice?: number;
}

interface Round {
  _id: string;
  participantId: string;
  winningHouseId: string;
  winningBid: number;
}

interface House {
  houseId?: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
}

export default function HousesPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [housePlayers, setHousePlayers] = useState<
    Record<string, filteredParticipant[]>
  >({});
  const [hasActiveRound, setHasActiveRound] = useState(false);
  const [editingHouse, setEditingHouse] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState<{
    totalBudget?: string;
    adjustBy?: string;
  }>({});
  const [editMode, setEditMode] = useState<"total" | "adjust">("total");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to get house background image
  const getHouseBackground = (houseName: string) => {
    const houseMap: Record<string, string> = {
      "Lord Shen": "/lord-shen.jpg",
      "Dragon Warrior": "/dragon-warrior.jpg",
      "Master Oogway": "/master-oogway.jpg",
      "Tai Lung": "/tai-lung.jpg",
    };
    return houseMap[houseName] || "/arena-background.jpg";
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch houses
        const housesResponse = await fetchWithAuth("/api/houses", {
          method: "GET",
        });
        const housesData: House[] = await housesResponse.json();
        setHouses(housesData);

        // Check for active rounds
        const statusResponse = await fetchWithAuth("/api/status", {
          method: "GET",
        });
        const statusData = await statusResponse.json();
        setHasActiveRound(statusData.roundStatus === "active");

        // Fetch participants
        const participantsResponse = await fetchWithAuth("/api/participants", {
          method: "GET",
        });
        const participantsData: filteredParticipant[] =
          await participantsResponse.json();

        // Fetch rounds
        const roundsResponse = await fetchWithAuth("/api/rounds", {
          method: "GET",
        });
        const roundsData: Round[] = await roundsResponse.json();

        // Create a map of participantId -> winning bid
        const participantPriceMap: Record<string, number> = {};
        roundsData.forEach((round) => {
          const pid =
            typeof round.participantId === "object"
              ? round.participantId
              : round.participantId;
          if (pid) {
            participantPriceMap[pid] = round.winningBid ?? 0; // fallback to 0 if undefined
          }
        });

        // Group participants by houseId
        const grouped: Record<string, filteredParticipant[]> = {};
        housesData.forEach((house) => {
          const houseId =
            typeof house.houseId === "object" ? house.houseId : house.houseId;
          if (houseId) grouped[houseId] = [];
        });

        participantsData.forEach((p) => {
          if (p.houseId) {
            const houseKey =
              typeof p.houseId === "object" ? p.houseId : p.houseId;
            if (!houseKey) return;

            if (!grouped[houseKey]) grouped[houseKey] = [];

            const participantId =
              typeof p.participantId === "object"
                ? p.participantId
                : p.participantId;
            grouped[houseKey].push({
              ...p,
              purchasePrice: participantId
                ? participantPriceMap[participantId] || 0
                : 0,
            });
          }
        });

        setHousePlayers(grouped);
      } catch (err) {
        console.error("Failed to fetch houses, participants, or rounds", err);
      }
    };

    fetchData();
  }, []);

  const handleEditBudget = async (houseId: string) => {
    setLoading(true);
    setError(null);

    try {
      const body: { totalBudget?: number; adjustRemainingBy?: number } = {};

      if (editMode === "total") {
        const total = parseFloat(budgetInput.totalBudget || "0");
        if (isNaN(total) || total < 0) {
          setError("Please enter a valid positive number for total budget");
          setLoading(false);
          return;
        }
        body.totalBudget = total;
      } else {
        const adjust = parseFloat(budgetInput.adjustBy || "0");
        if (isNaN(adjust)) {
          setError("Please enter a valid number for adjustment");
          setLoading(false);
          return;
        }
        body.adjustRemainingBy = adjust;
      }

      const response = await fetchWithAuth(`/api/houses/${houseId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update budget");
      }

      // Refresh houses data
      const housesResponse = await fetchWithAuth("/api/houses", {
        method: "GET",
      });
      const housesData: House[] = await housesResponse.json();
      setHouses(housesData);

      // Close modal
      setEditingHouse(null);
      setBudgetInput({});
      setEditMode("total");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update budget");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_20px_#FFD700]">
          🏯 House Rosters
        </h1>
        <p className="text-gray-300">
          View all houses and their acquired warriors
        </p>
      </div>

      <div className="space-y-6">
        {houses.map((house, index) => {
          const players = housePlayers[house.houseId?.toString() || ""] || [];
          const totalSpent = house.totalBudget - house.remainingBudget;
          const percentage = house.totalBudget
            ? (house.remainingBudget / house.totalBudget) * 100
            : 0;

          return (
            <div
              key={house.houseId?.toString() || `house-${index}`}
              className="relative rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] transition-all overflow-hidden"
              style={{
                backgroundImage: `url('${getHouseBackground(house.name)}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Opacity overlay */}
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm"></div>

              {/* Content */}
              <div className="relative z-10">
                {/* House Header */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-6">
                  <div className="text-center sm:text-left">
                    <h2 className="text-3xl sm:text-4xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_20px_#FFD700]">
                      {house.name}
                    </h2>
                    <p className="text-gray-200 text-lg">
                      {players.length} warrior{players.length !== 1 ? "s" : ""}{" "}
                      recruited
                    </p>
                  </div>
                  <div className="text-center sm:text-right bg-black/60 rounded-xl p-4 sm:p-6 border border-[#FFD700]/30">
                    <div className="text-3xl sm:text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_15px_#FFD700]">
                      ${house.remainingBudget}
                    </div>
                    <div className="text-sm text-gray-200 mt-1">
                      ${totalSpent} spent • {percentage.toFixed(0)}% remaining
                    </div>
                    <div className="w-48 bg-black/60 rounded-full h-3 mt-3 border border-[#FFD700]/30">
                      <div
                        className="bg-[#FFD700] h-full rounded-full transition-all shadow-[0_0_10px_#FFD700]"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingHouse(house.houseId?.toString() || "");
                        setBudgetInput({});
                        setEditMode("total");
                        setError(null);
                      }}
                      className="mt-4 px-4 py-2 bg-[#FFD700] text-black font-semibold rounded-lg hover:bg-[#FFC700] transition-all shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                    >
                      Edit Budget
                    </button>
                  </div>
                </div>

                {/* Players Grid */}
                {players.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {players.map((player, idx) => (
                      <div
                        key={
                          player.participantId ||
                          `player-${house.houseId}-${idx}`
                        }
                        className="bg-black/60 rounded-xl p-4 border-2 border-[#FFD700]/50 hover:border-[#FFD700] transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(255,215,0,0.2)] hover:shadow-[0_0_25px_rgba(255,215,0,0.4)] backdrop-blur-sm"
                      >
                        <div className="flex items-center gap-4">
                          {player.picture && (
                            <img
                              src={player.picture}
                              alt={player.name}
                              className="w-16 h-16 rounded-full border-2 border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white drop-shadow-[0_0_10px_#000000]">
                              {player.name}
                            </h3>
                            {player.purchasePrice !== undefined && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xl sm:text-2xl font-bold text-green-400 drop-shadow-[0_0_10px_#22C55E]">
                                  ${player.purchasePrice}
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-gray-300 mt-1">
                              Acquired Warrior
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-black/40 rounded-xl border-2 border-dashed border-gray-600 backdrop-blur-sm">
                    <p className="text-xl text-gray-400">
                      No warriors recruited yet
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Start bidding to build your roster!
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Budget Edit Modal */}
      {editingHouse && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700] shadow-[0_0_50px_rgba(255,215,0,0.5)] max-w-md w-full">
            <h2 className="text-2xl font-bold text-[#FFD700] mb-4 drop-shadow-[0_0_15px_#FFD700]">
              Edit Budget
            </h2>

            {hasActiveRound ? (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-4">
                <p className="text-red-300 font-semibold">
                  ⚠️ Cannot modify budget during an active round
                </p>
                <p className="text-red-400 text-sm mt-1">
                  Please wait until the current auction round is complete.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-white mb-2 font-semibold">
                    Edit Mode
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={editMode === "total"}
                        onChange={() => setEditMode("total")}
                        className="accent-[#FFD700]"
                      />
                      <span className="text-gray-300">
                        Set Total Budget (preserves spent amount)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={editMode === "adjust"}
                        onChange={() => setEditMode("adjust")}
                        className="accent-[#FFD700]"
                      />
                      <span className="text-gray-300">
                        Adjust Remaining Budget Only (total unchanged)
                      </span>
                    </label>
                  </div>
                </div>

                {editMode === "total" ? (
                  <div className="mb-4">
                    <label className="block text-white mb-2 font-semibold">
                      New Total Budget
                    </label>
                    <input
                      type="number"
                      value={budgetInput.totalBudget || ""}
                      onChange={(e) =>
                        setBudgetInput({
                          ...budgetInput,
                          totalBudget: e.target.value,
                        })
                      }
                      placeholder="Enter total budget"
                      className="w-full px-4 py-2 bg-black/60 border border-[#FFD700]/50 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
                      min="0"
                    />
                  </div>
                ) : (
                  <div className="mb-4">
                    <label className="block text-white mb-2 font-semibold">
                      Adjust By (use negative to subtract)
                    </label>
                    <input
                      type="number"
                      value={budgetInput.adjustBy || ""}
                      onChange={(e) =>
                        setBudgetInput({
                          ...budgetInput,
                          adjustBy: e.target.value,
                        })
                      }
                      placeholder="e.g., 100 or -50"
                      className="w-full px-4 py-2 bg-black/60 border border-[#FFD700]/50 rounded-lg text-white focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>
                )}

                {error && (
                  <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 mb-4">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingHouse(null);
                  setBudgetInput({});
                  setError(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
              {!hasActiveRound && (
                <button
                  onClick={() => handleEditBudget(editingHouse)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-[#FFD700] text-black font-semibold rounded-lg hover:bg-[#FFC700] transition-all shadow-[0_0_15px_rgba(255,215,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
