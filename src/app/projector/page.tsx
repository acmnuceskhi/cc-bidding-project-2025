"use client";

import { useState, useEffect, useRef } from "react";
import { useSynchronizedCountdown } from "@/hooks/useSynchronizedCountdown";
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

interface Bid {
  houseId: string;
  amount: number;
}

interface Status {
  roundStatus: "active" | "idle";
  roundId?: string;
  roundNumber?: number;
  team?: Team;
  timerEnd?: string;
  bidsPlaced?: Bid[];
  roundEnded?: boolean;
  winner?: WinnerData;
}

interface HouseBidState {
  status: "no-bid" | "bid-placed" | "bid-updated";
  showFlash: boolean;
  previousAmount?: number;
}

// Waiting Screen Component
function WaitingScreen() {
  const [displayText, setDisplayText] = useState("");
  const [audioStarted, setAudioStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fullText = "Waiting for admin to start the next round...";

  const startAudio = () => {
    if (!audioStarted && !audioRef.current) {
      const audio = new Audio("/oogway-ascends.mp3");
      audio.loop = true;
      audio.volume = 0.5;
      audioRef.current = audio;
      
      audio.play().then(() => {
        if (process.env.NODE_ENV === "development") {
          console.log("🎵 Music started!");
        }
        setAudioStarted(true);
      }).catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.log("Audio play failed:", err);
        }
      });
    }
  };

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
  }, []);

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
        <p className="text-3xl sm:text-4xl text-white drop-shadow-[0_0_20px_#000000] font-mono min-h-[3rem]">
          {displayText}
          <span className="animate-pulse">|</span>
        </p>
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
  const [status, setStatus] = useState<Status | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [winnerData, setWinnerData] = useState<WinnerData | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [lastRoundId, setLastRoundId] = useState<string | null>(null);
  const [houseBidStates, setHouseBidStates] = useState<Record<string, HouseBidState>>({});
  const winnerShownRef = useRef<boolean>(false);
  const lastCompletedWinnerRef = useRef<WinnerData | null>(null);
  const teamRef = useRef<Team | null>(null);
  const bidSoundRef = useRef<HTMLAudioElement | null>(null);
  const winnerSoundRef = useRef<HTMLAudioElement | null>(null);
  const pollDelayRef = useRef<number>(10000);
  const retryCountRef = useRef<number>(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Socket.IO integration for real-time updates
  const { socket, isConnected } = useSocket();

  const { remainingMs: projRemaining } = useSynchronizedCountdown(
    status?.roundStatus === "active" && status?.timerEnd
      ? status.timerEnd
      : null
  );
  
  useEffect(() => {
    setTimeLeft(projRemaining);
  }, [projRemaining]);
  
  useEffect(() => {
    teamRef.current = team;
  }, [team]);

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
      const statusRes = await fetch("/api/status", { cache: "no-store" });
      const statusData: Status = await statusRes.json();
      if (process.env.NODE_ENV === "development") {
        console.log('🎯 Projector fetchData - Full status:', statusData);
      }
      setStatus(statusData);
      
      // Reset retry count on success
      retryCountRef.current = 0;
      pollDelayRef.current = 10000;

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

      if (statusData.roundStatus === "active" && statusData.team) {
        setTeam(statusData.team);
        setLastRoundId(statusData.roundId || null);
        winnerShownRef.current = false;
        
        // Track bid states - use the fetched housesData, not state
        const bidsPlaced = statusData.bidsPlaced || [];
        if (process.env.NODE_ENV === "development") {
          console.log('📊 Bids placed:', bidsPlaced);
          console.log('🏠 Houses:', housesData.map(h => ({ id: h._id?.toString(), houseId: h.houseId, name: h.name })));
        }
        
        setHouseBidStates((prevStates) => {
          const newStates: Record<string, HouseBidState> = {};
          
          housesData.forEach((house) => {
            const houseId = house.houseId || house._id?.toString();
            if (!houseId) return;
            
            const bid = bidsPlaced.find(b => b.houseId === houseId || b.houseId === house._id?.toString());
            if (process.env.NODE_ENV === "development") {
              console.log(`🏯 ${house.name} (${houseId}): bid =`, bid);
            }
            const prevState = prevStates[houseId];
            
            if (!bid) {
              newStates[houseId] = {
                status: "no-bid",
                showFlash: false,
              };
            } else if (!prevState || prevState.status === "no-bid") {
              // First bid
              newStates[houseId] = {
                status: "bid-placed",
                showFlash: true,
                previousAmount: bid.amount,
              };
              // Play bid sound
              if (bidSoundRef.current) {
                try {
                  bidSoundRef.current.currentTime = 0;
                  void bidSoundRef.current.play();
                } catch (e) {
                  console.warn("Bid sound play failed", e);
                }
              }
              // Auto-hide flash after 2s
              setTimeout(() => {
                setHouseBidStates(prev => ({
                  ...prev,
                  [houseId]: { ...prev[houseId], showFlash: false }
                }));
              }, 2000);
            } else if (prevState.previousAmount !== bid.amount) {
              // Bid updated
              newStates[houseId] = {
                status: "bid-updated",
                showFlash: true,
                previousAmount: bid.amount,
              };
              if (bidSoundRef.current) {
                try {
                  bidSoundRef.current.currentTime = 0;
                  void bidSoundRef.current.play();
                } catch (e) {
                  console.warn("Bid sound play failed", e);
                }
              }
              setTimeout(() => {
                setHouseBidStates(prev => ({
                  ...prev,
                  [houseId]: { ...prev[houseId], showFlash: false }
                }));
              }, 2000);
            } else {
              // No change
              newStates[houseId] = prevState;
            }
          });
          
          return newStates;
        });
      } else {
        setTimeLeft(0);
        // Don't reset bid states immediately - keep them visible
      }

      // Check for winner from API or detect round completion
      if (process.env.NODE_ENV === "development") {
        console.log("🎯 Projector winner check:", {
          roundEnded: statusData.roundEnded,
          winner: statusData.winner,
          lastRoundId,
          currentRoundId: statusData.roundId,
          roundStatus: statusData.roundStatus,
          winnerShown: winnerShownRef.current,
          showWinnerState: showWinner,
        });
      }

      // Treat either an explicit roundEnded flag OR a winner object as signal
      const hasWinnerFromStatus =
        !!statusData.winner || statusData.roundEnded === true;

      if (hasWinnerFromStatus && !winnerShownRef.current) {
        if (process.env.NODE_ENV === "development") {
          console.log('🏆 Projector: Showing winner from API');
        }
        // Fetch all bids for this round to display in winner modal
        let allBids: Array<{ houseId: string; houseName: string; amount: number }> = [];
        // Prefer explicit roundId, otherwise fall back to our lastActive
        const roundIdToFetch = statusData.roundId || lastRoundId;
        if (roundIdToFetch) {
          try {
            const bidsRes = await fetch(`/api/bids?roundId=${roundIdToFetch}`, { cache: "no-store" });
            if (bidsRes.ok) {
              const bidsData = await bidsRes.json();
              if (process.env.NODE_ENV === "development") {
                console.log('📊 Fetched bids for winner popup:', bidsData);
              }
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
        
        // If API didn't send winner details, derive the winning bid from bids list
        let winnerHouseName = statusData.winner?.houseName || "";
        let winnerAmount = statusData.winner?.amount ?? 0;

        if (!winnerHouseName && allBids.length > 0) {
          const topBid = allBids[0];
          winnerHouseName = topBid.houseName;
          winnerAmount = topBid.amount;
        }

        const derivedWinner: WinnerData = {
          houseName: winnerHouseName || "Unknown House",
          amount: winnerAmount,
          allBids,
        };

        setWinnerData(derivedWinner);
        lastCompletedWinnerRef.current = derivedWinner;
        setShowWinner(true);
        winnerShownRef.current = true;
        setLastRoundId(null);
        // Play winner sound while popup is visible
        if (winnerSoundRef.current) {
          try {
            winnerSoundRef.current.currentTime = 0;
            void winnerSoundRef.current.play();
          } catch (e) {
            console.warn("Winner sound play failed", e);
          }
        }

        setTimeout(() => {
          setShowWinner(false);
          setWinnerData(null);
          if (winnerSoundRef.current) {
            winnerSoundRef.current.pause();
          }
        }, 15000);
      } else if (lastRoundId && statusData.roundStatus === "idle" && !statusData.roundId && !winnerShownRef.current) {
        // Round just ended, fetch the last completed round's winner
        try {
          const roundsRes = await fetch("/api/rounds");
          if (roundsRes.ok) {
            const rounds = await roundsRes.json();
            const completedRounds = rounds.filter((r: { status: string }) => r.status === "completed");
            
            if (completedRounds.length > 0) {
              const lastRound = completedRounds[0];
              
              if (lastRound.winningBid && lastRound.winningHouseId) {
                // Find the winning house
                const winningHouse = housesData.find(h => 
                  h._id?.toString() === lastRound.winningHouseId?.toString() ||
                  h.houseId === lastRound.winningHouseId?.toString()
                );
                
                if (winningHouse) {
                  if (process.env.NODE_ENV === "development") {
                    console.log('🏆 Projector: Showing winner from fallback completed rounds');
                  }
                  // Fetch all bids for this round
                  let allBids: Array<{ houseId: string; houseName: string; amount: number }> = [];
                  try {
                    const bidsRes = await fetch(`/api/bids?roundId=${lastRound.roundId}`, { cache: "no-store" });
                    if (bidsRes.ok) {
                      const bidsData = await bidsRes.json();
                      if (process.env.NODE_ENV === "development") {
                        console.log('📊 Fetched bids for fallback winner popup:', bidsData);
                      }
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
                  
                  const derivedWinner: WinnerData = {
                    houseName: winningHouse.name,
                    amount: lastRound.winningBid,
                    allBids,
                  };
                  setWinnerData(derivedWinner);
                  lastCompletedWinnerRef.current = derivedWinner;
                  setShowWinner(true);
                  winnerShownRef.current = true;
                  setLastRoundId(null);

                  if (winnerSoundRef.current) {
                    try {
                      winnerSoundRef.current.currentTime = 0;
                      void winnerSoundRef.current.play();
                    } catch (e) {
                      console.warn("Winner sound play failed", e);
                    }
                  }

                  setTimeout(() => {
                    setShowWinner(false);
                    setWinnerData(null);
                    if (winnerSoundRef.current) {
                      winnerSoundRef.current.pause();
                    }
                  }, 15000);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error fetching completed round:", err);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Exponential backoff on errors
      retryCountRef.current++;
      const backoffDelay = Math.min(
        10000 * Math.pow(2, retryCountRef.current),
        60000
      );
      pollDelayRef.current = backoffDelay;
    }
  };

  useEffect(() => {
    const scheduleNextPoll = () => {
      // Only schedule next poll if socket is NOT connected
      // When socket is connected, we rely on socket events for updates instead of polling
      if (!isConnected) {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
        }
        pollTimeoutRef.current = setTimeout(() => {
          fetchData().then(() => {
            scheduleNextPoll();
          }).catch(() => {
            scheduleNextPoll();
          });
        }, pollDelayRef.current);
      } else {
        // Socket is connected - clear any pending polls
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
      }
    };

    // Initial fetch only - don't start polling if socket is already connected
    fetchData().then(() => {
      // Only schedule polling if socket is not connected
      if (!isConnected) {
        scheduleNextPoll();
      }
    }).catch(() => {
      // Only schedule polling if socket is not connected
      if (!isConnected) {
        scheduleNextPoll();
      }
    });

    // Listen to socket events for real-time updates
    if (socket) {
      // Handle projector-update event with full data (status + houses)
      // This eliminates the need for HTTP requests when socket is connected
      const handleProjectorUpdate = (data: {
        status: {
          roundId: string | null;
          team: {
            teamId: string;
            rank: number;
            batch: string | null;
            memberCount: number;
            successfulAttempts?: number;
            totalPoints?: number;
          } | null;
          roundStatus: "active" | "idle";
          roundNumber?: number;
          timerRemaining: number;
          timerEnd?: string;
          bidsPlaced: Array<{ houseId: string; amount: number }>;
          roundEnded?: boolean;
          winner?: {
            houseName: string;
            amount: number;
          };
        };
        houses: Array<{
          _id: string;
          houseId: string;
          name: string;
          remainingBudget: number;
          totalBudget: number;
        }>;
      }) => {
        if (process.env.NODE_ENV === "development") {
          console.log("📡 Projector-update received via socket:", data);
        }

        // Update houses
        setHouses(data.houses);

        // Update status
        const statusData: Status = {
          roundStatus: data.status.roundStatus,
          roundId: data.status.roundId || undefined,
          roundNumber: data.status.roundNumber,
          team: data.status.team
            ? {
                teamId: data.status.team.teamId,
                rank: data.status.team.rank,
                batch: data.status.team.batch || "",
                memberCount: data.status.team.memberCount,
                successfulAttempts: data.status.team.successfulAttempts,
                totalPoints: data.status.team.totalPoints,
              }
            : undefined,
          timerEnd: data.status.timerEnd,
          bidsPlaced: data.status.bidsPlaced,
          roundEnded: data.status.roundEnded,
          winner: data.status.winner
            ? {
                houseName: data.status.winner.houseName,
                amount: data.status.winner.amount,
              }
            : undefined,
        };
        setStatus(statusData);

        // Update team
        if (data.status.team) {
          setTeam({
            teamId: data.status.team.teamId,
            rank: data.status.team.rank,
            batch: data.status.team.batch || "",
            memberCount: data.status.team.memberCount,
            successfulAttempts: data.status.team.successfulAttempts,
            totalPoints: data.status.team.totalPoints,
          });
          if (data.status.roundId) {
            setLastRoundId(data.status.roundId);
          }
        }

        // Handle bid states and winner display (similar to fetchData logic)
        if (statusData.roundStatus === "active" && statusData.team) {
          winnerShownRef.current = false;

          // Track bid states
          const bidsPlaced = statusData.bidsPlaced || [];
          setHouseBidStates((prevStates) => {
            const newStates: Record<string, HouseBidState> = {};

            data.houses.forEach((house) => {
              const houseId = house.houseId || house._id;
              if (!houseId) return;

              const bid = bidsPlaced.find(
                (b) => b.houseId === houseId || b.houseId === house._id
              );
              const prevState = prevStates[houseId];

              if (!bid) {
                newStates[houseId] = {
                  status: "no-bid",
                  showFlash: false,
                };
              } else if (!prevState || prevState.status === "no-bid") {
                // First bid
                newStates[houseId] = {
                  status: "bid-placed",
                  showFlash: true,
                  previousAmount: bid.amount,
                };
                if (bidSoundRef.current) {
                  try {
                    bidSoundRef.current.currentTime = 0;
                    void bidSoundRef.current.play();
                  } catch (e) {
                    console.warn("Bid sound play failed", e);
                  }
                }
                setTimeout(() => {
                  setHouseBidStates((prev) => ({
                    ...prev,
                    [houseId]: { ...prev[houseId], showFlash: false },
                  }));
                }, 2000);
              } else if (prevState.previousAmount !== bid.amount) {
                // Bid updated
                newStates[houseId] = {
                  status: "bid-updated",
                  showFlash: true,
                  previousAmount: bid.amount,
                };
                if (bidSoundRef.current) {
                  try {
                    bidSoundRef.current.currentTime = 0;
                    void bidSoundRef.current.play();
                  } catch (e) {
                    console.warn("Bid sound play failed", e);
                  }
                }
                setTimeout(() => {
                  setHouseBidStates((prev) => ({
                    ...prev,
                    [houseId]: { ...prev[houseId], showFlash: false },
                  }));
                }, 2000);
              } else {
                // No change
                newStates[houseId] = prevState;
              }
            });

            return newStates;
          });
        }

        // Handle winner display
        const hasWinnerFromStatus =
          !!statusData.winner || statusData.roundEnded === true;

        if (hasWinnerFromStatus && !winnerShownRef.current) {
          if (process.env.NODE_ENV === "development") {
            console.log("🏆 Projector: Showing winner from socket update");
          }

          // Fetch all bids for winner modal (still need this for full bid list)
          const roundIdToFetch = statusData.roundId || lastRoundId;
          if (roundIdToFetch) {
            fetch(`/api/bids?roundId=${roundIdToFetch}`, { cache: "no-store" })
              .then((bidsRes) => {
                if (bidsRes.ok) {
                  return bidsRes.json();
                }
                return [];
              })
              .then((bidsData) => {
                const allBids = bidsData.map(
                  (bid: { houseId: string; amount: number }) => {
                    const house = data.houses.find(
                      (h) =>
                        h.houseId === bid.houseId || h._id === bid.houseId
                    );
                    return {
                      houseId: bid.houseId,
                      houseName: house?.name || "Unknown",
                      amount: bid.amount,
                    };
                  }
                ).sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount);

                const derivedWinner: WinnerData = {
                  houseName: statusData.winner?.houseName || "Unknown House",
                  amount: statusData.winner?.amount || 0,
                  allBids,
                };

                setWinnerData(derivedWinner);
                lastCompletedWinnerRef.current = derivedWinner;
                setShowWinner(true);
                winnerShownRef.current = true;
                setLastRoundId(null);

                if (winnerSoundRef.current) {
                  try {
                    winnerSoundRef.current.currentTime = 0;
                    void winnerSoundRef.current.play();
                  } catch (e) {
                    console.warn("Winner sound play failed", e);
                  }
                }

                setTimeout(() => {
                  setShowWinner(false);
                  setWinnerData(null);
                  if (winnerSoundRef.current) {
                    winnerSoundRef.current.pause();
                  }
                }, 15000);
              })
              .catch((err) => {
                console.error("Error fetching round bids:", err);
              });
          }
        }
      };

      const handleBidNotification = (data: { houseId: string; houseName: string; roundId: string }) => {
        // Immediately update bid state when a bid is placed
        if (data.roundId === status?.roundId) {
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
          
          // No need to fetch - bid state is updated locally
          // The next state-update or round-end will provide full data if needed
        }
      };

      // Legacy handlers - kept for backward compatibility but no longer fetch data
      // projector-update event now provides all data needed
      const handleRoundStarted = (data?: { roundId: string; timerEnd: string }) => {
        // Clear any pending polls - projector-update will provide data
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        // No fetchData() call - wait for projector-update event
      };

      const handleRoundEnded = (data?: { roundId: string; winner: any; losers: any[] }) => {
        // Clear any pending polls - projector-update will provide data
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        // No fetchData() call - wait for projector-update event
      };

      const handleStateUpdate = (state: any) => {
        // State update received - projector-update will provide full data
        // No fetchData() call - wait for projector-update event
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
      };

      socket.on("projector-update", handleProjectorUpdate);
      socket.on("bid-notification", handleBidNotification);
      socket.on("round-started", handleRoundStarted);
      socket.on("round-ended", handleRoundEnded);
      socket.on("state-update", handleStateUpdate);

      return () => {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
        }
        socket.off("projector-update", handleProjectorUpdate);
        socket.off("bid-notification", handleBidNotification);
        socket.off("round-started", handleRoundStarted);
        socket.off("round-ended", handleRoundEnded);
        socket.off("state-update", handleStateUpdate);
      };
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, status?.roundId, isConnected]);

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
    console.log('🖥️ Projector render state:', {
      showWinner,
      hasWinnerData: !!winnerData,
      winnerData,
      roundStatus: status?.roundStatus,
      hasStatus: !!status
    });
  }

  // Winner Screen
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
          <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center mx-auto mb-8 border-8 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.8)]">
            <span className="text-9xl sm:text-[12rem] font-bold text-black">#{team?.rank || "?"}</span>
          </div>
          <h2 className="text-5xl sm:text-7xl font-bold mb-4 text-white drop-shadow-[0_0_30px_#000000]">
            Team #{team?.rank || "?"}
          </h2>
          <p className="text-3xl sm:text-4xl text-white/90 mb-2 drop-shadow-[0_0_20px_#000000]">
            Batch: {team?.batch || "N/A"}
          </p>
          <p className="text-2xl sm:text-3xl text-white/80 mb-8 drop-shadow-[0_0_20px_#000000]">
            {team?.memberCount || 0} members
          </p>
          <div className="text-4xl sm:text-5xl mb-8 text-white drop-shadow-[0_0_20px_#000000]">
            has been won by
          </div>
          <div className="bg-black/60 rounded-3xl p-8 sm:p-12 border-4 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.6)] backdrop-blur-md">
            <div className="text-6xl sm:text-8xl font-bold text-[#FFD700] mb-6 drop-shadow-[0_0_30px_#FFD700]">
              🏯 {winnerData.houseName}
            </div>
            <div className="text-5xl sm:text-6xl font-bold text-white drop-shadow-[0_0_20px_#FFFFFF] mb-8">
              for ${winnerData.amount}
            </div>
            
            {winnerData.allBids && winnerData.allBids.length > 0 && (
              <div className="mt-8 pt-8 border-t-2 border-[#FFD700]/30">
                <h3 className="text-3xl sm:text-4xl font-bold text-white mb-6 drop-shadow-[0_0_15px_#FFFFFF]">
                  All Bids This Round
                </h3>
                <div className="space-y-3">
                  {(() => {
                    // Build a list of all houses with either their bid or a "No Bids" entry
                    const seenHouseIds = new Set<string>();
                    const bidRows = winnerData.allBids!.map((bid, index) => {
                      seenHouseIds.add(bid.houseId);
                      const isWinner =
                        bid.amount === winnerData.amount &&
                        bid.houseName === winnerData.houseName;
                      return (
                        <div
                          key={`bid-${index}`}
                          className={`flex justify-between items-center p-4 sm:p-6 rounded-xl transition-all ${
                            isWinner
                              ? "bg-[#FFD700]/30 border-4 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.5)]"
                              : "bg-black/40 border-2 border-white/20"
                          }`}
                        >
                          <span
                            className={`font-bold ${
                              isWinner
                                ? "text-[#FFD700] text-3xl sm:text-4xl drop-shadow-[0_0_15px_#FFD700]"
                                : "text-white text-2xl sm:text-3xl"
                            }`}
                          >
                            {isWinner && "👑 "}
                            {bid.houseName}
                          </span>
                          <span
                            className={`font-bold ${
                              isWinner
                                ? "text-[#FFD700] text-4xl sm:text-5xl drop-shadow-[0_0_20px_#FFD700]"
                                : "text-white text-3xl sm:text-4xl"
                            }`}
                          >
                            ${bid.amount}
                          </span>
                        </div>
                      );
                    });

                    // Add synthetic "No Bids" rows for houses that never bid
                    const noBidRows = houses
                      .filter((h) => h.houseId && !seenHouseIds.has(h.houseId))
                      .map((h) => (
                        <div
                          key={`nobid-${h.houseId}`}
                          className="flex justify-between items-center p-4 sm:p-6 rounded-xl bg-black/40 border-2 border-white/10"
                        >
                          <span className="font-bold text-white text-2xl sm:text-3xl">
                            {h.name}
                          </span>
                          <span className="font-semibold text-gray-300 text-xl sm:text-2xl">
                            No Bids
                          </span>
                        </div>
                      ));

                    return [...bidRows, ...noBidRows];
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // If there is no active status but we have a last completed winner cached,
  // rebuild the winner popup so late-opened tabs still see the result.
  if ((!status || status.roundStatus !== "active") && lastCompletedWinnerRef.current && !showWinner) {
    // Safely trigger showing the cached winner; guard against render loops
    setTimeout(() => {
      setShowWinner((prev) => (prev ? prev : true));
      setWinnerData((prev) => prev || lastCompletedWinnerRef.current);
    }, 0);
  }

  if (!status || status.roundStatus !== "active") {
    return <WaitingScreen />;
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
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFD70008_1px,transparent_1px),linear-gradient(to_bottom,#FFD70008_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"></div>

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
            <div className="bg-gradient-to-br from-gray-900/95 to-black/95 rounded-3xl p-8 w-full max-w-2xl border-4 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.5)] backdrop-blur-md">
              <h2 className="text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
                👥 CURRENT TEAM
              </h2>
              <div className="flex flex-col items-center gap-4">
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#FFD700] via-[#FFB800] to-[#FFA500] flex items-center justify-center border-4 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.6)]">
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
