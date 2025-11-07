/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { Round } from "@/lib/models/rounds";

export default function OverviewPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [currentParticipant, setCurrentParticipant] =
    useState<Participant | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number>(1);

  useEffect(() => {
    // Mock data for UI testing
    const mockHouses: House[] = [
      {
        _id: "h1" as any,
        name: "Lord Shen",
        totalBudget: 1000,
        remainingBudget: 750,
      },
      {
        _id: "h2" as any,
        name: "Dragon Warrior",
        totalBudget: 1000,
        remainingBudget: 820,
      },
      {
        _id: "h3" as any,
        name: "Master Oogway",
        totalBudget: 1000,
        remainingBudget: 650,
      },
      {
        _id: "h4" as any,
        name: "Tai Lung",
        totalBudget: 1000,
        remainingBudget: 900,
      },
    ];
    setHouses(mockHouses);

    const mockParticipant: Participant = {
      _id: "p1" as any,
      name: "Po the Warrior",
      picture: "https://api.dicebear.com/7.x/initials/svg?seed=Po",
      roundStats: [],
    };
    setCurrentParticipant(mockParticipant);
    setTimeLeft(45000);
    setRoundNumber(12);

    // Timer countdown
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const getTimerColor = () => {
    if (timeLeft > 30000) return "text-green-400";
    if (timeLeft > 10000) return "text-yellow-400";
    return "text-red-500 animate-pulse";
  };

  return (
    <div className="space-y-8">
      {/* Round Info Card */}
      <div className="bg-black bg-opacity-40 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-5xl font-bold text-yellow-400 mb-2">
            ⚔️ Round {roundNumber}
          </h2>
          <p className="text-gray-300 text-lg">Battle in Progress</p>
        </div>

        {/* Timer */}
        <div className="text-center mb-8">
          <div className={`text-7xl font-bold ${getTimerColor()} mb-4`}>
            {formatTime(timeLeft)}
          </div>
          <div className="w-full max-w-2xl mx-auto bg-gray-800 rounded-full h-6 overflow-hidden border-2 border-yellow-600">
            <div
              className={`h-full transition-all duration-1000 ${
                timeLeft > 30000
                  ? "bg-green-500"
                  : timeLeft > 10000
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${(timeLeft / 60000) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Current Participant */}
        {currentParticipant && (
          <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl p-6 text-center">
            <h3 className="text-2xl font-bold text-black mb-4">
              🥋 Current Warrior
            </h3>
            <div className="flex items-center justify-center gap-6">
              {currentParticipant.picture && (
                <img
                  src={currentParticipant.picture}
                  alt={currentParticipant.name}
                  className="w-24 h-24 rounded-full border-4 border-black shadow-lg"
                />
              )}
              <div className="text-left">
                <p className="text-3xl font-bold text-black">
                  {currentParticipant.name}
                </p>
                <p className="text-black text-opacity-80">
                  Awaiting house bids...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Houses Budget Overview */}
      <div className="bg-black bg-opacity-40 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
        <h2 className="text-3xl font-bold text-yellow-400 mb-6 text-center">
          🏯 House Treasuries
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {houses.map((house) => {
            const percentage =
              (house.remainingBudget / house.totalBudget) * 100;
            const getColor = () => {
              if (percentage > 70) return "from-green-600 to-green-800";
              if (percentage > 40) return "from-yellow-600 to-orange-700";
              return "from-red-600 to-red-800";
            };

            return (
              <div
                key={house._id?.toString()}
                className={`bg-gradient-to-br ${getColor()} rounded-xl p-6 border-2 border-yellow-600 shadow-lg transform hover:scale-105 transition-all`}
              >
                <h3 className="text-2xl font-bold text-white mb-3 text-center">
                  {house.name}
                </h3>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-yellow-300">
                    ${house.remainingBudget}
                  </div>
                  <div className="text-sm text-gray-200">
                    of ${house.totalBudget}
                  </div>
                </div>
                <div className="w-full bg-black bg-opacity-40 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-yellow-400 h-full rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="text-center mt-2 text-sm text-gray-200">
                  {percentage.toFixed(0)}% remaining
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-black bg-opacity-40 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
        <h2 className="text-3xl font-bold text-yellow-400 mb-6 text-center">
          ⚡ Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105">
            ▶️ Start Next Round
          </button>
          <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105">
            ⏹️ End Current Round
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105">
            📊 View Full Stats
          </button>
        </div>
      </div>
    </div>
  );
}
