import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { Rounds } from "./models/rounds";
import { Participants } from "./models/participants";
import { Houses } from "./models/houses";
import { Bids } from "./models/bids";

export type AppState =
  | { screen: "waiting"; message: string }
  | {
      screen: "bidding";
      roundId: string;
      participantId: string;
      timeLeft: number;
    }
  | { screen: "results"; roundId: string; winner: any; losers: any[] };

let io: SocketIOServer | null = null;
let currentState: AppState = {
  screen: "waiting",
  message: "Waiting for admin to start...",
};

export function initializeSocket(httpServer: HTTPServer) {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send current state to newly connected client
    socket.emit("state-update", currentState);

    // Handle admin actions
    socket.on("admin:start-round", async (data) => {
      try {
        const { roundId } = data;
        const round = await Rounds.getById(roundId);

        if (round) {
          const participant = await Participants.getById(
            round.participantId.toString()
          );

          currentState = {
            screen: "bidding",
            roundId: roundId,
            participantId: round.participantId.toString(),
            timeLeft: Math.max(0, round.timerEnd.getTime() - Date.now()),
          };

          // Broadcast to all clients
          io?.emit("state-update", currentState);
          io?.emit("round-started", {
            roundId,
            participant,
            timerEnd: round.timerEnd,
          });
        }
      } catch (error) {
        console.error("Error starting round:", error);
      }
    });

    socket.on("admin:end-round", async (data) => {
      try {
        const { roundId, winner, losers } = data;

        currentState = {
          screen: "results",
          roundId,
          winner,
          losers,
        };

        // Broadcast to all clients
        io?.emit("state-update", currentState);
        io?.emit("round-ended", { roundId, winner, losers });
      } catch (error) {
        console.error("Error ending round:", error);
      }
    });

    socket.on("bid-placed", async (data) => {
      // Broadcast bid notification (without amount for privacy)
      io?.emit("bid-notification", {
        houseId: data.houseId,
        houseName: data.houseName,
        roundId: data.roundId,
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

export function getCurrentState() {
  return currentState;
}

export function updateState(newState: AppState) {
  currentState = newState;
  io?.emit("state-update", currentState);
}
