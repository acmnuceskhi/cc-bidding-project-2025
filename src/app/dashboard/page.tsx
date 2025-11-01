"use client";

import React, { useState, useEffect } from 'react';
import HousePanel from '@/components/HousePanel';
import ParticipantCard from '@/components/ParticipantCard';
import TimerDisplay from '@/components/TimerDisplay';
import { House } from '@/lib/models/houses';
import { Participant } from '@/lib/models/participants';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [houses, setHouses] = useState<House[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeParticipant, setActiveParticipant] = useState<Participant | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60000); // 1 minute in milliseconds
  const [currentBids, setCurrentBids] = useState<{ houseName: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch houses
        const housesRes = await fetch('/api/houses');
        const housesData = await housesRes.json();
        setHouses(housesData);

        // Fetch participants
        const participantsRes = await fetch('/api/participants');
        const participantsData = await participantsRes.json();
        setParticipants(participantsData);

        // Set first participant as active
        if (participantsData.length > 0) {
          setActiveParticipant(participantsData[0]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Timer effect
  useEffect(() => {
    if (!activeParticipant) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) {
          clearInterval(timer);
          // Move to next participant or end round
          moveToNextParticipant();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeParticipant]);

  const moveToNextParticipant = () => {
    const currentIndex = participants.findIndex(p => p._id === activeParticipant?._id);
    if (currentIndex < participants.length - 1) {
      setActiveParticipant(participants[currentIndex + 1]);
      setTimeLeft(60000); // Reset timer for next participant
      setCurrentBids([]); // Clear bids for next participant
    } else {
      // End of round
      alert('Round completed!');
    }
  };

  const handleBid = async (houseId: string, amount: number) => {
    if (!activeParticipant) return;

    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          houseID: houseId,
          participantID: activeParticipant._id,
          amount
        })
      });

      const result = await res.json();
      
      if (result.success) {
        // Update house budget locally
        setHouses(prevHouses => 
          prevHouses.map(house => 
            house._id?.toString() === houseId 
              ? { ...house, remainingBudget: house.remainingBudget - amount } 
              : house
          )
        );

        // Update current bids display
        const house = houses.find(h => h._id?.toString() === houseId);
        if (house) {
          setCurrentBids(prev => [
            ...prev.filter(bid => bid.houseName !== house.name),
            { houseName: house.name, amount }
          ]);
        }
      } else {
        alert(`Error placing bid: ${result.error}`);
      }
    } catch (error) {
      console.error('Error placing bid:', error);
      alert('Error placing bid');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="py-6 mb-8">
          <h1 className="text-3xl font-bold text-center text-gray-900">House Bidding Dashboard</h1>
        </header>

        {activeParticipant && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Current Participant: {activeParticipant.name}
            </h2>
            <TimerDisplay timeLeft={timeLeft} total_time={60000} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Houses Panel */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-xl font-bold">Houses</h2>
            {houses.map(house => (
              <HousePanel
                key={house._id?.toString()}
                house={house}
                onBid={(amount) => handleBid(house._id!.toString(), amount)}
                disabled={!activeParticipant}
              />
            ))}
          </div>

          {/* Participants Grid */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">Participants</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participants.map(participant => (
                <ParticipantCard
                  key={participant._id?.toString()}
                  participant={participant}
                  isActive={participant._id === activeParticipant?._id}
                  timeLeft={participant._id === activeParticipant?._id ? timeLeft : undefined}
                  currentBids={participant._id === activeParticipant?._id ? currentBids : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}