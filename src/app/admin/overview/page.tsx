"use client";

export default function OverviewPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Overview Removed</h1>
        <p className="text-gray-500">This admin overview page has been removed.</p>
      </div>
    </div>
  );
}

//   // Update ref when currentTeam changes
//   useEffect(() => {
//     currentTeamRef.current = currentTeam;
//   }, [currentTeam]);

//   // Function to get house background image
//   const getHouseBackground = (houseName: string) => {
//     const houseMap: Record<string, string> = {
//       "Lord Shen": "/lord-shen.jpg",
//       "Dragon Warrior": "/dragon-warrior.jpg",
//       "Master Oogway": "/master-oogway.jpg",
//       "Tai Lung": "/tai-lung.jpg",
//     };
//     return houseMap[houseName] || "/arena-background.jpg";
//   };

//   const fetchOverviewData = useCallback(async (showLoadingScreen = false) => {
//     try {
//       if (showLoadingScreen) {
//         setLoading(true);
//       }
//       const housesRes = await fetchWithAuth("/api/houses", {
//         cache: "no-store",
//       });
//       const housesData = await housesRes.json();

//       setHouses(housesData || []);
      
//       // Derive state from auctionState (like projector does)
//       const roundId = auctionState?.currentRound || "";
//       const now = Date.now();
//       const rStart = auctionState?.currentRoundStartTime ? new Date(auctionState.currentRoundStartTime).getTime() : null;
//       const rEnd = auctionState?.currentRoundEndTime ? new Date(auctionState.currentRoundEndTime).getTime() : null;
//       const isActive = !!(rStart && rEnd && now >= rStart && now < rEnd);
//       const isEnded = !!(roundId && rEnd && now >= rEnd);

//       if (isActive && roundId) {
//         // Populate active round
//         setActiveRound({
//           _id: roundId as unknown as any,
//           teamId: undefined as any,
//           status: "active",
//           timerEnd: rEnd ? new Date(rEnd) : null,
//         } as any);
//         lastActiveRoundIdRef.current = roundId;

//         // Fetch team directly using teamId (like projector)
//         try {
//           const teamRes = await fetchWithAuth(`/api/teams/${roundId}`, { cache: "no-store" });
//           if (teamRes.ok) {
//             const t = await teamRes.json();
//             setCurrentTeam({
//               _id: undefined,
//               teamId: t.teamId || t._id?.toString(),
//               rank: t.rank,
//               batch: t.batch,
//               memberCount: t.memberCount,
//               successfulAttempts: t.successfulAttempts,
//               totalPoints: t.totalPoints,
//             } as any);
//           } else {
//             setCurrentTeam(null);
//           }
//         } catch {
//           setCurrentTeam(null);
//         }

//         // Fetch current bids for this team
//         try {
//           const bidsRes = await fetchWithAuth(`/api/bids?teamId=${roundId}`, { cache: "no-store" });
//           const bidsData = await bidsRes.json();
//           if (Array.isArray(bidsData)) {
//             const enriched = bidsData.map((bid: any) => {
//               const house = housesData.find((h: any) => h.houseId === bid.houseId);
//               return { ...bid, houseName: house?.name || "Unknown House" };
//                     <TeamsLivePanel />
//             });
//             setCurrentBids(enriched);
//           } else {
//             setCurrentBids([]);
//           }
//         } catch {
//           setCurrentBids([]);
//         }
//       } else {
//         setActiveRound(null);
//         setCurrentTeam(null);
//         setCurrentBids([]);
//         setRoundNumber(null);

