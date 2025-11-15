"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import type { AuctionState } from "@/types/socket";

interface Team {
  teamId: string;
  rank: number;
  batch: string;
  memberCount: number;
  successfulAttempts?: number;
  totalPoints?: number;
  timeTaken?: number;
}

interface WinnerData {
  houseName: string;
  amount: number;
  allBids?: Array<{ houseId: string; houseName: string; amount: number }>;
}

interface House {
  _id: string;
  houseId: string;
  name: string;
  remainingBudget: number;
  totalBudget: number;
}

//

type Phase = "A_NOT_STARTED" | "B_ENDED" | "C_A_LIVE_IDLE" | "C_B_LIVE_PRESTART" | "C_C_LIVE_ENDED" | "C_D_LIVE_ACTIVE";

interface HouseBidState {
  status: "no-bid" | "bid-placed" | "bid-updated";
  showFlash: boolean;
  previousAmount?: number;
}

// Waiting Screen Component
function WaitingScreen({ auctionState }: { auctionState?: AuctionState | null }) {
  const [displayText, setDisplayText] = useState("");
  const [audioStarted, setAudioStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fullText = "Waiting for admin to start the next round...";

  // Prefer round-level countdown; fallback to auction-level
  const auctionCountdownEnd = (() => {
    if (!auctionState) return null;
    const now = Date.now();
    const roundStartMs = auctionState.currentRoundStartTime
      ? new Date(auctionState.currentRoundStartTime).getTime()
      : null;
    if (roundStartMs && now < roundStartMs) return auctionState.currentRoundStartTime;

    const startMs = auctionState.auctionStartTime
      ? new Date(auctionState.auctionStartTime).getTime()
      : null;
    const endMs = auctionState.auctionEndTime
      ? new Date(auctionState.auctionEndTime).getTime()
      : null;
    if (startMs && now < startMs) return auctionState.auctionStartTime;
    if (endMs && now < endMs) return auctionState.auctionEndTime;
    return null;
  })();
  const [auctionRemainingMs, setAuctionRemainingMs] = useState<number>(0);
  useEffect(() => {
    const calc = () => {
      if (!auctionCountdownEnd) {
        setAuctionRemainingMs(0);
        return;
      }
      const end = new Date(auctionCountdownEnd).getTime();
      setAuctionRemainingMs(Math.max(0, end - Date.now()));
    };
    const id = setInterval(calc, 1000);
    calc();
    return () => clearInterval(id);
  }, [auctionCountdownEnd]);

  const startAudio = useCallback(() => {
    if (!audioStarted && !audioRef.current) {
      const audio = new Audio("/oogway-ascends.mp3");
      audio.loop = true;
      audio.volume = 0.5;
      audioRef.current = audio;
      
      audio.play().then(() => {
        if (process.env.NODE_ENV === "development") {
          //console.log("🎵 Music started!");
        }
        setAudioStarted(true);
      }).catch(() => {});
    }
  }, [audioStarted]);

  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 80);

    const events = ['click', 'touchstart', 'keydown', 'mousemove'];
    events.forEach(event => {
      document.addEventListener(event, startAudio, { once: true });
    });

    return () => {
      clearInterval(typingInterval);
      events.forEach(event => {
        document.removeEventListener(event, startAudio);
      });
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [startAudio, fullText]);

  return (
    <div 
      className="min-h-screen bg-black relative flex items-center justify-center overflow-hidden cursor-pointer"
      onClick={startAudio}
      onTouchStart={startAudio}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/waiting-video.mp4" type="video/mp4" />
      </video>

      <div className="relative z-10 text-center px-8">
        <h1 className="text-5xl sm:text-7xl font-bold mb-8 text-[#FFD700] drop-shadow-[0_0_30px_#000000] animate-pulse">
          CC Bidding System
        </h1>
        <p className="text-3xl sm:text-4xl text-white drop-shadow-[0_0_20px_#000000] font-mono min-h-12">
          {displayText}
          <span className="animate-pulse">|</span>
        </p>
        {auctionState && (
          <p className="text-xl sm:text-2xl text-white/90 mt-4 drop-shadow-[0_0_12px_#000000]">
            {(() => {
              const now = Date.now();
              const roundStartMs = auctionState.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
              if (roundStartMs && now < roundStartMs) return `Round starts in ${Math.max(0, Math.floor(auctionRemainingMs / 1000))}s`;
              const startMs = auctionState.auctionStartTime ? new Date(auctionState.auctionStartTime).getTime() : null;
              const endMs = auctionState.auctionEndTime ? new Date(auctionState.auctionEndTime).getTime() : null;
              if (startMs && now < startMs) return `Auction starts in ${Math.max(0, Math.floor(auctionRemainingMs / 1000))}s`;
              if (endMs && now < endMs) return `Auction live • ends in ${Math.max(0, Math.floor(auctionRemainingMs / 1000))}s`;
              if (endMs && now >= endMs) return "Auction finished";
              return "Auction status pending";
            })()}
          </p>
        )}
        {!audioStarted && displayText.length > 0 && (
          <p className="text-sm text-gray-400 mt-8 animate-pulse">
            Click or tap anywhere to enable sound
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProjectorDisplay() {
  const [houses, setHouses] = useState<House[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [phase, setPhase] = useState<Phase>("A_NOT_STARTED");
  const [winnerData, setWinnerData] = useState<WinnerData | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [houseBidStates, setHouseBidStates] = useState<Record<string, HouseBidState>>({});
  const lastCompletedWinnerRef = useRef<WinnerData | null>(null);
  const teamRef = useRef<Team | null>(null);
  const bidSoundRef = useRef<HTMLAudioElement | null>(null);
  const winnerSoundRef = useRef<HTMLAudioElement | null>(null);

  // Socket.IO integration for real-time updates
  const { socket, auctionState } = useSocket();

  // Phase recomputation every 1s; no clock drift compensation required
  const computePhase = useCallback((): Phase => {
    const now = Date.now();
    const aStart = auctionState?.auctionStartTime ? new Date(auctionState.auctionStartTime).getTime() : null;
    const aEnd = auctionState?.auctionEndTime ? new Date(auctionState.auctionEndTime).getTime() : null;
    const rStart = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
    const rEnd = auctionState?.currentRoundEndTime ? new Date(auctionState.currentRoundEndTime).getTime() : null;
    const hasRound = !!auctionState?.currentRound;

    if (aStart && now < aStart) return "A_NOT_STARTED";
    if (aEnd && now >= aEnd) return "B_ENDED";

    // Auction live window
    if (!hasRound) return "C_A_LIVE_IDLE";
    if (rStart && now < rStart) return "C_B_LIVE_PRESTART";
    if (rEnd && now >= rEnd) return "C_C_LIVE_ENDED";
    if (rStart && rEnd && now >= rStart && now < rEnd) return "C_D_LIVE_ACTIVE";

    // Fallbacks
    return "C_A_LIVE_IDLE";
  }, [auctionState?.auctionStartTime, auctionState?.auctionEndTime, auctionState?.currentRound, auctionState?.currentRoundStartTime, auctionState?.currentRoundEndTime]);

  // Re-evaluate phase every second and update timeLeft for C-D and A/B countdowns
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const newPhase = computePhase();
      setPhase((prev) => prev !== newPhase ? newPhase : prev);

      if (newPhase === "C_D_LIVE_ACTIVE") {
        const endMs = auctionState?.currentRoundEndTime ? new Date(auctionState.currentRoundEndTime).getTime() : null;
        setTimeLeft(endMs ? Math.max(0, endMs - now) : 0);
      } else if (newPhase === "A_NOT_STARTED") {
        const aStart = auctionState?.auctionStartTime ? new Date(auctionState.auctionStartTime).getTime() : null;
        setTimeLeft(aStart ? Math.max(0, aStart - now) : 0);
      } else {
        setTimeLeft(0);
      }
    };

    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [computePhase, auctionState?.currentRoundEndTime, auctionState?.auctionStartTime]);
  
  useEffect(() => {
    teamRef.current = team;
  }, [team]);

  // Lazy-initialize bid sound
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!bidSoundRef.current) {
      bidSoundRef.current = new Audio("/bidding-sound.mp3");
      bidSoundRef.current.volume = 0.7;
    }
    if (!winnerSoundRef.current) {
      winnerSoundRef.current = new Audio("/winning-sound.mp3");
      winnerSoundRef.current.volume = 0.8;
      winnerSoundRef.current.loop = true;
    }
  }, []);

  const fetchData = async () => {
    try {
      // Fetch houses first
      let housesData: House[] = [];
      try {
        const housesRes = await fetch("/api/houses", { cache: "no-store" });
        if (housesRes.ok) {
          housesData = await housesRes.json();
          setHouses(Array.isArray(housesData) ? housesData : []);
        } else {
          setHouses([]);
        }
      } catch {
        setHouses([]);
      }
      // If active, fetch bids to build bid states and team details from current round
      const roundId = auctionState?.currentRound || null; // teamId in round-less mode
      const now = Date.now();
      const rStart = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
      const rEnd = auctionState?.currentRoundEndTime ? new Date(auctionState.currentRoundEndTime).getTime() : null;
      const isActive = !!(rStart && rEnd && now >= rStart && now < rEnd);
      if (isActive && roundId) {
        // Fetch team directly using teamId (round-less)
        try {
          const teamRes = await fetch(`/api/teams/${roundId}`, { cache: "no-store" });
          if (teamRes.ok) {
            const t = await teamRes.json();
            setTeam({
              teamId: t.teamId,
              rank: t.rank,
              batch: t.batch,
              memberCount: t.memberCount,
              successfulAttempts: t.successfulAttempts,
              totalPoints: t.totalPoints,
              timeTaken: undefined,
            });
          }
          lastCompletedWinnerRef.current = null;
        } catch {}

        // Fetch current team bids to update bid states
        try {
          const bidsRes = await fetch(`/api/bids?teamId=${roundId}`, { cache: "no-store" });
          const bidsData = await bidsRes.json();
          const bidsPlaced: Array<{ houseId: string; amount: number }> = Array.isArray(bidsData)
            ? bidsData.map((b: { houseId: string; amount: number }) => ({ houseId: b.houseId, amount: b.amount }))
            : [];

          setHouseBidStates((prevStates) => {
            const newStates: Record<string, HouseBidState> = {};
            housesData.forEach((house) => {
              const hId = house.houseId || house._id?.toString();
              if (!hId) return;
              const bid = bidsPlaced.find((b) => b.houseId === hId);
              const prevState = prevStates[hId];
              if (!bid) {
                newStates[hId] = { status: "no-bid", showFlash: false };
              } else if (!prevState || prevState.status === "no-bid") {
                newStates[hId] = { status: "bid-placed", showFlash: true, previousAmount: bid.amount };
                if (bidSoundRef.current) {
                  try { bidSoundRef.current.currentTime = 0; void bidSoundRef.current.play(); } catch {}
                }
                setTimeout(() => {
                  setHouseBidStates((prev) => ({ ...prev, [hId]: { ...prev[hId], showFlash: false } }));
                }, 2000);
              } else if (prevState.previousAmount !== bid.amount) {
                newStates[hId] = { status: "bid-updated", showFlash: true, previousAmount: bid.amount };
                if (bidSoundRef.current) {
                  try { bidSoundRef.current.currentTime = 0; void bidSoundRef.current.play(); } catch {}
                }
                setTimeout(() => {
                  setHouseBidStates((prev) => ({ ...prev, [hId]: { ...prev[hId], showFlash: false } }));
                }, 2000);
              } else {
                newStates[hId] = prevState;
              }
            });
            return newStates;
          });
        } catch {}
      } else {
        setTimeLeft(0);
      }
      // If ended phase, build winner board from current round (fallback by bids)
      const phaseNow = computePhase();
      if (phaseNow === "C_C_LIVE_ENDED") {
        let allBids: Array<{ houseId: string; houseName: string; amount: number }> = [];
        const teamIdToFetch = auctionState?.currentRound || null;
        if (teamIdToFetch) {
          try {
            const bidsRes = await fetch(`/api/bids?teamId=${teamIdToFetch}`, { cache: "no-store" });
            if (bidsRes.ok) {
              const bidsData = await bidsRes.json();
              allBids = bidsData.map((bid: { houseId: string; amount: number }) => {
                const house = housesData.find(h => 
                  h.houseId === bid.houseId || h._id?.toString() === bid.houseId
                );
                return {
                  houseId: bid.houseId,
                  houseName: house?.name || "Unknown",
                  amount: bid.amount,
                };
              }).sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount);
            }
          } catch (err) {
            console.error("Error fetching round bids:", err);
          }
        }

        let winnerHouseName = "";
        let winnerAmount = 0;
        if (allBids.length > 0) {
          const topBid = allBids[0];
          winnerHouseName = topBid.houseName;
          winnerAmount = topBid.amount;
        }

        const derivedWinner: WinnerData = {
          houseName: winnerHouseName || "No Winner",
          amount: winnerAmount,
          allBids,
        };

        setWinnerData(derivedWinner);
        lastCompletedWinnerRef.current = derivedWinner;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    // Initial hydrate
    fetchData().catch(() => {});

    // Listen to socket events for real-time updates (no polling)
    if (socket) {
      const handleBidNotification = (data: { houseId: string; houseName: string; roundId: string }) => {
        // Immediately update bid state when a bid is placed
        if (data.roundId === auctionState?.currentRound) {
          setHouseBidStates((prevStates) => {
            const houseId = data.houseId;
            const prevState = prevStates[houseId];
            
            if (!prevState || prevState.status === "no-bid") {
              // First bid for this house
              if (bidSoundRef.current) {
                try {
                  bidSoundRef.current.currentTime = 0;
                  void bidSoundRef.current.play();
                } catch (e) {
                  console.warn("Bid sound play failed", e);
                }
              }
              
              const newState: HouseBidState = {
                status: "bid-placed",
                showFlash: true,
              };
              
              setTimeout(() => {
                setHouseBidStates((prev) => ({
                  ...prev,
                  [houseId]: { ...prev[houseId], showFlash: false }
                }));
              }, 2000);
              
              return { ...prevStates, [houseId]: newState };
            } else {
              // Bid updated
              if (bidSoundRef.current) {
                try {
                  bidSoundRef.current.currentTime = 0;
                  void bidSoundRef.current.play();
                } catch (e) {
                  console.warn("Bid sound play failed", e);
                }
              }
              
              const newState: HouseBidState = {
                status: "bid-updated",
                showFlash: true,
                previousAmount: prevState.previousAmount,
              };
              
              setTimeout(() => {
                setHouseBidStates((prev) => ({
                  ...prev,
                  [houseId]: { ...prev[houseId], showFlash: false }
                }));
              }, 2000);
              
              return { ...prevStates, [houseId]: newState };
            }
          });
          
          // Also trigger a data refresh to get latest bid amounts
          fetchData().catch(() => {});
        }
      };

      const handleAuctionState = () => {
        // Refresh on state updates
        fetchData().catch(() => {});
      };

      socket.on("bid-notification", handleBidNotification);
      socket.on("auction-state", handleAuctionState);

      return () => {
        socket.off("bid-notification", handleBidNotification);
        socket.off("auction-state", handleAuctionState);
      };
    }

    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, auctionState?.currentRound]);

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    return `${seconds}`;
  };

  const getHouseBackground = (houseName: string) => {
    const houseMap: Record<string, string> = {
      "Lord Shen": "/lord-shen.jpg",
      "Dragon Warrior": "/dragon-warrior.jpg",
      "Master Oogway": "/master-oogway.jpg",
      "Tai Lung": "/tai-lung.jpg",
    };
    return houseMap[houseName] || "/arena-background.jpg";
  };

  // Debug rendering logic (development only)
  if (process.env.NODE_ENV === "development") {
    //console.log('🖥️ Projector render state:', {
    //   showWinner,
    //   hasWinnerData: !!winnerData,
    //   winnerData,
    //   roundStatus: status?.roundStatus,
    //   hasStatus: !!status
    // });
  }

  // (Old Winner Screen removed; C_C phase handles results)
  
  // Render for phases A/B/C-A/C-B/C-C/C-D
  if (phase === "A_NOT_STARTED") {
    return <WaitingScreen auctionState={auctionState} />;
  }
  if (phase === "B_ENDED") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-4xl">
        Auction finished
      </div>
    );
  }
  if (phase === "C_A_LIVE_IDLE") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-3xl">
        Auction live — waiting for next round…
      </div>
    );
  }
  if (phase === "C_B_LIVE_PRESTART") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <div className="text-3xl">Next round starting soon</div>
        <div className="text-6xl font-bold">{Math.max(0, Math.floor(timeLeft / 1000))}s</div>
        <div className="text-xl">Team #{team?.rank ?? "?"} • Batch {team?.batch ?? "N/A"} • {team?.memberCount ?? 0} members</div>
      </div>
    );
  }
  if (phase === "C_C_LIVE_ENDED" && winnerData) {
    return (
      <div className="min-h-screen bg-cover bg-center relative flex items-center justify-center" style={{ backgroundImage: "url('/arena-background.jpg')" }}>
        <div className="absolute inset-0 bg-black/80"></div>
        <div className="relative z-10 text-center max-w-5xl mx-auto p-8">
          <h1 className="text-7xl font-bold mb-8 text-[#FFD700] drop-shadow-[0_0_40px_#FFD700]">🏆 Round Result</h1>
          <div className="text-4xl text-white mb-6">Winner: {winnerData.houseName} {winnerData.amount > 0 ? `( $${winnerData.amount} )` : "(No Winner)"}</div>

          {winnerData.allBids && winnerData.allBids.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[#FFD700]/30">
              <h3 className="text-2xl font-bold text-white mb-4">All Bids</h3>
              <div className="space-y-3">
                {winnerData.allBids.map((bid, index) => (
                  <div key={index} className={`flex justify-between items-center p-4 rounded-xl ${bid.amount === winnerData.amount && bid.houseName === winnerData.houseName ? "bg-[#FFD700]/30 border-2 border-[#FFD700]" : "bg-black/50 border border-white/20"}`}>
                    <span className={`font-bold ${bid.amount === winnerData.amount && bid.houseName === winnerData.houseName ? "text-[#FFD700]" : "text-white"}`}>{bid.houseName}</span>
                    <span className={`font-bold ${bid.amount === winnerData.amount && bid.houseName === winnerData.houseName ? "text-[#FFD700]" : "text-white"}`}>${bid.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isTimeRunningOut = timeLeft < 10000;
  
  // Split houses: first 2 on left, last 2 on right
  const leftHouses = houses.slice(0, 2);
  const rightHouses = houses.slice(2, 4);

  return (
    <div
      className="min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/arena-background.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFD70008_1px,transparent_1px),linear-gradient(to_bottom,#FFD70008_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-20"></div>

      <div className="relative z-10 min-h-screen flex flex-col p-4">
        {/* Timer at top */}
        <div className="text-center py-4 mb-2">
          <div
            className={`text-7xl font-bold mb-2 transition-colors ${isTimeRunningOut ? "text-red-500 animate-pulse drop-shadow-[0_0_30px_#EF4444]" : "text-[#FFD700] drop-shadow-[0_0_30px_#FFD700]"}`}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="w-full max-w-3xl mx-auto bg-gray-700/60 rounded-full h-4 border-2 border-[#FFD700]/50">
            <div
              className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_currentColor] ${
                isTimeRunningOut ? "bg-red-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.max(0, (timeLeft / 60000) * 100)}%` }}
            ></div>
          </div>
          <div className="text-lg text-gray-300 mt-1">seconds remaining</div>
        </div>

        {/* Main content: 2 houses | center team | 2 houses */}
        <div className="flex-1 grid grid-cols-[1fr_2fr_1fr] gap-3">
          {/* Left Houses */}
          <div className="flex flex-col gap-3">
            {leftHouses.map((house, index) => {
              const houseId = house._id?.toString() || house.houseId || `left-house-${index}`;
              const bidState = houseBidStates[houseId] || { status: "no-bid", showFlash: false };
              const percentage = (house.remainingBudget / house.totalBudget) * 100;

              const isFlashing = bidState.showFlash && bidState.status !== "no-bid";

              return (
                <div
                  key={houseId}
                  className={`relative flex-1 rounded-2xl overflow-hidden border-3 transition-all duration-300 ${
                    isFlashing
                      ? "border-[#FFD700] shadow-[0_0_35px_rgba(255,215,0,0.9)] scale-[1.03]"
                      : "border-[#FFD700]/60 shadow-[0_0_25px_rgba(255,215,0,0.4)]"
                  }`}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${getHouseBackground(house.name)}')` }}
                  ></div>
                  
                  {/* Gray overlay for no-bid */}
                  {bidState.status === "no-bid" && (
                    <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-[2px] transition-opacity duration-500"></div>
                  )}

                  {/* Golden flash overlay for bid placed/updated while flashing */}
                  {isFlashing && (
                    <div className="absolute inset-0 bg-[#FFD700]/40 backdrop-blur-[3px] animate-pulse"></div>
                  )}

                  {/* Normal overlay for bid placed/updated when not flashing */}
                  {bidState.status !== "no-bid" && !isFlashing && (
                    <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"></div>
                  )}
                  
                  <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-3 text-center drop-shadow-[0_0_15px_#000000]">
                        {house.name}
                      </h3>
                      <div className="text-center mb-3">
                        <div className="text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_15px_#FFD700]">
                          ${house.remainingBudget}
                        </div>
                        <div className="text-sm text-gray-200">of ${house.totalBudget}</div>
                      </div>
                      <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden border border-[#FFD700]/30">
                        <div
                          className="bg-[#FFD700] h-full rounded-full transition-all shadow-[0_0_10px_#FFD700]"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-center mt-2 text-sm text-gray-200">
                        {percentage.toFixed(0)}% remaining
                      </div>
                    </div>
                    
                    {/* Bid status */}
                    <div className="text-center mt-4">
                      {bidState.status === "no-bid" && (
                        <div className="text-lg font-semibold text-gray-400">No Bid</div>
                      )}
                      {bidState.status === "bid-placed" && !bidState.showFlash && (
                        <div className="text-lg font-bold text-green-400 drop-shadow-[0_0_10px_#000000]">✓ Bid Placed</div>
                      )}
                      {bidState.status === "bid-updated" && !bidState.showFlash && (
                        <div className="text-lg font-bold text-blue-400 drop-shadow-[0_0_10px_#000000]">↻ Bid Updated</div>
                      )}
                      {bidState.showFlash && (
                        <div className="text-xl font-bold text-yellow-300 drop-shadow-[0_0_15px_#FFD700] animate-pulse">
                          {bidState.status === "bid-placed" ? "🎯 BID PLACED!" : "🔄 BID UPDATED!"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Team Card */}
          <div className="flex items-center justify-center">
            <div className="bg-linear-to-br from-gray-900/95 to-black/95 rounded-3xl p-8 w-full max-w-2xl border-4 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.5)] backdrop-blur-md">
              <h2 className="text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
                👥 CURRENT TEAM
              </h2>
              <div className="flex flex-col items-center gap-4">
                <div className="w-40 h-40 rounded-full bg-linear-to-br from-[#FFD700] via-[#FFB800] to-[#FFA500] flex items-center justify-center border-4 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.6)]">
                  <span className="text-8xl font-bold text-black">#{team?.rank || "?"}</span>
                </div>
                <div className="text-center">
                  <h3 className="text-4xl font-bold text-white drop-shadow-[0_0_15px_#FFFFFF] mb-2">
                    Team #{team?.rank || "?"}
                  </h3>
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                    <span className="bg-[#FFD700]/10 text-[#FFD700] px-4 py-2 rounded-lg font-semibold text-lg border border-[#FFD700]/40 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                      📚 Batch {team?.batch}
                    </span>
                    <span className="bg-[#FFD700]/10 text-[#FFD700] px-4 py-2 rounded-lg font-semibold text-lg border border-[#FFD700]/40 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                      👥 {team?.memberCount || 0} members
                    </span>
                  </div>
                  {team && (team.successfulAttempts !== undefined || team.totalPoints !== undefined) && (
                    <div className="flex justify-center gap-3 mt-3">
                      {team.successfulAttempts !== undefined && (
                        <span className="bg-green-500/20 text-green-300 px-4 py-2 rounded-lg font-semibold border border-green-500/40">
                          ✓ {team.successfulAttempts} solved
                        </span>
                      )}
                      {team.totalPoints !== undefined && (
                        <span className="bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-lg font-semibold border border-yellow-500/40">
                          ★ {team.totalPoints} pts
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Houses */}
          <div className="flex flex-col gap-3">
            {rightHouses.map((house, index) => {
              const houseId = house._id?.toString() || house.houseId || `right-house-${index}`;
              const bidState = houseBidStates[houseId] || { status: "no-bid", showFlash: false };
              const percentage = (house.remainingBudget / house.totalBudget) * 100;
              const isFlashing = bidState.showFlash && bidState.status !== "no-bid";

              return (
                <div
                  key={houseId}
                  className={`relative flex-1 rounded-2xl overflow-hidden border-3 transition-all duration-300 ${
                    isFlashing
                      ? "border-[#FFD700] shadow-[0_0_35px_rgba(255,215,0,0.9)] scale-[1.03]"
                      : "border-[#FFD700]/60 shadow-[0_0_25px_rgba(255,215,0,0.4)]"
                  }`}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${getHouseBackground(house.name)}')` }}
                  ></div>
                  
                  {bidState.status === "no-bid" && (
                    <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-[2px] transition-opacity duration-500"></div>
                  )}

                  {/* Golden flash overlay for bid placed/updated while flashing */}
                  {isFlashing && (
                    <div className="absolute inset-0 bg-[#FFD700]/40 backdrop-blur-[3px] animate-pulse"></div>
                  )}

                  {/* Normal overlay for bid placed/updated when not flashing */}
                  {bidState.status !== "no-bid" && !isFlashing && (
                    <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"></div>
                  )}
                  
                  <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-3 text-center drop-shadow-[0_0_15px_#000000]">
                        {house.name}
                      </h3>
                      <div className="text-center mb-3">
                        <div className="text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_15px_#FFD700]">
                          ${house.remainingBudget}
                        </div>
                        <div className="text-sm text-gray-200">of ${house.totalBudget}</div>
                      </div>
                      <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden border border-[#FFD700]/30">
                        <div
                          className="bg-[#FFD700] h-full rounded-full transition-all shadow-[0_0_10px_#FFD700]"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-center mt-2 text-sm text-gray-200">
                        {percentage.toFixed(0)}% remaining
                      </div>
                    </div>
                    
                    <div className="text-center mt-4">
                      {bidState.status === "no-bid" && (
                        <div className="text-lg font-semibold text-gray-400">No Bid</div>
                      )}
                      {bidState.status === "bid-placed" && !bidState.showFlash && (
                        <div className="text-lg font-bold text-green-400 drop-shadow-[0_0_10px_#000000]">✓ Bid Placed</div>
                      )}
                      {bidState.status === "bid-updated" && !bidState.showFlash && (
                        <div className="text-lg font-bold text-blue-400 drop-shadow-[0_0_10px_#000000]">↻ Bid Updated</div>
                      )}
                      {bidState.showFlash && (
                        <div className="text-xl font-bold text-yellow-300 drop-shadow-[0_0_15px_#FFD700] animate-pulse">
                          {bidState.status === "bid-placed" ? "🎯 BID PLACED!" : "🔄 BID UPDATED!"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
