"use client";

import { useState, useEffect } from "react";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";

interface ProjectorStatus {
  activeRound: {
    id: string;
    timerEnd: string;
    timeLeft: number;
  } | null;
  currentParticipant: {
    id: string;
    name: string;
    picture?: string;
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
      fetchStatus();
      const interval = setInterval(fetchStatus, 1000); // Refresh every second
      return () => clearInterval(interval);
    }
  }, [mounted]);

  const fetchStatus = async () => {
    try {
      const [statusRes, housesRes] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/houses")
      ]);

      const statusData = statusRes.ok ? await statusRes.json() : null;
      const housesData = housesRes.ok ? await housesRes.json() : [];

      setStatus(statusData);
      setHouses(Array.isArray(housesData) ? housesData : []);

      // If there was an active round but now there isn't, show results
      if (status?.activeRound && statusData && !statusData.activeRound && !showResults) {
        // Fetch the latest completed round results
        setTimeout(() => {
          setShowResults(true);
          setTimeout(() => setShowResults(false), 10000); // Show results for 10 seconds
        }, 1000);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
      setStatus(null);
      setHouses([]);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8">CC Bidding System</h1>
          <p className="text-2xl text-gray-300">Waiting for next round to begin...</p>
        </div>
      </div>
    );
  }

  const timeLeft = Math.max(0, status.activeRound.timeLeft);
  const isTimeRunningOut = timeLeft < 10000; // Less than 10 seconds

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      {/* Header */}
      <div className="bg-black bg-opacity-30 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-4xl font-bold">CC Bidding System</h1>
          <div className="text-right">
            <div className="text-2xl font-bold">Current Round</div>
            <div className="text-lg text-gray-300">Live Bidding</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Timer */}
        <div className="text-center mb-12">
          <div className={`text-8xl font-bold mb-4 ${isTimeRunningOut ? "text-red-400 animate-pulse" : "text-white"}`}>
            {formatTime(timeLeft)}
          </div>
          <div className="w-full max-w-2xl mx-auto bg-gray-700 rounded-full h-6">
            <div
              className={`h-6 rounded-full transition-all duration-1000 ${
                isTimeRunningOut ? "bg-red-500" : "bg-green-500"
              }`}
              style={{
                width: `${Math.max(0, (timeLeft / 60000) * 100)}%`,
              }}
            ></div>
          </div>
          <div className="text-xl text-gray-300 mt-2">seconds remaining</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Current Participant */}
          <div className="bg-white bg-opacity-10 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-3xl font-bold mb-6 text-center">Current Participant</h2>
            <div className="text-center">
              {status.currentParticipant.picture && (
                <img
                  src={status.currentParticipant.picture}
                  alt={status.currentParticipant.name}
                  className="w-48 h-48 object-cover rounded-full mx-auto mb-6 border-4 border-white"
                />
              )}
              <h3 className="text-4xl font-bold">{status.currentParticipant.name}</h3>
            </div>
          </div>

          {/* Bidding Status */}
          <div className="bg-white bg-opacity-10 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-3xl font-bold mb-6 text-center">Bidding Status</h2>
            <div className="space-y-4">
              <div className="text-xl mb-4">
                Houses that placed bids: <span className="font-bold">{status.housesWithBids.length}</span>
              </div>
              
              {status.housesWithBids.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {status.housesWithBids.map((house) => (
                    <div
                      key={house.id}
                      className="bg-green-500 bg-opacity-30 rounded-lg p-4 text-center border-2 border-green-400"
                    >
                      <div className="text-lg font-semibold">{house.name}</div>
                      <div className="text-sm text-green-200">✓ Bid Placed</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-300 text-xl">
                  No bids placed yet...
                </div>
              )}

              {/* Show houses that haven't bid */}
              {houses.length > status.housesWithBids.length && (
                <div className="mt-6">
                  <div className="text-lg mb-2 text-gray-300">Waiting for:</div>
                  <div className="grid grid-cols-2 gap-4">
                    {houses
                      .filter(house => !status.housesWithBids.some(bidHouse => bidHouse.id === house._id?.toString()))
                      .map((house) => (
                        <div
                          key={house._id?.toString()}
                          className="bg-gray-500 bg-opacity-30 rounded-lg p-4 text-center border-2 border-gray-400"
                        >
                          <div className="text-lg font-semibold">{house.name}</div>
                          <div className="text-sm text-gray-300">Thinking...</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* House Budget Overview */}
        <div className="mt-12 bg-white bg-opacity-10 rounded-2xl p-8 backdrop-blur-sm">
          <h2 className="text-3xl font-bold mb-6 text-center">House Budgets</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {houses.map((house) => (
              <div key={house._id?.toString()} className="text-center">
                <h3 className="text-xl font-semibold mb-2">{house.name}</h3>
                <div className="text-2xl font-bold text-green-400 mb-2">
                  ${house.remainingBudget}
                </div>
                <div className="w-full bg-gray-600 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{
                      width: `${(house.remainingBudget / house.totalBudget) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="text-sm text-gray-300 mt-1">
                  of ${house.totalBudget}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}