//         // If ended, show winner modal by deriving from bids
//         if (isEnded && !isWinnerShown(roundId) && roundId) {
//           try {
//             const bidsRes = await fetchWithAuth(`/api/bids?teamId=${roundId}`, { cache: "no-store" });
//             if (bidsRes.ok) {
//               const bids = await bidsRes.json();
//               const top = Array.isArray(bids) ? bids.sort((a: any, b: any) => b.amount - a.amount)[0] : null;
//               if (top) {
//                 const winningHouse = housesData.find((h: any) => h.houseId === top.houseId);
//                 // Resolve team for modal (roundId is teamId)
//                 let teamText = "Team";
//                 let teamBatch: string | undefined = undefined;
//                 let teamRank: number | undefined = undefined;
//                 try {
//                   const teamRes = await fetchWithAuth(`/api/teams/${roundId}`, { cache: "no-store" });
//                   if (teamRes.ok) {
//                     const t = await teamRes.json();
//                     teamText = `Team ${t.rank}`;
//                     teamBatch = t.batch;
//                     teamRank = t.rank;
//                   }
//                 } catch {
//                   // Ignore errors
//                 }

//                 setWinnerData({
//                   teamName: teamText,
//                   teamBatch,
//                   teamRank,
//                   memberCount: undefined,
//                   houseName: winningHouse?.name || "Unknown House",
//                   amount: top.amount,
//                 });
//                 setShowWinnerModal(true);
//                 markWinnerShown(roundId);
//                 setTimeout(() => {
//                   setShowWinnerModal(false);
//                   setWinnerData(null);
//                 }, 15000);
//               }
//             }
//           } catch (err) {
//             console.error("Error deriving winner modal:", err);
//           }
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching overview data:", error);
//     } finally {
//       setLoading(false);
//     }
//   }, [auctionState?.currentRound, auctionState?.currentRoundEndTime, auctionState?.currentRoundStartTime]);

//   useEffect(() => {
//     // Initial hydrate
//     fetchOverviewData(true);

//     if (!socket) return;

//     const refresh = () => fetchOverviewData(false);
//     const refreshBids = () => fetchOverviewData(false);

//     socket.on("round-started", refresh);
//     socket.on("round-ended", refresh);
//     socket.on("state-update", refresh);
//     socket.on("auction-state", refresh); // Add auction-state listener
//     socket.on("bid-notification", refreshBids);

//     return () => {
//       socket.off("round-started", refresh);
//       socket.off("round-ended", refresh);
//       socket.off("state-update", refresh);
//       socket.off("auction-state", refresh);
//       socket.off("bid-notification", refreshBids);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [socket]);
//   // Removed fetchOverviewData to prevent refresh loops

//   const derivedEnd = auctionState?.currentRoundEndTime
//     ? auctionState.currentRoundEndTime
//     : activeRound?.timerEnd
//     ? activeRound.timerEnd.toISOString()
//     : null;
//   const { remainingMs: syncedRemainingMs } = useSynchronizedCountdown(
//     derivedEnd
//   );
//   useEffect(() => {
//     setTimeLeft(syncedRemainingMs);
//   }, [syncedRemainingMs]);

//   // Auction-level countdown for admin banner
//   const auctionCountdownEnd = (() => {
//     if (!auctionState) return null;
//     const now = Date.now();
//     const startMs = auctionState.auctionStartTime
//       ? new Date(auctionState.auctionStartTime).getTime()
//       : null;
//     const endMs = auctionState.auctionEndTime
//       ? new Date(auctionState.auctionEndTime).getTime()
//       : null;
//     if (startMs && now < startMs) return auctionState.auctionStartTime;
//     if (endMs && now < endMs) return auctionState.auctionEndTime;
//     return null;
//   })();
//   const { remainingMs: auctionRemainingMs } = useSynchronizedCountdown(
//     auctionCountdownEnd
//   );

//   const handleStartNextRound = async () => {
//     if (isStartingRound) return;
//     setIsStartingRound(true);
//     try {
//       const response = await fetchWithAuth("/api/rounds/next/start", {
//         method: "POST",
//       });
//       const result = await response.json();
//       if (!response.ok) {
//         setIsStartingRound(false);
//         alert(result.error || result.message || "Failed to start round");
//         return;
//       }
//       await fetchOverviewData();
//       setIsStartingRound(false);
//     } catch (e: any) {
//       console.error(e);
//       alert(e.message || "Failed to start round");
//       setIsStartingRound(false);
//     }
//   };

