"use client";

import { useState, useEffect } from "react";
import { House } from "@/lib/models/houses";
import { Participant } from "@/lib/models/participants";
import { Round } from "@/lib/models/rounds";

export default function AdminDashboard() {
  const [houses, setHouses] = useState<House[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      // checkAuthentication(); // disabled for UI testing
      // Mock admin data for UI rendering without backend/auth
      const mockHouses: House[] = [
        { _id: "h1" as any, name: "Alpha", totalBudget: 1000, remainingBudget: 900 },
        { _id: "h2" as any, name: "Bravo", totalBudget: 1000, remainingBudget: 750 },
        { _id: "h3" as any, name: "Charlie", totalBudget: 1000, remainingBudget: 620 },
      ];
      const mockParticipants: Participant[] = [
        { _id: "p1" as any, name: "Player One", picture: "", roundStats: [], assignedHouse: undefined as any },
        { _id: "p2" as any, name: "Player Two", picture: "", roundStats: [], assignedHouse: undefined as any },
        { _id: "p3" as any, name: "Player Three", picture: "", roundStats: [], assignedHouse: undefined as any },
      ];
      const now = Date.now();
      const mockRounds: Round[] = [
        {
          _id: "r1" as any,
          participantId: "p1" as any,
          bids: [],
          status: "active",
          timerEnd: new Date(now + 45000),
          scheduledStart: new Date(now - 5000),
        },
      ];
      setHouses(mockHouses);
      setParticipants(mockParticipants);
      setRounds(mockRounds);
      setActiveRound(mockRounds[0]);
      setIsAuthenticated(true);
      const interval = setInterval(() => {
        // simple countdown effect to update timer visually
        setActiveRound((prev) => (prev ? { ...prev, timerEnd: new Date(prev.timerEnd) } : prev));
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [mounted]);

  const checkAuthentication = async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token) {
      // Redirect to login
      window.location.href = "/login";
      return;
    }

    // Verify token with server
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        if (userData.role !== "admin") {
          alert("Access denied. Admin privileges required.");
          window.location.href = "/login";
          return;
        }
        setIsAuthenticated(true);
        setUserRole(userData.role);
        fetchData();
        const interval = setInterval(fetchData, 2000); // Refresh every 2 seconds
        return () => clearInterval(interval);
      } else {
        // Token invalid, redirect to login
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

  // const fetchData = async () => {
  //   try {
  //     const token = localStorage.getItem("token");
  //     const authHeaders = {
  //       "Authorization": `Bearer ${token}`
  //     };
  //
  //     const [housesRes, participantsRes, roundsRes] = await Promise.all([
  //       fetch("/api/houses", { headers: authHeaders }),
  //       fetch("/api/participants", { headers: authHeaders }),
  //       fetch("/api/rounds?active=true", { headers: authHeaders })
  //     ]);
  //
  //     const housesData = housesRes.ok ? await housesRes.json() : [];
  //     const participantsData = participantsRes.ok ? await participantsRes.json() : [];
  //     const roundsData = roundsRes.ok ? await roundsRes.json() : [];
  //
  //     setHouses(Array.isArray(housesData) ? housesData : []);
  //     setParticipants(Array.isArray(participantsData) ? participantsData : []);
  //     setRounds(Array.isArray(roundsData) ? roundsData : []);
  //     setActiveRound(Array.isArray(roundsData) && roundsData.length > 0 ? roundsData[0] : null);
  //     
  //     console.log("Fetched data:", {
  //       houses: housesData?.length || 0,
  //       participants: participantsData?.length || 0,
  //       rounds: roundsData?.length || 0
  //     });
  //   } catch (error) {
  //     console.error("Error fetching data:", error);
  //     setHouses([]);
  //     setParticipants([]);
  //     setRounds([]);
  //     setActiveRound(null);
  //   }
  // };
  // Mock no-op for UI testing
  const fetchData = () => {};

  const startRound = async () => {
    if (!selectedParticipant) {
      alert("Please select a participant");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/rounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          participantId: selectedParticipant,
        }),
      });

      if (response.ok) {
        fetchData();
        setSelectedParticipant("");
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error starting round:", error);
      alert("Error starting round");
    } finally {
      setLoading(false);
    }
  };

  const endRound = async () => {
    if (!activeRound || !activeRound._id) {
      alert("No active round found");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      console.log("Ending round with ID:", activeRound._id);
      const response = await fetch(`/api/rounds/${activeRound._id}/end`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchData();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error ending round:", error);
      alert("Error ending round");
    } finally {
      setLoading(false);
    }
  };

  // Filter participants that are not assigned to any house and don't have an active round
  const availableParticipants = participants.filter(p => !p.assignedHouse);

  console.log("Available participants:", {
    total: participants.length,
    available: availableParticipants.length,
    assigned: participants.filter(p => p.assignedHouse).length,
    sampleParticipant: participants[0]
  });

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

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
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

        {/* Active Round Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Round</h2>
          {activeRound ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg">
                    Participant: {participants.find(p => p._id?.toString() === activeRound.participantId?.toString())?.name || "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Ends at: {new Date(activeRound.timerEnd).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={endRound}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  End Round
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">No active round</p>
              <div className="flex gap-4">
                <select
                  value={selectedParticipant}
                  onChange={(e) => setSelectedParticipant(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 flex-1"
                >
                  <option value="">Select a participant</option>
                  {availableParticipants.map((participant) => (
                    <option key={participant._id?.toString()} value={participant._id?.toString()}>
                      {participant.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={startRound}
                  disabled={loading || !selectedParticipant}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Start Round
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Houses Overview */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Houses Budget Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {houses.map((house) => (
              <div key={house._id?.toString()} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg">{house.name}</h3>
                <p className="text-sm text-gray-600">
                  Budget: ${house.remainingBudget} / ${house.totalBudget}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${(house.remainingBudget / house.totalBudget) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Participants Status */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Participants Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participants.map((participant) => (
              <div
                key={participant._id?.toString()}
                className={`border rounded-lg p-4 ${
                  participant.assignedHouse ? "bg-green-50 border-green-200" : "bg-gray-50"
                }`}
              >
                <h3 className="font-semibold">{participant.name}</h3>
                <p className="text-sm text-gray-600">
                  Status: {participant.assignedHouse ? "Assigned" : "Available"}
                </p>
                {participant.assignedHouse && (
                  <p className="text-sm text-green-600">
                    House: {houses.find(h => h._id?.toString() === participant.assignedHouse?.toString())?.name || "Unknown"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}