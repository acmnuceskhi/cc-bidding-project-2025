"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import type { AuctionState } from "@/types/socket";
import{ Spinner} from "@/components/Spinner";

interface Team {
  teamId: string;
  rank: number;
  batch: string;
  memberCount: number;
  successfulAttempts?: number;
  totalPoints?: number;
  timeTaken?: number;
  totalPenalty?: number;
  members?: Array<{ name: string; participantId?: string; picture?: string | null }>;
  name?: string | null;
}

interface WinnerData {
  houseName: string;
  amount: number;
  allBids?: Array<{ houseId: string; houseName: string; amount: number; timestamp?: string; timeTakenMs?: number }>;
  teamName?: string | null;
  teamRank?: number;
  teamBatch?: string | null;
  teamSuccessfulAttempts?: number;
  teamTotalPoints?: number;
  teamMemberCount?: number;
  teamMembers?: Array<{ name: string; participantId?: string; picture?: string | null }>;
  teamTotalPenalty?: number;
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

  // useEffect(() => {
  //   let currentIndex = 0;
  //   const typingInterval = setInterval(() => {
  //     if (currentIndex <= fullText.length) {
  //       setDisplayText(fullText.slice(0, currentIndex));
  //       currentIndex++;
  //     } else {
  //       clearInterval(typingInterval);
  //     }
  //   }, 80);

  //   const events = ['click', 'touchstart', 'keydown', 'mousemove'];
  //   events.forEach(event => {
  //     document.addEventListener(event, startAudio, { once: true });
  //   });

  //   return () => {
  //     clearInterval(typingInterval);
  //     events.forEach(event => {
  //       document.removeEventListener(event, startAudio);
  //     });
  //     if (audioRef.current) {
  //       audioRef.current.pause();
  //       audioRef.current.currentTime = 0;
  //     }
  //   };
  // }, [startAudio, fullText]);

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

      <div className="absolute w-full h-full bg-black/50"></div>

      <div className="relative z-10 text-center px-8">
        <div className="text-3xl sm:text-3xl font-bold mb-8 text-[#fba911]">
          Coder&apos;s Cup
        </div>