//   // Derived live teams list (socket) sorted by rank
//   const liveTeams = (allTeams || []).slice().sort((a: any, b: any) => a.rank - b.rank);

//   // Simple component section to show teams live
//   const TeamsLivePanel = () => (
//     <div className="mt-8 bg-black/70 border border-white/10 rounded-xl p-4">
//       <h3 className="text-lg font-semibold text-white mb-3">Live Teams State</h3>
//       {liveTeams.length === 0 ? (
//         <div className="text-gray-400 text-sm">No teams loaded.</div>
//       ) : (
//         <div className="max-h-80 overflow-auto space-y-1 pr-1">
//           {liveTeams.map((t: any) => (
//             <div
//               key={t.teamId}
//               className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2 border border-white/10"
//             >
//               <div className="flex items-center gap-3 min-w-0">
//                 <span className="text-xs font-bold bg-white/20 rounded px-2 py-0.5">#{t.rank}</span>
//                 <span className="truncate font-medium text-white">{t.name || `Team ${t.rank}`}</span>
//                 {t.batch && (
//                   <span className="text-[10px] uppercase tracking-wide bg-white/10 px-2 py-0.5 rounded border border-white/20 text-gray-300">{t.batch}</span>
//                 )}
//               </div>
//               <div className="flex items-center gap-2">
//                 {t.houseId ? (
//                   <span className="text-xs bg-green-600/30 text-green-300 px-2 py-0.5 rounded border border-green-600/40">Owned</span>
//                 ) : (
//                   <span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded border border-yellow-600/40">Unowned</span>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );

//   const handleEndCurrentRound = async () => {
//     if (!activeRound?._id) return;

//     if (activeRound.status !== "active") {
//       alert("Can only end an active round");
//       return;
//     }

//     try {
//       const response = await fetchWithAuth(
//         `/api/rounds/${activeRound._id}/end`,
//         { method: "POST" }
//       );
//       const result = await response.json();

//       if (!response.ok) {
//         throw new Error(result.message || "Failed to end round");
//       }

//       if (result.winningBid && result.winningBid.houseName) {
//         console.log(
//           "Manual end - showing winner modal for:",
//           result.winningBid
//         );
//         const team = currentTeamRef.current;
//         setWinnerData({
//           teamName: `Team ${team?.rank || "?"}`,
//           teamBatch: team?.batch,
//           teamRank: team?.rank,
//           memberCount: undefined, // Will need to calculate if needed
//           houseName: result.winningBid.houseName,
//           amount: result.winningBid.amount,
//         });
//         setShowWinnerModal(true);
//         if (activeRound._id) {
//           markWinnerShown(activeRound._id.toString());
//         }

//         setTimeout(() => {
//           setShowWinnerModal(false);
//           setWinnerData(null);
//         }, 10000);
//       } else {
//         alert(result.message || "Round ended with no bids");
//       }

//       setActiveRound(null);
//       setCurrentTeam(null);
//       setTimeLeft(0);

//       setTimeout(async () => {
//         await fetchOverviewData();
//       }, 500);
//     } catch (err: any) {
//       console.error("Error ending current round:", err);
//       alert(err.message || "Failed to end round");
//     }
//   };

//   const delay = (ms: number) =>
//     new Promise((resolve) => setTimeout(resolve, ms));

//   const handleReStartRound = async () => {
//     if (!activeRound?._id) {
//       alert("No active round to restart");
//       return;
//     }

//     if (isStartingRound) return;
//     setIsStartingRound(true);

//     try {
//       // Step 1: Restart the round (refund bids, reset state)
//       const restartRes = await fetchWithAuth(
//         `/api/rounds/${activeRound._id.toString()}/restart`,
//         { method: "POST" }
//       );
//       const restartData = await restartRes.json();

//       if (!restartRes.ok) {
//         throw new Error(restartData.error || "Failed to restart round");
//       }

