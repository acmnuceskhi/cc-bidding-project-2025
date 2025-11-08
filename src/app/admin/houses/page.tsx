/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, react-hooks/rules-of-hooks */
"use client";

import { useState, useEffect } from "react";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { fetchWithAuth } from "@/lib/fetchWithAuth"; // make sure this exists

interface PlayerWithPrice extends Participant {
  purchasePrice?: number;
}

interface Round {
  _id: string;
  participantId: string;
  winningHouseId: string;
  winningBid: number;
}

export default function HousesPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [housePlayers, setHousePlayers] = useState<
    Record<string, PlayerWithPrice[]>
  >({});

    useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch houses
        const housesResponse = await fetchWithAuth("/api/houses", { method: "GET" });
        const housesData: House[] = await housesResponse.json();
        setHouses(housesData);

        // Fetch participants
        const participantsResponse = await fetchWithAuth("/api/participants", { method: "GET" });
        const participantsData: Participant[] = await participantsResponse.json();

        // Fetch rounds
        const roundsResponse = await fetchWithAuth("/api/rounds", { method: "GET" });
        const roundsData: Round[] = await roundsResponse.json();

        // Create a map of participantId -> winning bid
        const participantPriceMap: Record<string, number> = {};
        roundsData.forEach((round) => {
          const pid =
            typeof round.participantId === "object"
              ? round.participantId
              : round.participantId;
          if (pid) {
            participantPriceMap[pid] = round.winningBid ?? 0; // fallback to 0 if undefined
          }
        });

        // Group participants by houseId
        const grouped: Record<string, PlayerWithPrice[]> = {};
        housesData.forEach((house) => {
          const houseId = typeof house._id === "object" ? house._id?.toString?.() : house._id;
          if (houseId) grouped[houseId] = [];
        });

        participantsData.forEach((p) => {
          if (p.houseId) {
            const houseKey = typeof p.houseId === "object" ? p.houseId?.toString?.() : p.houseId;
            if (!houseKey) return;

            if (!grouped[houseKey]) grouped[houseKey] = [];

            const participantId = typeof p._id === "object" ? p._id?.toString?.() : p._id;
            grouped[houseKey].push({
              ...p,
              purchasePrice: participantId ? participantPriceMap[participantId] || 0 : 0,
            });
          }
        });

        setHousePlayers(grouped);
      } catch (err) {
        console.error("Failed to fetch houses, participants, or rounds", err);
      }
    };

    fetchData();
  }, []);

  const getHouseGradient = (index: number) => {
    const gradients = [
      "from-purple-600 to-purple-900",
      "from-blue-600 to-blue-900",
      "from-green-600 to-green-900",
      "from-red-600 to-red-900",
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-yellow-400 mb-2">
          🏯 House Rosters
        </h1>
        <p className="text-gray-300">
          View all houses and their acquired warriors
        </p>
      </div>

      {houses.map((house, index) => {
        const players = housePlayers[house._id?.toString() || ""] || [];
        const totalSpent = house.totalBudget - house.remainingBudget;
        const percentage = (house.remainingBudget / house.totalBudget) * 100;

        return (
          <div
            key={house._id?.toString()}
            className={`bg-gradient-to-br ${getHouseGradient(
              index
            )} rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl`}
          >
            {/* House Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {house.name}
                </h2>
                <p className="text-gray-200">
                  {players.length} warrior{players.length !== 1 ? "s" : ""}{" "}
                  recruited
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-yellow-300">
                  ${house.remainingBudget}
                </div>
                <div className="text-sm text-gray-200">
                  ${totalSpent} spent • {percentage.toFixed(0)}% left
                </div>
                <div className="w-48 bg-black bg-opacity-40 rounded-full h-3 mt-2">
                  <div
                    className="bg-yellow-400 h-full rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Players Grid */}
            {players.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.map((player) => (
                  <div
                    key={player._id?.toString()}
                    className="bg-black bg-opacity-40 rounded-xl p-4 border-2 border-yellow-500 hover:border-yellow-300 transition-all transform hover:scale-105"
                  >
                    <div className="flex items-center gap-4">
                      {player.picture && (
                        <img
                          src={player.picture}
                          alt={player.name}
                          className="w-16 h-16 rounded-full border-2 border-yellow-400"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">
                          {player.name}
                        </h3>
                        {player.purchasePrice && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-2xl font-bold text-yellow-400">
                              ${player.purchasePrice}
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-gray-300 mt-1">
                          Acquired Warrior
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-black bg-opacity-30 rounded-xl border-2 border-dashed border-gray-600">
                <p className="text-xl text-gray-400">
                  No warriors recruited yet
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Start bidding to build your roster!
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
