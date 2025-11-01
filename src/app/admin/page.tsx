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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchData();
      const interval = setInterval(fetchData, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [mounted]);

  const fetchData = async () => {
    try {
      const [housesRes, participantsRes, roundsRes] = await Promise.all([
        fetch("/api/houses"),
        fetch("/api/participants"),
        fetch("/api/rounds?active=true")
      ]);

      const housesData = housesRes.ok ? await housesRes.json() : [];
      const participantsData = participantsRes.ok ? await participantsRes.json() : [];
      const roundsData = roundsRes.ok ? await roundsRes.json() : [];

      setHouses(Array.isArray(housesData) ? housesData : []);
      setParticipants(Array.isArray(participantsData) ? participantsData : []);
      setRounds(Array.isArray(roundsData) ? roundsData : []);
      setActiveRound(roundsData.length > 0 ? roundsData[0] : null);
    } catch (error) {
      console.error("Error fetching data:", error);
      setHouses([]);
      setParticipants([]);
      setRounds([]);
      setActiveRound(null);
    }
  };

  const startRound = async () => {
    if (!selectedParticipant) {
      alert("Please select a participant");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/rounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantID: selectedParticipant,
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
    if (!activeRound) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/rounds/${activeRound._id}/end`, {
        method: "POST",
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

  const availableParticipants = participants.filter(p => !p.assignedHouse);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {/* Active Round Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Round</h2>
          {activeRound ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg">
                    Participant: {participants.find(p => p._id?.toString() === activeRound.participantID.toString())?.name}
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
                    House: {houses.find(h => h._id?.toString() === participant.assignedHouse?.toString())?.name}
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