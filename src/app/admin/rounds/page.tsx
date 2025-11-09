"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Bid {
  _id?: string;
  roundId: string;
  houseId: string;
  participantId: string;
  amount: number;
  timestamp: Date;
  edits?: number;
}

interface House {
  _id?: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
}

interface RoundWithDetails {
  _id: string;
  roundNumber: number; // can be indexed or derived
  participantName: string;
  participantPicture?: string;
  status: "not_started" | "active" | "completed"; // UI-friendly status
  winnerHouse?: string;
  winningBid?: number;
  timerEnd?: Date;
}

interface filteredRound {
  _id: string; // matches MongoDB _id
  participantId: string;
  status: "scheduled" | "active" | "completed"; // matches schema
  timerEnd?: string; // string from API, parse to Date
  scheduledStart?: string; // string from API, parse to Date
}

interface filteredParticipant {
  participantId: string;
  name: string;
  picture?: string;
}

export default function RoundsPage() {
  const [rounds, setRounds] = useState<RoundWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRound, setSelectedRound] = useState<RoundWithDetails | null>(null);

  const fetchRounds = async () => {
    try {
      setLoading(true);

      // Fetch rounds
      const roundsRes = await fetchWithAuth("/api/rounds");
      const roundsData: filteredRound[] = await roundsRes.json();

      // Fetch participants and houses
      const [participantsRes, housesRes] = await Promise.all([
        fetchWithAuth("/api/participants"),
        fetchWithAuth("/api/houses"),
      ]);

      const participantsData: filteredParticipant[] = await participantsRes.json();
      const housesData: House[] = await housesRes.json();

      // Sort the API rounds before mapping
      const sortedRoundsData = roundsData.sort((a, b) => {
        // Example: sort by scheduledStart if present
        const dateA = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
        const dateB = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
        return dateA - dateB;
      });

      // Map rounds to RoundWithDetails
      const mapped: RoundWithDetails[] = roundsData.map((round, index) => {
        const participant = participantsData.find(p => p.participantId === round.participantId);

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

        return {
          _id: round._id,
          roundNumber: index + 1,
          participantName: participant?.name ?? "Unknown",
          participantPicture: participant?.picture,
          status,
          timerEnd: timerEndDate,
        };
      });

      // After fetching winning bids for completed rounds
      await Promise.all(
        mapped.map(async (r) => {
          if (r.status === "completed") {
            try {
              const bidsRes = await fetchWithAuth(`/api/bids?roundId=${r._id}`);
              const bids: Bid[] = await bidsRes.json();
              if (bids.length > 0) {
                const topBid = bids.reduce((max, bid) =>
                  bid.amount > max.amount ? bid : max
                );
                r.winningBid = topBid.amount;
                const house = housesData.find(
                  (h) => String(h._id) === String(topBid.houseId)
                );
                r.winnerHouse = house?.name ?? "Unknown";
              }
            } catch (error) {
              console.error(`Failed to fetch bids for round ${r._id}:`, error);
            }
          }
        })
      );

      // Sort rounds by roundNumber before updating state
      const sortedMapped = mapped.sort((a, b) => {
        if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
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
        <h1 className="text-4xl font-bold text-yellow-400 mb-2">⏱️ Bidding Rounds</h1>
        <p className="text-gray-300">Complete history of all auction rounds</p>
      </div>

      {loading && <div className="text-center text-yellow-400 text-lg">Loading...</div>}

      <div className="space-y-4">
        {rounds.map((round, index) => (
          <div
            key={round._id || `round-${index}`}
            className={`rounded-xl p-6 border-4 shadow-lg transition-all ${
              round.status === "active"
                ? "bg-gradient-to-r from-yellow-700 to-orange-700 border-yellow-400 animate-pulse"
                : round.status === "completed"
                ? "bg-gradient-to-r from-green-700 to-green-900 border-green-500"
                : "bg-gradient-to-r from-gray-700 to-gray-900 border-gray-500"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-5xl font-bold text-yellow-400 mb-1">{round.roundNumber}</div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getStatusBadge(
                      round.status
                    )}`}
                  >
                    {getStatusText(round.status)}
                  </span>
                </div>

                {round.participantPicture && (
                  <img
                    src={round.participantPicture}
                    alt={round.participantName}
                    className="w-20 h-20 rounded-full border-4 border-yellow-400 shadow-lg"
                  />
                )}

                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">{round.participantName}</h3>
                  {round.status === "completed" && round.winnerHouse && (
                    <p className="text-lg text-gray-200">
                      Sold to{" "}
                      <span className="text-yellow-400 font-bold">{round.winnerHouse}</span> for{" "}
                      <span className="text-green-400 font-bold text-2xl">${round.winningBid}</span>
                    </p>
                  )}
                  {round.status === "active" && (
                    <p className="text-yellow-300 font-semibold animate-pulse">Bidding in progress...</p>
                  )}
                  {round.status === "not_started" && <p className="text-gray-400">Awaiting start</p>}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {round.status === "completed" && (
                  <button
                    onClick={() => handleViewDetails(round)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                  >
                    📊 View Details
                  </button>
                )}
                {round.status === "active" && (
                  <button
                    onClick={() => handleEndRound(round._id)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                  >
                    ⏹️ End Round
                  </button>
                )}
                {round.status === "not_started" && (
                  <button
                    onClick={() => handleStartRound(round._id)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                  >
                    ▶️ Start Round
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for View Details */}
      {selectedRound && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-white rounded-lg p-6 w-11/12 md:w-2/3 lg:w-1/2 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-xl font-bold hover:text-yellow-400"
            >
              ✖
            </button>
            <h2 className="text-3xl font-bold mb-4">Round {selectedRound.roundNumber} Details</h2>
            <p className="mb-2">
              <strong>Participant:</strong> {selectedRound.participantName}
            </p>
            {selectedRound.winnerHouse && (
              <p className="mb-2">
                <strong>Winner House:</strong> {selectedRound.winnerHouse}
              </p>
            )}
            {selectedRound.winningBid !== undefined ? (
              <p className="mb-2">
                <strong>Winning Bid:</strong> ${selectedRound.winningBid}
              </p>
            ) : selectedRound.status === "completed" ? (
              <p className="mb-2 text-gray-400">No bids placed</p>
            ) : null}
            <p className="mb-2">
              <strong>Status:</strong> {getStatusText(selectedRound.status)}
            </p>
            {selectedRound.timerEnd && (
              <p className="mb-2">
                <strong>Timer End:</strong> {selectedRound.timerEnd.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
