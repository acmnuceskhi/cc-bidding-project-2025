"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        if (data.houseId) localStorage.setItem("houseId", data.houseId);

        if (data.role === "admin") router.push("/admin");
        else if (data.role === "house_captain")
          router.push(`/house/${data.houseId}`);
        else router.push("/");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0F2F]">
        <p className="text-[#FFD700] text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('arena-background.jpg')" }}
    >
      <div
        className="relative w-full max-w-md p-8 rounded-2xl border border-[#FFD700]/50
          shadow-[0_0_40px_rgba(255,215,0,0.5)] overflow-hidden
          bg-red-900/40 backdrop-blur-sm
          before:absolute before:inset-0 before:bg-gradient-to-br before:from-[#FFD700]/10 before:via-[#FFB800]/5 before:to-[#B22222]/10 before:rounded-2xl before:blur-lg"
      >
        <img
          src="/cc-logo.png"
          alt="CC Trophy Logo"
          className="absolute inset-0 w-full h-full object-contain opacity-40 pointer-events-none z-0"
        />

        {/* Head */}
        <div className="relative z-10 text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#FFD700] mb-2 drop-shadow-[0_0_10px_#B22222]">
            CC Bidding System
          </h1>
          <p className="text-[#00A6FF] font-medium drop-shadow-[0_0_8px_#FFD700]">
            Please sign in to continue
          </p>
        </div>

        {/* Login stuff */}
        <form onSubmit={handleLogin} className="relative z-10 space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-white drop-shadow-[0_0_5px_#B22222] mb-2"
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-white/20 backdrop-blur-none border border-[#FFD700]/50 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-white drop-shadow-[0_0_5px_#B22222] mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-white/20 backdrop-blur-none border border-[#FFD700]/50 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/60 rounded-md p-3">
              <p className="text-red-200 text-sm text-center drop-shadow-[0_0_5px_#B22222]">
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md font-bold text-black shadow-lg transition-all ${
              loading
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-[#FFD700] to-[#FFB800] hover:from-[#FFB800] hover:to-[#FFD700] hover:shadow-[0_0_25px_rgba(255,215,0,0.6)] focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:ring-offset-2"
            }`}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* defaults */}
        <div className="relative z-10 mt-8 text-center text-gray-200 text-sm">
          <p className="mb-2 text-[#FFD700] font-semibold drop-shadow-[0_0_5px_#B22222]">
            Demo Accounts:
          </p>
          <div className="space-y-1 text-xs">
            <p>
              <strong>Admin:</strong> admin / admin123
            </p>
            <p className="mt-2 font-semibold text-[#00A6FF] drop-shadow-[0_0_3px_#FFD700]">
              House Captains:
            </p>
            <p>captain_lord_shen / captain123</p>
            <p>captain_dragon_warrior / captain123</p>
            <p>captain_master_oogway / captain123</p>
            <p>captain_tai_lung / captain123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
