"use client";

import { useState, useEffect } from "react";
import { useSynchronizedCountdown } from "@/hooks/useSynchronizedCountdown";

interface Participant {
  participantId: string;
  name: string;
  picture?: string;
}

interface WinnerData {
  houseName: string;
  amount: number;
}

interface House {
  _id: string;
  houseId: string;
  name: string;
  remainingBudget: number;
  totalBudget: number;
}

interface Bid {
  houseId: string;
  amount: number;
}

interface Status {
  roundStatus: "active" | "idle";
  roundId?: string;
  roundNumber?: number;
  participant?: Participant;
  timerEnd?: string;
  bidsPlaced?: Bid[];
  roundEnded?: boolean;
  winner?: WinnerData;
}

// Waiting Screen Component with Video
function WaitingScreen() {
  return (
    <div className="min-h-screen bg-black relative flex items-center justify-center overflow-hidden">
      {/* Full Screen Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/waiting-video.mp4" type="video/mp4" />
      </video>

      {/* Optional overlay text (you can remove this if you want just the video) */}
      <div className="relative z-10 text-center">
        <h1 className="text-5xl sm:text-7xl font-bold mb-8 text-[#FFD700] drop-shadow-[0_0_30px_#000000]">
          CC Bidding System
        </h1>
        <p className="text-3xl sm:text-4xl text-white drop-shadow-[0_0_20px_#000000]">
          Waiting for admin to start the next round...
        </p>
      </div>
    </div>
  );
}

