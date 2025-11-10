/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

      // Auto-redirect /admin to /admin/overview
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
      {/* Dark overlay for text visibility */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <div className="bg-black/40 shadow-lg border-b-4 border-yellow-600">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-yellow-400 drop-shadow-lg">
                  ⚡ Admin Command Center
                </h1>
                <p className="text-gray-300 mt-1">
                  Master the bidding battlefield
                </p>
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
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-black bg-opacity-30 border-b-2 border-yellow-600">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex space-x-1">
              {tabs.map((tab) => (
                <Link key={tab.path} href={tab.path}>
                  <div
                    className={`px-6 py-4 font-semibold text-lg transition-all cursor-pointer ${
                      isActiveTab(tab.path)
                        ? "bg-yellow-600 text-black border-t-4 border-yellow-400"
                        : "bg-black bg-opacity-20 text-gray-300 hover:bg-opacity-40 hover:text-white"
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
        <div className="max-w-7xl mx-auto px-4 py-8">{children}</div>
      </div>
    </div>
  );
}
