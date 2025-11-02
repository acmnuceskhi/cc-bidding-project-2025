"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { Round } from "@/lib/models/rounds";
import { Bid } from "@/lib/models/bids";

export default function HouseDashboard() {
  const params = useParams();
  const houseId = params.houseId as string;

  const [house, setHouse] = useState<House | null>(null);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
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
      const mockHouse: House = { _id: houseId as any, name: `House ${houseId}`, totalBudget: 1000, remainingBudget: 800 };
      setHouse(mockHouse);
      const now = Date.now();
      const mockRound: any = {
        _id: "r1" as any,
        participantId: "p1" as any,
        bids: [],
        status: "active" as const,
        timerEnd: new Date(now + 45000),
        scheduledStart: new Date(now - 5000),
      };
      setActiveRound(mockRound);
      setCurrentParticipant({ _id: "p1" as any, name: "Player One", picture: "", roundStats: [] });
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Checking Authentication</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  if (!house) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">
          House not found. Please check the URL or connect to database.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{house.name} Dashboard</h1>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("role");
                localStorage.removeItem("houseId");
                window.location.href = "/login";
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg text-gray-600">
                Remaining Budget: <span className="font-semibold text-green-600">${house.remainingBudget}</span>
              </p>
              <p className="text-sm text-gray-500">
                Total Budget: ${house.totalBudget}
              </p>
            </div>
            <div className="w-48">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full"
                  style={{
                    width: `${(house.remainingBudget / house.totalBudget) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {activeRound && currentParticipant ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Current Bidding Round</h2>
              <div className={`text-xl font-bold ${timeLeft < 10000 ? "text-red-600" : "text-green-600"}`}>
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div
                  className={`h-4 rounded-full transition-all duration-1000 ${
                    timeLeft < 10000 ? "bg-red-600" : "bg-green-600"
                  }`}
                  style={{
                    width: `${Math.max(0, (timeLeft / 60000) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-2">Current Participant</h3>
              <p className="text-lg">{currentParticipant.name}</p>
              {currentParticipant.picture && (
                <img
                  src={currentParticipant.picture}
                  alt={currentParticipant.name}
                  className="w-32 h-32 object-cover rounded-lg mt-4"
                />
              )}
            </div>

            {timeLeft > 0 && !hasBid ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="bidAmount" className="block text-sm font-medium text-gray-700 mb-2">
                    Place Your Bid
                  </label>
                  <div className="flex gap-4">
                    <input
                      type="number"
                      id="bidAmount"
                      min="1"
                      max={house.remainingBudget}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value))}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter bid amount"
                    />
                    <button
                      onClick={placeBid}
                      disabled={loading || bidAmount <= 0 || bidAmount > house.remainingBudget}
                      className={`px-6 py-2 rounded-md text-white font-medium ${
                        loading || bidAmount <= 0 || bidAmount > house.remainingBudget
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {loading ? "Placing..." : "Place Bid"}
                    </button>
                  </div>
                  {bidAmount > house.remainingBudget && (
                    <p className="text-red-600 text-sm mt-1">
                      Bid amount exceeds remaining budget
                    </p>
                  )}
                </div>
              </div>
            ) : hasBid ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  ✓ You have already placed a bid for this participant
                </p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">
                  ⏰ Time's up! Bidding has ended for this round
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold text-gray-600 mb-2">No Active Round</h2>
              <p className="text-gray-500">Waiting for admin to start the next bidding round...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}