        <div className="text-5xl sm:text-7xl font-bold mb-8 text-[#fba911]">
          Finalists&apos; Auction
        </div>
        {!auctionState ? (
          <div className="mt-6 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <p
            className="text-xl sm:text-2xl text-white/90 mt-4 tracking-wider"
            style={{ fontFamily: "'Press Start 2P', 'VT323', monospace" }}
          >
            {(() => {
              const now = Date.now();
              const roundStartMs = auctionState.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
              if (roundStartMs && now < roundStartMs) return `Round starts in ${Math.max(0, Math.floor(auctionRemainingMs / 1000))}s`;
              const startMs = auctionState.auctionStartTime ? new Date(auctionState.auctionStartTime).getTime() : null;
              const endMs = auctionState.auctionEndTime ? new Date(auctionState.auctionEndTime).getTime() : null;
              if (startMs && now < startMs) return `Starting in ${Math.max(0, Math.floor(auctionRemainingMs / 1000))}s`;
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
  const [currentBids, setCurrentBids] = useState<Array<{ houseId: string; houseName: string; amount: number; timestamp?: string; timeTakenMs?: number }>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastCompletedWinnerRef = useRef<WinnerData | null>(null);
  const teamRef = useRef<Team | null>(null);
  const bidSoundRef = useRef<HTMLAudioElement | null>(null);
  const winnerSoundRef = useRef<HTMLAudioElement | null>(null);
  const fetchDataRef = useRef<(() => Promise<void>) | null>(null);

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
  }, [auctionState]);

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

  // Re-evaluate phase every second and update timeLeft for C-D and A/B countdowns
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const newPhase = computePhase();
      const prevPhase = phase;
      
      if (prevPhase !== newPhase) {
        setPhase(newPhase);
        // When transitioning to C_C (round ended), fetch winner data
        if (newPhase === "C_C_LIVE_ENDED" && prevPhase === "C_D_LIVE_ACTIVE") {
          fetchDataRef.current?.();
        }
        // When transitioning to C_B or C_D, fetch team data
        if ((newPhase === "C_B_LIVE_PRESTART" || newPhase === "C_D_LIVE_ACTIVE") && prevPhase !== newPhase) {
          fetchDataRef.current?.();
        }
      }

      if (newPhase === "C_D_LIVE_ACTIVE") {
        const endMs = auctionState?.currentRoundEndTime ? new Date(auctionState.currentRoundEndTime).getTime() : null;
        setTimeLeft(endMs ? Math.max(0, endMs - now) : 0);
      } else if (newPhase === "C_B_LIVE_PRESTART") {
        const rStartMs = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
        setTimeLeft(rStartMs ? Math.max(0, rStartMs - now) : 0);
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
  }, [computePhase, auctionState?.currentRoundEndTime, auctionState?.auctionStartTime, phase]);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      // Fetch houses first
      let housesData: House[] = [];
      try {
        const housesRes = await fetch("/api/houses", { cache: "no-store" });
        if (housesRes.ok) {
          housesData = await housesRes.json();
          setHouses(Array.isArray(housesData) ? housesData : []);
        } else {
          setHouses([]);
          setLoadError("Failed to load houses");
        }
      } catch {
        setHouses([]);
        setLoadError("Failed to load houses");
      }
      // If active, fetch bids to build bid states and team details from current round
      const roundId = auctionState?.currentRound || null; // teamId in round-less mode
      const now = Date.now();
      const rStart = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
      const rEnd = auctionState?.currentRoundEndTime ? new Date(auctionState.currentRoundEndTime).getTime() : null;
      const isActive = !!(rStart && rEnd && now >= rStart && now < rEnd);
      
      if (roundId) {
        // Fetch team even in prestart so projector has data early
        const beforeStart = rStart && now < rStart;
        const duringActive = isActive;
        if (beforeStart || duringActive) {
          try {
            let enrichedTeam: any = null;
            const listRes = await fetch(`/api/teams`, { cache: "no-store" });
            if (listRes.ok) {
              const allTeams = await listRes.json();
              enrichedTeam = allTeams.find((t: { teamId: string }) => t.teamId === roundId) || null;
            }
            if (!enrichedTeam) {
              const teamRes = await fetch(`/api/teams/${roundId}`, { cache: "no-store" });
              if (teamRes.ok) {
                enrichedTeam = await teamRes.json();
              }
            }
            if (enrichedTeam) {
              setTeam({
                teamId: enrichedTeam.teamId,
                rank: enrichedTeam.rank,
                batch: enrichedTeam.batch,
                memberCount: enrichedTeam.memberCount,
                successfulAttempts: enrichedTeam.successfulAttempts,
                totalPoints: enrichedTeam.totalPoints,
                totalPenalty: enrichedTeam.totalPenalty,
                timeTaken: undefined,
                members: enrichedTeam.members || [],
                name: enrichedTeam.name || null,
              });
            }
            if (duringActive) {
              lastCompletedWinnerRef.current = null;
            }
          } catch {}
        }
      }

      if (isActive && roundId) {
        // Fetch enriched team data (public list includes members & stats)
        try {
          let enrichedTeam: any = null;
          const listRes = await fetch(`/api/teams`, { cache: "no-store" });
          if (listRes.ok) {
            const allTeams = await listRes.json();
            enrichedTeam = allTeams.find((t: { teamId: string }) => t.teamId === roundId) || null;
          }
          // Fallback to single team endpoint (may require auth) if not found
          if (!enrichedTeam) {
            const teamRes = await fetch(`/api/teams/${roundId}`, { cache: "no-store" });
            if (teamRes.ok) {
              enrichedTeam = await teamRes.json();
            }
          }
          if (enrichedTeam) {
            setTeam({
              teamId: enrichedTeam.teamId,
              rank: enrichedTeam.rank,
              batch: enrichedTeam.batch,
              memberCount: enrichedTeam.memberCount,
              successfulAttempts: enrichedTeam.successfulAttempts,
              totalPoints: enrichedTeam.totalPoints,
              totalPenalty: enrichedTeam.totalPenalty,
              timeTaken: undefined,
              members: enrichedTeam.members || [],
              name: enrichedTeam.name || null,
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

          // Build enriched current bids list for UI on the right
          try {
            const startMs = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
            const enriched = Array.isArray(bidsData)
              ? bidsData
                  .map((bid: { houseId: string; amount: number; timestamp?: string }) => {
                    const house = housesData.find(h => h.houseId === bid.houseId || h._id?.toString() === bid.houseId);
                    const ts = bid?.timestamp ? new Date(bid.timestamp).toISOString() : undefined;
                    const tMs = ts && startMs ? Math.max(0, new Date(ts).getTime() - startMs) : undefined;
                    return {
                      houseId: bid.houseId,
                      houseName: house?.name || "Unknown",
                      amount: bid.amount,
                      timestamp: ts,
                      timeTakenMs: tMs,
                    };
                  })
                  .sort((a: { amount: number; timeTakenMs?: number }, b: { amount: number; timeTakenMs?: number }) => {
                    if (b.amount !== a.amount) return b.amount - a.amount;
                    if (a.timeTakenMs !== undefined && b.timeTakenMs !== undefined) return a.timeTakenMs - b.timeTakenMs;
                    return 0;
                  })
              : [];
            setCurrentBids(enriched);
          } catch {}

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
        // Clear bid states when round is not active
        setHouseBidStates({});
        setTimeLeft(0);
        setCurrentBids([]);
      }
      // If ended phase, build winner board from current round (fallback by bids)
      const phaseNow = computePhase();
      if (phaseNow === "C_C_LIVE_ENDED") {
        console.log("Auction State");
        console.log(auctionState);
        let allBids: Array<{ houseId: string; houseName: string; amount: number }> = [];
        const teamIdToFetch = auctionState?.currentRound || null;
        let winnerHouseName = "";
        let winnerAmount = 0;
        let teamData: { houseId?: string | null; name?: string | null; rank?: number; batch?: string | null; successfulAttempts?: number; totalPoints?: number; memberCount?: number; members?: Array<{ name: string; participantId?: string; picture?: string | null }>; totalPenalty?: number } | null = null;

        if (teamIdToFetch) {
          try {
            // Fetch all teams to find the current team's validation status
            const teamsRes = await fetch(`/api/teams`, { cache: "no-store" });
            if (teamsRes.ok) {
              const allTeams = await teamsRes.json();
              teamData = allTeams.find((t: { teamId: string }) => t.teamId === teamIdToFetch) || null;
            }

            // Fetch all bids for display
            const bidsRes = await fetch(`/api/bids?teamId=${teamIdToFetch}`, { cache: "no-store" });
            if (bidsRes.ok) {
              const bidsData = await bidsRes.json();
              const startMs = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
              allBids = bidsData.map((bid: { houseId: string; amount: number; timestamp?: string }) => {
                const house = housesData.find(h => 
                  h.houseId === bid.houseId || h._id?.toString() === bid.houseId
                );
                const ts = bid?.timestamp ? new Date(bid.timestamp).toISOString() : undefined;
                const tMs = ts && startMs ? Math.max(0, new Date(ts).getTime() - startMs) : undefined;
                return {
                  houseId: bid.houseId,
                  houseName: house?.name || "Unknown",
                  amount: bid.amount,
                  timestamp: ts,
                  timeTakenMs: tMs,
                };
              }).sort((a: { amount: number; timeTakenMs?: number }, b: { amount: number; timeTakenMs?: number }) => {
                // Sort by amount descending, then by time taken ascending (earliest first)
                if (b.amount !== a.amount) return b.amount - a.amount;
                if (a.timeTakenMs !== undefined && b.timeTakenMs !== undefined) return a.timeTakenMs - b.timeTakenMs;
                return 0;
              });
            }

            // Determine winner: if validated, use assigned house; otherwise use highest bid
            if (teamData?.houseId) {
              // Team has been validated - show the actual winner
              const winningHouse = housesData.find(h => 
                h._id?.toString() === teamData?.houseId || h.houseId === teamData?.houseId
              );
              winnerHouseName = winningHouse?.name || "Unknown";
              // Find the winning bid amount
              const winningBid = allBids.find(b => 
                b.houseId === teamData?.houseId || b.houseId === winningHouse?.houseId
              );
              winnerAmount = winningBid?.amount || 0;
            } else {
              // Not validated yet - show highest bid
              if (allBids.length > 0) {
                const topBid = allBids[0];
                winnerHouseName = topBid.houseName;
                winnerAmount = topBid.amount;
              }
            }
          } catch (err) {
            console.error("Error fetching round data:", err);
          }
        }

        const derivedWinner: WinnerData = {
          houseName: winnerHouseName || "No Winner",
          amount: winnerAmount,
          allBids,
          teamName: teamData?.name || null,
          teamRank: teamData?.rank,
          teamBatch: teamData?.batch || null,
          teamSuccessfulAttempts: teamData?.successfulAttempts,
          teamTotalPoints: teamData?.totalPoints,
          teamMemberCount: teamData?.memberCount,
          teamMembers: teamData?.members || [],
          teamTotalPenalty: teamData?.totalPenalty,
        };

        setWinnerData(derivedWinner);
        lastCompletedWinnerRef.current = derivedWinner;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoadError("Failed to load data");
    }
  }, [auctionState, computePhase]);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Initial data load
  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      if (mounted) {
        await fetchData().catch(() => {});
      }
    };
    loadInitialData();
    
    return () => {
      mounted = false;
    };
  }, [fetchData]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

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

    const handleRoundEnded = () => {
      console.log('[PROJECTOR] Round ended, fetching winner data');
      // Trigger immediate data fetch to show winner screen
      fetchData().catch(() => {});
    };

    socket.on("bid-notification", handleBidNotification);
    socket.on("auction-state", handleAuctionState);
    socket.on("round-ended", handleRoundEnded);

    return () => {
      socket.off("bid-notification", handleBidNotification);
      socket.off("auction-state", handleAuctionState);
      socket.off("round-ended", handleRoundEnded);
    };
  }, [socket, auctionState?.currentRound, fetchData]);

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
  
