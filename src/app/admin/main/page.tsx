"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import type { ServerToClientEvents } from "@/types/socket";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { FullPageSpinner } from "@/components/Spinner";

interface TeamOption {
  teamId: string;
  rank: number;
  batch: string | null;
  name?: string | null;
  memberCount?: number;
}

interface AuctionStateLike {
  currentRound?: string;
  currentRoundStartTime?: string | null;
  currentRoundEndTime?: string | null;
}

export default function AdminMainPage() {
  const { auctionState, socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [duration, setDuration] = useState<number>(45);
  const [useDelay, setUseDelay] = useState<boolean>(true); // whether to start after a short delay
  const [delaySeconds, setDelaySeconds] = useState<number>(5); // adjustable delay seconds
  const [startTime, setStartTime] = useState<string>(""); // datetime-local value
  const [bids, setBids] = useState<Array<{ houseId: string; houseName?: string; amount: number }>>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [validating, setValidating] = useState<boolean>(false);
  const [currentTeamAssigned, setCurrentTeamAssigned] = useState<string | null>(null);
  const [currentTeamName, setCurrentTeamName] = useState<string | null>(null);
  const [housesMap, setHousesMap] = useState<Record<string,string>>({});

  // Keep a 1s tick for countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Function to fetch unsold teams
  const fetchUnsoldTeams = useCallback(async () => {
    try {
      const statusRes = await fetchWithAuth("/api/status", { cache: "no-store" });
      const statusData: { unsoldTeams?: Array<{ teamId: string; rank: number; batch?: string | null; memberCount?: number }> } = await statusRes.json();
      const unsold: TeamOption[] = (statusData?.unsoldTeams || []).map((t) => ({
        teamId: t.teamId,
        rank: t.rank,
        batch: t.batch ?? null,
        memberCount: t.memberCount,
      }));

      // Try to enrich names from /api/teams
      try {
        const teamsRes = await fetchWithAuth("/api/teams", { cache: "no-store" });
        const teamsList: Array<{ teamId: string; name?: string | null }> = await teamsRes.json();
        const nameMap = new Map<string, string | null>();
        teamsList.forEach((t) => nameMap.set(t.teamId, t.name || null));
        unsold.forEach((u) => (u.name = nameMap.get(u.teamId) ?? null));
      } catch {}

      setTeams(unsold);
    } catch (e) {
      console.error("Failed to load status/teams", e);
    }
  }, []);

  // Initial load: get status (for unsold teams) + full team list to enrich names
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await fetchUnsoldTeams();
        // Fetch houses for name mapping
        try {
          const housesRes = await fetchWithAuth("/api/houses", { cache: "no-store" });
            if (housesRes.ok) {
              const houses: Array<{ houseId: string; name: string }> = await housesRes.json();
              const map: Record<string,string> = {};
              houses.forEach(h => { map[h.houseId] = h.name; });
              if (mounted) setHousesMap(map);
            }
        } catch {}
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchUnsoldTeams]);

  const filteredTeams = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return teams;
    return teams.filter((t) =>
      (t.name || "").toLowerCase().includes(f) ||
      String(t.rank).includes(f) ||
      (t.batch || "").toLowerCase().includes(f)
    );
  }, [teams, filter]);

  const roundOngoing = useMemo(() => {
    if (!auctionState?.currentRoundStartTime || !auctionState?.currentRoundEndTime) return false;
    const s = new Date(auctionState.currentRoundStartTime).getTime();
    const e = new Date(auctionState.currentRoundEndTime).getTime();
    return now >= s && now < e;
  }, [auctionState, now]);

  const roundPrestart = useMemo(() => {
    if (!auctionState?.currentRound || !auctionState?.currentRoundStartTime) return false;
    const s = new Date(auctionState.currentRoundStartTime).getTime();
    return now < s;
  }, [auctionState, now]);

  // Track assignment status for the current team (treated as validated if assigned)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const teamId = (auctionState as AuctionStateLike)?.currentRound || "";
        if (!teamId) { setCurrentTeamAssigned(null); return; }
        const res = await fetchWithAuth(`/api/teams/${teamId}`, { cache: "no-store" });
        if (!res.ok) { setCurrentTeamAssigned(null); return; }
        const data = await res.json();
        if (!cancelled) {
          setCurrentTeamAssigned(data?.houseId || null);
          setCurrentTeamName(data?.name || null);
        }
      } catch {
        if (!cancelled) {
          setCurrentTeamAssigned(null);
          setCurrentTeamName(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [auctionState, auctionState?.currentRound]);

  const roundEnded = useMemo(() => {
    if (!auctionState?.currentRoundEndTime) return false;
    const e = new Date(auctionState.currentRoundEndTime).getTime();
    return now >= e && !!auctionState.currentRound;
  }, [auctionState, now]);

  const remainingSeconds = useMemo(() => {
    if (!auctionState?.currentRoundEndTime) return 0;
    const e = new Date(auctionState.currentRoundEndTime).getTime();
    return Math.max(0, Math.ceil((e - now) / 1000));
  }, [auctionState, now]);

  // Load bids for current team when ongoing or ended (for results)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const teamId = (auctionState as AuctionStateLike)?.currentRound || "";
        if (!teamId || (!roundOngoing && !roundEnded)) {
          if (mounted) setBids([]);
          return;
        }
        const res = await fetchWithAuth(`/api/bids?teamId=${teamId}`, { cache: "no-store" });
        const data: Array<{ houseId: string; houseName?: string; amount: number }> = await res.json();
        if (!Array.isArray(data)) {
          if (mounted) setBids([]);
          return;
        }
        const list = data
          .map((b) => ({ houseId: b.houseId, houseName: b.houseName || housesMap[b.houseId] || undefined, amount: b.amount }))
          .sort((a, b) => b.amount - a.amount);
        if (mounted) setBids(list);
      } catch (e) {
        console.error("Failed to load bids", e);
        if (mounted) setBids([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [auctionState, auctionState?.currentRound, roundOngoing, roundEnded, housesMap]);

  // Live bids via socket (admins receive all latest bids for current team)
  useEffect(() => {
    if (!socket) return;
    const handler = (data: Parameters<ServerToClientEvents["bids-update"]>[0]) => {
      const teamId = (auctionState as AuctionStateLike)?.currentRound || "";
      if (!teamId) return;
      if (!data || typeof data !== "object") return;
      if ("bids" in data && data.teamId === teamId) {
        const list = (data.bids as Array<{ houseId: string; houseName?: string; amount: number }>)
          .slice()
          .map(b => ({ ...b, houseName: b.houseName || housesMap[b.houseId] || undefined }))
          .sort((a, b) => b.amount - a.amount);
        setBids(list);
      }
    };
    socket.on("bids-update", handler);
    return () => {
      socket.off("bids-update", handler);
    };
  }, [socket, auctionState, housesMap]);

  // Refresh team list when rounds end (team gets assigned to a house)
  useEffect(() => {
    if (!socket) return;
    const handleRoundEnded = () => {
      console.log('[ADMIN_MAIN] Round ended, refreshing unsold teams list');
      fetchUnsoldTeams();
    };
    socket.on("round-ended", handleRoundEnded);
    return () => {
      socket.off("round-ended", handleRoundEnded);
    };
  }, [socket, fetchUnsoldTeams]);

  async function startRound() {
    try {
      if (!selectedTeamId) return;
      let startIso: string;
      if (useDelay) {
        const secs = Math.max(1, Math.floor(delaySeconds));
        startIso = new Date(Date.now() + secs * 1000).toISOString();
      } else {
        if (!startTime) return;
        const d = new Date(startTime);
        startIso = d.toISOString();
      }
      const endIso = new Date(new Date(startIso).getTime() + duration * 1000).toISOString();

      // POST /api/status — flexible body: teamId + start/end
      const res = await fetchWithAuth("/api/status", {
        method: "POST",
        body: JSON.stringify({
          action: "start",
          teamId: selectedTeamId,
          startTime: startIso,
          endTime: endIso,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Failed to start round: ${msg}`);
        return;
      }
      setSelectedTeamId("");
    } catch (e) {
      console.error(e);
      alert("Failed to start round");
    }
  }

  async function endNow() {
    try {
      const teamId = (auctionState as AuctionStateLike)?.currentRound || "";
      if (!teamId) return;
      const ok = window.confirm("End the current bidding instantly?");
      if (!ok) return;
      const res = await fetchWithAuth("/api/status", {
        method: "POST",
        body: JSON.stringify({ action: "endNow" }),
      });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Failed to end round: ${msg}`);
        return;
      }
    } catch (e) {
      console.error(e);
      alert("Failed to end round");
    }
  }

  async function validateWin() {
    try {
      const teamId = (auctionState as AuctionStateLike)?.currentRound || "";
      if (!teamId) return;
      const ok = window.confirm("Validate the winning bid and finalize the team?");
      if (!ok) return;
      setValidating(true);
      const res = await fetchWithAuth("/api/validate-win", {
        method: "POST",
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Failed to validate winner: ${msg}`);
        return;
      }
      const data = await res.json();
      if (data?.alreadyValidated && data?.winner) {
        setCurrentTeamAssigned(data.winner.houseId || null);
        alert(`Already validated for ${data.winner.houseName}${data.winner.amount ? ` ($${data.winner.amount})` : ""}`);
      } else if (data?.winner) {
        setCurrentTeamAssigned(data.winner.houseId || null);
        alert(`Winner validated: ${data.winner.houseName} ($${data.winner.amount})`);
      } else {
        alert("No winner to validate (no bids)");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to validate winner");
    } finally {
      setValidating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <FullPageSpinner message="Loading…" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Live Auction State banner */}
      <div className="bg-black/60 rounded-2xl p-4 border-2 border-[#FFD700]/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-gray-200">
            <span className="font-semibold">Auction State:</span>{" "}
            {(() => {
              const nowMs = now;
              const aStart = auctionState?.auctionStartTime ? new Date(auctionState.auctionStartTime).getTime() : null;
              const aEnd = auctionState?.auctionEndTime ? new Date(auctionState.auctionEndTime).getTime() : null;
              const rStart = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
              const rEnd = auctionState?.currentRoundEndTime ? new Date(auctionState.currentRoundEndTime).getTime() : null;
              if (aStart && nowMs < aStart) {
                const s = Math.max(0, Math.ceil((aStart - nowMs) / 1000));
                return `Not started • starts in ${s}s`;
              }
              if (aEnd && nowMs >= aEnd) return "Finished";
              if (rStart && nowMs < rStart) {
                const s = Math.max(0, Math.ceil((rStart - nowMs) / 1000));
                return `Live • next round starts in ${s}s`;
              }
              if (rStart && rEnd && nowMs >= rStart && nowMs < rEnd) {
                const s = Math.max(0, Math.ceil((rEnd - nowMs) / 1000));
                return `Live • round ${auctionState?.currentRound || "?"} ends in ${s}s`;
              }
              if (aEnd && nowMs < aEnd) return "Live • waiting for next round";
              return "Unknown";
            })()}
          </div>
          <div className="text-gray-400 text-sm">
            <span className="font-mono">Round: {auctionState?.currentRound || "-"}</span>
          </div>
        </div>
      </div>

      {/* Start Round Panel */}
      <div className="bg-black/60 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.25)]">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-4">🚀 Start Team Bidding</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="sm:col-span-1">
            <label className="block text-sm font-semibold text-gray-200 mb-1">Search team</label>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by name, rank, batch"
              className="w-full bg-gray-900/70 border-2 border-[#FFD700]/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-200 mb-1">Select team</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              disabled={roundEnded && bids.length > 0 && !currentTeamAssigned}
              className={`w-full bg-gray-900/70 border-2 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 ${
                roundEnded && bids.length > 0 && !currentTeamAssigned
                  ? "border-gray-600 text-gray-400 cursor-not-allowed"
                  : "border-[#FFD700]/30 focus:ring-[#FFD700]"
              }`}
            >
              <option value="">-- Choose a team --</option>
              {filteredTeams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {(t.name ? `${t.name}` : `Team #${t.rank}`)} • Batch {t.batch || "?"} • {t.memberCount || 0} members
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end opacity-100">
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-1">Duration (seconds, min 5)</label>
            <input
              type="number"
              min={5}
              value={duration}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDuration(isNaN(val) ? 5 : val);
              }}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val < 5) setDuration(5);
              }}
              disabled={roundEnded && bids.length > 0 && !currentTeamAssigned}
              className="w-full bg-gray-900/70 border-2 border-[#FFD700]/30 rounded-lg px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
            />
          </div>
          <div>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-gray-200">
                <input
                  type="checkbox"
                  checked={useDelay}
                  onChange={(e) => setUseDelay(e.target.checked)}
                  disabled={roundEnded && bids.length > 0 && !currentTeamAssigned}
                />
                <span>Start after delay</span>
              </label>
              {useDelay && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Delay (seconds, min 1)</label>
                  <input
                    type="number"
                    min={1}
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value) || 1)}
                    onBlur={() => { if (delaySeconds < 1) setDelaySeconds(1); }}
                    disabled={roundEnded && bids.length > 0 && !currentTeamAssigned}
                    className="w-full bg-gray-900/70 border-2 border-[#FFD700]/30 rounded-lg px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                  />
                </div>
              )}
            </div>
          </div>
          <div>
            <label className={`block text-sm font-semibold mb-1 ${useDelay ? "text-gray-500" : "text-gray-200"}`}>Start time</label>
            <input
              type="datetime-local"
              value={startTime}
              disabled={useDelay || (roundEnded && bids.length > 0 && !currentTeamAssigned)}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-gray-900/70 border-2 border-[#FFD700]/30 rounded-lg px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={startRound}
            disabled={!selectedTeamId || (roundEnded && bids.length > 0 && !currentTeamAssigned)}
            className={`px-6 py-3 rounded-xl font-bold ${!selectedTeamId || (roundEnded && bids.length > 0 && !currentTeamAssigned) ? "bg-gray-600 text-gray-300 cursor-not-allowed" : "bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"}`}
          >
            Start
          </button>
          {roundEnded && bids.length > 0 && !currentTeamAssigned && (
            <div className="text-sm text-yellow-300 self-center">Finish validating the current team to start the next.</div>
          )}
        </div>
      </div>

      {/* Prestart (C-B) */}
      {roundPrestart && (
        <div className="bg-black/60 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.25)]">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-2">⏳ Upcoming Start</h2>
          <div className="text-gray-200">Team: <span className="font-semibold">{currentTeamName || `Team ${auctionState?.currentRound?.slice(0,6) || "?"}`}</span>{auctionState?.currentRound ? <span className="font-mono text-xs opacity-50 ml-2">{auctionState.currentRound}</span> : null}</div>
          <div className="text-4xl font-bold text-[#FFD700] mt-2">
            {(() => {
              const rStart = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
              const s = rStart ? Math.max(0, Math.ceil((rStart - now) / 1000)) : 0;
              return `${s}s`;
            })()}
          </div>
        </div>
      )}

      {/* Ongoing (C-D) */}
      <div className="bg-black/60 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.25)]">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-4">⏱️ Current Team</h2>
        {roundOngoing ? (
          <div>
            <div className="flex items-center justify-between">
              <div className="text-gray-200">Team: <span className="font-semibold">{currentTeamName || `Team ${auctionState?.currentRound?.slice(0,6) || "?"}`}</span>{auctionState?.currentRound ? <span className="font-mono text-xs opacity-50 ml-2">{auctionState.currentRound}</span> : null}</div>
              <div className="text-4xl font-bold text-[#FFD700]">{remainingSeconds}s</div>
            </div>
            <div className="mt-4">
              <button
                onClick={endNow}
                className="px-6 py-3 rounded-xl font-bold bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
              >
                End Instantly
              </button>
            </div>
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-white mb-2">Bids</h3>
              {bids.length === 0 ? (
                <div className="text-gray-400">No bids yet.</div>
              ) : (
                <div className="space-y-2">
                  {bids.map((b, idx) => {
                    const displayName = b.houseName || housesMap[b.houseId] || `House ${b.houseId.slice(0,6)}`;
                    return (
                      <div key={`${b.houseId}-${idx}`} className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg px-4 py-2">
                        <div className="text-white flex items-center gap-2">
                          <span>{idx + 1}.</span>
                          <span>{displayName}</span>
                          <span className="font-mono text-xs opacity-40">{b.houseId.slice(0,8)}</span>
                        </div>
                        <div className={`${idx === 0 ? "text-[#FFD700]" : "text-white"} font-bold`}>${b.amount}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-300">No round is currently active.</div>
        )}
      </div>

      {/* Results (C-C) */}
      {roundEnded && (
        <div className="bg-black/60 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.25)]">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-4">🏁 Results</h2>
          <div className="text-gray-200 mb-3">Team: <span className="font-semibold">{currentTeamName || `Team ${auctionState?.currentRound?.slice(0,6) || "?"}`}</span>{auctionState?.currentRound ? <span className="font-mono text-xs opacity-50 ml-2">{auctionState.currentRound}</span> : null}</div>
          {bids.length === 0 ? (
            <div className="text-gray-400">No bids were placed. Result considered cancelled.</div>
          ) : (
            <div className="space-y-2">
              {bids.map((b, idx) => {
                const displayName = b.houseName || housesMap[b.houseId] || `House ${b.houseId.slice(0,6)}`;
                return (
                  <div key={`${b.houseId}-res-${idx}`} className={`flex items-center justify-between bg-black/40 border rounded-lg px-4 py-2 ${idx === 0 ? "border-[#FFD700]" : "border-white/10"}`}>
                    <div className={`${idx === 0 ? "text-[#FFD700]" : "text-white"} flex items-center gap-2`}>
                      <span>{idx + 1}.</span>
                      <span>{displayName}</span>
                      <span className="font-mono text-xs opacity-40">{b.houseId.slice(0,8)}</span>
                    </div>
                    <div className={`${idx === 0 ? "text-[#FFD700]" : "text-white"} font-bold`}>${b.amount}</div>
                  </div>
                );
              })}
            </div>
          )}
          {bids.length > 0 && !currentTeamAssigned && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={validateWin}
                disabled={validating}
                className={`px-6 py-3 rounded-xl font-bold ${validating ? "bg-gray-600 text-gray-300" : "bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"}`}
              >
                Validate Win
              </button>
              <button
                onClick={async () => {
                  try {
                    const teamId = (auctionState as AuctionStateLike)?.currentRound || "";
                    if (!teamId) return;
                    const ok = window.confirm("Cancel results and clear bids for this team?");
                    if (!ok) return;
                    const res = await fetchWithAuth("/api/validate-win", {
                      method: "POST",
                      body: JSON.stringify({ teamId, action: "cancel" }),
                    });
                    if (!res.ok) {
                      const msg = await res.text();
                      alert(`Failed to cancel: ${msg}`);
                      return;
                    }
                    setBids([]); // unlock Start form immediately
                  } catch (e) {
                    console.error(e);
                    alert("Failed to cancel");
                  }
                }}
                className="px-6 py-3 rounded-xl font-bold bg-gray-700 text-white hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
