/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      setIsAuthenticated(true);

      if (pathname === "/admin") {
        router.push("/admin/overview");
      }
    }
  }, [mounted, pathname, router]);

  const tabs = [
    { name: "Overview", path: "/admin/overview", icon: "📊" },
    { name: "Houses", path: "/admin/houses", icon: "🏯" },
    { name: "Players", path: "/admin/players", icon: "🥋" },
    { name: "Rounds", path: "/admin/rounds", icon: "⏱️" },
  ];

  const isActiveTab = (path: string) => {
    if (pathname === "/admin" && path === "/admin/overview") return true;
    return pathname === path;
  };

  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-white mb-2">
            Loading Admin Panel
          </h2>
          <p className="text-gray-300">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{
        backgroundImage: "url('/arena-background.jpg')",
      }}
    >
      {/* Enhanced dark overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs"></div>

      {/* Neon grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFD70010_1px,transparent_1px),linear-gradient(to_bottom,#FFD70010_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Enhanced Header */}
        <div className="bg-black/60 shadow-lg border-b-2 border-[#FFD700]/50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_20px_#FFD700]">
                  ⚡ Admin Command Center
                </h1>
                <p className="text-gray-300 mt-1 text-sm sm:text-base">
                  Master the bidding battlefield
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await fetchWithAuth("/api/auth/logout", { method: "POST" });
                    sessionStorage.removeItem("token");
                    sessionStorage.removeItem("role");
                    sessionStorage.removeItem("houseId");
                    window.location.href = "/login";
                  } catch (err) {
                    console.error("Logout failed:", err);
                  }
                }}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-2 sm:py-3 px-4 sm:px-6 rounded-xl font-bold transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Tab Navigation - Centered */}
        <div className="bg-black/40 border-b-2 border-[#FFD700]/50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-center space-x-1 sm:space-x-2 overflow-x-auto">
              {tabs.map((tab) => (
                <Link key={tab.path} href={tab.path}>
                  <div
                    className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold text-base sm:text-lg transition-all cursor-pointer whitespace-nowrap ${
                      isActiveTab(tab.path)
                        ? "bg-gradient-to-r from-[#FFD700] to-[#FFB800] text-black border-t-4 border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.5)]"
                        : "bg-black/20 text-gray-300 hover:bg-black/40 hover:text-white hover:shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.name}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:py-8 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
