/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { Round } from "@/lib/models/rounds";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useSynchronizedCountdown } from "@/hooks/useSynchronizedCountdown";

interface WinnerData {
  participantName: string;
  participantPicture?: string;
  houseName: string;
  amount: number;
}

export default function OverviewPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  // Track last active round ID to detect silent transitions
  const lastActiveRoundIdRef = useRef<string | null>(null);
  const [currentParticipant, setCurrentParticipant] =
    useState<Participant | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);
  const [winnerData, setWinnerData] = useState<WinnerData | null>(null);
  const [isStartingRound, setIsStartingRound] = useState<boolean>(false);
  // Prevent repeatedly showing the winner modal across polling cycles
  const winnerShownRef = useRef<boolean>(false);

  // Use ref to capture current participant without causing re-renders
  const currentParticipantRef = useRef<Participant | null>(null);

  // Server time hook not needed directly; countdown uses its own

  // Update ref when currentParticipant changes
  useEffect(() => {
    currentParticipantRef.current = currentParticipant;
  }, [currentParticipant]);

  // ⏱️ Fetch all overview data
  const fetchOverviewData = useCallback(async (showLoadingScreen = false) => {
    try {
      if (showLoadingScreen) {
        setLoading(true);
      }

      const statusRes = await fetchWithAuth("/api/status", {
        cache: "no-store",
      });
      const statusData = await statusRes.json();

      const housesRes = await fetchWithAuth("/api/houses", {
        cache: "no-store",
      });
      const housesData = await housesRes.json();

      setHouses(housesData || []);

      // Check if round just ended (server-side auto-end)
      console.log("🔍 Status check:", {
        roundEnded: statusData.roundEnded,
        winner: statusData.winner,
        alreadyShown: winnerShownRef.current,
      });

      if (
        statusData.roundEnded &&
        statusData.winner &&
        !winnerShownRef.current
      ) {
        console.log(
          "🏆 Server detected round end with winner:",
          statusData.winner
        );
        // Use participant from current state ref OR from status data
        const participant =
          currentParticipantRef.current || statusData.participant;
        console.log("📝 Using participant for winner modal:", participant);

        setWinnerData({
          participantName: participant?.name || "Unknown",
          participantPicture: participant?.picture,
          houseName: statusData.winner.houseName,
          amount: statusData.winner.amount,
        });
        setShowWinnerModal(true);
        winnerShownRef.current = true;

        // Auto-close after 10 seconds
        setTimeout(() => {
          setShowWinnerModal(false);
          setWinnerData(null);
        }, 10000);
      }

      // Only set active round if status is "active", not "completed"
      if (
        statusData &&
        statusData.roundId &&
        statusData.roundStatus === "active"
      ) {
        const serverTimerEnd = statusData.timerEnd
          ? new Date(statusData.timerEnd)
          : null;

        if (serverTimerEnd) {
          setActiveRound({
            _id: statusData.roundId,
            participantId: statusData.participant.participantId,
            status: statusData.roundStatus,
            timerEnd: serverTimerEnd,
            bids: [],
          } as any);
          lastActiveRoundIdRef.current = statusData.roundId; // remember current active round

          setCurrentParticipant(statusData.participant || null);
          // timeLeft driven by synchronized countdown hook; round number still from API
          setRoundNumber(statusData.roundNumber || null);
          // New round is active; allow showing a winner again when this ends
          winnerShownRef.current = false;
        } else {
          // If no valid timer, reset everything
          setActiveRound(null);
          setCurrentParticipant(null);
          setRoundNumber(null);
        }
      } else {
        // No active round reported.
        // If we previously had an active round and did NOT get roundEnded/winner payload (missed auto-end response), attempt fallback winner reconstruction.
        if (
          lastActiveRoundIdRef.current &&
          !winnerShownRef.current &&
          !statusData.roundEnded &&
          !statusData.winner
        ) {
          console.log(
            "⚠️ Possible missed auto-end response. Attempting fallback winner fetch."
          );
          try {
            // Fetch all rounds
            const roundsResp = await fetchWithAuth("/api/rounds", {
              cache: "no-store",
            });
            if (roundsResp.ok) {
              const allRounds = await roundsResp.json();
              // Find the last completed round whose id matches previous active or most recent completed
              const completedRounds = allRounds.filter(
                (r: any) => r.status === "completed"
              );
              const targetRound =
                completedRounds.find(
                  (r: any) => r.roundId === lastActiveRoundIdRef.current
                ) || completedRounds[0];
              if (targetRound && targetRound.winningBid) {
                console.log(
                  "✅ Fallback found winning bid for round",
                  targetRound.roundId
                );
                // Fetch bids for that round to identify winning house
                const bidsResp = await fetchWithAuth(
                  `/api/bids?roundId=${targetRound.roundId}`,
                  { cache: "no-store" }
                );
                let houseName = "Unknown House";
                if (bidsResp.ok) {
                  const bids = await bidsResp.json();
                  const winningBidObj = bids.find(
                    (b: any) => b.amount === targetRound.winningBid
                  );
                  if (winningBidObj) {
                    // Fetch houses to map name
                    const housesResp2 = await fetchWithAuth("/api/houses", {
                      cache: "no-store",
                    });
                    if (housesResp2.ok) {
                      const housesList = await housesResp2.json();
                      const house = housesList.find(
                        (h: any) => h.houseId === winningBidObj.houseId
                      );
                      if (house) houseName = house.name;
                    }
                  }
                }
                // Fetch participants to get participant name
                const participantsResp = await fetchWithAuth(
                  "/api/participants",
                  { cache: "no-store" }
                );
                let participantName = "Unknown";
                let participantPicture: string | undefined = undefined;
                if (participantsResp.ok) {
                  const participantsList = await participantsResp.json();
                  const pMatch = participantsList.find(
                    (p: any) => p.participantId === targetRound.participantId
                  );
                  if (pMatch) {
                    participantName = pMatch.name;
                    participantPicture = pMatch.picture;
                  }
                }
                setWinnerData({
                  participantName,
                  participantPicture,
                  houseName,
                  amount: targetRound.winningBid,
                });
                setShowWinnerModal(true);
                winnerShownRef.current = true;
                // Auto-close after 10s
                setTimeout(() => {
                  setShowWinnerModal(false);
                  setWinnerData(null);
                }, 10000);
              } else {
                console.log(
                  "ℹ️ Fallback: No completed round with winning bid found."
                );
              }
            }
          } catch (fallbackErr) {
            console.warn("Fallback winner fetch failed:", fallbackErr);
          } finally {
            // Clear last active round reference regardless
            lastActiveRoundIdRef.current = null;
          }
        }
        setActiveRound(null);
        setCurrentParticipant(null);
        setRoundNumber(null);
      }
    } catch (error) {
      console.error("Error fetching overview data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load with loading screen
    fetchOverviewData(true);
    // Poll more frequently (2s) to reduce chance of missing the single auto-end response
    const pollInterval = setInterval(() => fetchOverviewData(false), 2000);
    return () => clearInterval(pollInterval);
  }, [fetchOverviewData]);

  // Millisecond-synced countdown via server time
  const { remainingMs: syncedRemainingMs } = useSynchronizedCountdown(
    activeRound?.timerEnd ? activeRound.timerEnd.toISOString() : null
  );
  useEffect(() => {
    setTimeLeft(syncedRemainingMs);
  }, [syncedRemainingMs]);

  const handleStartNextRound = async () => {
    if (isStartingRound) return;
    setIsStartingRound(true);
    try {
      const response = await fetchWithAuth("/api/rounds/next/start", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        setIsStartingRound(false);
        alert(result.error || result.message || "Failed to start round");
        return;
      }
      await fetchOverviewData();
      setIsStartingRound(false);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to start round");
      setIsStartingRound(false);
    }
  };

  const handleEndCurrentRound = async () => {
    if (!activeRound?._id) return;

    // Only allow ending if round is active
    if (activeRound.status !== "active") {
      alert("Can only end an active round");
      return;
    }

    try {
      const response = await fetchWithAuth(
        `/api/rounds/${activeRound._id}/end`,
        { method: "POST" }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to end round");
      }

      // Show winner announcement if there was a winning bid (BEFORE clearing state)
      if (result.winningBid && result.winningBid.houseName) {
        console.log(
          "Manual end - showing winner modal for:",
          result.winningBid
        );
        const participant = currentParticipantRef.current;
        setWinnerData({
          participantName: participant?.name || "Unknown",
          participantPicture: participant?.picture,
          houseName: result.winningBid.houseName,
          amount: result.winningBid.amount,
        });
        setShowWinnerModal(true);
        winnerShownRef.current = true; // Mark as shown for manual end too

        // Auto-close after 10 seconds
        setTimeout(() => {
          setShowWinnerModal(false);
          setWinnerData(null);
        }, 10000);
      } else {
        alert(result.message || "Round ended with no bids");
      }

      // Clear active round after setting winner data
      setActiveRound(null);
      setCurrentParticipant(null);
      setTimeLeft(0);

      // Refresh data after a short delay to ensure DB is updated
      setTimeout(async () => {
        await fetchOverviewData();
      }, 500);
    } catch (err: any) {
      console.error("Error ending current round:", err);
      alert(err.message || "Failed to end round");
    }
  };

  const handleViewFullStats = () => {
    // Redirect to rounds page (or open modal)
    window.location.href = "/rounds";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-yellow-400 text-3xl">
        Loading admin overview...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 🏁 Round Info */}
      <div className="bg-black bg-opacity-40 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
        {activeRound ? (
          <>
            <div className="text-center mb-6">
              <h2 className="text-5xl font-bold text-yellow-400 mb-2">
                ⚔️ Round {roundNumber ?? "?"}
              </h2>
              <p className="text-gray-300 text-lg">
                {activeRound.status === "active"
                  ? "Battle in Progress"
                  : "No Active Round"}
              </p>
            </div>

            <div className="text-center mb-8">
              <div
                className={`text-7xl font-bold mb-4 transition-colors duration-300 ${timeLeft > 30000 ? "text-green-400" : timeLeft > 10000 ? "text-yellow-400" : "text-red-500"}`}
              >
                {`${Math.floor(timeLeft / 1000)}s`}
              </div>
              <div className="w-full max-w-2xl mx-auto bg-gray-800 rounded-full h-6 overflow-hidden border-2 border-yellow-600">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timeLeft > 30000
                      ? "bg-green-500"
                      : timeLeft > 10000
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${(timeLeft / 60000) * 100}%` }}
                ></div>
              </div>
            </div>

            {currentParticipant && (
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl p-6 text-center">
                <h3 className="text-2xl font-bold text-black mb-4">
                  🥋 Current Warrior
                </h3>
                <div className="flex items-center justify-center gap-6">
                  {currentParticipant.picture && (
                    <img
                      src={currentParticipant.picture}
                      alt={currentParticipant.name}
                      className="w-24 h-24 rounded-full border-4 border-black shadow-lg"
                    />
                  )}
                  <div className="text-left">
                    <p className="text-3xl font-bold text-black">
                      {currentParticipant.name}
                    </p>
                    <p className="text-black text-opacity-80">
                      Awaiting house bids...
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400 text-2xl py-10">
            No active round currently.
          </div>
        )}
      </div>

      {/* 🏯 House Treasuries */}
      <div className="bg-black bg-opacity-40 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
        <h2 className="text-3xl font-bold text-yellow-400 mb-6 text-center">
          🏯 House Treasuries
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {houses.map((house, index) => {
            const percentage =
              (house.remainingBudget / house.totalBudget) * 100;
            const getColor = () => {
              if (percentage > 70) return "from-green-600 to-green-800";
              if (percentage > 40) return "from-yellow-600 to-orange-700";
              return "from-red-600 to-red-800";
            };

            return (
              <div
                key={house._id?.toString() || `house-${index}`}
                className={`bg-gradient-to-br ${getColor()} rounded-xl p-6 border-2 border-yellow-600 shadow-lg transform hover:scale-105 transition-all`}
              >
                <h3 className="text-2xl font-bold text-white mb-3 text-center">
                  {house.name}
                </h3>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-yellow-300">
                    ${house.remainingBudget}
                  </div>
                  <div className="text-sm text-gray-200">
                    of ${house.totalBudget}
                  </div>
                </div>
                <div className="w-full bg-black bg-opacity-40 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-yellow-400 h-full rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="text-center mt-2 text-sm text-gray-200">
                  {percentage.toFixed(0)}% remaining
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⚡ Quick Actions */}
      <div className="bg-black bg-opacity-40 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
        <h2 className="text-3xl font-bold text-yellow-400 mb-6 text-center">
          ⚡ Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleStartNextRound}
            disabled={!!activeRound || isStartingRound} // Disable if a round is active or starting
            className={`bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isStartingRound ? "⏳ Starting..." : "▶️ Start Next Round"}
          </button>
          <button
            onClick={handleEndCurrentRound}
            disabled={!activeRound || timeLeft === 0} // Disable if no active round or timer is 0
            className={`bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            ⏹️ End Current Round
          </button>
          <button
            onClick={handleViewFullStats}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105"
          >
            📊 View Full Stats
          </button>
        </div>
      </div>

      {/* 🏆 Winner Announcement Modal */}
      {showWinnerModal && winnerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm will-change-transform">
          <div className="bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 rounded-3xl p-12 border-8 border-yellow-400 shadow-2xl max-w-4xl w-full mx-4">
            <div className="text-center">
              <h1 className="text-7xl font-bold text-black mb-8 drop-shadow-lg">
                🏆 SOLD! 🏆
              </h1>

              {/* Participant Info */}
              <div className="bg-black bg-opacity-40 rounded-2xl p-8 mb-8">
                {winnerData.participantPicture && (
                  <img
                    src={winnerData.participantPicture}
                    alt={winnerData.participantName}
                    className="w-48 h-48 rounded-full border-8 border-yellow-400 shadow-2xl mx-auto mb-6"
                  />
                )}
                <h2 className="text-5xl font-bold text-yellow-300 mb-4">
                  {winnerData.participantName}
                </h2>
                <p className="text-3xl text-white">has been won by</p>
              </div>

              {/* Winner House */}
              <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-2xl p-8 border-4 border-yellow-400">
                <h3 className="text-6xl font-bold text-yellow-300 mb-4">
                  🏯 {winnerData.houseName}
                </h3>
                <div className="text-5xl font-bold text-white">
                  for ${winnerData.amount}
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => {
                  setShowWinnerModal(false);
                  setWinnerData(null);
                }}
                className="mt-8 bg-black bg-opacity-60 hover:bg-opacity-80 text-white font-bold py-3 px-8 rounded-lg text-xl transition-all"
              >
                Close (Auto-closes in 10s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
