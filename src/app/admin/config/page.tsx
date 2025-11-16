"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface AuctionConfig {
  maxTeamsPerBatch: number;
  maxBidAmount?: number | null;
  roundDurationSeconds: number;
  countdownWarningSeconds: number;
  autoStartNextRound: boolean;
  delayBetweenRoundsSeconds: number;
  auctionStartTime?: string | null;
  auctionEndTime?: string | null;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<AuctionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Form state - use strings for inputs to avoid parsing issues while typing
  const [maxTeamsPerBatch, setMaxTeamsPerBatch] = useState("1");
  const [maxBidAmount, setMaxBidAmount] = useState<string>("");
  const [roundDurationSeconds, setRoundDurationSeconds] = useState("120");
  const [countdownWarningSeconds, setCountdownWarningSeconds] = useState("30");
  const [autoStartNextRound, setAutoStartNextRound] = useState(false);
  const [delayBetweenRoundsSeconds, setDelayBetweenRoundsSeconds] = useState("5");
  const [auctionStartTimeLocal, setAuctionStartTimeLocal] = useState<string>("");
  const [auctionEndTimeLocal, setAuctionEndTimeLocal] = useState<string>("");

  // Helpers to convert between ISO and input[type=datetime-local] values
  const isoToLocalInput = (iso?: string | null): string => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  const localInputToIso = (local: string): string | null => {
    if (!local) return null;
    const d = new Date(local);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/config");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GET /api/config ${res.status}: ${text || res.statusText}`);
      }
      const data = await res.json();
      setConfig(data);
      
      // Update form state - convert to strings
      setMaxTeamsPerBatch(String(data.maxTeamsPerBatch));
      setMaxBidAmount(
        data.maxBidAmount === null || data.maxBidAmount === undefined
          ? ""
          : String(data.maxBidAmount)
      );
      setRoundDurationSeconds(String(data.roundDurationSeconds));
      setCountdownWarningSeconds(String(data.countdownWarningSeconds));
      setAutoStartNextRound(data.autoStartNextRound);
      setDelayBetweenRoundsSeconds(String(data.delayBetweenRoundsSeconds));
      // Times into datetime-local inputs (local timezone display)
      setAuctionStartTimeLocal(isoToLocalInput(data.auctionStartTime));
      setAuctionEndTimeLocal(isoToLocalInput(data.auctionEndTime));
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
          maxBidAmount:
            maxBidAmount.trim() === "" ? null : parseInt(maxBidAmount, 10),
          roundDurationSeconds: parseInt(roundDurationSeconds),
          countdownWarningSeconds: parseInt(countdownWarningSeconds),
          autoStartNextRound,
          delayBetweenRoundsSeconds: parseInt(delayBetweenRoundsSeconds),
          auctionStartTime: localInputToIso(auctionStartTimeLocal),
          auctionEndTime: localInputToIso(auctionEndTimeLocal),
        }),
      });


      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Configuration saved successfully!");
        const newConfig = data.config || data;
        setConfig(newConfig);
        // Update form with saved values
        setMaxTeamsPerBatch(String(newConfig.maxTeamsPerBatch));
        setMaxBidAmount(
          newConfig.maxBidAmount === null || newConfig.maxBidAmount === undefined
            ? ""
            : String(newConfig.maxBidAmount)
        );
        setRoundDurationSeconds(String(newConfig.roundDurationSeconds));
        setCountdownWarningSeconds(String(newConfig.countdownWarningSeconds));
        setAutoStartNextRound(newConfig.autoStartNextRound);
        setDelayBetweenRoundsSeconds(String(newConfig.delayBetweenRoundsSeconds));
        setAuctionStartTimeLocal(isoToLocalInput(newConfig.auctionStartTime));
        setAuctionEndTimeLocal(isoToLocalInput(newConfig.auctionEndTime));
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
          {/* Auction Window Times */}
          <div className="bg-black/60 rounded-xl p-6 border border-[#FFD700]/30">
            <label className="block text-xl font-bold text-[#FFD700] mb-3">
              🗓️ Auction Window
            </label>
            <p className="text-gray-300 mb-4">
              Set the overall start and end time of the auction. These values drive the global status banners and countdowns for all clients.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Auction Start</label>
                <input
                  type="datetime-local"
                  value={auctionStartTimeLocal}
                  onChange={(e) => setAuctionStartTimeLocal(e.target.value)}
                  className="w-full bg-gray-800 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-[#FFD700]"
                />
                <button
                  type="button"
                  onClick={() => setAuctionStartTimeLocal("")}
                  className="mt-2 text-sm text-yellow-300 hover:text-yellow-200"
                >
                  Clear start
                </button>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Auction End</label>
                <input
                  type="datetime-local"
                  value={auctionEndTimeLocal}
                  onChange={(e) => setAuctionEndTimeLocal(e.target.value)}
                  className="w-full bg-gray-800 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-[#FFD700]"
                />
                <button
                  type="button"
                  onClick={() => setAuctionEndTimeLocal("")}
                  className="mt-2 text-sm text-yellow-300 hover:text-yellow-200"
                >
                  Clear end
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-3">Times are interpreted in your local timezone and saved as ISO-8601 (UTC) on the server.</p>
          </div>

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

          {/* Max Bid Amount */}
          <div className="bg-black/60 rounded-xl p-6 border border-[#FFD700]/30">
            <label className="block text-xl font-bold text-[#FFD700] mb-3">
              💰 Max Bid Amount (per bid)
            </label>
            <p className="text-gray-300 mb-4">
              Caps any single bid amount. Leave blank for unlimited.
            </p>
            <input
              type="number"
              min="1"
              value={maxBidAmount}
              onChange={(e) => setMaxBidAmount(e.target.value)}
              placeholder="Blank = unlimited"
              className="w-full bg-gray-800 text-white border-2 border-[#FFD700]/50 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-[#FFD700]"
            />
            <p className="text-sm text-gray-400 mt-2">
              {maxBidAmount ? `Bids over $${maxBidAmount} will be rejected.` : "No limit applied."}
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
              className="flex-1 bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
