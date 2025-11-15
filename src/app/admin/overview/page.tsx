/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { House } from "@/lib/models/houses";
import { Team } from "@/lib/models/teams";
import { Round } from "@/lib/models/rounds";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useSynchronizedCountdown } from "@/hooks/useSynchronizedCountdown";
import { FullPageSpinner } from "@/components/Spinner";
import { useSocket } from "@/hooks/useSocket";

interface WinnerData {
  teamName: string;
  teamBatch?: string;
  teamRank?: number;
  memberCount?: number;
  houseName: string;
  amount: number;
}

export default function OverviewPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  // Track last active round ID to detect silent transitions
  const lastActiveRoundIdRef = useRef<string | null>(null);
  const [currentTeam, setCurrentTeam] =
    useState<Team | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);
  const [winnerData, setWinnerData] = useState<WinnerData | null>(null);
  const [isStartingRound, setIsStartingRound] = useState<boolean>(false);
  const [currentBids, setCurrentBids] = useState<any[]>([]);
  // Prevent repeatedly showing the winner modal across polling cycles
  const winnerShownRef = useRef<boolean>(false);

  // Use ref to capture current team without causing re-renders
  const currentTeamRef = useRef<Team | null>(null);
  // Server time hook not needed directly; countdown uses its own

  // Socket.IO integration for real-time updates
  const { socket, isConnected } = useSocket();

  // Update ref when currentTeam changes
  useEffect(() => {
    currentTeamRef.current = currentTeam;
  }, [currentTeam]);

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
        // Use team from current state ref OR from status data

        const team =
          currentTeamRef.current || statusData.team;
        console.log("📝 Using team for winner modal:", team);

        setWinnerData({
          teamName: `Team ${team?.rank || "?"}`,
          teamBatch: team?.batch,
          teamRank: team?.rank,
          memberCount: team?.memberCount,
          houseName: statusData.winner.houseName,
          amount: statusData.winner.amount,
        });
        setShowWinnerModal(true);
        winnerShownRef.current = true;

        // Auto-close after 15 seconds
        setTimeout(() => {
          setShowWinnerModal(false);
          setWinnerData(null);
        }, 15000);
      } else if (!statusData.roundEnded && !statusData.roundId && activeRound && !winnerShownRef.current) {
        // Round ended but winner not in status - fetch from completed rounds
        try {
          const roundsRes = await fetchWithAuth("/api/rounds");
          if (roundsRes.ok) {
            const rounds = await roundsRes.json();
            const lastCompleted = rounds.find((r: { status: string; roundId: string }) => 
              r.status === "completed" && r.roundId === activeRound._id?.toString()
            );
            
            if (lastCompleted && lastCompleted.winningBid && lastCompleted.winningHouseId) {
              const winningHouse = housesData.find((h: { _id: { toString: () => string } }) => 
                h._id?.toString() === lastCompleted.winningHouseId?.toString()
              );
              
              if (winningHouse) {
                const team = currentTeamRef.current || statusData.team;
                setWinnerData({
                  teamName: `Team ${team?.rank || "?"}`,
                  teamBatch: team?.batch,
                  teamRank: team?.rank,
                  memberCount: team?.memberCount,
                  houseName: winningHouse.name,
                  amount: lastCompleted.winningBid,
                });
                setShowWinnerModal(true);
                winnerShownRef.current = true;
                setTimeout(() => {
                  setShowWinnerModal(false);
                  setWinnerData(null);
                }, 15000);
              }
            }
          }
        } catch (err) {
          console.error("Error fetching completed round:", err);
        }
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
            teamId: statusData.team?.teamId,
            status: statusData.roundStatus,
            timerEnd: serverTimerEnd,
            bids: [],
          } as any);
          lastActiveRoundIdRef.current = statusData.roundId;

          setCurrentTeam(statusData.team || null);
          setRoundNumber(statusData.roundNumber || null);
          winnerShownRef.current = false;

          // Fetch current bids for this round
          try {
            const bidsRes = await fetchWithAuth(
              `/api/bids?roundId=${statusData.roundId}`,
              {
                cache: "no-store",
              }
            );
            const bidsData = await bidsRes.json();

            if (Array.isArray(bidsData)) {
              // Enrich bids with house names
              const enrichedBids = bidsData.map((bid: any) => {
                const house = housesData.find(
                  (h: any) => h.houseId === bid.houseId
                );
                return {
                  ...bid,
                  houseName: house?.name || "Unknown House",
                };
              });
              setCurrentBids(enrichedBids);
            } else {
              setCurrentBids([]);
            }
          } catch (error) {
            console.error("Failed to fetch current bids:", error);
            setCurrentBids([]);
          }
        } else {
          setActiveRound(null);
          setCurrentTeam(null);
          setCurrentBids([]);
          setRoundNumber(null);
        }
      } else {
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
            const roundsResp = await fetchWithAuth("/api/rounds", {
              cache: "no-store",
            });
            if (roundsResp.ok) {
              const allRounds = await roundsResp.json();
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
                const teamsResp = await fetchWithAuth(
                  "/api/teams",
                  { cache: "no-store" }
                );
                let teamName = "Unknown Team";
                let teamBatch: string | undefined = undefined;
                let teamRank: number | undefined = undefined;
                let memberCount: number | undefined = undefined;
                if (teamsResp.ok) {
                  const teamsList = await teamsResp.json();
                  const tMatch = teamsList.find(
                    (t: any) => t.teamId === targetRound.teamId
                  );
                  if (tMatch) {
                    teamName = `Team ${tMatch.rank}`;
                    teamBatch = tMatch.batch;
                    teamRank = tMatch.rank;
                    memberCount = tMatch.memberCount;
                  }
                }
                setWinnerData({
                  teamName,
                  teamBatch,
                  teamRank,
                  memberCount,
                  houseName,
                  amount: targetRound.winningBid,
                });
                setShowWinnerModal(true);
                winnerShownRef.current = true;
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
            lastActiveRoundIdRef.current = null;
          }
        }
        setActiveRound(null);
        setCurrentTeam(null);
        setRoundNumber(null);
      }
    } catch (error) {
      console.error("Error fetching overview data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData(true);
    
    // Only set up polling if socket is NOT connected
    // When socket is connected, we rely on socket events for updates
    let pollInterval: NodeJS.Timeout | null = null;
    
    if (!isConnected) {
      pollInterval = setInterval(() => fetchOverviewData(false), 2000);
    }
    
    // Listen to socket events for real-time updates
    if (socket) {
      const handleRoundStarted = () => {
        // Round started - fetch to get updated state
        fetchOverviewData(false);
      };

      const handleRoundEnded = () => {
        // Round ended - fetch to get winner details
        fetchOverviewData(false);
      };

      const handleStateUpdate = () => {
        // State update - fetch to get latest data
        // Debounce: use a small delay to avoid rapid fetches
        setTimeout(() => {
          fetchOverviewData(false);
        }, 1000);
      };

      const handleBidNotification = () => {
        // Bid placed - fetch to get updated bids
        // Debounce: use a small delay to avoid rapid fetches
        setTimeout(() => {
          fetchOverviewData(false);
        }, 1000);
      };

      socket.on("round-started", handleRoundStarted);
      socket.on("round-ended", handleRoundEnded);
      socket.on("state-update", handleStateUpdate);
      socket.on("bid-notification", handleBidNotification);

      return () => {
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        socket.off("round-started", handleRoundStarted);
        socket.off("round-ended", handleRoundEnded);
        socket.off("state-update", handleStateUpdate);
        socket.off("bid-notification", handleBidNotification);
      };
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [fetchOverviewData, isConnected, socket]);

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

      if (result.winningBid && result.winningBid.houseName) {
        console.log(
          "Manual end - showing winner modal for:",
          result.winningBid
        );
        const team = currentTeamRef.current;
        setWinnerData({
          teamName: `Team ${team?.rank || "?"}`,
          teamBatch: team?.batch,
          teamRank: team?.rank,
          memberCount: undefined, // Will need to calculate if needed
          houseName: result.winningBid.houseName,
          amount: result.winningBid.amount,
        });
        setShowWinnerModal(true);
        winnerShownRef.current = true;

        setTimeout(() => {
          setShowWinnerModal(false);
          setWinnerData(null);
        }, 10000);
      } else {
        alert(result.message || "Round ended with no bids");
      }

      setActiveRound(null);
      setCurrentTeam(null);
      setTimeLeft(0);

      setTimeout(async () => {
        await fetchOverviewData();
      }, 500);
    } catch (err: any) {
      console.error("Error ending current round:", err);
      alert(err.message || "Failed to end round");
    }
  };

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const handleReStartRound = async () => {
    if (!activeRound?._id) {
      alert("No active round to restart");
      return;
    }

    if (isStartingRound) return;
    setIsStartingRound(true);

    try {
      // Step 1: Restart the round (refund bids, reset state)
      const restartRes = await fetchWithAuth(
        `/api/rounds/${activeRound._id.toString()}/restart`,
        { method: "POST" }
      );
      const restartData = await restartRes.json();

      if (!restartRes.ok) {
        throw new Error(restartData.error || "Failed to restart round");
      }

      if (!restartData.canRestart) {
        alert(restartData.message || "Round cannot be restarted");
        setIsStartingRound(false);
        return;
      }

      // Step 2: Wait a moment for the restart to complete
      await delay(1000);

      // Step 3: Start the round again
      const startRes = await fetchWithAuth(
        `/api/rounds/${activeRound._id.toString()}/start`,
        { method: "POST" }
      );
      const startData = await startRes.json();

      if (!startRes.ok) {
        throw new Error(startData.error || startData.message || "Failed to start round");
      }

      // Step 4: Refresh the overview data
      await fetchOverviewData();
      
      alert("Round restarted successfully!");
    } catch (e: any) {
      console.error("Error restarting round:", e);
      alert(e.message || "Failed to restart round");
    } finally {
      setIsStartingRound(false);
    }
  };

  if (loading) {
    return <FullPageSpinner message="Loading admin overview..." />;
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Round Info */}
      <div className="bg-black/40 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
        {activeRound ? (
          <>
            <div className="text-center mb-6">
              <h2 className="text-4xl sm:text-5xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_20px_#FFD700]">
                ⚔️ Round {roundNumber ?? "?"}
              </h2>
              <p className="text-gray-300 text-base sm:text-lg">
                {activeRound.status === "active"
                  ? "Battle in Progress"
                  : "No Active Round"}
              </p>
            </div>

            <div className="text-center mb-8">
              <div
                className={`text-6xl sm:text-7xl font-bold mb-4 transition-colors duration-300 ${timeLeft > 30000 ? "text-green-400" : timeLeft > 10000 ? "text-yellow-400" : "text-red-500"}`}
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

            {currentTeam && (
              <div className="bg-black/60 rounded-xl p-6 text-center border-2 border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)] backdrop-blur-md">
                <h3 className="text-xl sm:text-2xl font-bold text-[#FFD700] mb-4 drop-shadow-[0_0_15px_#FFD700]">
                  👥 Current Team
                </h3>
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-bold text-white">
                      {currentTeam.batch ? `Batch ${currentTeam.batch} #${currentTeam.rank || roundNumber || "?"}` : `Team #${currentTeam.rank || roundNumber || "?"}`}
                    </p>
                    <p className="text-gray-300 mt-2">
                      Awaiting house bids...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Current Bids Display */}
            {activeRound && currentBids.length > 0 && (
              <div className="bg-black/60 rounded-xl p-6 border-2 border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)] backdrop-blur-md mt-6">
                <h3 className="text-xl sm:text-2xl font-bold text-[#FFD700] mb-4 text-center drop-shadow-[0_0_15px_#FFD700]">
                  💰 Current Bids
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {currentBids
                    .sort((a, b) => b.amount - a.amount) // Sort highest to lowest
                    .map((bid, index) => (
                      <div
                        key={bid._id || index}
                        className={`bg-black/60 rounded-lg p-4 border-2 ${
                          index === 0
                            ? "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                            : "border-[#FFD700]/30"
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-lg font-bold text-white mb-2">
                            {bid.houseName}
                          </div>
                          <div
                            className={`text-3xl font-bold ${
                              index === 0 ? "text-green-400" : "text-[#FFD700]"
                            } drop-shadow-[0_0_10px_currentColor]`}
                          >
                            ${bid.amount}
                          </div>
                          {index === 0 && (
                            <div className="text-green-400 text-sm mt-2 font-semibold">
                              🏆 Leading
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400 text-xl sm:text-2xl py-10">
            No active round currently.
          </div>
        )}
      </div>

      {/* House Treasuries with Backgrounds */}
      <div className="bg-black/40 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
          🏯 House Treasuries
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {houses.map((house, index) => {
            const percentage =
              (house.remainingBudget / house.totalBudget) * 100;

            return (
              <div
                key={house._id?.toString() || `house-${index}`}
                className="relative rounded-xl p-6 border-2 border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)] transform hover:scale-105 transition-all overflow-hidden"
                style={{
                  backgroundImage: `url('${getHouseBackground(house.name)}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* Opacity overlay */}
                <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"></div>

                {/* Content */}
                <div className="relative z-10">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 text-center drop-shadow-[0_0_15px_#000000]">
                    {house.name}
                  </h3>
                  <div className="text-center mb-4">
                    <div className="text-3xl sm:text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_15px_#FFD700]">
                      ${house.remainingBudget}
                    </div>
                    <div className="text-sm text-gray-200">
                      of ${house.totalBudget}
                    </div>
                  </div>
                  <div className="w-full bg-black/60 rounded-full h-4 overflow-hidden border border-[#FFD700]/30">
                    <div
                      className="bg-[#FFD700] h-full rounded-full transition-all shadow-[0_0_10px_#FFD700]"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-center mt-2 text-sm text-gray-200">
                    {percentage.toFixed(0)}% remaining
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-black/40 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
          ⚡ Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={handleStartNextRound}
            disabled={!!activeRound || isStartingRound}
            className={`bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
          >
            {isStartingRound ? "⏳ Starting..." : "Start Next Round"}
          </button>
          <button
            onClick={handleEndCurrentRound}
            disabled={!activeRound || timeLeft === 0}
            className={`bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-6 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
          >
            End Current Round
          </button>
          <button
            onClick={handleReStartRound}
            disabled={!activeRound || isStartingRound}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isStartingRound ? "⏳ Restarting..." : "Restart Round"}
          </button>
        </div>
      </div>

      {/* Winner Modal - Neon Theme */}
      {showWinnerModal && winnerData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.4)] max-w-2xl w-full mx-4 relative overflow-hidden animate-slide-up">
            {/* Subtle grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFD70005_1px,transparent_1px),linear-gradient(to_bottom,#FFD70005_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-20"></div>

            <div className="relative z-10 text-center">
              <h1 className="text-4xl sm:text-5xl font-bold text-[#FFD700] mb-6 drop-shadow-[0_0_20px_#FFD700]">
                🏆 SOLD! 🏆
              </h1>

              <div className="bg-black/40 rounded-xl p-6 mb-6 border border-[#FFD700]/40 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
                <div className="text-5xl mb-4">👥</div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 drop-shadow-[0_0_15px_#FFFFFF]">
                  {winnerData.teamName}
                </h2>
                {winnerData.teamBatch && winnerData.teamRank && (
                  <p className="text-lg text-gray-300 mb-2">
                    Batch {winnerData.teamBatch} #{winnerData.teamRank}
                  </p>
                )}
                {winnerData.memberCount && (
                  <p className="text-sm text-gray-400 mb-3">
                    {winnerData.memberCount} members
                  </p>
                )}
                <p className="text-xl text-gray-300">
                  has been won by
                </p>
              </div>

              <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 rounded-xl p-6 border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.3)]">
                <h3 className="text-3xl sm:text-4xl font-bold text-[#FFD700] mb-3 drop-shadow-[0_0_20px_#FFD700]">
                  🏯 {winnerData.houseName}
                </h3>
                <div className="text-3xl sm:text-4xl font-bold text-white drop-shadow-[0_0_15px_#FFFFFF]">
                  for ${winnerData.amount}
                </div>
              </div>

              <button
                onClick={() => {
                  setShowWinnerModal(false);
                  setWinnerData(null);
                }}
                className="mt-6 bg-[#FFD700] hover:bg-[#FFB800] text-black font-bold py-2 px-6 rounded-lg text-lg transition-all shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:shadow-[0_0_30px_rgba(255,215,0,0.6)] transform hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
