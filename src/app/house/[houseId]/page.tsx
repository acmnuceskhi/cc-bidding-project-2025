/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useSynchronizedCountdown } from "@/hooks/useSynchronizedCountdown";
import { useToast } from "@/components/ToastProvider";

interface ParticipantWithDetails extends Participant {
  batch?: string;
  universityId?: string;
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
  participantId: string;
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
  const [currentParticipant, setCurrentParticipant] =
    useState<ParticipantWithDetails | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [currentBid, setCurrentBid] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);

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
              roundId: statusData.roundId,
              participantId: statusData.participant?.participantId || "",
              status: "active",
              timerEnd: serverTimerEnd.toISOString(),
              roundNumber: statusData.roundNumber,
            });

            setCurrentParticipant(statusData.participant || null);

            // Fetch current bid for this house in this round
            try {
              const bidsRes = await fetchWithAuth(`/api/bids?roundId=${statusData.roundId}`, {
                cache: "no-store",
              });
              const bidsData = await bidsRes.json();
              
              if (Array.isArray(bidsData)) {
                const myBid = bidsData.find((bid: any) => bid.houseId === houseId);
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
            setCurrentParticipant(null);
            setCurrentBid(null);
          }
        } else {
          setActiveRound(null);
          setCurrentParticipant(null);
          setCurrentBid(null);
          setTimeLeft(0);
        }
      } catch (error) {
        console.error("Failed to fetch house data:", error);
        setHouse(null);
        setActiveRound(null);
        setCurrentParticipant(null);
        setTimeLeft(0);
      }
    };

    fetchData();

    const pollInterval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [houseId]);

  const { remainingMs: houseRemaining } = useSynchronizedCountdown(
    activeRound?.timerEnd ?? null
  );
  useEffect(() => {
    setTimeLeft(houseRemaining);
  }, [houseRemaining]);

  const toast = useToast();

  const placeBid = async () => {
    if (!activeRound || !currentParticipant || !house || bidAmount <= 0) return;
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
        backgroundImage: house ? `url('${getHouseBackground(house.name)}')` : "url('/arena-background.jpg')",
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
                <p className="text-lg sm:text-xl text-gray-200">Command Center</p>
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
                  <p className="text-gray-300 text-base sm:text-lg mb-1">💰 Treasury Balance</p>
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
                    budgetPercentage > 50 ? "bg-green-500" : budgetPercentage > 25 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${budgetPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {activeRound && currentParticipant ? (
            <div className="space-y-6 sm:space-y-8">
              {/* Enhanced Round Info */}
              <div className="bg-gradient-to-br from-gray-900/90 to-black/90 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 mb-6">
                  <h2 className="text-3xl sm:text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_20px_#FFD700]">
                    ⚔️ ROUND {activeRound.roundNumber || "?"}
                  </h2>
                  <div className="text-center">
                    <div className={`text-5xl sm:text-6xl font-bold ${isTimeRunningOut ? "text-red-500 animate-pulse drop-shadow-[0_0_20px_#FF0000]" : "text-[#FFD700] drop-shadow-[0_0_20px_#FFD700]"}`}>
                      {formatTime(timeLeftValue)}
                    </div>
                    <div className="text-sm text-white font-semibold mt-1">Time Left</div>
                  </div>
                </div>

                {/* Timer Progress Bar */}
                <div className="w-full bg-black/60 rounded-full h-4 border border-[#FFD700]/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all shadow-[0_0_15px_currentColor] ${
                      isTimeRunningOut ? "bg-red-500" : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.max(0, (timeLeftValue / 60000) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Enhanced Player Info */}
              <div className="bg-black/80 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
                  🥋 WARRIOR UP FOR BIDDING
                </h2>
                <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                  {/* Player Picture */}
                  <div className="relative flex-shrink-0">
                    {currentParticipant.picture ? (
                      <img
                        src={currentParticipant.picture}
                        alt={currentParticipant.name}
                        className="w-32 h-32 sm:w-48 sm:h-48 object-cover rounded-full border-4 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.5)]"
                      />
                    ) : (
                      <div className="w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full border-4 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.5)] flex items-center justify-center">
                        <span className="text-4xl sm:text-6xl">👤</span>
                      </div>
                    )}
                    {currentParticipant.batch && (
                      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-black px-4 sm:px-6 py-2 rounded-full border-2 border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.5)]">
                        <span className="text-[#FFD700] font-bold text-sm sm:text-lg">{currentParticipant.batch}</span>
                      </div>
                    )}
                  </div>

                  {/* Player Details */}
                  <div className="flex-1 space-y-3 text-center sm:text-left w-full">
                    <h3 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-[0_0_15px_#FFFFFF]">
                      {currentParticipant.name}
                    </h3>
                    {currentParticipant.universityId && (
                      <div className="flex items-center justify-center sm:justify-start gap-3">
                        <span className="bg-[#FFD700]/20 text-[#FFD700] px-4 py-2 rounded-lg font-bold text-lg sm:text-xl border border-[#FFD700]/50 shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                          🎓 {currentParticipant.universityId}
                        </span>
                      </div>
                    )}
                    {currentParticipant.batch && (
                      <div className="text-lg sm:text-xl text-gray-300">
                        📚 Year: <span className="text-[#FFD700] font-semibold">{currentParticipant.batch}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Enhanced Bidding Section */}
              <div className="bg-black/80 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
                {timeLeftValue > 0 ? (
                  <div className="space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] text-center drop-shadow-[0_0_20px_#FFD700]">
                      💰 PLACE YOUR BID
                    </h2>
                    
                    {/* Current Bid Display */}
                    {currentBid !== null && (
                      <div className="bg-gradient-to-r from-[#FFD700]/20 to-yellow-600/20 border-2 border-[#FFD700] rounded-xl p-4 text-center shadow-[0_0_25px_rgba(255,215,0,0.4)]">
                        <div className="text-gray-200 text-sm sm:text-base mb-1">Your Active Bid</div>
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
                        className="flex-1 bg-gray-900/80 border-2 border-[#FFD700]/50 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-white text-xl sm:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.2)]"
                        placeholder="Enter bid amount"
                      />
                      <button
                        onClick={placeBid}
                        disabled={loading || bidAmount <= 0 || bidAmount > house.remainingBudget}
                        className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-xl sm:text-2xl font-bold transition-all transform whitespace-nowrap ${
                          loading || bidAmount <= 0 || bidAmount > house.remainingBudget
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
                <h2 className="text-3xl sm:text-4xl font-bold text-[#FFD700] mb-4 drop-shadow-[0_0_20px_#FFD700]">⏸️ No Active Round</h2>
                <p className="text-lg sm:text-xl text-gray-300">Waiting for the next battle to begin...</p>
                <p className="text-gray-400 mt-4">The admin will start the next round soon</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}