//       if (!restartData.canRestart) {
//         alert(restartData.message || "Round cannot be restarted");
//         setIsStartingRound(false);
//         return;
//       }

//       // Step 2: Wait a moment for the restart to complete
//       await delay(1000);

//       // Step 3: Start the round again
//       const startRes = await fetchWithAuth(
//         `/api/rounds/${activeRound._id.toString()}/start`,
//         { method: "POST" }
//       );
//       const startData = await startRes.json();

//       if (!startRes.ok) {
//         throw new Error(startData.error || startData.message || "Failed to start round");
//       }

//       // Step 4: Refresh the overview data
//       await fetchOverviewData();
      
//       alert("Round restarted successfully!");
//     } catch (e: any) {
//       console.error("Error restarting round:", e);
//       alert(e.message || "Failed to restart round");
//     } finally {
//       setIsStartingRound(false);
//     }
//   };

//   if (loading) {
//     return <FullPageSpinner message="Loading admin overview..." />;
//   }

//   return (
//     <div className="space-y-6 sm:space-y-8 pb-8">
//       {auctionState && (
//         <div className="flex justify-center">
//           <div className="inline-block px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-gray-100 text-sm">
//             {(() => {
//               const now = Date.now();
//               const startMs = auctionState.auctionStartTime ? new Date(auctionState.auctionStartTime).getTime() : null;
//               const endMs = auctionState.auctionEndTime ? new Date(auctionState.auctionEndTime).getTime() : null;
//               if (startMs && now < startMs) return `Auction starts in ${Math.max(0, Math.floor(auctionRemainingMs / 1000))}s`;
//               if (endMs && now < endMs) return `Auction live • ends in ${Math.max(0, Math.floor(auctionRemainingMs / 1000))}s`;
//               if (endMs && now >= endMs) return "Auction finished";
//               return "Auction status pending";
//             })()}
//           </div>
//         </div>
//       )}
//       {/* Round Info */}
//       <div className="bg-black/40 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
//         {activeRound ? (
//           <>
//             <div className="text-center mb-6">
//               <h2 className="text-4xl sm:text-5xl font-bold text-[#FFD700] mb-2 drop-shadow-[0_0_20px_#FFD700]">
//                 ⚔️ Round {roundNumber ?? "?"}
//               </h2>
//               <p className="text-gray-300 text-base sm:text-lg">
//                 {activeRound.status === "active"
//                   ? "Battle in Progress"
//                   : "No Active Round"}
//               </p>
//             </div>

//             <div className="text-center mb-8">
//               <div
//                 className={`text-6xl sm:text-7xl font-bold mb-4 transition-colors duration-300 ${timeLeft > 30000 ? "text-green-400" : timeLeft > 10000 ? "text-yellow-400" : "text-red-500"}`}
//               >
//                 {`${Math.floor(timeLeft / 1000)}s`}
//               </div>
//               <div className="w-full max-w-2xl mx-auto bg-gray-800 rounded-full h-6 overflow-hidden border-2 border-yellow-600">
//                 <div
//                   className={`h-full transition-all duration-1000 ${
//                     timeLeft > 30000
//                       ? "bg-green-500"
//                       : timeLeft > 10000
//                         ? "bg-yellow-500"
//                         : "bg-red-500"
//                   }`}
//                   style={{ width: `${(timeLeft / 60000) * 100}%` }}
//                 ></div>
//               </div>
//             </div>

