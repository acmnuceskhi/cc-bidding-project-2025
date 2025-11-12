"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Participant {
  _id: string;
  name: string;
  picture?: string;
  houseId?: string;
}

interface PlayerWithDetails extends Participant {
  participantId: string;
  status: "available" | "sold";
  soldTo?: string;
  soldToHouseName?: string;
  soldPrice?: number;
  roundNumber?: number;
}

interface House {
  houseId?: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
  color?: string;
}

interface HouseWithPlayers extends House {
  players: PlayerWithDetails[];
}

export default function FinalTeamsPage() {
  const [houses, setHouses] = useState<HouseWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [housesRes, participantsRes] = await Promise.all([
          fetchWithAuth("/api/houses", { method: "GET" }),
          fetchWithAuth("/api/participants", { method: "GET" }),
        ]);

        const [housesData, participantsData]: [House[], PlayerWithDetails[]] =
          await Promise.all([housesRes.json(), participantsRes.json()]);

        // Assign participants to their respective houses
        const housesWithPlayers: HouseWithPlayers[] = housesData.map(
          (house) => ({
            ...house,
            players: participantsData.filter(
              (p) => p.houseId && String(p.houseId) === String(house._id)
            ),
          })
        );

        setHouses(housesWithPlayers);
      } catch (error) {
        console.error("Failed to fetch final teams data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col items-center justify-start text-white"
      style={{ backgroundImage: "url('/arena-background.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      <div className="relative z-10 w-full max-w-7xl p-8 text-center">
        <h1 className="text-5xl font-extrabold text-[#FFD700] drop-shadow-[0_0_20px_#FFD700] mb-12">
          ☯︎ Final Teams Line-Up ☯︎
        </h1>

        {loading ? (
          <div className="text-yellow-400 text-lg animate-pulse mt-12">
            Loading teams...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {houses.map((house, index) => (
              <div
                key={house.houseId || `house-${index}`}
                className="relative p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-[#FFD700]/40 shadow-[0_0_25px_rgba(255,215,0,0.3)] transition-transform hover:scale-105"
              >
                <h2
                  className="text-2xl font-bold mb-4 drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]"
                  style={{ color: house.color || "#FFD700" }}
                >
                  House of {house.name}
                </h2>

                {house.players.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-200">
                    {house.players.map((player, pIndex) => (
                      <div
                        key={
                          player.participantId ||
                          `player-${player.name}-${pIndex}`
                        }
                        className="p-2 bg-black/30 rounded-md border border-white/10 hover:bg-black/50 transition-all"
                      >
                        {player.picture ? (
                          <div className="flex items-center space-x-2">
                            <img
                              src={player.picture}
                              alt={player.name}
                              className="w-8 h-8 rounded-full border border-white/40"
                            />
                            <span>{player.name}</span>
                          </div>
                        ) : (
                          <span>{player.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 italic mt-2">
                    No players assigned yet
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <footer className="mt-16 text-gray-400 text-sm">
          Powered by <span className="text-[#FFD700]">CC Bidding System</span>
        </footer>
      </div>
    </div>
  );
}
