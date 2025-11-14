"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface AuctionConfig {
  maxTeamsPerBatch: number;
  roundDurationSeconds: number;
  countdownWarningSeconds: number;
  autoStartNextRound: boolean;
  delayBetweenRoundsSeconds: number;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<AuctionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Form state - use strings for inputs to avoid parsing issues while typing
  const [maxTeamsPerBatch, setMaxTeamsPerBatch] = useState("1");
  const [roundDurationSeconds, setRoundDurationSeconds] = useState("120");
  const [countdownWarningSeconds, setCountdownWarningSeconds] = useState("30");
  const [autoStartNextRound, setAutoStartNextRound] = useState(false);
  const [delayBetweenRoundsSeconds, setDelayBetweenRoundsSeconds] = useState("5");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/config");
      const data = await res.json();
      setConfig(data);
      
      // Update form state - convert to strings
      setMaxTeamsPerBatch(String(data.maxTeamsPerBatch));
      setRoundDurationSeconds(String(data.roundDurationSeconds));
      setCountdownWarningSeconds(String(data.countdownWarningSeconds));
      setAutoStartNextRound(data.autoStartNextRound);
      setDelayBetweenRoundsSeconds(String(data.delayBetweenRoundsSeconds));
    } catch (error) {
      console.error("Error fetching config:", error);
      setMessage("❌ Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      const res = await fetchWithAuth("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxTeamsPerBatch: parseInt(maxTeamsPerBatch),
          roundDurationSeconds: parseInt(roundDurationSeconds),
          countdownWarningSeconds: parseInt(countdownWarningSeconds),
          autoStartNextRound,
          delayBetweenRoundsSeconds: parseInt(delayBetweenRoundsSeconds),
        }),
      });


      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Configuration saved successfully!");
        const newConfig = data.config || data;
        setConfig(newConfig);
        // Update form with saved values
        setMaxTeamsPerBatch(String(newConfig.maxTeamsPerBatch));
        setRoundDurationSeconds(String(newConfig.roundDurationSeconds));
        setCountdownWarningSeconds(String(newConfig.countdownWarningSeconds));
        setAutoStartNextRound(newConfig.autoStartNextRound);
        setDelayBetweenRoundsSeconds(String(newConfig.delayBetweenRoundsSeconds));
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`❌ Error: ${data.error || "Failed to save"}`);
      }
    } catch (error: any) {
      console.error("Error saving config:", error);
      setMessage(`❌ Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-yellow-400 text-2xl">
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-black/40 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
        <h2 className="text-3xl font-bold text-[#FFD700] mb-6 drop-shadow-[0_0_20px_#FFD700]">
          ⚙️ Auction Configuration
        </h2>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.includes("✅")
                ? "bg-green-500/20 border-2 border-green-500 text-green-300"
                : "bg-red-500/20 border-2 border-red-500 text-red-300"
            }`}
          >
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* Max Teams Per Batch */}
          <div className="bg-black/60 rounded-xl p-6 border border-[#FFD700]/30">
            <label className="block text-xl font-bold text-[#FFD700] mb-3">
              🎓 Max Teams Per Batch
            </label>
            <p className="text-gray-300 mb-4">
              Maximum number of teams from a single batch (22k, 23k, 24k, 25k) that a house can win
            </p>
            <input
              type="number"
              min="1"
              max="10"
              value={maxTeamsPerBatch}
              onChange={(e) => setMaxTeamsPerBatch(e.target.value)}
              className="w-full bg-gray-800 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-[#FFD700]"
            />
            <p className="text-sm text-gray-400 mt-2">
              Current: Each house can win up to {maxTeamsPerBatch || 1} team(s) from each batch
            </p>
            <p className="text-sm text-yellow-400 mt-2 font-semibold">
              ⚠️ Recommended: 1 (ensures each house gets exactly 1 team from each of the 4 batches = 4 teams total)
            </p>
          </div>

          {/* Round Duration */}
          <div className="bg-black/60 rounded-xl p-6 border border-[#FFD700]/30">
            <label className="block text-xl font-bold text-[#FFD700] mb-3">
              ⏱️ Round Duration (seconds)
            </label>
            <p className="text-gray-300 mb-4">
              How long each bidding round lasts
            </p>
            <input
              type="number"
              min="30"
              max="600"
              value={roundDurationSeconds}
              onChange={(e) => setRoundDurationSeconds(e.target.value)}
              className="w-full bg-gray-800 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-[#FFD700]"
            />
            <p className="text-sm text-gray-400 mt-2">
              Current: {roundDurationSeconds || 120} seconds ({Math.floor((parseInt(roundDurationSeconds) || 120) / 60)}:{((parseInt(roundDurationSeconds) || 120) % 60).toString().padStart(2, '0')} minutes)
            </p>
          </div>

          {/* Countdown Warning */}
          <div className="bg-black/60 rounded-xl p-6 border border-[#FFD700]/30">
            <label className="block text-xl font-bold text-[#FFD700] mb-3">
              ⚠️ Countdown Warning (seconds)
            </label>
            <p className="text-gray-300 mb-4">
              When to show red warning (seconds before round ends)
            </p>
            <input
              type="number"
              min="5"
              max="60"
              value={countdownWarningSeconds}
              onChange={(e) => setCountdownWarningSeconds(e.target.value)}
              className="w-full bg-gray-800 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-[#FFD700]"
            />
            <p className="text-sm text-gray-400 mt-2">
              Timer turns red in the last {countdownWarningSeconds || 30} seconds
            </p>
          </div>

          {/* Auto Start Next Round */}
          <div className="bg-black/60 rounded-xl p-6 border border-[#FFD700]/30">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoStartNextRound}
                onChange={(e) => setAutoStartNextRound(e.target.checked)}
                className="w-6 h-6 rounded border-2 border-[#FFD700]/50 bg-gray-800 checked:bg-[#FFD700] focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
              />
              <span className="text-xl font-bold text-[#FFD700]">
                🚀 Auto-Start Next Round
              </span>
            </label>
            <p className="text-gray-300 ml-9 mt-2">
              Automatically start the next round after current one completes
            </p>
          </div>

          {/* Delay Between Rounds */}
          {autoStartNextRound && (
            <div className="bg-black/60 rounded-xl p-6 border border-[#FFD700]/30">
              <label className="block text-xl font-bold text-[#FFD700] mb-3">
                ⏳ Delay Between Rounds (seconds)
              </label>
              <p className="text-gray-300 mb-4">
                Pause duration before auto-starting next round
              </p>
              <input
                type="number"
                min="0"
                max="60"
                value={delayBetweenRoundsSeconds}
                onChange={(e) => setDelayBetweenRoundsSeconds(e.target.value)}
                className="w-full bg-gray-800 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-[#FFD700]"
              />
              <p className="text-sm text-gray-400 mt-2">
                Wait {delayBetweenRoundsSeconds || 5} seconds before starting next round
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {saving ? "Saving..." : "💾 Save Configuration"}
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border-2 border-blue-500/50 rounded-lg p-6 backdrop-blur-md">
        <h3 className="text-xl font-bold text-blue-300 mb-3">ℹ️ Important Notes</h3>
        <ul className="text-gray-300 space-y-2">
          <li>• Changes take effect immediately for new rounds</li>
          <li>• Active rounds continue with their original settings</li>
          <li>• Batch limits prevent houses from dominating a single batch</li>
          <li>• Round duration affects all future rounds</li>
        </ul>
      </div>
    </div>
  );
}
