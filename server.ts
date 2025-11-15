import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { setSocketInstance } from "@/lib/socket-instance";
import { Rounds } from "@/lib/models/rounds";
import { Teams } from "@/lib/models/teams";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { buildProjectorData } from "@/lib/socket-projector-data";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname =
  process.env.HOST || (dev ? "localhost" : "0.0.0.0");

const app = next({ dev });
const handle = app.getRequestHandler();

// Build current state from database (stateless approach)
async function buildStateFromDB() {
  try {
    const activeRounds = await Rounds.getActive();

    if (activeRounds.length === 0) {
      return {
        screen: "waiting",
        message: "Waiting for admin to start...",
      };
    }

    const activeRound = activeRounds[0];
    const roundId = activeRound._id?.toString();

    if (!roundId) {
      return {
        screen: "waiting",
        message: "Waiting for admin to start...",
      };
    }

    const timeLeft = activeRound.timerEnd
      ? Math.max(0, activeRound.timerEnd.getTime() - Date.now())
      : 0;

    if (activeRound.status === "active" && timeLeft > 0) {
      return {
        screen: "bidding",
        roundId,
        teamId: activeRound.teamId?.toString() || "",
        timeLeft,
      };
    }

    if (activeRound.status === "completed") {
      const bids = await Bids.getLatestBidPerHouseForRound(roundId);

      if (bids.length > 0) {
        const winningBid = bids.reduce((winner, current) => {
          if (current.amount > winner.amount) return current;
          if (
            current.amount === winner.amount &&
            current.timestamp < winner.timestamp
          )
            return current;
          return winner;
        });

        const winningHouse = await Houses.getById(winningBid.houseId.toString());

        const allBidsData = bids.map((bid) => ({
          houseId: bid.houseId.toString(),
          amount: bid.amount,
          timestamp: bid.timestamp?.toISOString() || new Date().toISOString(),
        }));

        return {
          screen: "results",
          roundId,
          winner: winningHouse
            ? {
                houseId: winningBid.houseId.toString(),
                houseName: winningHouse.name,
                amount: winningBid.amount,
                timestamp: winningBid.timestamp?.toISOString() || new Date().toISOString(),
              }
            : null,
          losers: allBidsData.filter(
            (bid) =>
              bid.houseId !== winningBid.houseId.toString() ||
              bid.amount !== winningBid.amount
          ),
        };
      }
    }

    return {
      screen: "waiting",
      message: "Waiting for admin to start...",
    };
  } catch (error) {
    if (dev) {
      console.error("Error building state from DB:", error);
    }
    return {
      screen: "waiting",
      message: "Waiting for admin to start...",
    };
  }
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      if (dev) {
        console.error("Error occurred handling", req.url, err);
      }
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Production-ready Socket.IO configuration
  const corsOrigin =
    process.env.NODE_ENV === "production" && process.env.RENDER_EXTERNAL_URL
      ? [process.env.RENDER_EXTERNAL_URL]
      : "*";

  const io = new Server(httpServer, {
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e6,
    transports: ["websocket", "polling"],
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  // Export socket instance for use in API routes
  setSocketInstance(io);

  io.on("connection", async (socket) => {
    if (dev) {
      console.log("Client connected:", socket.id);
    }

    try {
      // Send both legacy state-update and new projector-update
      const currentState = await buildStateFromDB();
      socket.emit("state-update", currentState);
      
      // Also send full projector data for projector page
      const projectorData = await buildProjectorData();
      socket.emit("projector-update", projectorData);
    } catch (error) {
      if (dev) {
        console.error("Error sending initial state:", error);
      }
      socket.emit("state-update", {
        screen: "waiting",
        message: "Waiting for admin to start...",
      });
      // Try to send projector data even on error (may have partial data)
      try {
        const projectorData = await buildProjectorData();
        socket.emit("projector-update", projectorData);
      } catch (projectorError) {
        if (dev) {
          console.error("Error sending initial projector data:", projectorError);
        }
      }
    }

    socket.on("bid-placed", (data) => {
      try {
        if (dev) {
          console.log("Bid placed:", data);
        }
        io.emit("bid-notification", {
          houseId: data.houseId,
          houseName: data.houseName,
          roundId: data.roundId,
        });
      } catch (error) {
        if (dev) {
          console.error("Error handling bid-placed event:", error);
        }
      }
    });

    socket.on("disconnect", (reason) => {
      if (dev) {
        console.log("Client disconnected:", socket.id, "Reason:", reason);
      }
    });

    socket.on("error", (error) => {
      if (dev) {
        console.error("Socket error:", socket.id, error);
      }
    });
  });

  io.engine.on("connection_error", (err) => {
    if (dev) {
      console.error("Socket.IO connection error:", err);
    }
  });

  httpServer
    .once("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running`);
      console.log(`> Environment: ${dev ? "development" : "production"}`);
    });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully...");
    io.close(() => {
      httpServer.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully...");
    io.close(() => {
      httpServer.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
    });
  });
});

