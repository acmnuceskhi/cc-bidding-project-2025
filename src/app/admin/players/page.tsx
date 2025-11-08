/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { Participant } from "@/lib/models/participants";
import { House } from "@/lib/models/houses";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface PlayerWithDetails extends Participant {
  status: "available" | "sold";
  soldTo?: string;
  soldToHouseName?: string;
  soldPrice?: number;
  roundNumber?: number;
}

interface Round {
  _id: string;
  participantId: string;
  winningHouseId?: string;
  winningBid?: number;
  roundNumber: number;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithDetails[]>([]);
  const [sortBy, setSortBy] = useState<
    "round" | "price-asc" | "price-desc" | "name"
  >("round");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "available" | "sold"
  >("all");

  useEffect(() => {
    async function fetchData() {
      try {
        // --- Fetch all data in parallel ---
        const [participantsRes, roundsRes, housesRes] = await Promise.all([
          fetchWithAuth("/api/participants", { method: "GET" }),
          fetchWithAuth("/api/rounds", { method: "GET" }),
          fetchWithAuth("/api/houses", { method: "GET" }),
        ]);

        const [participants, rounds, houses] = await Promise.all([
          participantsRes.json(),
          roundsRes.json(),
          housesRes.json(),
        ]);

        // --- Build player data ---
        const playersData: PlayerWithDetails[] = participants.map(
          (participant: Participant) => {
            const round = rounds.find(
              (r: Round) => r.participantId === participant._id?.toString()
            );

            if (round && round.winningHouseId && round.winningBid) {
              const house = houses.find(
                (h: House) => h._id.toString() === round.winningHouseId
              );
              return {
                ...participant,
                status: "sold",
                soldTo: round.winningHouseId,
                soldToHouseName: house ? house.name : "Unknown",
                soldPrice: round.winningBid,
                roundNumber: round.roundNumber,
              };
            } else {
              return {
                ...participant,
                status: "available",
              };
            }
          }
        );

        setPlayers(playersData);
      } catch (error) {
        console.error("Failed to fetch players data:", error);
      }
    }

    fetchData();
  }, []);

  // --- Sorting + Filtering logic ---
  const getSortedPlayers = () => {
    const filtered = players.filter((p) => {
      if (filterStatus === "all") return true;
      return p.status === filterStatus;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "round":
          return (a.roundNumber || 999) - (b.roundNumber || 999);
        case "price-asc":
          return (a.soldPrice || 0) - (b.soldPrice || 0);
        case "price-desc":
          return (b.soldPrice || 0) - (a.soldPrice || 0);
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  };

  const sortedPlayers = getSortedPlayers();
  const availableCount = players.filter((p) => p.status === "available").length;
  const soldCount = players.filter((p) => p.status === "sold").length;

  // --- UI remains identical ---
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-yellow-400 mb-2">🥋 All Warriors</h1>
        <p className="text-gray-300">
          {availableCount} available • {soldCount} recruited
        </p>
      </div>

      {/* Filters and sorting */}
      <div className="bg-black bg-opacity-40 rounded-xl p-6 border-2 border-yellow-600 shadow-lg">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            {["all", "available", "sold"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  filterStatus === status
                    ? status === "sold"
                      ? "bg-red-600 text-white"
                      : status === "available"
                      ? "bg-green-600 text-white"
                      : "bg-yellow-600 text-black"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {status === "all"
                  ? `All (${players.length})`
                  : status === "available"
                  ? `Available (${availableCount})`
                  : `Recruited (${soldCount})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-300 font-semibold">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-800 text-white border-2 border-yellow-600 rounded-lg px-4 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="round">Round Number</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPlayers.map((player) => (
          <div
            key={player._id?.toString()}
            className={`rounded-xl p-6 border-4 shadow-lg transform hover:scale-105 transition-all ${
              player.status === "available"
                ? "bg-gradient-to-br from-gray-700 to-gray-900 border-gray-500"
                : "bg-gradient-to-br from-green-700 to-green-900 border-green-500"
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              {player.picture && (
                <img
                  src={player.picture}
                  alt={player.name}
                  className="w-20 h-20 rounded-full border-4 border-yellow-400 shadow-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{player.name}</h3>
                {player.roundNumber && (
                  <p className="text-sm text-gray-300">
                    Round {player.roundNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t-2 border-gray-600">
              {player.status === "available" ? (
                <div className="text-center">
                  <span className="inline-block bg-blue-600 text-white px-4 py-2 rounded-full font-bold">
                    ✨ Available
                  </span>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-300 mb-2">Sold to</p>
                  <div className="flex items-center justify-between bg-black bg-opacity-40 rounded-lg p-3">
                    <div>
                      <p className="font-bold text-yellow-400 text-lg">
                        {player.soldToHouseName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-400">
                        ${player.soldPrice}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {sortedPlayers.length === 0 && (
        <div className="text-center py-12 bg-black bg-opacity-40 rounded-xl border-2 border-dashed border-gray-600">
          <p className="text-xl text-gray-400">
            No warriors match your filters
          </p>
        </div>
      )}
    </div>
  );
}