//             {currentTeam && (
//               <div className="bg-black/60 rounded-xl p-6 text-center border-2 border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)] backdrop-blur-md">
//                 <h3 className="text-xl sm:text-2xl font-bold text-[#FFD700] mb-4 drop-shadow-[0_0_15px_#FFD700]">
//                   👥 Current Team
//                 </h3>
//                 <div className="flex flex-col items-center justify-center gap-4">
//                   <div className="text-center">
//                     <p className="text-2xl sm:text-3xl font-bold text-white">
//                       {currentTeam.batch ? `Batch ${currentTeam.batch} #${currentTeam.rank || roundNumber || "?"}` : `Team #${currentTeam.rank || roundNumber || "?"}`}
//                     </p>
//                     <p className="text-gray-300 mt-2">
//                       Awaiting house bids...
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Current Bids Display */}
//             {activeRound && currentBids.length > 0 && (
//               <div className="bg-black/60 rounded-xl p-6 border-2 border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)] backdrop-blur-md mt-6">
//                 <h3 className="text-xl sm:text-2xl font-bold text-[#FFD700] mb-4 text-center drop-shadow-[0_0_15px_#FFD700]">
//                   💰 Current Bids
//                 </h3>
//                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//                   {currentBids
//                     .sort((a, b) => b.amount - a.amount) // Sort highest to lowest
//                     .map((bid, index) => (
//                       <div
//                         key={bid._id || index}
//                         className={`bg-black/60 rounded-lg p-4 border-2 ${
//                           index === 0
//                             ? "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]"
//                             : "border-[#FFD700]/30"
//                         }`}
//                       >
//                         <div className="text-center">
//                           <div className="text-lg font-bold text-white mb-2">
//                             {bid.houseName}
//                           </div>
//                           <div
//                             className={`text-3xl font-bold ${
//                               index === 0 ? "text-green-400" : "text-[#FFD700]"
//                             } drop-shadow-[0_0_10px_currentColor]`}
//                           >
//                             ${bid.amount}
//                           </div>
//                           {index === 0 && (
//                             <div className="text-green-400 text-sm mt-2 font-semibold">
//                               🏆 Leading
//                             </div>
//                           )}
//                         </div>
//                       </div>
//                     ))}
//                 </div>
//               </div>
//             )}
//           </>
//         ) : (
//           <div className="text-center text-gray-400 text-xl sm:text-2xl py-10">
//             No active round currently.
//           </div>
//         )}
//       </div>

//       {/* House Treasuries with Backgrounds */}
//       <div className="bg-black/40 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
//         <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
//           🏯 House Treasuries
//         </h2>
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
//           {houses.map((house, index) => {
//             const percentage =
//               (house.remainingBudget / house.totalBudget) * 100;

//             return (
//               <div
//                 key={house._id?.toString() || `house-${index}`}
//                 className="relative rounded-xl p-6 border-2 border-[#FFD700]/50 shadow-[0_0_25px_rgba(255,215,0,0.3)] transform hover:scale-105 transition-all overflow-hidden"
//                 style={{
//                   backgroundImage: `url('${getHouseBackground(house.name)}')`,
//                   backgroundSize: "cover",
//                   backgroundPosition: "center",
//                 }}
//               >
//                 {/* Opacity overlay */}
//                 <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"></div>

//                 {/* Content */}
//                 <div className="relative z-10">
//                   <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 text-center drop-shadow-[0_0_15px_#000000]">
//                     {house.name}
//                   </h3>
//                   <div className="text-center mb-4">
//                     <div className="text-3xl sm:text-4xl font-bold text-[#FFD700] drop-shadow-[0_0_15px_#FFD700]">
//                       ${house.remainingBudget}
//                     </div>
//                     <div className="text-sm text-gray-200">
//                       of ${house.totalBudget}
//                     </div>
//                   </div>
//                   <div className="w-full bg-black/60 rounded-full h-4 overflow-hidden border border-[#FFD700]/30">
//                     <div
//                       className="bg-[#FFD700] h-full rounded-full transition-all shadow-[0_0_10px_#FFD700]"
//                       style={{ width: `${percentage}%` }}
//                     ></div>
//                   </div>
//                   <div className="text-center mt-2 text-sm text-gray-200">
//                     {percentage.toFixed(0)}% remaining
//                   </div>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </div>

