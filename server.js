/* eslint-disable */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { setSocketInstance } = require("./src/lib/socket-instance");
const jwt = require("jsonwebtoken");

// Import shared MongoDB connection from src/lib/mongodb.ts
// This eliminates duplicate connection pools (was creating 2x10 connections)
const getMongoClient = async () => {
  const clientPromise = require("./src/lib/mongodb").default;
  return await clientPromise;
};

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname =
  process.env.HOST || (dev ? "localhost" : "0.0.0.0");

const app = next({ dev });
const handle = app.getRequestHandler();

// Build current state from config (authoritative five fields)
async function buildAuctionStateFromConfig() {
  try {
    const client = await getMongoClient();
    const collection = client.db().collection("config");
    const CONFIG_ID = "auction-config";
    const doc = await collection.findOne({ _id: CONFIG_ID });

    const normalizeDate = (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (v instanceof Date) return v;
      if (typeof v === "number") return new Date(v);
      if (typeof v === "string") {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      }
      if (v && typeof v === "object" && typeof v.toDate === "function") {
        try {
          const d = v.toDate();
          return d instanceof Date ? d : null;
        } catch {
          return null;
        }
      }
      return null;
    };

    const state = doc || {};
    const auctionStartTime = normalizeDate(state.auctionStartTime);
    const auctionEndTime = normalizeDate(state.auctionEndTime);
    const currentRoundStartTime = normalizeDate(state.currentRoundStartTime);
    const currentRoundEndTime = normalizeDate(state.currentRoundEndTime);

    return {
      currentRound: state.currentRound || "",
      auctionStartTime: auctionStartTime ? auctionStartTime.toISOString() : null,
      auctionEndTime: auctionEndTime ? auctionEndTime.toISOString() : null,
      currentRoundStartTime: currentRoundStartTime ? currentRoundStartTime.toISOString() : null,
      currentRoundEndTime: currentRoundEndTime ? currentRoundEndTime.toISOString() : null,
      serverTime: Date.now(),
    };
  } catch (error) {
    if (dev) {
      console.error("Error building auction state from config:", error);
    }
    return {
      currentRound: "",
      auctionStartTime: null,
      auctionEndTime: null,
      currentRoundStartTime: null,
      currentRoundEndTime: null,
      serverTime: Date.now(),
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
  // Support both Heroku and Render deployments
  // Priority: EXTERNAL_URL (unified) > RENDER_EXTERNAL_URL > HEROKU_EXTERNAL_URL
  let corsOrigin = "*";
  if (process.env.NODE_ENV === "production") {
    const origins = [];
    
    // Unified environment variable (works for both platforms)
    if (process.env.EXTERNAL_URL) {
      origins.push(process.env.EXTERNAL_URL);
    }
    
    // Platform-specific variables (fallback)
    if (process.env.RENDER_EXTERNAL_URL) {
      origins.push(process.env.RENDER_EXTERNAL_URL);
    }
    if (process.env.HEROKU_EXTERNAL_URL) {
      origins.push(process.env.HEROKU_EXTERNAL_URL);
    }
    
    // If we have any production origins, use them; otherwise allow all (dev mode)
    if (origins.length > 0) {
      corsOrigin = origins;
    }
  }

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

  // Authenticate sockets and join rooms
  io.use((socket, next) => {
    try {
      const token = socket.handshake?.auth?.token;
      if (!token) return next();
      const secret = process.env.JWT_SECRET || "fallback-secret-key";
      const payload = jwt.verify(token, secret);
      socket.data.user = payload || null;
      return next();
    } catch (e) {
      // Allow connection but without privileged rooms
      return next();
    }
  });

  io.on("connection", async (socket) => {
    if (dev) {
      console.log("Client connected:", socket.id);
    }

    // Join role-based rooms for targeted events
    try {
      const payload = socket.data?.user;
      if (payload?.role === "house_captain" && payload.houseId) {
        socket.join(`house:${payload.houseId}`);
      }
      if (payload?.role === "admin") {
        socket.join("admins");
      }
    } catch { }

    try {
      const currentState = await buildAuctionStateFromConfig();
      socket.emit("auction-state", currentState);
    } catch (error) {
      if (dev) {
        console.error("Error sending initial auction state:", error);
      }
      socket.emit("auction-state", {
        currentRound: "",
        auctionStartTime: null,
        auctionEndTime: null,
        currentRoundStartTime: null,
        currentRoundEndTime: null,
        serverTime: Date.now(),
      });
    }

    // Send the full configuration snapshot to the connecting client so
    // the client can compute bidding constraints from authoritative values
    try {
      const client = await getMongoClient();
      const cfgCol = client.db().collection("config");
      const cfg = await cfgCol.findOne({ _id: "auction-config" });
      if (cfg) {
        const safe = {
          ...cfg,
          auctionStartTime: cfg.auctionStartTime ? (new Date(cfg.auctionStartTime)).toISOString() : null,
          auctionEndTime: cfg.auctionEndTime ? (new Date(cfg.auctionEndTime)).toISOString() : null,
          currentRoundStartTime: cfg.currentRoundStartTime ? (new Date(cfg.currentRoundStartTime)).toISOString() : null,
          currentRoundEndTime: cfg.currentRoundEndTime ? (new Date(cfg.currentRoundEndTime)).toISOString() : null,
        };
        socket.emit("config-update", safe);
      }
    } catch (e) {
      if (dev) console.warn("Failed to send initial config-update to client", e);
    }

    // Send initial teams state snapshot based on role
    try {
      const payload = socket.data?.user;
      const client = await getMongoClient();
      const teamsCol = client.db().collection("teams");
      const rawTeams = await teamsCol.find({}).toArray();
      const mapped = rawTeams.map((t) => ({
        teamId: t._id?.toString(),
        name: t.name || null,
        rank: t.rank,
        batch: t.batch || null,
        houseId: t.houseId ? t.houseId.toString() : null,
      }));
      if (payload?.role === "admin") {
        socket.emit("teams-update", { teams: mapped });
      }
      if (payload?.role === "house_captain" && payload.houseId) {
        const mine = mapped.filter((t) => t.houseId === payload.houseId).map((t) => ({
          teamId: t.teamId,
          name: t.name,
          rank: t.rank,
          batch: t.batch,
        }));
        socket.emit("house-teams-update", { houseId: payload.houseId, teams: mine });
      }
    } catch (e) {
      if (dev) console.warn("Initial teams snapshot failed", e);
    }

    // Allow clients to request the latest auction-state snapshot on demand
    socket.on("request-state", async (ack) => {
      try {
        const currentState = await buildAuctionStateFromConfig();
        if (typeof ack === "function") ack(currentState);
        else socket.emit("auction-state", currentState);
      } catch (err) {
        if (dev) console.error("request-state failed:", err);
      }
    });

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
