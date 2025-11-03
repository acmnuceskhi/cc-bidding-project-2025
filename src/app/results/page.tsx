"use client";

import { useEffect, useState } from "react";

interface Player {
  id: string;
  name: string;
  picture?: string;
}

interface House {
  id: string;
  name: string;
  color: string;
  players: Player[];
}

export default function FinalTeamsPage() {
  const [houses, setHouses] = useState<House[]>([]);

  useEffect(() => {
    setHouses([
      {
        id: "h1",
        name: "Dragon Warriors",
        color: "#00FFFF",
        players: [
          { id: "p1", name: "Po" },
          { id: "p2", name: "Shifu" },
          { id: "p3", name: "Tigress" },
          { id: "p4", name: "Crane" },
        ],
      },
      {
        id: "h2",
        name: "House of Tai Lung",
        color: "#FF1493",
        players: Array.from({ length: 4 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Player ${i + 1}`,
        })),
      },
      {
        id: "h3",
        name: "House of Lord Shen",
        color: "#FFD700",
        players: Array.from({ length: 4 }, (_, i) => ({
          id: `p${i + 5}`,
          name: `Player ${i + 4}`,
        })),
      },
      {
        id: "h4",
        name: "House of Oogway",
        color: "#00FF7F",
        players: Array.from({ length: 4 }, (_, i) => ({
          id: `p${i + 9}`,
          name: `Player ${i + 9}`,
        })),
      },
    ]);
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {houses.map((house) => (
            <div
              key={house.id}
              className="relative p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-[#FFD700]/40 shadow-[0_0_25px_rgba(255,215,0,0.3)] transition-transform hover:scale-105"
            >
              <h2
                className="text-2xl font-bold mb-4 drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]"
                style={{ color: house.color }}
              >
                {house.name}
              </h2>

              <div className="grid grid-cols-1 gap-2 text-sm text-gray-200">
                {house.players.map((player) => (
                  <div
                    key={player.id}
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
            </div>
          ))}
        </div>

        <footer className="mt-16 text-gray-400 text-sm">
          Powered by <span className="text-[#FFD700]">CC Bidding System</span>
        </footer>
      </div>
    </div>
  );
}
