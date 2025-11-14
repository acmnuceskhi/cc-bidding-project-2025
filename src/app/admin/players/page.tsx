/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { Participant } from "@/lib/models/participants";
// import { House } from "@/lib/models/houses";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface PlayerWithDetails extends Participant {
  participantId: string;
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

interface House {
  houseId?: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithDetails[]>([]);
  const [sortBy, setSortBy] = useState<
    "round" | "price-asc" | "price-desc" | "name"
  >("round");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "available" | "sold"
  >("all");

  // Function to get house background image
  const getHouseBackground = (houseName?: string) => {
    if (!houseName) return "/temple-out.jpg";

    const houseMap: Record<string, string> = {
      "Lord Shen": "/lord-shen.jpg",
      "Dragon Warrior": "/dragon-warrior.jpg",
      "Master Oogway": "/master-oogway.jpg",
      "Tai Lung": "/tai-lung.jpg",
    };
    return houseMap[houseName] || "/temple-out.jpg";
  };

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
          (participant: PlayerWithDetails) => {
            const round = rounds.find(
              (r: Round) => r.participantId === participant.participantId
            );

            if (round && participant.houseId && round.finalized) {
              const house = houses.find(
                (h: House) =>
                  h.houseId?.toString() === participant.houseId?.toString()
              );
              // const winningBid;
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
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_20px_#FFD700]">
          🥋 All Warriors
        </h1>
        <p className="text-gray-300">Complete roster of participants</p>
      </div>

      {/* Filters and sorting */}
      <div className="bg-black/40 rounded-xl p-6 border-2 border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)] backdrop-blur-md">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            {["all", "available", "sold"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                  filterStatus === status
                    ? status === "sold"
                      ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                      : status === "available"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                        : "bg-gradient-to-r from-[#FFD700] to-[#FFB800] text-black shadow-[0_0_20px_rgba(255,215,0,0.5)]"
                    : "bg-gray-700/80 text-gray-300 hover:bg-gray-600/80"
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
              className="bg-gray-800/90 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.2)]"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedPlayers.map((player, index) => {
          const backgroundImage =
            player.status === "sold" && player.soldToHouseName
              ? getHouseBackground(player.soldToHouseName)
              : "/temple-out.jpg";

          return (
            <div
              key={player._id?.toString() || `player-${index}`}
              className="relative rounded-xl p-6 border-2 shadow-lg transform hover:scale-105 transition-all overflow-hidden"
              style={{
                backgroundImage: `url('${backgroundImage}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Opacity overlay */}
              <div
                className={`absolute inset-0 ${
                  player.status === "available"
                    ? "bg-gray-900/80 backdrop-blur-[2px]"
                    : "bg-black/70 backdrop-blur-[2px]"
                }`}
              ></div>

              {/* Neon border for sold players */}
              {player.status === "sold" && (
                <div className="absolute inset-0 border-2 border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.5)]"></div>
              )}
              {player.status === "available" && (
                <div className="absolute inset-0 border-2 border-gray-500"></div>
              )}

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  {player.picture && (
                    <img
                      src={player.picture}
                      alt={player.name}
                      className="w-20 h-20 rounded-full border-4 border-[#FFD700] shadow-[0_0_25px_rgba(255,215,0,0.5)]"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white drop-shadow-[0_0_10px_#000000]">
                      {player.name}
                    </h3>
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
                      <span className="inline-block bg-blue-600/90 text-white px-4 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                        ✨ Available
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-300 mb-2">Sold to</p>
                      <div className="flex items-center justify-between bg-black/60 rounded-lg p-3 border border-[#FFD700]/30">
                        <div>
                          <p className="font-bold text-[#FFD700] text-lg drop-shadow-[0_0_10px_#FFD700]">
                            {player.soldToHouseName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-400 drop-shadow-[0_0_10px_#22C55E]">
                            ${player.soldPrice}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedPlayers.length === 0 && (
        <div className="text-center py-12 bg-black/40 rounded-xl border-2 border-dashed border-gray-600 backdrop-blur-sm">
          <p className="text-xl text-gray-400">
            No warriors match your filters
          </p>
        </div>
      )}
    </div>
  );
}