  // If auction state hasn't arrived yet, block with a spinner
  if (!auctionState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Spinner />
      </div>
    );
  }

  // Render for phases A/B/C-A/C-B/C-C/C-D
  if (phase === "A_NOT_STARTED") {
    return <WaitingScreen auctionState={auctionState} />;
  }
  if (phase === "B_ENDED") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-4xl">
        {!auctionState ? <Spinner /> : <>Auction finished</>}
      </div>
    );
  }
  if (phase === "C_A_LIVE_IDLE") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-3xl">
        {!auctionState ? <Spinner /> : <>Auction live — waiting for next round…</>}
      </div>
    );
  }
  if (phase === "C_B_LIVE_PRESTART") {
    return (
      <div className="min-h-screen bg-cover bg-center relative flex items-center justify-center" style={{ backgroundImage: "url('/arena-background.jpg')" }}>
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="relative z-10 flex flex-col items-center justify-center text-white gap-4 px-6">
          {team ? (
            <div className="text-7xl text-orange-400 font-extrabold uppercase tracking-wider text-center transition-opacity duration-300">
              {team.name || (team.rank ? `Team #${team.rank}` : "Team")}
            </div>
          ) : (
            <div className="h-14 w-80 rounded-md bg-white/20 animate-pulse" />
          )}

          <div className="text-xl sm:text-2xl text-white/90">bidding starts in</div>

          {auctionState?.currentRoundStartTime ? (
            <div className="text-4xl font-extrabold text-orange-400 transition-opacity duration-300">
              {Math.max(0, Math.floor(timeLeft / 1000))}s
            </div>
          ) : (
            <div className="mt-2"><Spinner /></div>
          )}

          {team?.members && team.members.length > 0 ? (
            <div className="text-base sm:text-lg text-white/80 flex flex-wrap justify-center max-w-3xl px-6">
              {team.members.map((m, idx) => (
                <span key={m.participantId || idx} className="mx-2">
                  {m.name}
                  {idx < (team.members?.length || 0) - 1 && <span className="mx-2 text-orange-400">•</span>}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 mt-2">
              <div className="h-4 w-28 bg-white/20 rounded animate-pulse" />
              <div className="h-4 w-36 bg-white/20 rounded animate-pulse" />
              <div className="h-4 w-24 bg-white/20 rounded animate-pulse" />
            </div>
          )}

          {/* Stats: table-like grid, no borders */}
          <div className="mt-6 w-full max-w-xl py-4 bg-black/60 rounded-xl px-6">
            {team ? (
              <div className="grid grid-cols-2 gap-y-2 text-white/90">
                {team.batch && (
                  <>
                    <div className="font-semibold">Batch</div>
                    <div className="text-right">{team.batch}</div>
                  </>
                )}
                {typeof team.successfulAttempts === 'number' && (
                  <>
                    <div className="font-semibold">Solved</div>
                    <div className="text-right">{team.successfulAttempts}</div>
                  </>
                )}
                {typeof team.totalPoints === 'number' && (
                  <>
                    <div className="font-semibold">Points</div>
                    <div className="text-right">{team.totalPoints}</div>
                  </>
                )}
                {typeof team.totalPenalty === 'number' && (
                  <>
                    <div className="font-semibold">Penalty</div>
                    <div className="text-right">{team.totalPenalty}</div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-3">
                <div className="h-4 w-24 bg-white/20 rounded animate-pulse" />
                <div className="h-4 w-16 bg-white/20 rounded animate-pulse justify-self-end" />
                <div className="h-4 w-24 bg-white/20 rounded animate-pulse" />
                <div className="h-4 w-12 bg-white/20 rounded animate-pulse justify-self-end" />
                <div className="h-4 w-24 bg-white/20 rounded animate-pulse" />
                <div className="h-4 w-20 bg-white/20 rounded animate-pulse justify-self-end" />
              </div>
            )}
          </div>

          {loadError && (
            <div className="mt-4 text-center">
              <div className="text-red-400 mb-2">{loadError}</div>
              <button className="px-4 py-2 bg-white/10 border border-white/30 rounded" onClick={() => fetchDataRef.current?.()}>Retry</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  console.log(winnerData);
  if (phase === "C_C_LIVE_ENDED" && winnerData) {
    return (
      <div className="min-h-screen bg-cover bg-center relative flex items-center justify-center" style={{ backgroundImage: "url('/arena-background.jpg')" }}>
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="relative z-10 w-full max-w-6xl mx-auto p-6 md:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left: Team Info */}
            <div className="text-left min-w-0">
              <div className="mb-4 w-full max-w-full">
                <h1 className="text-6xl md:text-7xl font-extrabold text-orange-400 leading-tight wrap-break-word sm:wrap-break-word whitespace-normal">
                  {winnerData.teamName || (winnerData.teamRank ? `Team #${winnerData.teamRank}` : "")}
                </h1>
              </div>

              {/* Team Members as a visible bullet list */}
              {winnerData.teamMembers && winnerData.teamMembers.length > 0 && (
                <ul className="text-xl md:text-2xl text-white/95 mb-4 space-y-2 list-disc pl-6 marker:text-orange-400 wrap-break-word whitespace-normal">
                  {winnerData.teamMembers.map((member, idx) => (
                    <li key={member.participantId || idx} className="leading-snug">
                      <span className="font-medium">{member.name}</span>
                    </li>
                  ))}
                </ul>
              )}

            </div>

            {/* Right: Bids */}
            <div className="text-left min-w-0">
              {/* Winner line (prominent, no amount) */}
              <div className="text-4xl md:text-5xl text-white mb-4 font-semibold wrap-break-word whitespace-normal">
                {winnerData.houseName && winnerData.houseName !== "No Winner" ? (
                  <span><span className="text-orange-400 font-extrabold  wrap-break-word sm:wrap-break-word whitespace-normal">{winnerData.houseName}</span> wins.</span>
                ) : (
                  <span>No winner.</span>
                )}
              </div>

              {winnerData.allBids && winnerData.allBids.length > 0 ? (
                <div className="mt-2 pt-4 border-t border-orange-400/30">
                  <h3 className="text-2xl font-bold text-white mb-4">All Bids</h3>
                  <div className="space-y-3">
                    {winnerData.allBids.map((bid, index) => (
                      <div key={index} className={`flex justify-between items-center p-4 rounded-xl ${bid.amount === winnerData.amount && bid.houseName === winnerData.houseName ? "bg-orange-400/30 border-2 border-orange-400" : "bg-black/50 border border-white/20"}`}>
                        <div className="flex flex-col text-left min-w-0 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`font-bold break-all sm:wrap-break-word whitespace-normal ${bid.amount === winnerData.amount && bid.houseName === winnerData.houseName ? "text-orange-400" : "text-white"}`}>{bid.houseName}</span>
                            {bid.timeTakenMs !== undefined && (
                              <span className="px-2 py-0.5 rounded-md border border-orange-400/50 bg-orange-400/10 text-orange-400 text-sm font-bold">{Math.floor(bid.timeTakenMs / 1000)}s</span>
                            )}
                            {bid.timeTakenMs === undefined && bid.timestamp && (
                              <span className="px-2 py-0.5 rounded-md border border-white/30 bg-white/10 text-white/90 text-sm font-bold">{new Date(bid.timestamp).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>
                        <span className={`font-bold ${bid.amount === winnerData.amount && bid.houseName === winnerData.houseName ? "text-orange-400" : "text-white"}`}>${bid.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 pt-4 border-t border-orange-400/30">
                  <h3 className="text-2xl font-bold text-white mb-4">All Bids</h3>
                  <div className="p-6 rounded-xl bg-black/50 border border-white/20 text-white/80">
                    No bids placed
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isTimeRunningOut = timeLeft < 10000;
  
  // Active view uses team + current bids layout (no house panels)

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
          {auctionState?.currentRoundEndTime ? (
            <>
              <div
                className={`text-7xl font-bold mb-2 transition-colors ${isTimeRunningOut ? "text-red-500 animate-pulse" : "text-orange-400"}`}
              >
                {formatTime(timeLeft)}
              </div>
              
              <div className="text-lg text-gray-300 mt-1">seconds remaining</div>
            </>
          ) : (
            <div className="flex items-center justify-center"><Spinner /></div>
          )}
        </div>

        {/* Main content: Team left | Bids right */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Team Info */}
          <div className="text-left min-w-0">
            <div className="mb-4 w-full max-w-full">
              {team ? (
                <h1 className="text-5xl md:text-6xl font-extrabold text-orange-400 leading-tight">
                  {team.name || (team.rank ? `Team #${team.rank}` : "Team")}
                </h1>
              ) : (
                <div className="h-10 w-72 bg-white/20 rounded animate-pulse" />
              )}
            </div>

            {/* Members */}
            {team?.members && team.members.length > 0 ? (
              <ul className="text-lg md:text-xl text-white/95 mb-4 space-y-1 list-disc pl-6">
                {team.members.map((m, idx) => (
                  <li key={m.participantId || idx} className="leading-snug">
                    <span className="font-medium">{m.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2 mb-4">
                <div className="h-4 w-40 bg-white/20 rounded animate-pulse" />
                <div className="h-4 w-48 bg-white/20 rounded animate-pulse" />
              </div>
            )}

            {/* Stats table-like grid */}
            <div className="mt-2 w-full max-w-md">
              {team ? (
                <div className="grid grid-cols-2 gap-y-2 text-white/90">
                  {team.batch && (<><div className="font-semibold">Batch</div><div className="text-right">{team.batch}</div></>)}
                  {typeof team.memberCount === 'number' && (<><div className="font-semibold">Members</div><div className="text-right">{team.memberCount}</div></>)}
                  {typeof team.successfulAttempts === 'number' && (<><div className="font-semibold">Solved</div><div className="text-right">{team.successfulAttempts}</div></>)}
                  {typeof team.totalPoints === 'number' && (<><div className="font-semibold">Points</div><div className="text-right">{team.totalPoints}</div></>)}
                  {typeof team.totalPenalty === 'number' && (<><div className="font-semibold">Penalty</div><div className="text-right">{team.totalPenalty}</div></>)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-y-3">
                  <div className="h-4 w-20 bg-white/20 rounded animate-pulse" />
                  <div className="h-4 w-10 bg-white/20 rounded animate-pulse justify-self-end" />
                  <div className="h-4 w-20 bg-white/20 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-white/20 rounded animate-pulse justify-self-end" />
                  <div className="h-4 w-20 bg-white/20 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-white/20 rounded animate-pulse justify-self-end" />
                </div>
              )}
            </div>
          </div>

          {/* Right: Current Bids */}
          <div className="text-left min-w-0">
            <h3 className="text-2xl font-bold text-white mb-4">Current Bids</h3>
            {team ? (
              currentBids && currentBids.length > 0 ? (
                <div className="space-y-3">
                  {currentBids.map((bid, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 rounded-xl bg-black/50 border border-white/20">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-white break-all">{bid.houseName}</span>
                        {typeof bid.timeTakenMs === 'number' && (
                          <span className="px-2 py-0.5 rounded-md border border-orange-400/50 bg-orange-400/10 text-orange-400 text-sm font-bold">{Math.floor((bid.timeTakenMs || 0) / 1000)}s</span>
                        )}
                      </div>
                      <span className="font-bold text-orange-400">${bid.amount}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-black/50 border border-white/20 text-white/80">No bids placed</div>
              )
            ) : (
              <div className="flex justify-center"><Spinner /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