//       {/* Quick Actions */}
//       <div className="bg-black/40 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700]/50 shadow-[0_0_30px_rgba(255,215,0,0.3)] backdrop-blur-md">
//         <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-6 text-center drop-shadow-[0_0_20px_#FFD700]">
//           ⚡ Quick Actions
//         </h2>
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           <button
//             onClick={handleStartNextRound}
//             disabled={!!activeRound || isStartingRound}
//             className={`bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
//           >
//             {isStartingRound ? "⏳ Starting..." : "Start Next Round"}
//           </button>
//           <button
//             onClick={handleEndCurrentRound}
//             disabled={!activeRound || timeLeft === 0}
//             className={`bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-6 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
//           >
//             End Current Round
//           </button>
//           <button
//             onClick={handleReStartRound}
//             disabled={!activeRound || isStartingRound}
//             className="bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
//           >
//             {isStartingRound ? "⏳ Restarting..." : "Restart Round"}
//           </button>
//         </div>
//       </div>

//       {/* Winner Modal - Neon Theme */}
//       {showWinnerModal && winnerData && (
//         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
//           <div className="bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 sm:p-8 border-2 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.4)] max-w-2xl w-full mx-4 relative overflow-hidden animate-slide-up">
//             {/* Subtle grid overlay */}
//             <div className="absolute inset-0 bg-[linear-gradient(to_right,#FFD70005_1px,transparent_1px),linear-gradient(to_bottom,#FFD70005_1px,transparent_1px)] bg-size-[3rem_3rem] opacity-20"></div>

//             <div className="relative z-10 text-center">
//               <h1 className="text-4xl sm:text-5xl font-bold text-[#FFD700] mb-6 drop-shadow-[0_0_20px_#FFD700]">
//                 🏆 SOLD! 🏆
//               </h1>

//               <div className="bg-black/40 rounded-xl p-6 mb-6 border border-[#FFD700]/40 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
//                 <div className="text-5xl mb-4">👥</div>
//                 <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 drop-shadow-[0_0_15px_#FFFFFF]">
//                   {winnerData.teamName}
//                 </h2>
//                 {winnerData.teamBatch && winnerData.teamRank && (
//                   <p className="text-lg text-gray-300 mb-2">
//                     Batch {winnerData.teamBatch} #{winnerData.teamRank}
//                   </p>
//                 )}
//                 {winnerData.memberCount && (
//                   <p className="text-sm text-gray-400 mb-3">
//                     {winnerData.memberCount} members
//                   </p>
//                 )}
//                 <p className="text-xl text-gray-300">
//                   has been won by
//                 </p>
//               </div>

//               <div className="bg-linear-to-r from-green-900/50 to-emerald-900/50 rounded-xl p-6 border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.3)]">
//                 <h3 className="text-3xl sm:text-4xl font-bold text-[#FFD700] mb-3 drop-shadow-[0_0_20px_#FFD700]">
//                   🏯 {winnerData.houseName}
//                 </h3>
//                 <div className="text-3xl sm:text-4xl font-bold text-white drop-shadow-[0_0_15px_#FFFFFF]">
//                   for ${winnerData.amount}
//                 </div>
//               </div>

//               <button
//                 onClick={() => {
//                   setShowWinnerModal(false);
//                   setWinnerData(null);
//                 }}
//                 className="mt-6 bg-[#FFD700] hover:bg-[#FFB800] text-black font-bold py-2 px-6 rounded-lg text-lg transition-all shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:shadow-[0_0_30px_rgba(255,215,0,0.6)] transform hover:scale-105"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
      
//       <style jsx>{`
//         @keyframes slide-up {
//           from {
//             transform: translateY(100%);
//             opacity: 0;
//           }
//           to {
//             transform: translateY(0);
//             opacity: 1;
//           }
//         }
//         @keyframes fade-in {
//           from {
//             opacity: 0;
//           }
//           to {
//             opacity: 1;
//           }
//         }
//         .animate-slide-up {
//           animation: slide-up 0.4s ease-out;
//         }
//         .animate-fade-in {
//           animation: fade-in 0.3s ease-out;
//         }
//       `}</style>
//     </div>
//   );
// }
