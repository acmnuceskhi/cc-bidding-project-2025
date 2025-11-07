/* eslint-disable @typescript-eslint/no-unused-vars, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { Round } from "@/lib/models/rounds";

interface RoundWithDetails {
  _id: string;
  roundNumber: number;
  participantName: string;
  participantPicture?: string;
  status: "not_started" | "active" | "completed";
  winnerHouse?: string;
  winningBid?: number;
  timerEnd?: Date;
}

export default function RoundsPage() {
  const [rounds, setRounds] = useState<RoundWithDetails[]>([]);

  useEffect(() => {
    // Mock rounds data
    const mockRounds: RoundWithDetails[] = [
      {
        _id: "r1",
        roundNumber: 1,
        participantName: "Master Shifu",
        participantPicture:
          "https://api.dicebear.com/7.x/initials/svg?seed=Shifu",
        status: "completed",
        winnerHouse: "Lord Shen",
        winningBid: 150,
      },
      {
        _id: "r2",
        roundNumber: 2,
        participantName: "Po the Dragon Warrior",
        participantPicture: "https://api.dicebear.com/7.x/initials/svg?seed=Po",
        status: "completed",
        winnerHouse: "Dragon Warrior",
        winningBid: 250,
      },
      {
        _id: "r3",
        roundNumber: 3,
        participantName: "Tigress",
        participantPicture:
          "https://api.dicebear.com/7.x/initials/svg?seed=Tigress",
        status: "active",
        timerEnd: new Date(Date.now() + 35000),
      },
      {
        _id: "r4",
        roundNumber: 4,
        participantName: "Mantis",
        participantPicture:
          "https://api.dicebear.com/7.x/initials/svg?seed=Mantis",
        status: "not_started",
      },
      {
        _id: "r5",
        roundNumber: 5,
        participantName: "Crane",
        participantPicture:
          "https://api.dicebear.com/7.x/initials/svg?seed=Crane",
        status: "not_started",
      },
    ];
    setRounds(mockRounds);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-600 text-white";
      case "active":
        return "bg-yellow-600 text-black animate-pulse";
      case "not_started":
        return "bg-gray-600 text-gray-300";
      default:
        return "bg-gray-600 text-gray-300";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "✅ Completed";
      case "active":
        return "⚡ Active Now";
      case "not_started":
        return "⏳ Not Started";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-yellow-400 mb-2">
          ⏱️ Bidding Rounds
        </h1>
        <p className="text-gray-300">Complete history of all auction rounds</p>
      </div>

      {/* Rounds List */}
      <div className="space-y-4">
        {rounds.map((round) => (
          <div
            key={round._id}
            className={`rounded-xl p-6 border-4 shadow-lg transition-all ${
              round.status === "active"
                ? "bg-gradient-to-r from-yellow-700 to-orange-700 border-yellow-400 animate-pulse"
                : round.status === "completed"
                  ? "bg-gradient-to-r from-green-700 to-green-900 border-green-500"
                  : "bg-gradient-to-r from-gray-700 to-gray-900 border-gray-500"
            }`}
          >
            <div className="flex items-center justify-between">
              {/* Round Info */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-5xl font-bold text-yellow-400 mb-1">
                    {round.roundNumber}
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getStatusBadge(
                      round.status
                    )}`}
                  >
                    {getStatusText(round.status)}
                  </span>
                </div>

                {round.participantPicture && (
                  <img
                    src={round.participantPicture}
                    alt={round.participantName}
                    className="w-20 h-20 rounded-full border-4 border-yellow-400 shadow-lg"
                  />
                )}

                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {round.participantName}
                  </h3>
                  {round.status === "completed" && round.winnerHouse && (
                    <p className="text-lg text-gray-200">
                      Sold to{" "}
                      <span className="text-yellow-400 font-bold">
                        {round.winnerHouse}
                      </span>{" "}
                      for{" "}
                      <span className="text-green-400 font-bold text-2xl">
                        ${round.winningBid}
                      </span>
                    </p>
                  )}
                  {round.status === "active" && (
                    <p className="text-yellow-300 font-semibold animate-pulse">
                      Bidding in progress...
                    </p>
                  )}
                  {round.status === "not_started" && (
                    <p className="text-gray-400">Awaiting start</p>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div>
                {round.status === "completed" && (
                  <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all">
                    📊 View Details
                  </button>
                )}
                {round.status === "active" && (
                  <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-all">
                    ⏹️ End Round
                  </button>
                )}
                {round.status === "not_started" && (
                  <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all">
                    ▶️ Start Round
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
