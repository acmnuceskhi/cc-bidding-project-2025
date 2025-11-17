"use client";

export default function RoundsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Rounds Page Removed</h1>
        <p className="text-gray-500">This admin page has been removed.</p>
      </div>
    </div>
  );
                    <button
                      onClick={() => handleStartRound(round._id)}
                      className="bg-green-600/90 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.5)] transform hover:scale-105"
                    >
                      Start Round
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for View Details */}
      {selectedRound && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-900 to-black text-white rounded-2xl p-8 w-11/12 md:w-2/3 lg:w-1/2 relative border-2 border-[#FFD700]/50 shadow-[0_0_40px_rgba(255,215,0,0.4)]">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-3xl font-bold hover:text-[#FFD700] transition-colors drop-shadow-[0_0_10px_#FFD700]"
            >
              ✖
            </button>
            <h2 className="text-4xl font-bold mb-6 text-[#FFD700] drop-shadow-[0_0_20px_#FFD700]">
              Round {selectedRound.roundNumber} Details
            </h2>
            <div className="space-y-4 text-lg">
              <p>
                <strong className="text-[#FFD700]">Team:</strong>{" "}
                <span className="text-white">
                  Team #{selectedRound.teamRank}
                </span>
              </p>
              {selectedRound.teamBatch && (
                <p>
                  <strong className="text-[#FFD700]">Batch:</strong>{" "}
                  <span className="text-white">
                    {selectedRound.teamBatch}
                  </span>
                </p>
              )}
              {selectedRound.winnerHouse && (
                <p>
                  <strong className="text-[#FFD700]">Winner House:</strong>{" "}
                  <span className="text-white">
                    {selectedRound.winnerHouse}
                  </span>
                </p>
              )}
              {selectedRound.winningBid !== undefined ? (
                <p>
                  <strong className="text-[#FFD700]">Winning Bid:</strong>{" "}
                  <span className="text-green-400 font-bold text-2xl drop-shadow-[0_0_10px_#22C55E]">
                    ${selectedRound.winningBid}
                  </span>
                </p>
              ) : selectedRound.status === "completed" ? (
                <p className="text-gray-400">No bids placed</p>
              ) : null}
              <p>
                <strong className="text-[#FFD700]">Status:</strong>{" "}
                <span className="text-white">
                  {getStatusText(selectedRound.status)}
                </span>
              </p>
              {selectedRound.timerEnd && (
                <p>
                  <strong className="text-[#FFD700]">Timer End:</strong>{" "}
                  <span className="text-white">
                    {selectedRound.timerEnd.toLocaleString()}
                  </span>
                </p>
              )}
            </div>
            <button
              onClick={closeModal}
              className="mt-6 bg-gradient-to-r from-[#FFD700] to-[#FFB800] text-black font-bold py-3 px-8 rounded-lg transition-all shadow-[0_0_20px_rgba(255,215,0,0.5)] transform hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
