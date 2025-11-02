"use client";

import { useState, useEffect } from "react";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";

interface ProjectorStatus {
  activeRound: {
    id: string;
    roundNumber: number;
    timerEnd: string;
    timeLeft: number;
  } | null;
  currentParticipant: {
    id: string;
    name: string;
    picture?: string;
    batch: string;
    universityId: string;
  } | null;
  housesWithBids: {
    id: string;
    name: string;
  }[];
  winningHouse: {
    id: string;
    name: string;
    amount: number;
  } | null;
}

export default function ProjectorDisplay() {
  const [status, setStatus] = useState<ProjectorStatus | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      // ORIGINAL CODE (commented out for UI testing):
      // fetchStatus();
      // const interval = setInterval(fetchStatus, 1000); // Refresh every second
      // return () => clearInterval(interval);

      // Mock data for projector display (for testing without backend):
      const now = Date.now();
      const mockStatus: ProjectorStatus = {
        activeRound: {
          id: "r1",
          roundNumber: 12,
          timerEnd: new Date(now + 45000).toISOString(),
          timeLeft: 45000,
        },
        currentParticipant: {
          id: "p1",
          name: "Po the Dragon Warrior",
          picture: "https://api.dicebear.com/7.x/initials/svg?seed=Po",
          batch: "Sophomore",
          universityId: "23K-4567",
        },
        housesWithBids: [
          { id: "h1", name: "Lord Shen" },
          { id: "h3", name: "Master Oogway" },
        ],
        winningHouse: null,
      };
      const mockHouses: House[] = [
        { _id: "h1" as any, name: "Lord Shen", totalBudget: 1000, remainingBudget: 900 },
        { _id: "h2" as any, name: "Dragon Warrior", totalBudget: 1000, remainingBudget: 750 },
        { _id: "h3" as any, name: "Master Oogway", totalBudget: 1000, remainingBudget: 620 },
        { _id: "h4" as any, name: "Tai Lung", totalBudget: 1000, remainingBudget: 1000 },
      ];
      setStatus(mockStatus);
      setHouses(mockHouses);

      // Tick down the timer every second
      const interval = setInterval(() => {
        setStatus((prev) => {
          if (!prev?.activeRound) return prev;
          const newTimeLeft = Math.max(0, prev.activeRound.timeLeft - 1000);
          return {
            ...prev,
            activeRound: {
              ...prev.activeRound,
              timeLeft: newTimeLeft,
            },
          };
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mounted]);

  const fetchStatus = async () => {
    // ORIGINAL CODE (commented out for UI testing):
    // try {
    //   const [statusRes, housesRes] = await Promise.all([
    //     fetch("/api/status"),
    //     fetch("/api/houses")
    //   ]);
    //
    //   const statusData = statusRes.ok ? await statusRes.json() : null;
    //   const housesData = housesRes.ok ? await housesRes.json() : [];
    //
    //   setStatus(statusData);
    //   setHouses(Array.isArray(housesData) ? housesData : []);
    //
    //   // If there was an active round but now there isn't, show results
    //   if (status?.activeRound && statusData && !statusData.activeRound && !showResults) {
    //     // Fetch the latest completed round results
    //     setTimeout(() => {
    //       setShowResults(true);
    //       setTimeout(() => setShowResults(false), 10000); // Show results for 10 seconds
    //     }, 1000);
    //   }
    // } catch (error) {
    //   console.error("Error fetching status:", error);
    //   setStatus(null);
    //   setHouses([]);
    // }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${seconds}`;
  };

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  if (showResults && roundResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8">Round Results</h1>
          {roundResults.winningBid ? (
            <div className="space-y-6">
              <div className="text-4xl">
                🎉 Winner: <span className="text-yellow-400">{roundResults.winningBid.houseName}</span>
              </div>
              <div className="text-3xl">
                Winning Bid: <span className="text-green-400">${roundResults.winningBid.amount}</span>
              </div>
            </div>
          ) : (
            <div className="text-4xl text-red-400">No bids were placed</div>
          )}
        </div>
      </div>
    );
  }

  if (!status?.activeRound || !status.currentParticipant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-7xl font-bold mb-8 text-yellow-400 drop-shadow-2xl">
            🐉 Coders Cup 2025
          </h1>
          <p className="text-3xl text-gray-200">Awaiting the next warrior...</p>
          <div className="mt-8 text-xl text-gray-300">
            The bidding arena will open soon
          </div>
        </div>
      </div>
    );
  }

  const timeLeft = Math.max(0, status.activeRound.timeLeft);
  const isTimeRunningOut = timeLeft < 10000; // Less than 10 seconds

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed relative text-white"
      style={{
        backgroundImage: "url('/arena-background.jpg')",
      }}
    >
      {/* Dark overlay for text visibility */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Header with Round Number and Timer */}
        <div className="bg-black/50 border-b-4 border-yellow-600 shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <h1 className="text-5xl font-bold text-yellow-400 drop-shadow-lg">
                ⚔️ ROUND {status.activeRound.roundNumber}
              </h1>
            </div>
            <div className="text-center">
              <div className={`text-7xl font-bold ${isTimeRunningOut ? "text-red-400 animate-pulse" : "text-yellow-300"}`}>
                {formatTime(timeLeft)}s
              </div>
              <div className="text-lg text-gray-300 mt-1">Time Remaining</div>
            </div>
          </div>
          
          {/* Timer Progress Bar */}
          <div className="w-full bg-black bg-opacity-40 rounded-full h-4 mt-4 border-2 border-yellow-600">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isTimeRunningOut ? "bg-red-500" : "bg-green-500"
              }`}
              style={{
                width: `${Math.max(0, (timeLeft / 60000) * 100)}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Main Player Display */}
        <div className="bg-gradient-to-br from-yellow-600 to-orange-700 rounded-3xl p-12 mb-12 border-4 border-yellow-400 shadow-2xl">
          <h2 className="text-4xl font-bold mb-8 text-center text-black drop-shadow-lg">
            🥋 WARRIOR ON THE BLOCK
          </h2>
          <div className="flex items-center justify-center gap-12">
            {/* Player Picture */}
            <div className="relative">
              {status.currentParticipant.picture ? (
                <img
                  src={status.currentParticipant.picture}
                  alt={status.currentParticipant.name}
                  className="w-64 h-64 object-cover rounded-full border-8 border-black shadow-2xl"
                />
              ) : (
                <div className="w-64 h-64 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full border-8 border-black shadow-2xl flex items-center justify-center">
                  <span className="text-8xl">👤</span>
                </div>
              )}
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-black px-6 py-2 rounded-full border-4 border-yellow-400">
                <span className="text-yellow-400 font-bold text-xl">{status.currentParticipant.batch}</span>
              </div>
            </div>

            {/* Player Details */}
            <div className="text-left space-y-4">
              <h3 className="text-6xl font-bold text-black drop-shadow-lg">
                {status.currentParticipant.name}
              </h3>
              <div className="flex items-center gap-4 text-3xl">
                <span className="bg-black text-yellow-400 px-6 py-3 rounded-lg font-bold border-2 border-yellow-400">
                  🎓 {status.currentParticipant.universityId}
                </span>
              </div>
              <div className="text-2xl text-black font-semibold mt-4">
                📚 Batch: {status.currentParticipant.batch}
              </div>
            </div>
          </div>
        </div>

        {/* Bidding Houses Status */}
        <div className="bg-black bg-opacity-50 rounded-3xl p-10 border-4 border-yellow-600 shadow-2xl">
          <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">
            🏯 HOUSE BIDDING STATUS
          </h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {houses.map((house) => {
              const hasBid = status.housesWithBids.some(bidHouse => bidHouse.id === house._id?.toString());
              
              return (
                <div
                  key={house._id?.toString()}
                  className={`rounded-2xl p-6 text-center transition-all transform hover:scale-105 border-4 ${
                    hasBid
                      ? "bg-gradient-to-br from-green-600 to-green-800 border-green-400 shadow-lg shadow-green-500/50"
                      : "bg-gradient-to-br from-gray-700 to-gray-900 border-gray-500 opacity-60"
                  }`}
                >
                  <div className="text-3xl mb-3">
                    {hasBid ? "✅" : "⏳"}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{house.name}</h3>
                  <div className={`text-lg font-semibold ${hasBid ? "text-green-200" : "text-gray-400"}`}>
                    {hasBid ? "Bid Placed!" : "Thinking..."}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-8 text-center">
            <div className="inline-block bg-yellow-600 text-black px-8 py-4 rounded-full text-2xl font-bold border-4 border-yellow-400 shadow-lg">
              {status.housesWithBids.length} of {houses.length} Houses Have Placed Their Bids
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}