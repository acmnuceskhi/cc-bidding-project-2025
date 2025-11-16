"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

// interface Bid {
//   _id?: string;
//   roundId: string;
//   houseId: string;
//   participantId: string;
//   amount: number;
//   timestamp: Date;
//   edits?: number;
// }

interface House {
  houseId?: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
}

interface RoundWithDetails {
  _id: string;
  roundNumber: number; // can be indexed or derived
  teamRank: number;
  teamBatch?: string;
  status: "not_started" | "active" | "completed"; // UI-friendly status
  winnerHouse?: string;
  winningBid?: number;
  timerEnd?: Date;
}

interface filteredRound {
  _id: string; // matches MongoDB _id
  roundId: string; // matches MongoDB _id
  teamId: string;
  status: "scheduled" | "active" | "completed"; // matches schema
  timerEnd?: string; // string from API, parse to Date
  scheduledStart?: string; // string from API, parse to Date
  finalized?: boolean;
  winningBid?: number;
}

interface filteredTeam {
  teamId: string;
  rank: number;
  batch?: string;
  successfulAttempts: number;
  totalPoints: number;
  houseId?: string;
}

export default function RoundsPage() {
  const [rounds, setRounds] = useState<RoundWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRound, setSelectedRound] = useState<RoundWithDetails | null>(
    null
  );

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

  const fetchRounds = async () => {
    try {
      setLoading(true);

      // Fetch rounds with no-store to avoid stale cache
      const roundsRes = await fetchWithAuth("/api/rounds", { cache: "no-store" });
      const roundsData: filteredRound[] = await roundsRes.json();

      // Ensure roundsData is an array
      if (!Array.isArray(roundsData)) {
        console.error("Rounds API did not return an array:", roundsData);
        setRounds([]);
        setLoading(false);
        return;
      }

      // Fetch teams and houses with no-store
      const [teamsRes, housesRes] = await Promise.all([
        fetchWithAuth("/api/teams", { cache: "no-store" }),
        fetchWithAuth("/api/houses", { cache: "no-store" }),
      ]);

      const teamsData: filteredTeam[] =
        await teamsRes.json();
      const housesData: House[] = await housesRes.json();

      // Ensure teamsData and housesData are arrays
      if (!Array.isArray(teamsData) || !Array.isArray(housesData)) {
        console.error("Teams or Houses API did not return arrays");
        setRounds([]);
        setLoading(false);
        return;
      }

      // Sort the API rounds before mapping
      // const sortedRoundsData = roundsData.sort((a, b) => {
      //   // Example: sort by scheduledStart if present
      //   const dateA = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
      //   const dateB = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
      //   return dateA - dateB;
      // });

      // Map rounds to RoundWithDetails
      const mapped: RoundWithDetails[] = roundsData.map((round, index) => {
        const team = teamsData.find(
          (t) => t.teamId === round.teamId
        );

        const now = new Date();
        let status: "not_started" | "active" | "completed" = "not_started";
        const timerEndDate =
          round.timerEnd && !isNaN(new Date(round.timerEnd).getTime())
            ? new Date(round.timerEnd)
            : undefined;
        // const scheduledStartDate = round.scheduledStart ? new Date(round.scheduledStart) : undefined;

        // Map schema status to UI-friendly status
        // Respect DB status first, only use time checks as fallback for active rounds
        if (round.status === "completed") {
          status = "completed";
        } else if (round.status === "active") {
          // For active rounds, check if timer has expired
          status = timerEndDate && timerEndDate < now ? "completed" : "active";
        } else if (round.status === "scheduled") {
          status = "not_started";
        }

        const house = housesData.find(
          (h) => String(h.houseId) === String(team?.houseId)
        );

        return {
          _id: round._id || round.roundId,
          roundNumber: index + 1,
          teamRank: team?.rank ?? 0,
          teamBatch: team?.batch,
          status,
          timerEnd: timerEndDate,
          winningBid: round.winningBid,
          winnerHouse: house?.name ?? undefined, // Use undefined instead of "Unknown" for no winner
        };
      });

      // Fetching Winning Bid and House from db above instead of manual calculation
      // After fetching winning bids for completed rounds
      // await Promise.all(
      //   mapped.map(async (r) => {
      //     if (r.status === "completed") {
      //       // r.winningBid
      //       try {
      //         const bidsRes = await fetchWithAuth(`/api/bids?roundId=${r._id}`);
      //         const bids: Bid[] = await bidsRes.json();
      //         if (bids.length > 0) {
      //           const topBid = bids.reduce((max, bid) =>
      //             bid.amount > max.amount ? bid : max
      //           );
      //           r.winningBid = topBid.amount;
      //           const house = housesData.find(
      //             (h) => String(h.houseId) === String(topBid.houseId)
      //           );
      //           r.winnerHouse = house?.name ?? "Unknown";
      //         }
      //       } catch (error) {
      //         console.error(`Failed to fetch bids for round ${r._id}:`, error);
      //       }
      //     }
      //   })
      // );

      // Sort rounds by roundNumber before updating state
      const sortedMapped = mapped.sort((a, b) => {
        if (a.roundNumber !== b.roundNumber)
          return a.roundNumber - b.roundNumber;
        return (a.timerEnd?.getTime() || 0) - (b.timerEnd?.getTime() || 0);
      });

      setRounds(sortedMapped);
    } catch (err) {
      console.error("Error fetching rounds:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  const handleStartRound = async (roundId: string) => {
    await fetchWithAuth(`/api/rounds/${roundId}/start`, { method: "POST" });
    await fetchRounds();
  };

  const handleEndRound = async (roundId: string) => {
    await fetchWithAuth(`/api/rounds/${roundId}/end`, { method: "POST" });
    await fetchRounds();
  };

  const handleReStartRound = async (roundId: string) => {
    try {
      const res = await fetchWithAuth(`/api/rounds/${roundId}/restart`, {
        method: "POST",
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(`Failed to restart round: ${error.error || 'Unknown error'}`);
        return;
      }
      
      const response = await res.json();
      
      if (response.success) {
        alert(`Round reset successfully! ${response.message || ''}\nBids cleared: ${response.bidsCleared}\nAmount refunded: $${response.totalRefundAmount}\n\nThe round is now available to start from Admin Main.`);
        // Small delay to ensure DB updates propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        await fetchRounds();
      } else {
        alert(`Could not restart: ${response.message || 'Round not in completed state'}`);
      }
    } catch (error) {
      console.error('Restart error:', error);
      alert('Failed to restart round');
    }
  };

  const handleViewDetails = (round: RoundWithDetails) => {
    setSelectedRound(round);
  };

  const closeModal = () => setSelectedRound(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-600 text-white";
      case "active":
        return "bg-yellow-600 text-black animate-pulse";
      default:
        return "bg-gray-600 text-gray-300";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "✅ Completed";
      case "active":
        return "⚡ Active Now";
      case "not_started":
        return "⏳ Not Started";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_20px_#FFD700]">
          ⏱️ Bidding Rounds
        </h1>
        <p className="text-gray-300">Complete history of all auction rounds</p>
      </div>

      {loading && (
        <div className="text-center text-[#FFD700] text-lg animate-pulse">
          Loading...
        </div>
      )}

      <div className="space-y-4">
        {rounds.map((round, index) => {
          const backgroundImage =
            round.status === "completed" && round.winnerHouse
              ? getHouseBackground(round.winnerHouse)
              : round.status === "active"
                ? "/arena-background.jpg"
                : "/temple-out.jpg";

          return (
            <div
              key={round._id || `round-${index}`}
              className="relative rounded-xl p-6 border-2 shadow-lg transition-all overflow-hidden"
              style={{
                backgroundImage: `url('${backgroundImage}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Opacity overlay */}
              <div
                className={`absolute inset-0 ${
                  round.status === "active"
                    ? "bg-yellow-900/70 backdrop-blur-sm"
                    : round.status === "completed"
                      ? "bg-black/70 backdrop-blur-xs"
                      : "bg-gray-900/80 backdrop-blur-sm"
                }`}
              ></div>

              {/* Neon border effect for active */}
              {round.status === "active" && (
                <div className="absolute inset-0 border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.6)] animate-pulse"></div>
              )}

              {/* Content */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-[#FFD700] mb-1 drop-shadow-[0_0_20px_#FFD700]">
                      {round.roundNumber}
                    </div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getStatusBadge(
                        round.status
                      )}`}
                    >
                      {getStatusText(round.status)}
                    </span>
                  </div>

                  <div className="w-20 h-20 rounded-full border-4 border-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.5)] bg-gradient-to-br from-yellow-600 to-orange-600 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-black">#{round.teamRank}</div>
                      {round.teamBatch && <div className="text-xs text-black">{round.teamBatch}</div>}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1 drop-shadow-[0_0_10px_#000000]">
                      Team #{round.teamRank}
                    </h3>
                    {round.teamBatch && (
                      <p className="text-sm text-gray-200 mb-1">
                        Batch {round.teamBatch}
                      </p>
                    )}
                    {round.status === "completed" && round.winnerHouse && (
                      <p className="text-lg text-gray-200">
                        Sold to{" "}
                        <span className="text-[#FFD700] font-bold drop-shadow-[0_0_10px_#FFD700]">
                          {round.winnerHouse}
                        </span>{" "}
                        for{" "}
                        <span className="text-green-400 font-bold text-2xl drop-shadow-[0_0_10px_#22C55E]">
                          ${round.winningBid}
                        </span>
                      </p>
                    )}
                    {round.status === "active" && (
                      <p className="text-[#FFD700] font-semibold animate-pulse drop-shadow-[0_0_10px_#FFD700]">
                        Bidding in progress...
                      </p>
                    )}
                    {round.status === "not_started" && (
                      <p className="text-gray-400">Awaiting start</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {round.status === "completed" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReStartRound(round._id)}
                        className="bg-red-600/90 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-[0_0_20px_rgba(59,130,246,0.5)] transform hover:scale-105"
                      >
                        Restart
                      </button>
                      <button
                        onClick={() => handleViewDetails(round)}
                        className="bg-blue-700/90 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-[0_0_20px_rgba(156,163,175,0.4)] transform hover:scale-105"
                      >
                        View Details
                      </button>
                    </div>
                  )}
                  {round.status === "active" && (
                    <button
                      onClick={() => handleEndRound(round._id)}
                      className="bg-red-600/90 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-[0_0_20px_rgba(239,68,68,0.5)] transform hover:scale-105"
                    >
                      End Round
                    </button>
                  )}
                  {round.status === "not_started" && (
                    <button
                      onClick={() => handleStartRound(round._id)}
                      className="bg-green-600/90 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.5)] transform hover:scale-105"
                    >
                      Start Round
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for View Details */}
      {selectedRound && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-900 to-black text-white rounded-2xl p-8 w-11/12 md:w-2/3 lg:w-1/2 relative border-2 border-[#FFD700]/50 shadow-[0_0_40px_rgba(255,215,0,0.4)]">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-3xl font-bold hover:text-[#FFD700] transition-colors drop-shadow-[0_0_10px_#FFD700]"
            >
              ✖
            </button>
            <h2 className="text-4xl font-bold mb-6 text-[#FFD700] drop-shadow-[0_0_20px_#FFD700]">
              Round {selectedRound.roundNumber} Details
            </h2>
            <div className="space-y-4 text-lg">
              <p>
                <strong className="text-[#FFD700]">Team:</strong>{" "}
                <span className="text-white">
                  Team #{selectedRound.teamRank}
                </span>
              </p>
              {selectedRound.teamBatch && (
                <p>
                  <strong className="text-[#FFD700]">Batch:</strong>{" "}
                  <span className="text-white">
                    {selectedRound.teamBatch}
                  </span>
                </p>
              )}
              {selectedRound.winnerHouse && (
                <p>
                  <strong className="text-[#FFD700]">Winner House:</strong>{" "}
                  <span className="text-white">
                    {selectedRound.winnerHouse}
                  </span>
                </p>
              )}
              {selectedRound.winningBid !== undefined ? (
                <p>
                  <strong className="text-[#FFD700]">Winning Bid:</strong>{" "}
                  <span className="text-green-400 font-bold text-2xl drop-shadow-[0_0_10px_#22C55E]">
                    ${selectedRound.winningBid}
                  </span>
                </p>
              ) : selectedRound.status === "completed" ? (
                <p className="text-gray-400">No bids placed</p>
              ) : null}
              <p>
                <strong className="text-[#FFD700]">Status:</strong>{" "}
                <span className="text-white">
                  {getStatusText(selectedRound.status)}
                </span>
              </p>
              {selectedRound.timerEnd && (
                <p>
                  <strong className="text-[#FFD700]">Timer End:</strong>{" "}
                  <span className="text-white">
                    {selectedRound.timerEnd.toLocaleString()}
                  </span>
                </p>
              )}
            </div>
            <button
              onClick={closeModal}
              className="mt-6 bg-gradient-to-r from-[#FFD700] to-[#FFB800] text-black font-bold py-3 px-8 rounded-lg transition-all shadow-[0_0_20px_rgba(255,215,0,0.5)] transform hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
