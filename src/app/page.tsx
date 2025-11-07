"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // checkAuthentication(); // disabled for UI testing
    setIsAuthenticated(true);
    setLoading(false);
  }, []);

  const checkAuthentication = async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const houseId = localStorage.getItem("houseId");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    // Verify token and redirect based on role
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();

        // Redirect based on role
        if (userData.role === "admin") {
          window.location.href = "/admin";
        } else if (userData.role === "house_captain" && userData.houseId) {
          window.location.href = `/house/${userData.houseId}`;
        } else {
          // Show home page for other cases
          setIsAuthenticated(true);
          fetchHouses();
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

  const fetchHouses = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/houses", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
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
    <div
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{
        backgroundImage: "url('/arena-background.jpg')",
      }}
    >
      {/* Dark overlay for text visibility */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
        <div className="max-w-6xl w-full">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-7xl font-bold mb-4 text-yellow-400 drop-shadow-2xl">
              🏆 CODERS CUP 2025
            </h1>
            <p className="text-3xl text-gray-200 font-semibold">
              Kung Fu Panda Bidding Arena
            </p>
          </div>

          {/* Main Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* House Captain Card */}
            <Link href="/login">
              <div className="bg-gradient-to-br from-red-800 to-orange-800 rounded-2xl p-8 hover:scale-105 transition-all duration-300 cursor-pointer border-4 border-yellow-600 shadow-2xl group">
                <div className="text-center">
                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                    🏯
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-yellow-400">
                    House Captain
                  </h2>
                  <p className="text-gray-200 text-lg">
                    Lead your house to victory! Place strategic bids to recruit
                    the best warriors.
                  </p>
                  <div className="mt-6 bg-black/40 rounded-lg py-3 px-4">
                    <span className="text-yellow-300 font-semibold">
                      🔒 Login Required
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Projector Card */}
            <Link href="/projector">
              <div className="bg-gradient-to-br from-yellow-600 to-orange-700 rounded-2xl p-8 hover:scale-105 transition-all duration-300 cursor-pointer border-4 border-yellow-400 shadow-2xl group">
                <div className="text-center">
                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                    📺
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-black">
                    Projector Display
                  </h2>
                  <p className="text-black text-lg font-medium">
                    Watch the auction live! See which warriors are up for
                    bidding in real-time.
                  </p>
                  <div className="mt-6 bg-black/40 rounded-lg py-3 px-4">
                    <span className="text-yellow-200 font-semibold">
                      ✨ Public Access
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Admin Card */}
            <Link href="/login">
              <div className="bg-gradient-to-br from-black to-gray-900 rounded-2xl p-8 hover:scale-105 transition-all duration-300 cursor-pointer border-4 border-red-600 shadow-2xl group">
                <div className="text-center">
                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                    👑
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-red-500">
                    Admin Control
                  </h2>
                  <p className="text-gray-200 text-lg">
                    Master the auction! Start rounds, monitor bids, and control
                    the entire arena.
                  </p>
                  <div className="mt-6 bg-red-900/60 rounded-lg py-3 px-4 border-2 border-red-500">
                    <span className="text-red-300 font-semibold">
                      ⚔️ Admin Login Required
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* How It Works Section */}
          <div className="bg-black/60 backdrop-blur-md rounded-2xl p-8 border-4 border-yellow-600 shadow-2xl">
            <h3 className="text-3xl font-bold mb-8 text-center text-yellow-400">
              ⚔️ How The Battle Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-5xl mb-4">🥋</div>
                <h4 className="font-bold text-xl mb-3 text-yellow-300">
                  Round Begins
                </h4>
                <p className="text-gray-300">
                  Admin selects a warrior and starts a 60-second bidding battle
                </p>
              </div>
              <div className="text-center">
                <div className="text-5xl mb-4">💰</div>
                <h4 className="font-bold text-xl mb-3 text-yellow-300">
                  Houses Bid
                </h4>
                <p className="text-gray-300">
                  Each house places their secret bid within their remaining
                  treasury
                </p>
              </div>
              <div className="text-center">
                <div className="text-5xl mb-4">🏆</div>
                <h4 className="font-bold text-xl mb-3 text-yellow-300">
                  Victor Emerges
                </h4>
                <p className="text-gray-300">
                  Highest bid wins! In case of tie, the first bid claims victory
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
