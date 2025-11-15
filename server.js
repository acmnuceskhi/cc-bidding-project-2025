const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname =
  process.env.HOST || (dev ? "localhost" : "0.0.0.0");

const app = next({ dev });
const handle = app.getRequestHandler();

// Build current state from database (stateless approach)
async function buildStateFromDB() {
  try {
    const baseUrl = `http://${hostname}:${port}`;
    const response = await fetch(`${baseUrl}/api/status`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Status API returned ${response.status}`);
    }

    const statusData = await response.json();

    // Convert status API response to socket state format
    if (statusData.roundStatus === "active" && statusData.roundId) {
      const timeLeft = statusData.timerEnd
        ? Math.max(0, new Date(statusData.timerEnd).getTime() - Date.now())
        : 0;

      return {
        screen: "bidding",
        roundId: statusData.roundId,
        teamId: statusData.team?.teamId || "",
        timeLeft,
      };
    }

    // Check if round just ended (has winner data)
    if (statusData.roundEnded && statusData.winner) {
      return {
        screen: "results",
        roundId: statusData.roundId || null,
        winner: statusData.winner
          ? {
              houseId: statusData.winner.houseId || "",
              houseName: statusData.winner.houseName || "",
              amount: statusData.winner.amount || 0,
              timestamp: new Date().toISOString(),
            }
          : null,
        losers: statusData.allBids
          ? statusData.allBids
              .filter(
                (bid) =>
                  bid.houseId !== statusData.winner?.houseId &&
                  bid.amount !== statusData.winner?.amount
              )
              .map((bid) => ({
                houseId: bid.houseId || "",
                amount: bid.amount || 0,
                timestamp: bid.timestamp || new Date().toISOString(),
              }))
          : [],
      };
    }

    // Default to waiting screen
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
    transports: ["websocket", "polling"],
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    if (dev) {
      console.log("Client connected:", socket.id);
    }

    // Fetch current state from database and send to newly connected client
    setTimeout(async () => {
      try {
        const currentState = await buildStateFromDB();
        socket.emit("state-update", currentState);
      } catch (error) {
        if (dev) {
          console.error("Error sending initial state:", error);
        }
        socket.emit("state-update", {
          screen: "waiting",
          message: "Waiting for admin to start...",
        });
      }
    }, 100);

    // Admin actions - these will trigger broadcasts
    socket.on("admin:start-round", async (data) => {
      if (dev) {
        console.log("Admin starting round:", data);
      }
      const state = await buildStateFromDB();
      io.emit("state-update", state);
      io.emit("round-started", {
        roundId: data.roundId,
        timerEnd: data.timerEnd,
      });
    });

    socket.on("admin:end-round", async (data) => {
      if (dev) {
        console.log("Admin ending round:", data);
      }
      const state = await buildStateFromDB();
      io.emit("state-update", state);
      io.emit("round-ended", {
        roundId: data.roundId,
        winner: data.winner,
        losers: data.losers,
      });
    });

    socket.on("admin:show-waiting", async (data) => {
      if (dev) {
        console.log("Admin showing waiting screen");
      }
      const state = {
        screen: "waiting",
        message: data.message || "Waiting for next round...",
      };
      io.emit("state-update", state);
    });

    socket.on("bid-placed", (data) => {
      if (dev) {
        console.log("Bid placed:", data);
      }
      io.emit("bid-notification", {
        houseId: data.houseId,
        houseName: data.houseName,
        roundId: data.roundId,
      });
    });

    socket.on("disconnect", () => {
      if (dev) {
        console.log("Client disconnected:", socket.id);
      }
    });
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
    httpServer.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully...");
    httpServer.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  });
});
