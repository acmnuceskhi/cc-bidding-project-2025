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

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  let currentState = {
    screen: "waiting",
    message: "Waiting for admin to start...",
  };

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send current state to newly connected client
    socket.emit("state-update", currentState);

    // Admin actions
    socket.on("admin:start-round", (data) => {
      console.log("Admin starting round:", data);
      currentState = {
        screen: "bidding",
        roundId: data.roundId,
        participantId: data.participantId,
        participant: data.participant,
        timerEnd: data.timerEnd,
      };
      io.emit("state-update", currentState);
    });

    socket.on("admin:end-round", (data) => {
      console.log("Admin ending round:", data);
      currentState = {
        screen: "results",
        roundId: data.roundId,
        winner: data.winner,
        losers: data.losers,
        participant: data.participant,
      };
      io.emit("state-update", currentState);
    });

    socket.on("admin:show-waiting", (data) => {
      console.log("Admin showing waiting screen");
      currentState = {
        screen: "waiting",
        message: data.message || "Waiting for next round...",
      };
      io.emit("state-update", currentState);
    });

    socket.on("bid-placed", (data) => {
      console.log("Bid placed:", data);
      io.emit("bid-notification", {
        houseId: data.houseId,
        houseName: data.houseName,
        roundId: data.roundId,
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
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
