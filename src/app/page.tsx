"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { House } from "@/lib/models/houses";
import NoSSR from "@/components/NoSSR";

export default function Home() {
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHouses();
  }, []);

  const fetchHouses = async () => {
    try {
      const response = await fetch("/api/houses");
      if (response.ok) {
        const data = await response.json();
        setHouses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching houses:", error);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-4">CC Bidding System</h1>
          <p className="text-xl text-gray-300">
            Welcome to the College Championship Bidding Platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Admin Dashboard */}
          <Link href="/admin">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-8 hover:bg-opacity-20 transition-all duration-300 cursor-pointer border border-white border-opacity-20">
              <div className="text-center">
                <div className="text-4xl mb-4">👑</div>
                <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
                <p className="text-gray-300">
                  Start and manage bidding rounds, monitor house budgets, and oversee the entire auction process.
                </p>
              </div>
            </div>
          </Link>

          {/* Projector Display */}
          <Link href="/projector">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-8 hover:bg-opacity-20 transition-all duration-300 cursor-pointer border border-white border-opacity-20">
              <div className="text-center">
                <div className="text-4xl mb-4">📺</div>
                <h2 className="text-2xl font-bold mb-2">Projector Display</h2>
                <p className="text-gray-300">
                  Live display for spectators showing current participant, timer, and bidding status.
                </p>
              </div>
            </div>
          </Link>

          {/* House Dashboards */}
          <div className="md:col-span-2 lg:col-span-1">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-8 border border-white border-opacity-20">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">🏠</div>
                <h2 className="text-2xl font-bold mb-2">House Dashboards</h2>
                <p className="text-gray-300 mb-6">
                  Access your house's bidding interface
                </p>
              </div>
              
              <NoSSR fallback={
                <div className="text-center text-gray-400 py-4">
                  Loading houses...
                </div>
              }>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center text-gray-400 py-4">
                      Loading houses...
                    </div>
                  ) : houses.length > 0 ? (
                    houses.map((house) => (
                      <Link key={house._id?.toString()} href={`/house/${house._id}`}>
                        <div className="bg-white bg-opacity-10 rounded-lg p-4 hover:bg-opacity-20 transition-all duration-200 cursor-pointer">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold">{house.name}</span>
                            <span className="text-sm text-green-400">
                              ${house.remainingBudget} left
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 py-4">
                      No houses found. Please connect to database and run initialization.
                    </div>
                  )}
                </div>
              </NoSSR>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-8 border border-white border-opacity-20">
            <h3 className="text-2xl font-bold mb-6 text-center">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-3">1️⃣</div>
                <h4 className="font-semibold mb-2">Admin Starts Round</h4>
                <p className="text-sm text-gray-300">
                  Admin selects a participant and starts a 1-minute bidding round
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3">2️⃣</div>
                <h4 className="font-semibold mb-2">Houses Place Bids</h4>
                <p className="text-sm text-gray-300">
                  Each house can place one bid within their remaining budget
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3">3️⃣</div>
                <h4 className="font-semibold mb-2">Winner Determined</h4>
                <p className="text-sm text-gray-300">
                  Highest bid wins. In case of tie, earliest bid wins
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Database Initialization */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 mb-4">
            Need to set up the database? Run the initialization script:
          </p>
          <code className="bg-black bg-opacity-30 px-4 py-2 rounded-lg text-green-400">
            npm run init-data
          </code>
        </div>
      </div>
    </div>
  );
}