/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { Round } from "@/lib/models/rounds";
import { Bid } from "@/lib/models/bids";

interface ParticipantWithDetails extends Participant {
  batch?: string;
  universityId?: string;
}

export default function HouseDashboard() {
  const params = useParams();
  const houseId = params.houseId as string;

  const [house, setHouse] = useState<House | null>(null);
  const [activeRound, setActiveRound] = useState<(Round & { roundNumber?: number }) | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<ParticipantWithDetails | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [hasBid, setHasBid] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && houseId) {
      // checkAuthentication(); // disabled for UI testing
      // Mock data for house dashboard
      const mockHouse: House = { 
        _id: houseId as any, 
        name: "Lord Shen's Army", 
        totalBudget: 1000, 
        remainingBudget: 750 
      };
      setHouse(mockHouse);
      const now = Date.now();
      const mockRound: any = {
        _id: "r1" as any,
        roundNumber: 15,
        participantId: "p1" as any,
        bids: [],
        status: "active" as const,
        timerEnd: new Date(now + 45000),
        scheduledStart: new Date(now - 5000),
      };
      setActiveRound(mockRound);
      setCurrentParticipant({ 
        _id: "p1" as any, 
        name: "Master Shifu", 
        picture: "https://api.dicebear.com/7.x/initials/svg?seed=Shifu", 
        batch: "Senior",
        universityId: "22K-3456",
        roundStats: [] 
      });
      setTimeLeft(45000);
      setHasBid(false);
      setIsAuthenticated(true);
      const interval = setInterval(() => {
        setTimeLeft((t) => Math.max(0, t - 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [houseId, mounted]);

  const checkAuthentication = async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const userHouseId = localStorage.getItem("houseId");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    // Verify token and check house access
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Check if user can access this house
        if (userData.role === "admin" || userData.houseId === houseId) {
          setIsAuthenticated(true);
          fetchData();
          const interval = setInterval(fetchData, 1000); // Refresh every second
          return () => clearInterval(interval);
        } else {
          alert("Access denied. You don't have permission to access this house.");
          window.location.href = "/login";
        }
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("houseId");
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      window.location.href = "/login";
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const authHeaders = {
        "Authorization": `Bearer ${token}`
      };

      // Fetch house data
      const houseRes = await fetch("/api/houses", { headers: authHeaders });
      if (houseRes.ok) {
        const housesData = await houseRes.json();
        const currentHouse = Array.isArray(housesData) 
          ? housesData.find((h: House) => h._id?.toString() === houseId)
          : null;
        setHouse(currentHouse || null);
      }

      // Fetch active round
      const roundsRes = await fetch("/api/rounds?active=true", { headers: authHeaders });
      if (roundsRes.ok) {
        const roundsData = await roundsRes.json();
        const activeRoundData = Array.isArray(roundsData) && roundsData.length > 0 ? roundsData[0] : null;
        setActiveRound(activeRoundData);

        if (activeRoundData) {
          // Fetch current participant
          const participantsRes = await fetch("/api/participants", { headers: authHeaders });
          if (participantsRes.ok) {
            const participantsData = await participantsRes.json();
            const participant = Array.isArray(participantsData)
              ? participantsData.find((p: Participant) => p._id?.toString() === activeRoundData.participantId?.toString())
              : null;
            setCurrentParticipant(participant || null);
          }

          // Calculate time left
          const endTime = new Date(activeRoundData.timerEnd).getTime();
          const now = Date.now();
          setTimeLeft(Math.max(0, endTime - now));

          // Check if house has already placed a bid
          const token = localStorage.getItem("token");
          const bidsRes = await fetch(`/api/bids?participantID=${activeRoundData.participantId}`, {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          if (bidsRes.ok) {
            const bidsData = await bidsRes.json();
            const houseBid = Array.isArray(bidsData)
              ? bidsData.find((bid: Bid) => bid.houseId.toString() === houseId)
              : null;
            setHasBid(!!houseBid);
          }
        } else {
          setCurrentParticipant(null);
          setTimeLeft(0);
          setHasBid(false);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setHouse(null);
      setActiveRound(null);
      setCurrentParticipant(null);
      setTimeLeft(0);
      setHasBid(false);
    }
  };

  const placeBid = async () => {
    if (!activeRound || !currentParticipant || bidAmount <= 0 || !house) return;
    // UI-only bid: update local state and flag hasBid
    setLoading(true);
    setTimeout(() => {
      setHouse({ ...house, remainingBudget: house.remainingBudget - bidAmount });
      setBidAmount(0);
      setHasBid(true);
      setLoading(false);
      alert("Bid placed (mock)");
    }, 300);
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${seconds}s`;
  };

  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-white mb-2">Checking Authentication</h2>
          <p className="text-gray-300">Please wait...</p>
        </div>
      </div>
    );
  }

  if (!house) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center">
        <div className="text-xl text-white">
          House not found. Please check the URL or connect to database.
        </div>
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
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("role");
                  localStorage.removeItem("houseId");
                  window.location.href = "/login";
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all transform hover:scale-105"
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
                    budgetPercentage > 50 ? "bg-green-500" : budgetPercentage > 25 ? "bg-yellow-500" : "bg-red-500"
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
                    <div className={`text-6xl font-bold ${isTimeRunningOut ? "text-red-600 animate-pulse" : "text-black"}`}>
                      {formatTime(timeLeftValue)}
                    </div>
                    <div className="text-sm text-black font-semibold mt-1">Time Left</div>
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
                        <span className="text-yellow-400 font-bold text-lg">{currentParticipant.batch}</span>
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
                        📚 Year: <span className="text-yellow-400 font-semibold">{currentParticipant.batch}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bidding Section */}
              <div className="bg-black bg-opacity-80 rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
                {timeLeftValue > 0 && !hasBid ? (
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
                        value={bidAmount}
                        onChange={(e) => setBidAmount(Number(e.target.value))}
                        className="flex-1 bg-gray-800 border-4 border-yellow-600 rounded-xl px-6 py-4 text-white text-2xl font-bold focus:outline-none focus:ring-4 focus:ring-yellow-500"
                        placeholder="Enter bid amount"
                      />
                      <button
                        onClick={placeBid}
                        disabled={loading || bidAmount <= 0 || bidAmount > house.remainingBudget}
                        className={`px-8 py-4 rounded-xl text-2xl font-bold transition-all transform ${
                          loading || bidAmount <= 0 || bidAmount > house.remainingBudget
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
                ) : hasBid ? (
                  <div className="bg-green-900 border-4 border-green-500 rounded-xl p-6 text-center">
                    <p className="text-green-300 font-bold text-2xl">
                      ✅ Your bid has been placed for this warrior!
                    </p>
                    <p className="text-green-400 mt-2">Wait for the round to complete</p>
                  </div>
                ) : (
                  <div className="bg-red-900 border-4 border-red-500 rounded-xl p-6 text-center">
                    <p className="text-red-300 font-bold text-2xl">
                      ⏰ Time's Up! Bidding has ended for this round
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-black bg-opacity-80 rounded-2xl p-12 border-4 border-yellow-600 shadow-2xl">
              <div className="text-center">
                <h2 className="text-4xl font-bold text-yellow-400 mb-4">⏸️ No Active Round</h2>
                <p className="text-xl text-gray-300">Waiting for the next battle to begin...</p>
                <p className="text-gray-400 mt-4">The admin will start the next round soon</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}