export default function ProjectorDisplay() {
  const [status, setStatus] = useState<Status | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [winnerData, setWinnerData] = useState<WinnerData | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [lastRoundId, setLastRoundId] = useState<string | null>(null);

  // Server time hook not required directly; countdown uses hook

  // Synced countdown derived from server time
  const { remainingMs: projRemaining } = useSynchronizedCountdown(
    status?.roundStatus === "active" && status?.timerEnd
      ? status.timerEnd
      : null
  );
  useEffect(() => {
    setTimeLeft(projRemaining);
  }, [projRemaining]);

  const fetchLastRoundWinner = async () => {
    try {
      // Fetch all rounds and get the most recent completed one
      const roundsRes = await fetch("/api/rounds");
      if (roundsRes.ok) {
        const rounds = await roundsRes.json();
        const completedRounds = rounds.filter(
          (r: { status: string }) => r.status === "completed"
        );

        if (completedRounds.length > 0) {
          const lastRound = completedRounds[0]; // Most recent

          if (lastRound.winningBid) {
            // Fetch participant
            const participantRes = await fetch("/api/participants");
            if (participantRes.ok) {
              const participants = await participantRes.json();
              const roundParticipant = participants.find(
                (p: Participant) => p.participantId === lastRound.participantId
              );

              if (roundParticipant) {
                setParticipant(roundParticipant);
              }
            }

            // Fetch bids to get winner house name
            const bidsRes = await fetch(
              `/api/bids?roundId=${lastRound.roundId}`
            );
            if (bidsRes.ok) {
              const bids = await bidsRes.json();
              const winningBid = bids.find(
                (b: Bid & { amount: number }) =>
                  b.amount === lastRound.winningBid
              );

              if (winningBid) {
                // Try to get house name (might fail without auth, but try anyway)
                try {
                  const housesRes = await fetch("/api/houses");
                  if (housesRes.ok) {
                    const housesData: House[] = await housesRes.json();
                    const winningHouse = housesData.find(
                      (h) => h.houseId === winningBid.houseId.toString()
                    );
                    if (winningHouse) {
                      setWinnerData({
                        houseName: winningHouse.name,
                        amount: lastRound.winningBid,
                      });
                      setShowWinner(true);
                      setTimeout(() => {
                        setShowWinner(false);
                        setWinnerData(null);
                      }, 15000); // Show winner for 15 seconds
                    }
                  }
                } catch (err) {
                  console.log("Could not fetch house details");
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching last round winner:", error);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch status
      const statusRes = await fetch("/api/status", { cache: "no-store" });
      const statusData: Status = await statusRes.json();
      setStatus(statusData);

      // Fetch houses (handle 401 gracefully for projector)
      try {
        const housesRes = await fetch("/api/houses", { cache: "no-store" });
        if (housesRes.ok) {
          const housesData: House[] = await housesRes.json();
          setHouses(Array.isArray(housesData) ? housesData : []);
        } else {
          // If auth fails, use empty array (projector doesn't need house details)
          setHouses([]);
        }
      } catch (houseError) {
        console.log("Could not fetch houses (projector doesn't need auth)");
        setHouses([]);
      }

      // Update participant and timer
      if (statusData.roundStatus === "active" && statusData.participant) {
        setParticipant(statusData.participant);
        setLastRoundId(statusData.roundId || null);
        // timeLeft is driven by synchronized countdown hook
      } else {
        setTimeLeft(0);
      }

      // Check for winner announcement (direct from API)
      if (statusData.roundEnded && statusData.winner) {
        console.log("🏆 Winner detected from API:", statusData.winner);
        console.log("📝 Participant:", participant);
        setWinnerData(statusData.winner);
        setShowWinner(true);
        setLastRoundId(null); // Reset for next round

        // Auto-hide after 15 seconds
        setTimeout(() => {
          console.log("⏰ Hiding winner modal");
          setShowWinner(false);
          setWinnerData(null);
        }, 15000); // Show winner for 15 seconds
      } else {
        console.log(
          "📊 Status:",
          statusData.roundStatus,
          "RoundEnded:",
          statusData.roundEnded,
          "Winner:",
          statusData.winner
        );
      }

      // Also detect round end by checking if we had an active round that's now gone
      if (
        lastRoundId &&
        !statusData.roundId &&
        statusData.roundStatus !== "active"
      ) {
        console.log("🏆 Round ended, fetching winner info...");
        // Fetch the last completed round to get winner
        fetchLastRoundWinner();
        setLastRoundId(null);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  // Poll for data updates
  useEffect(() => {
    fetchData();

    const pollInterval = setInterval(() => {
      fetchData();
    }, 2000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Legacy boundary ticker removed; rAF-based hook handles countdown

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    return `${seconds}`;
  };

  // Winner Announcement Screen
  if (showWinner && winnerData) {
    return (
      <div
        className="min-h-screen bg-cover bg-center relative flex items-center justify-center"
        style={{ backgroundImage: "url('/arena-background.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/30 via-orange-500/30 to-red-600/30 backdrop-blur-sm"></div>

        <div className="relative z-10 text-center max-w-5xl mx-auto p-8">
          <h1 className="text-8xl sm:text-9xl font-bold mb-12 text-[#FFD700] drop-shadow-[0_0_40px_#FFD700] animate-pulse">
            🏆 SOLD! 🏆
          </h1>

          {participant?.picture && (
            <img
              src={participant.picture}
              alt={participant.name}
              className="w-48 h-48 sm:w-64 sm:h-64 object-cover rounded-full mx-auto mb-8 border-8 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.8)]"
            />
          )}

          <h2 className="text-5xl sm:text-7xl font-bold mb-8 text-white drop-shadow-[0_0_30px_#000000]">
            {participant?.name || "Participant"}
          </h2>

          <div className="text-4xl sm:text-5xl mb-8 text-white drop-shadow-[0_0_20px_#000000]">
            has been won by
          </div>

          <div className="bg-black/60 rounded-3xl p-8 sm:p-12 border-4 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.6)] backdrop-blur-md">
            <div className="text-6xl sm:text-8xl font-bold text-[#FFD700] mb-6 drop-shadow-[0_0_30px_#FFD700]">
              🏯 {winnerData.houseName}
            </div>
            <div className="text-5xl sm:text-6xl font-bold text-white drop-shadow-[0_0_20px_#FFFFFF]">
              for ${winnerData.amount}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Screen with Music
  if (!status || status.roundStatus !== "active") {
    return <WaitingScreen />;
  }

  // Active Bidding Screen
  const isTimeRunningOut = timeLeft < 10000;
  const bidsPlaced = status.bidsPlaced || [];

  // Get house background images
  const getHouseBackground = (houseName: string) => {
    const houseMap: Record<string, string> = {
      "Lord Shen": "/lord-shen.jpg",
      "Dragon Warrior": "/dragon-warrior.jpg",
      "Master Oogway": "/master-oogway.jpg",
      "Tai Lung": "/tai-lung.jpg",
    };
    return houseMap[houseName] || "/arena-background.jpg";
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center relative flex flex-col"
      style={{ backgroundImage: "url('/arena-background.jpg')" }}
    >
      {/* Enhanced dark overlay */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm"></div>

      {/* Neon grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFD70010_1px,transparent_1px),linear-gradient(to_bottom,#FFD70010_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"></div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Timer at Top */}
        <div className="text-center py-8">
          <div
            className={`text-8xl sm:text-[10rem] font-bold mb-4 transition-colors ${isTimeRunningOut ? "text-red-500 animate-pulse drop-shadow-[0_0_40px_#EF4444]" : "text-[#FFD700] drop-shadow-[0_0_40px_#FFD700]"}`}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="w-full max-w-4xl mx-auto bg-gray-700/60 rounded-full h-6 border-2 border-[#FFD700]/50 px-4">
            <div
              className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_20px_currentColor] ${
                isTimeRunningOut ? "bg-red-500" : "bg-green-500"
              }`}
              style={{
                width: `${Math.max(0, (timeLeft / 60000) * 100)}%`,
              }}
            ></div>
          </div>
          <div className="text-xl sm:text-2xl text-gray-300 mt-2">
            seconds remaining
          </div>
        </div>

        {/* Participant in Center */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="max-w-7xl w-full">
            {/* Participant Card */}
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-3xl p-8 sm:p-12 max-w-3xl mx-auto backdrop-blur-md border-4 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.5)] mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-center text-black">
                🥋 Current Warrior
              </h2>
              <div className="flex flex-col items-center gap-6">
                {participant?.picture ? (
                  <img
                    src={participant.picture}
                    alt={participant.name}
                    className="w-32 h-32 sm:w-48 sm:h-48 object-cover rounded-full border-4 border-black shadow-[0_0_30px_rgba(0,0,0,0.8)]"
                  />
                ) : (
                  <div className="w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full border-4 border-black shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center">
                    <span className="text-6xl sm:text-8xl">👤</span>
                  </div>
                )}
                <div className="text-center">
                  <h3 className="text-4xl sm:text-6xl font-bold text-black mb-2">
                    {participant?.name || "Loading..."}
                  </h3>
                  <p className="text-xl sm:text-2xl text-black/80">
                    Awaiting house bids...
                  </p>
                </div>
              </div>
            </div>

            {/* House Treasuries Cards */}
            <div className="bg-black/40 rounded-2xl p-6 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
                🏯 House Treasuries
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.isArray(houses) &&
                  houses.map((house) => {
                    const percentage =
                      (house.remainingBudget / house.totalBudget) * 100;
                    const hasBid = bidsPlaced.some(
                      (bid) => bid.houseId === house._id?.toString()
                    );

                    return (
                      <div
                        key={house._id?.toString()}
                        className={`relative rounded-xl p-4 sm:p-6 border-2 transition-all overflow-hidden ${
                          hasBid
                            ? "border-green-400 shadow-[0_0_25px_rgba(34,197,94,0.6)]"
                            : "border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)]"
                        }`}
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
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-2 text-center drop-shadow-[0_0_15px_#000000]">
                            {house.name}
                          </h3>
                          <div className="text-center mb-3">
                            <div className="text-2xl sm:text-3xl font-bold text-[#FFD700] drop-shadow-[0_0_15px_#FFD700]">
                              ${house.remainingBudget}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-200">
                              of ${house.totalBudget}
                            </div>
                          </div>
                          <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden border border-[#FFD700]/30">
                            <div
                              className="bg-[#FFD700] h-full rounded-full transition-all shadow-[0_0_10px_#FFD700]"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <div className="text-center mt-2 text-xs sm:text-sm text-gray-200">
                            {percentage.toFixed(0)}% remaining
                          </div>
                          {hasBid && (
                            <div className="text-center mt-2 text-sm font-bold text-green-300 drop-shadow-[0_0_10px_#000000]">
                              ✓ Bid Placed
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
