"use client";

import { useState, useEffect } from "react";

interface Participant {
  participantId: string;
  name: string;
  picture?: string;
}

interface WinnerData {
  houseName: string;
  amount: number;
}

export default function ProjectorDisplay() {
  const [status, setStatus] = useState<any>(null);
  const [houses, setHouses] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [winnerData, setWinnerData] = useState<WinnerData | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [lastRoundId, setLastRoundId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    // Poll every 2 seconds for real-time sync
    const pollInterval = setInterval(() => {
      fetchData();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, []);

  const fetchLastRoundWinner = async () => {
    try {
      // Fetch all rounds and get the most recent completed one
      const roundsRes = await fetch("/api/rounds");
      if (roundsRes.ok) {
        const rounds = await roundsRes.json();
        const completedRounds = rounds.filter(
          (r: any) => r.status === "completed"
        );

        if (completedRounds.length > 0) {
          const lastRound = completedRounds[0]; // Most recent

          if (lastRound.winningBid) {
            // Fetch participant
            const participantRes = await fetch("/api/participants");
            if (participantRes.ok) {
              const participants = await participantRes.json();
              const roundParticipant = participants.find(
                (p: any) => p.participantId === lastRound.participantId
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
                (b: any) => b.amount === lastRound.winningBid
              );

              if (winningBid) {
                // Try to get house name (might fail without auth, but try anyway)
                try {
                  const housesRes = await fetch("/api/houses");
                  if (housesRes.ok) {
                    const housesData = await housesRes.json();
                    const winningHouse = housesData.find(
                      (h: any) => h.houseId === winningBid.houseId.toString()
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
                      }, 10000);
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
      const statusData = await statusRes.json();
      setStatus(statusData);

      // Fetch houses (handle 401 gracefully for projector)
      try {
        const housesRes = await fetch("/api/houses", { cache: "no-store" });
        if (housesRes.ok) {
          const housesData = await housesRes.json();
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
        setLastRoundId(statusData.roundId);
        const serverTimerEnd = statusData.timerEnd
          ? new Date(statusData.timerEnd)
          : new Date(Date.now() + statusData.timerRemaining * 1000);
        setTimeLeft(Math.max(0, serverTimerEnd.getTime() - Date.now()));
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

        // Auto-hide after 10 seconds
        setTimeout(() => {
          console.log("⏰ Hiding winner modal");
          setShowWinner(false);
          setWinnerData(null);
        }, 10000);
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

  const formatTime = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${seconds}`;
  };

  // Winner Announcement Screen
  if (showWinner && winnerData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 text-white flex items-center justify-center">
        <div className="text-center max-w-5xl mx-auto p-8 animate-pulse">
          <h1 className="text-9xl font-bold mb-12 drop-shadow-lg">
            🏆 SOLD! 🏆
          </h1>

          {participant?.picture && (
            <img
              src={participant.picture}
              alt={participant.name}
              className="w-64 h-64 object-cover rounded-full mx-auto mb-8 border-8 border-yellow-400 shadow-2xl"
            />
          )}

          <h2 className="text-7xl font-bold mb-8 text-black drop-shadow-lg">
            {participant?.name || "Participant"}
          </h2>

          <div className="text-5xl mb-6">has been won by</div>

          <div className="bg-black bg-opacity-40 rounded-3xl p-12 border-4 border-yellow-400">
            <div className="text-8xl font-bold text-yellow-300 mb-6">
              🏯 {winnerData.houseName}
            </div>
            <div className="text-6xl font-bold text-white">
              for ${winnerData.amount}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Screen
  if (!status || status.roundStatus !== "active") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-9xl mb-8">⏳</div>
          <h1 className="text-7xl font-bold mb-8">CC Bidding System</h1>
          <p className="text-4xl text-gray-300">
            Waiting for admin to start the next round...
          </p>
        </div>
      </div>
    );
  }

  // Active Bidding Screen
  const isTimeRunningOut = timeLeft < 10000;
  const bidsPlaced = status.bidsPlaced || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      {/* Header */}
      <div className="bg-black bg-opacity-30 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-5xl font-bold">CC Bidding System</h1>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-400">
              🔴 LIVE BIDDING
            </div>
            <div className="text-2xl text-gray-300">
              Round {status.roundNumber || "?"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Timer */}
        <div className="text-center mb-12">
          <div
            className={`text-[12rem] font-bold mb-6 ${isTimeRunningOut ? "text-red-400 animate-pulse" : "text-white"}`}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="w-full max-w-4xl mx-auto bg-gray-700 rounded-full h-10">
            <div
              className={`h-10 rounded-full transition-all duration-1000 ${
                isTimeRunningOut ? "bg-red-500" : "bg-green-500"
              }`}
              style={{
                width: `${Math.max(0, (timeLeft / 60000) * 100)}%`,
              }}
            ></div>
          </div>
          <div className="text-3xl text-gray-300 mt-4">seconds remaining</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Current Participant */}
          <div className="bg-white bg-opacity-10 rounded-3xl p-10 backdrop-blur-sm border-4 border-yellow-400">
            <h2 className="text-5xl font-bold mb-8 text-center text-yellow-400">
              🥋 WARRIOR UP FOR BIDDING
            </h2>
            <div className="text-center">
              {participant?.picture ? (
                <img
                  src={participant.picture}
                  alt={participant.name}
                  className="w-72 h-72 object-cover rounded-full mx-auto mb-8 border-8 border-yellow-400 shadow-2xl"
                />
              ) : (
                <div className="w-72 h-72 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full mx-auto mb-8 border-8 border-yellow-400 shadow-2xl flex items-center justify-center">
                  <span className="text-9xl">👤</span>
                </div>
              )}
              <h3 className="text-6xl font-bold text-white drop-shadow-lg">
                {participant?.name || "Loading..."}
              </h3>
            </div>
          </div>

          {/* Bidding Status */}
          <div className="bg-white bg-opacity-10 rounded-3xl p-10 backdrop-blur-sm border-4 border-blue-400">
            <h2 className="text-5xl font-bold mb-8 text-center text-blue-300">
              🏯 Bidding Status
            </h2>
            <div className="space-y-6">
              <div className="text-3xl mb-8 text-center">
                Houses that placed bids:{" "}
                <span className="font-bold text-green-400 text-5xl">
                  {bidsPlaced.length}
                </span>
              </div>

              {bidsPlaced.length > 0 ? (
                <div className="grid grid-cols-2 gap-6">
                  {Array.isArray(houses) &&
                    houses
                      .filter((house) =>
                        bidsPlaced.some(
                          (bid: any) => bid.houseId === house._id?.toString()
                        )
                      )
                      .map((house) => (
                        <div
                          key={house._id?.toString()}
                          className="bg-green-500 bg-opacity-30 rounded-xl p-8 text-center border-4 border-green-400 transform hover:scale-105 transition-all"
                        >
                          <div className="text-3xl font-bold mb-2">
                            {house.name}
                          </div>
                          <div className="text-2xl text-green-200">
                            ✓ Bid Placed
                          </div>
                        </div>
                      ))}
                </div>
              ) : (
                <div className="text-center text-gray-300 text-3xl py-12">
                  No bids placed yet...
                </div>
              )}

              {/* Show houses that haven't bid */}
              {Array.isArray(houses) && houses.length > bidsPlaced.length && (
                <div className="mt-10">
                  <div className="text-2xl mb-6 text-gray-300 text-center">
                    Waiting for:
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    {houses
                      .filter(
                        (house) =>
                          !bidsPlaced.some(
                            (bid: any) => bid.houseId === house._id?.toString()
                          )
                      )
                      .map((house) => (
                        <div
                          key={house._id?.toString()}
                          className="bg-gray-500 bg-opacity-30 rounded-xl p-8 text-center border-4 border-gray-400"
                        >
                          <div className="text-3xl font-bold mb-2">
                            {house.name}
                          </div>
                          <div className="text-2xl text-gray-300">
                            Thinking...
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
