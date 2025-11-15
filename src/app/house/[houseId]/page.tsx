/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { House } from "@/lib/models/houses";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useSynchronizedCountdown } from "@/hooks/useSynchronizedCountdown";
import { useToast } from "@/components/ToastProvider";
import { FullPageSpinner } from "@/components/Spinner";
import { useSocket } from "@/hooks/useSocket";

interface Team {
  teamId: string;
  rank: number;
  batch: string;
  memberCount: number;
  successfulAttempts?: number;
  totalPoints?: number;
  timeTaken?: number;
}

interface HouseApiResponse {
  houseId: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
}

interface filteredRound {
  _id: string;
  roundId: string;
  teamId: string;
  status: "scheduled" | "active" | "completed";
  timerEnd?: string;
  scheduledStart?: string;
  finalized?: boolean;
}

export default function HouseDashboard() {
  const params = useParams();
  const houseId = params.houseId as string;

  const [house, setHouse] = useState<House | null>(null);
  const [activeRound, setActiveRound] = useState<
    (filteredRound & { roundNumber?: number }) | null
  >(null);
  const [currentTeam, setCurrentTeam] =
    useState<Team | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [currentBid, setCurrentBid] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [canBid, setCanBid] = useState<boolean>(true);
  const [canBidMessage, setCanBidMessage] = useState<string>("");
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const pollDelayRef = useRef<number>(10000);
  const retryCountRef = useRef<number>(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Socket.IO integration for real-time updates
  const { socket, isConnected, currentState, emit } = useSocket();

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

  // Stop polling when socket is connected, resume when disconnected
  useEffect(() => {
    if (isConnected) {
      // Clear any existing polling when socket connects
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    } else {
      // Resume polling with normal interval when socket disconnects
      pollDelayRef.current = 10000;
    }
  }, [isConnected]);

  useEffect(() => {
    const fetchData = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) {
          setInitialLoading(true);
        } else {
          setIsPolling(true);
        }
        const housesResponse = await fetchWithAuth("/api/houses", {
          cache: "no-store",
        });
        const allHouses = await housesResponse.json();

        const selectedHouse = allHouses.find(
          (h: HouseApiResponse) => h.houseId === houseId
        );
        if (!selectedHouse) {
          console.warn("No house found with ID:", houseId);
          setHouse(null);
          return;
        }
        setHouse(selectedHouse);

        const statusRes = await fetchWithAuth("/api/status", {
          cache: "no-store",
        });
        const statusData = await statusRes.json();

        // Reset retry count on success
        retryCountRef.current = 0;
        pollDelayRef.current = 10000;

        const hasActiveRound =
          statusData &&
          statusData.roundId &&
          statusData.roundStatus === "active";

        if (hasActiveRound) {
          const serverTimerEnd = statusData.timerEnd
            ? new Date(statusData.timerEnd)
            : null;

          if (serverTimerEnd) {
            setActiveRound({
              _id: statusData.roundId,
              roundId: statusData.roundId,
              teamId: statusData.team?.teamId || "",
              status: "active",
              timerEnd: serverTimerEnd.toISOString(),
              roundNumber: statusData.roundNumber,
            });

            setCurrentTeam(statusData.team || null);

            if (selectedHouse && statusData.team?.teamId) {
              try {
                const canBidRes = await fetchWithAuth(
                  `/api/houses/${selectedHouse.houseId}/canPlaceBid?teamId=${statusData.team.teamId}`,
                  { cache: "no-store" }
                );
                const canBidData = await canBidRes.json();

                setCanBid(!!canBidData.canBid);
                setCanBidMessage(canBidData.message || "");
              } catch (err) {
                console.error("Failed to check canBid:", err);
                setCanBid(true); // default to true to not block bidding if check fails
              }
            }

            // Fetch current bid for this house in this round
            try {
              const bidsRes = await fetchWithAuth(
                `/api/bids?roundId=${statusData.roundId}`,
                {
                  cache: "no-store",
                }
              );
              const bidsData = await bidsRes.json();

              if (Array.isArray(bidsData)) {
                const myBid = bidsData.find(
                  (bid: any) => bid.houseId === houseId
                );
                setCurrentBid(myBid ? myBid.amount : null);
              } else {
                setCurrentBid(null);
              }
            } catch (error) {
              console.error("Failed to fetch current bid:", error);
              setCurrentBid(null);
            }
          } else {
            setActiveRound(null);
            setCurrentTeam(null);
            setCurrentBid(null);
          }
        } else {
          setActiveRound(null);
          setCurrentTeam(null);
          setCurrentBid(null);
          setTimeLeft(0);
        }

        // Schedule next poll only if socket is NOT connected AND (there's an active round or we're still initializing)
        // When socket is connected, we rely on socket events for updates instead of polling
        if (!isConnected && (hasActiveRound || isInitialLoad)) {
          if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
          }
          pollTimeoutRef.current = setTimeout(() => {
            fetchData(false);
          }, pollDelayRef.current);
        }
      } catch (error) {
        console.error("Failed to fetch house data:", error);
        // Exponential backoff on errors
        retryCountRef.current++;
        const backoffDelay = Math.min(
          10000 * Math.pow(2, retryCountRef.current),
          60000
        );
        pollDelayRef.current = backoffDelay;

        // Still schedule next poll even on error (with backoff), but only if socket is not connected
        if (!isConnected) {
          if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
          }
          pollTimeoutRef.current = setTimeout(() => {
            fetchData(false);
          }, backoffDelay);
        }
      } finally {
        if (isInitialLoad) {
          setInitialLoading(false);
        } else {
          setIsPolling(false);
        }
      }
    };

    fetchData(true);

    // Listen to socket events for real-time updates
    // When socket is connected, we use events instead of polling
    if (socket) {
      const handleBidNotification = (data: { houseId: string; houseName: string; roundId: string }) => {
        // Only refresh if it's for the current round and not our own bid
        // We don't need to fetch for other houses' bids - just note that bidding is active
        if (data.roundId === activeRound?.roundId && data.houseId !== houseId) {
          // No need to fetch - just indicates other houses are bidding
          // The next state-update or round-end will provide full data
        }
      };

      const handleRoundStarted = (data?: { roundId: string; timerEnd: string }) => {
        // Round started - fetch full data to get team info, house budgets, etc.
        // Clear any pending polls since we're fetching now
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        // Fetch immediately to get all round data
        fetchData(false);
      };

      const handleRoundEnded = (data?: { roundId: string; winner: any; losers: any[] }) => {
        // Round ended - fetch to get winner details and updated house budgets
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        // Fetch immediately to get final state
        fetchData(false);
      };

      const handleStateUpdate = (state: any) => {
        // State update received - use it to update round state if it's bidding state
        // But we still need to fetch for house-specific data (budget, current bid)
        if (state.screen === "bidding" && state.roundId === activeRound?.roundId) {
          // Update round info from state
          if (state.timeLeft !== undefined) {
            // State has timeLeft in ms, but we need timerEnd as ISO string
            // We'll fetch to get full data including house budgets
            if (pollTimeoutRef.current) {
              clearTimeout(pollTimeoutRef.current);
              pollTimeoutRef.current = null;
            }
            // Debounce: only fetch if we haven't fetched recently
            pollTimeoutRef.current = setTimeout(() => {
              fetchData(false);
            }, 2000); // 2s debounce for state updates
          }
        } else if (state.screen === "waiting" || state.screen === "results") {
          // Round ended or waiting - fetch to get full state
          if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
          }
          fetchData(false);
        }
      };

      socket.on("bid-notification", handleBidNotification);
      socket.on("round-started", handleRoundStarted);
      socket.on("round-ended", handleRoundEnded);
      socket.on("state-update", handleStateUpdate);

      return () => {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
        }
        socket.off("bid-notification", handleBidNotification);
        socket.off("round-started", handleRoundStarted);
        socket.off("round-ended", handleRoundEnded);
        socket.off("state-update", handleStateUpdate);
      };
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [houseId, socket, activeRound?.roundId, isConnected]);

  const { remainingMs: houseRemaining } = useSynchronizedCountdown(
    activeRound?.timerEnd ?? null
  );
  useEffect(() => {
    setTimeLeft(houseRemaining);
  }, [houseRemaining]);

  const toast = useToast();

  const placeBid = async () => {
    if (!activeRound || !currentTeam || !house || bidAmount <= 0) return;
    setLoading(true);

    const toastId = toast.show("Placing bid…", { type: "info" });

    try {
      const response = await fetchWithAuth("/api/bids", {
        method: "POST",
        body: JSON.stringify({
          roundId: activeRound.roundId,
          amount: bidAmount,
          previousAmount: currentBid,
        }),
      });

      if (!response.ok) {
        let message = "Failed to place bid.";
        try {
          const errJson = await response.json();
          message = errJson.message || message;
        } catch {}
        toast.update(toastId, `Bid failed: ${message}`, {
          type: "error",
          duration: 3000,
        });
        setLoading(false);
        return;
      }

      toast.update(toastId, "Bid placed — confirming…", { type: "success" });

      response
        .json()
        .then((data) => {
          if (data.success) {
            const finalMsg =
              data.previousAmount == null
                ? `Bid confirmed: $${data.newAmount}`
                : `Bid updated from $${data.previousAmount} to $${data.newAmount}`;
            toast.update(toastId, finalMsg, {
              type: "success",
              duration: 2500,
            });
            setBidAmount(0);
            // Update current bid display
            setCurrentBid(data.newAmount || bidAmount);
            if (typeof data.remainingBudget === "number") {
              setHouse((prev) =>
                prev ? { ...prev, remainingBudget: data.remainingBudget } : prev
              );
            } else {
              fetchWithAuth("/api/houses")
                .then((r) => r.json())
                .then((houses) => {
                  const updated = houses.find(
                    (h: HouseApiResponse) => h.houseId === houseId
                  );
                  if (updated) setHouse(updated);
                })
                .catch(() => {});
            }
          } else {
            toast.update(toastId, data.message || "Bid failed", {
              type: "error",
              duration: 3000,
            });
          }
          setLoading(false);
        })
        .catch(() => {
          toast.update(toastId, "Failed to parse response", {
            type: "error",
            duration: 3000,
          });
          setLoading(false);
        });
    } catch (error: any) {
      toast.update(
        toastId,
        `${error.message || "Network error placing bid."}`,
        { type: "error", duration: 3500 }
      );
      setLoading(false);
    }
  };

  const formatTime = (ms: number) => `${Math.floor(ms / 1000)}s`;

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <FullPageSpinner message="Loading house..." />
      </div>
    );
  }

  if (!house) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center">
        <div className="text-xl text-white">House not found.</div>
      </div>
    );
  }

  const timeLeftValue = Math.max(0, timeLeft);
  const isTimeRunningOut = timeLeftValue < 10000;
  const budgetPercentage = (house.remainingBudget / house.totalBudget) * 100;

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{
        backgroundImage: house
          ? `url('${getHouseBackground(house.name)}')`
          : "url('/arena-background.jpg')",
        backgroundPosition: "center 30%",
      }}
    >
      {/* Enhanced dark overlay with neon glow */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs"></div>

      {/* Neon grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFD70010_1px,transparent_1px),linear-gradient(to_bottom,#FFD70010_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-gray-900/90 to-black/90 rounded-2xl p-6 sm:p-8 mb-6 sm:mb-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              <div className="text-center sm:text-left">
                <h1 className="text-4xl sm:text-5xl font-bold text-[#FFD700] drop-shadow-[0_0_20px_#FFD700] mb-2">
                  🏯 {house.name}
                </h1>
                <p className="text-lg sm:text-xl text-gray-200">
                  Command Center
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await fetchWithAuth("/api/auth/logout", { method: "POST" });
                    sessionStorage.removeItem("token");
                    sessionStorage.removeItem("role");
                    sessionStorage.removeItem("houseId");
                    window.location.href = "/login";
                  } catch (err) {
                    console.error("Logout failed:", err);
                  }
                }}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-2 sm:py-3 px-4 sm:px-6 rounded-xl font-bold transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              >
                Logout
              </button>
            </div>

            {/* Enhanced Budget Display */}
            <div className="bg-black/60 rounded-xl p-4 sm:p-6 border border-[#FFD700]/30 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                <div className="text-center sm:text-left">
                  <p className="text-gray-300 text-base sm:text-lg mb-1">
                    💰 Treasury Balance
                  </p>
                  <div className="flex items-baseline gap-2 sm:gap-3 justify-center sm:justify-start">
                    <span className="text-4xl sm:text-5xl font-bold text-[#FFD700] drop-shadow-[0_0_10px_#FFD700]">
                      ${house.remainingBudget}
                    </span>
                    <span className="text-lg sm:text-xl text-gray-400">
                      / ${house.totalBudget}
                    </span>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <div className="text-2xl sm:text-3xl font-bold text-[#FFD700] drop-shadow-[0_0_10px_#FFD700]">
                    {budgetPercentage.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-400">Remaining</div>
                </div>
              </div>
              <div className="w-full bg-black/60 rounded-full h-4 border border-[#FFD700]/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all shadow-[0_0_10px_currentColor] ${
                    budgetPercentage > 50
                      ? "bg-green-500"
                      : budgetPercentage > 25
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${budgetPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {activeRound && currentTeam ? (
            <div className="space-y-6 sm:space-y-8">
              {/* Enhanced Round & Team Info */}
              <div className="bg-gradient-to-br from-gray-900/90 to-black/90 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 mb-6">
                  <h2 className="text-3xl sm:text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_20px_#FFD700]">
                    ⚔️ ROUND {activeRound.roundNumber || "?"}
                  </h2>
                  <div className="text-center">
                    <div
                      className={`text-5xl sm:text-6xl font-bold ${isTimeRunningOut ? "text-red-500 animate-pulse drop-shadow-[0_0_20px_#FF0000]" : "text-[#FFD700] drop-shadow-[0_0_20px_#FFD700]"}`}
                    >
                      {formatTime(timeLeftValue)}
                    </div>
                    <div className="text-sm text-white font-semibold mt-1">
                      Time Left
                    </div>
                  </div>
                </div>

                {/* Timer Progress Bar */}
                <div className="w-full bg-black/60 rounded-full h-4 border border-[#FFD700]/30 overflow-hidden mb-8">
                  <div
                    className={`h-full rounded-full transition-all shadow-[0_0_15px_currentColor] ${
                      isTimeRunningOut ? "bg-red-500" : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.max(0, (timeLeftValue / 60000) * 100)}%`,
                    }}
                  ></div>
                </div>

                {/* Team Info Section */}
                <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
                  👥 TEAM UP FOR BIDDING
                </h2>
                <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
                  {/* Team Rank Badge */}
                  <div className="relative shrink-0 mx-auto sm:mx-0">
                    <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-[#FFD700] via-[#FFB800] to-[#FFA500] flex items-center justify-center border-4 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.5)]">
                      <span className="text-5xl sm:text-6xl font-bold text-black">#{currentTeam.rank}</span>
                    </div>
                  </div>

                  {/* Team Details */}
                  <div className="flex-1 space-y-4 w-full">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-[0_0_15px_#FFFFFF] text-center sm:text-left">
                      Team #{currentTeam.rank}
                    </h3>
                    
                    {/* Upper Row: Batch, Rank in Batch, Points */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                      <span className="bg-[#FFD700]/10 text-[#FFD700] px-4 py-2 rounded-lg font-semibold text-base sm:text-lg border border-[#FFD700]/40 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                        📚 Batch {currentTeam.batch}
                      </span>
                      <span className="bg-[#FFD700]/10 text-[#FFD700] px-4 py-2 rounded-lg font-semibold text-base sm:text-lg border border-[#FFD700]/40 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                        🏆 Rank #{currentTeam.rank}
                      </span>
                      {currentTeam.totalPoints !== undefined && (
                        <span className="bg-[#FFD700]/10 text-[#FFD700] px-4 py-2 rounded-lg font-semibold text-base sm:text-lg border border-[#FFD700]/40 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                          ⭐ {currentTeam.totalPoints} pts
                        </span>
                      )}
                    </div>
                    
                    {/* Lower Row: Member count and team info */}
                    <div className="bg-black/40 rounded-lg p-4 border border-[#FFD700]/30">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[#FFD700] font-bold text-lg">👥 {currentTeam.memberCount} Members</span>
                      </div>
                      <div className="text-gray-300 text-sm">
                        Ready for bidding
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Bidding Section */}
              <div className="bg-black/80 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
                {timeLeftValue > 0 ? (
                  canBid ? (
                    <div className="space-y-6">
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] text-center drop-shadow-[0_0_20px_#FFD700]">
                        💰 PLACE YOUR BID
                      </h2>

                      {currentBid !== null && (
                        <div className="bg-gradient-to-r from-[#FFD700]/20 to-yellow-600/20 border-2 border-[#FFD700] rounded-xl p-4 text-center shadow-[0_0_25px_rgba(255,215,0,0.4)]">
                          <div className="text-gray-200 text-sm sm:text-base mb-1">
                            Your Active Bid
                          </div>
                          <div className="text-3xl sm:text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_15px_#FFD700]">
                            ${currentBid}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-4">
                        <input
                          type="number"
                          id="bidAmount"
                          min="1"
                          max={house.remainingBudget}
                          value={bidAmount || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBidAmount(val === "" ? 0 : parseInt(val, 10));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !loading && bidAmount > 0 && bidAmount <= house.remainingBudget) {
                              placeBid();
                            }
                          }}
                          className="flex-1 bg-gray-900/80 border-2 border-[#FFD700]/50 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-white text-xl sm:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.2)]"
                          placeholder="Enter bid amount"
                        />
                        <button
                          onClick={placeBid}
                          disabled={
                            loading ||
                            bidAmount <= 0 ||
                            bidAmount > house.remainingBudget
                          }
                          className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-xl sm:text-2xl font-bold transition-all transform whitespace-nowrap ${
                            loading ||
                            bidAmount <= 0 ||
                            bidAmount > house.remainingBudget
                              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white hover:scale-105 shadow-[0_0_30px_rgba(34,197,94,0.5)]"
                          }`}
                        >
                          {loading ? "⏳ Placing..." : "✅ Place Bid"}
                        </button>
                      </div>
                      {bidAmount > house.remainingBudget && (
                        <div className="bg-red-900/80 border-2 border-red-500 rounded-lg p-4 text-center shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                          <p className="text-red-300 font-bold text-base sm:text-lg">
                            ⚠️ Bid amount exceeds your remaining treasury!
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-yellow-900/80 border-2 border-yellow-500 rounded-xl p-6 text-center shadow-[0_0_30px_rgba(255,215,0,0.3)]">
                      <p className="text-yellow-300 font-bold text-xl sm:text-2xl">
                        ⚠️{" "}
                        {canBidMessage ||
                          "You have already recruited 3 players from this batch!"}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="bg-red-900/80 border-2 border-red-500 rounded-xl p-6 text-center shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                    <p className="text-red-300 font-bold text-xl sm:text-2xl">
                      ⏰ Time&apos;s Up! Bidding has ended for this round
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-black/80 rounded-2xl p-8 sm:p-12 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
              <div className="text-center">
                <h2 className="text-3xl sm:text-4xl font-bold text-[#FFD700] mb-4 drop-shadow-[0_0_20px_#FFD700]">
                  ⏸️ No Active Round
                </h2>
                <p className="text-lg sm:text-xl text-gray-300">
                  Waiting for the next battle to begin...
                </p>
                <p className="text-gray-400 mt-4">
                  The admin will start the next round soon
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
