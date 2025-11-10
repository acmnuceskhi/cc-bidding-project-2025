/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { Round } from "@/lib/models/rounds";
import { Bid } from "@/lib/models/bids";
import { fetchWithAuth } from "@/lib/fetchWithAuth"; // ✅ your global helper

interface ParticipantWithDetails extends Participant {
  batch?: string;
  universityId?: string;
}

interface HouseApiResponse {
  houseId: string;
  name: string;
  totalBudget: number;
  remainingBudget: number;
}

interface filteredRound {
  _id: string; // matches MongoDB _id
  roundId: string; // matches MongoDB _id
  participantId: string;
  status: "scheduled" | "active" | "completed"; // matches schema
  timerEnd?: string; // string from API, parse to Date
  scheduledStart?: string; // string from API, parse to Date
  finalized?: boolean;
}

export default function HouseDashboard() {
  const params = useParams();
  const houseId = params.houseId as string;

  const [house, setHouse] = useState<House | null>(null);
  const [activeRound, setActiveRound] = useState<
    (filteredRound & { roundNumber?: number }) | null
  >(null);
  const [currentParticipant, setCurrentParticipant] =
    useState<ParticipantWithDetails | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [hasBid, setHasBid] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ✅ Fetch all houses and find the one matching the URL param
        const housesResponse = await fetchWithAuth("/api/houses");
        const allHouses = await housesResponse.json();
        const selectedHouse = allHouses.find(
          (h: HouseApiResponse) => h.houseId === houseId
        );
        if (!selectedHouse) {
          console.warn("No house found with ID:", houseId);
          setHouse(null);
          return;
        }
        setHouse(selectedHouse);

        // ✅ Fetch active round
        const roundsResponse = await fetchWithAuth("/api/rounds?active=only");
        const active = (await roundsResponse.json())[0] || null;
        setActiveRound(active);

        if (!active) {
          setCurrentParticipant(null);
          setTimeLeft(0);
          setHasBid(false);
          return;
        }

        // ✅ Fetch participant for active round
        const participantResponse = await fetchWithAuth(`/api/participants`);
        const participants = await participantResponse.json();
        const matchedParticipant = participants.find(
          (p: any) => p.participantId === active.participantId
        );
        setCurrentParticipant(matchedParticipant || null);

        // ✅ Update time remaining from server time
        setTimeLeft(
          Math.max(0, new Date(active.timerEnd).getTime() - Date.now())
        );

        // ✅ No longer checking for existing bids - allow multiple bids
        setHasBid(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setHouse(null);
        setActiveRound(null);
        setCurrentParticipant(null);
        setTimeLeft(0);
        setHasBid(false);
      }
    };

    // ✅ Fetch once when the component mounts
    fetchData();

    // Poll every 2 seconds for real-time sync
    const pollInterval = setInterval(() => {
      fetchData();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [houseId]);

  const placeBid = async () => {
    if (!activeRound || !currentParticipant || !house || bidAmount <= 0) return;
    setLoading(true);

    try {
      const response = await fetchWithAuth("/api/bids", {
        method: "POST",
        body: JSON.stringify({
          roundId: activeRound.roundId,
          amount: bidAmount,
        }),
      });

      const data = await response.json();

      // Check if the request was successful
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to place bid");
      }

      // Update house budget with the actual remaining budget from server
      if (typeof data.remainingBudget === "number") {
        setHouse((prev) =>
          prev ? { ...prev, remainingBudget: data.remainingBudget } : prev
        );
      } else {
        console.error("Invalid remainingBudget in response:", data);
        // Fallback: refetch house data
        const housesResponse = await fetchWithAuth("/api/houses");
        const allHouses = await housesResponse.json();
        const updatedHouse = allHouses.find(
          (h: HouseApiResponse) => h.houseId === houseId
        );
        if (updatedHouse) {
          setHouse(updatedHouse);
        }
      }

      setBidAmount(0);

      if (data.previousAmount && data.previousAmount > 0) {
        alert(
          `✅ Bid updated from $${data.previousAmount} to $${data.newAmount}!`
        );
      } else {
        alert("✅ Bid placed successfully! You can update it anytime.");
      }
    } catch (error: any) {
      console.error(error);
      alert(`⚠️ ${error.message || "Failed to place bid."}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number) => `${Math.ceil(ms / 1000)}s`;

  if (!house) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center">
        <div className="text-xl text-white">House not found.</div>
      </div>
    );
  }

  const timeLeftValue = Math.max(0, timeLeft);
  const isTimeRunningOut = timeLeftValue < 10000;
  const budgetPercentage = (house.remainingBudget / house.totalBudget) * 100;

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{
        backgroundImage: "url('/arena-background.jpg')",
      }}
    >
      {/* Dark overlay for text visibility */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with House Info and Logout */}
          <div className="bg-gradient-to-r from-red-800 to-orange-800 rounded-2xl p-8 mb-8 border-4 border-yellow-600 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-5xl font-bold text-yellow-400 drop-shadow-lg mb-2">
                  🏯 {house.name}
                </h1>
                <p className="text-xl text-gray-200">Command Center</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const data = await fetchWithAuth("/api/auth/logout", {
                      method: "POST",
                    });
                    console.log("Logout response:", data);

                    // Clear client-side storage
                    localStorage.removeItem("token");
                    localStorage.removeItem("role");
                    localStorage.removeItem("houseId");

                    // Redirect to login
                    window.location.href = "/login";
                  } catch (err) {
                    console.error("Logout failed:", err);
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
              >
                Logout
              </button>
            </div>

            {/* Budget Display */}
            <div className="bg-black bg-opacity-40 rounded-xl p-6 border-2 border-yellow-500">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-300 text-lg mb-1">Treasury Balance</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold text-yellow-300">
                      ${house.remainingBudget}
                    </span>
                    <span className="text-xl text-gray-400">
                      / ${house.totalBudget}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-yellow-400">
                    {budgetPercentage.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-400">Remaining</div>
                </div>
              </div>
              <div className="w-full bg-black bg-opacity-60 rounded-full h-4 border-2 border-yellow-600">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetPercentage > 50
                      ? "bg-green-500"
                      : budgetPercentage > 25
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${budgetPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {activeRound && currentParticipant ? (
            <div className="space-y-8">
              {/* Round Info and Timer */}
              <div className="bg-gradient-to-br from-yellow-600 to-orange-700 rounded-2xl p-8 border-4 border-yellow-400 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-4xl font-bold text-black drop-shadow-lg">
                    ⚔️ ROUND {activeRound.roundNumber || "?"}
                  </h2>
                  <div className="text-center">
                    <div
                      className={`text-6xl font-bold ${isTimeRunningOut ? "text-red-600 animate-pulse" : "text-black"}`}
                    >
                      {formatTime(timeLeftValue)}
                    </div>
                    <div className="text-sm text-black font-semibold mt-1">
                      Time Left
                    </div>
                  </div>
                </div>

                {/* Timer Progress Bar */}
                <div className="w-full bg-black bg-opacity-40 rounded-full h-4 border-2 border-black">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      isTimeRunningOut ? "bg-red-500" : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.max(0, (timeLeftValue / 60000) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Player Info */}
              <div className="bg-black bg-opacity-80 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
                <h2 className="text-3xl font-bold text-yellow-400 mb-6 text-center drop-shadow-lg">
                  🥋 WARRIOR UP FOR BIDDING
                </h2>
                <div className="flex items-center gap-8">
                  {/* Player Picture */}
                  <div className="relative">
                    {currentParticipant.picture ? (
                      <img
                        src={currentParticipant.picture}
                        alt={currentParticipant.name}
                        className="w-48 h-48 object-cover rounded-full border-8 border-yellow-400 shadow-2xl"
                      />
                    ) : (
                      <div className="w-48 h-48 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full border-8 border-yellow-400 shadow-2xl flex items-center justify-center">
                        <span className="text-6xl">👤</span>
                      </div>
                    )}
                    {currentParticipant.batch && (
                      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-black px-6 py-2 rounded-full border-4 border-yellow-400">
                        <span className="text-yellow-400 font-bold text-lg">
                          {currentParticipant.batch}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Player Details */}
                  <div className="flex-1 space-y-3">
                    <h3 className="text-4xl font-bold text-white drop-shadow-lg">
                      {currentParticipant.name}
                    </h3>
                    {currentParticipant.universityId && (
                      <div className="flex items-center gap-3">
                        <span className="bg-yellow-600 text-black px-4 py-2 rounded-lg font-bold text-xl border-2 border-yellow-400">
                          🎓 {currentParticipant.universityId}
                        </span>
                      </div>
                    )}
                    {currentParticipant.batch && (
                      <div className="text-xl text-gray-300">
                        📚 Year:{" "}
                        <span className="text-yellow-400 font-semibold">
                          {currentParticipant.batch}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bidding Section */}
              <div className="bg-black bg-opacity-80 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
                {timeLeftValue > 0 ? (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-bold text-yellow-400 text-center">
                      💰 PLACE YOUR BID
                    </h2>
                    <div className="flex gap-4">
                      <input
                        type="number"
                        id="bidAmount"
                        min="1"
                        max={house.remainingBudget}
                        value={bidAmount || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Only set if it's a valid number or empty string
                          setBidAmount(val === "" ? 0 : parseInt(val, 10));
                        }}
                        className="flex-1 bg-gray-800 border-4 border-yellow-600 rounded-xl px-6 py-4 text-white text-2xl font-bold focus:outline-none focus:ring-4 focus:ring-yellow-500"
                        placeholder="Enter bid amount"
                      />
                      <button
                        onClick={placeBid}
                        disabled={
                          loading ||
                          bidAmount <= 0 ||
                          bidAmount > house.remainingBudget
                        }
                        className={`px-8 py-4 rounded-xl text-2xl font-bold transition-all transform ${
                          loading ||
                          bidAmount <= 0 ||
                          bidAmount > house.remainingBudget
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700 text-white hover:scale-105 shadow-lg"
                        }`}
                      >
                        {loading ? "⏳ Placing..." : "✅ Place Bid"}
                      </button>
                    </div>
                    {bidAmount > house.remainingBudget && (
                      <div className="bg-red-900 border-2 border-red-500 rounded-lg p-4 text-center">
                        <p className="text-red-300 font-bold text-lg">
                          ⚠️ Bid amount exceeds your remaining treasury!
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-900 border-4 border-red-500 rounded-xl p-6 text-center">
                    <p className="text-red-300 font-bold text-2xl">
                      ⏰ Time&apos;s Up! Bidding has ended for this round
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-black bg-opacity-80 rounded-2xl p-12 border-4 border-yellow-600 shadow-2xl">
              <div className="text-center">
                <h2 className="text-4xl font-bold text-yellow-400 mb-4">
                  ⏸️ No Active Round
                </h2>
                <p className="text-xl text-gray-300">
                  Waiting for the next battle to begin...
                </p>
                <p className="text-gray-400 mt-4">
                  The admin will start the next round soon
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
