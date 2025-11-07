"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { House } from "@/lib/models/houses";

export default function ProjectorDisplay() {
  const { isConnected, currentState, on } = useSocket();
  const [houses, setHouses] = useState<House[]>([]);
  const [housesWithBids, setHousesWithBids] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    fetchHouses();
  }, []);

  useEffect(() => {
    if (!on) return;

    const unsubBid = on("bid-notification", (data: any) => {
      setHousesWithBids(prev => {
        if (!prev.includes(data.houseId)) {
          return [...prev, data.houseId];
        }
        return prev;
      });
    });

    const unsubRoundStart = on("round-started", () => {
      setHousesWithBids([]);
    });

    return () => {
      unsubBid?.();
      unsubRoundStart?.();
    };
  }, [on]);

  // Timer countdown
  useEffect(() => {
    if (currentState?.screen === "bidding" && currentState.timerEnd) {
      const interval = setInterval(() => {
        const remaining = new Date(currentState.timerEnd).getTime() - Date.now();
        setTimeLeft(Math.max(0, remaining));
      }, 100);

      return () => clearInterval(interval);
    }
  }, [currentState]);

  const fetchHouses = async () => {
    try {
      const response = await fetch("/api/status");
      if (response.ok) {
        const data = await response.json();
        if (data.houses) {
          setHouses(data.houses);
        }
      }
    } catch (error) {
      console.error("Error fetching houses:", error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${seconds}`;
  };

  // Waiting Screen
  if (!currentState || currentState.screen === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-8">⏳</div>
          <h1 className="text-6xl font-bold mb-8">CC Bidding System</h1>
          <p className="text-3xl text-gray-300">
            {currentState?.message || "Waiting for admin to start the next round..."}
          </p>
          <div className="mt-8">
            <div className={`inline-block px-4 py-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}>
              {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Bidding Screen
  if (currentState.screen === "bidding") {
    const isTimeRunningOut = timeLeft < 10000;
    const participant = currentState.participant;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
        {/* Header */}
        <div className="bg-black bg-opacity-30 p-6">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-4xl font-bold">CC Bidding System</h1>
            <div className="text-right">
              <div className="text-2xl font-bold">LIVE BIDDING</div>
              <div className={`text-lg ${isConnected ? "text-green-400" : "text-red-400"}`}>
                {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-8">
          {/* Timer */}
          <div className="text-center mb-12">
            <div className={`text-9xl font-bold mb-4 ${isTimeRunningOut ? "text-red-400 animate-pulse" : "text-white"}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="w-full max-w-3xl mx-auto bg-gray-700 rounded-full h-8">
              <div
                className={`h-8 rounded-full transition-all duration-1000 ${
                  isTimeRunningOut ? "bg-red-500" : "bg-green-500"
                }`}
                style={{
                  width: `${Math.max(0, (timeLeft / 60000) * 100)}%`,
                }}
              ></div>
            </div>
            <div className="text-2xl text-gray-300 mt-4">seconds remaining</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Current Participant */}
            <div className="bg-white bg-opacity-10 rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-4xl font-bold mb-6 text-center">Current Participant</h2>
              <div className="text-center">
                {participant?.picture && (
                  <img
                    src={participant.picture}
                    alt={participant.name}
                    className="w-64 h-64 object-cover rounded-full mx-auto mb-6 border-4 border-white"
                  />
                )}
                <h3 className="text-5xl font-bold">{participant?.name || "Loading..."}</h3>
              </div>
            </div>

            {/* Bidding Status */}
            <div className="bg-white bg-opacity-10 rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-4xl font-bold mb-6 text-center">Bidding Status</h2>
              <div className="space-y-4">
                <div className="text-2xl mb-6 text-center">
                  Houses that placed bids: <span className="font-bold text-green-400">{housesWithBids.length}</span>
                </div>
                
                {housesWithBids.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {houses
                      .filter(house => housesWithBids.includes(house._id?.toString() || ""))
                      .map((house) => (
                        <div
                          key={house._id?.toString()}
                          className="bg-green-500 bg-opacity-30 rounded-lg p-6 text-center border-2 border-green-400"
                        >
                          <div className="text-2xl font-semibold">{house.name}</div>
                          <div className="text-lg text-green-200">✓ Bid Placed</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-300 text-2xl py-8">
                    No bids placed yet...
                  </div>
                )}

                {/* Show houses that haven't bid */}
                {houses.length > housesWithBids.length && (
                  <div className="mt-8">
                    <div className="text-xl mb-4 text-gray-300 text-center">Waiting for:</div>
                    <div className="grid grid-cols-2 gap-4">
                      {houses
                        .filter(house => !housesWithBids.includes(house._id?.toString() || ""))
                        .map((house) => (
                          <div
                            key={house._id?.toString()}
                            className="bg-gray-500 bg-opacity-30 rounded-lg p-6 text-center border-2 border-gray-400"
                          >
                            <div className="text-2xl font-semibold">{house.name}</div>
                            <div className="text-lg text-gray-300">Thinking...</div>
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

  // Results Screen
  if (currentState.screen === "results") {
    const { winner, losers, participant } = currentState;

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-blue-900 text-white flex items-center justify-center">
        <div className="text-center max-w-5xl mx-auto p-8">
          <h1 className="text-7xl font-bold mb-12">🎉 Round Results 🎉</h1>
          
          {/* Participant Info */}
          <div className="mb-12">
            {participant?.picture && (
              <img
                src={participant.picture}
                alt={participant.name}
                className="w-48 h-48 object-cover rounded-full mx-auto mb-6 border-4 border-yellow-400"
              />
            )}
            <h2 className="text-5xl font-bold mb-4">{participant?.name}</h2>
          </div>

          {winner ? (
            <div className="space-y-8">
              {/* Winner */}
              <div className="bg-yellow-500 bg-opacity-20 rounded-2xl p-8 border-4 border-yellow-400">
                <div className="text-3xl mb-4">🏆 WINNER 🏆</div>
                <div className="text-6xl font-bold text-yellow-400 mb-4">
                  {houses.find(h => h._id?.toString() === winner.houseId)?.name || "Unknown House"}
                </div>
                <div className="text-4xl text-green-400">
                  Winning Bid: ${winner.amount}
                </div>
                <div className="text-xl text-gray-300 mt-2">
                  Placed at: {new Date(winner.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* Losers */}
              {losers && losers.length > 0 && (
                <div className="bg-white bg-opacity-10 rounded-2xl p-8">
                  <h3 className="text-3xl font-bold mb-6">Other Bids</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {losers.map((loser: any, index: number) => (
                      <div key={index} className="bg-gray-700 bg-opacity-50 rounded-lg p-6">
                        <div className="text-2xl font-semibold mb-2">
                          {houses.find(h => h._id?.toString() === loser.houseId)?.name || "Unknown"}
                        </div>
                        <div className="text-3xl text-red-400">${loser.amount}</div>
                        <div className="text-sm text-gray-400 mt-2">
                          {new Date(loser.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-5xl text-red-400">No bids were placed</div>
          )}

          <div className="mt-12 text-2xl text-gray-300">
            Waiting for admin to start next round...
          </div>
        </div>
      </div>
    );
  }

  return null;
}
