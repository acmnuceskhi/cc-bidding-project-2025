"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type {
  AppState,
  ServerToClientEvents,
  ClientToServerEvents,
  AuctionState,
} from "@/types/socket";

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentState, setCurrentState] = useState<AppState | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [allTeams, setAllTeams] = useState<Array<{ teamId: string; name?: string | null; rank: number; batch?: string | null; houseId?: string | null }>>([]);
  const [myTeams, setMyTeams] = useState<Array<{ teamId: string; name?: string | null; rank: number; batch?: string | null }>>([]);
  const [serverConfig, setServerConfig] = useState<any | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [socketObj, setSocketObj] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  useEffect(() => {
    // Ensure a singleton socket exists
    if (!socketRef.current) {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") : null;
      socketRef.current = io({
        path: "/socket.io",
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ["websocket", "polling"],
        auth: token ? { token } : undefined,
      });
    }

    const socket = socketRef.current!;
    setSocketObj(socket);

    const handleConnect = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("Socket connected");
      }
      setIsConnected(true);
      setIsReconnecting(false);
      // Request an authoritative snapshot for THIS hook instance
      socket.emit("request-state", async (snapshot: AuctionState) => {
        if (process.env.NODE_ENV === "development") {
          console.log("request-state ack:", snapshot);
        }
        const isEmpty =
          (!snapshot.currentRound || snapshot.currentRound === "") &&
          !snapshot.auctionStartTime &&
          !snapshot.auctionEndTime &&
          !snapshot.currentRoundStartTime &&
          !snapshot.currentRoundEndTime;
        if (isEmpty) {
          try {
            const res = await fetch("/api/config", { cache: "no-store" });
            if (res.ok) {
              const cfg = await res.json();
              setAuctionState({
                currentRound: cfg.currentRound || "",
                auctionStartTime: cfg.auctionStartTime || null,
                auctionEndTime: cfg.auctionEndTime || null,
                currentRoundStartTime: cfg.currentRoundStartTime || null,
                currentRoundEndTime: cfg.currentRoundEndTime || null,
                serverTime: Date.now(),
              });
              return;
            }
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.warn("/api/config fallback failed", e);
            }
          }
        }
        setAuctionState(snapshot);
      });
    };

    const handleDisconnect = (reason: string) => {
      if (process.env.NODE_ENV === "development") {
        console.log("Socket disconnected:", reason);
      }
      setIsConnected(false);
    };

    const handleStateUpdate = (state: AppState) => {
      if (process.env.NODE_ENV === "development") {
        console.log("State update received:", state);
      }
      setCurrentState(state);
    };

    const handleAuctionState = (data: AuctionState) => {
      if (process.env.NODE_ENV === "development") {
        console.log("Auction state received:", data);
      }
      setAuctionState(data);
    };

    const handleTeamsUpdate = (data: { teams: Array<{ teamId: string; name?: string | null; rank: number; batch?: string | null; houseId?: string | null }> }) => {
      if (Array.isArray(data?.teams)) {
        setAllTeams(data.teams);
      }
    };

    const handleHouseTeamsUpdate = (data: { houseId: string; teams: Array<{ teamId: string; name?: string | null; rank: number; batch?: string | null }> }) => {
      if (Array.isArray(data?.teams)) {
        setMyTeams(data.teams);
      }
    };

    const handleConfigUpdate = (data: any) => {
      setServerConfig(data || null);
    };

    // Attach per-instance listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("state-update", handleStateUpdate);
    socket.on("auction-state", handleAuctionState);
    socket.on("teams-update", handleTeamsUpdate);
    socket.on("house-teams-update", handleHouseTeamsUpdate);
    socket.on("config-update", handleConfigUpdate);

    // If already connected (because another hook created it), request state immediately
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("state-update", handleStateUpdate);
      socket.off("auction-state", handleAuctionState);
      socket.off("teams-update", handleTeamsUpdate);
      socket.off("house-teams-update", handleHouseTeamsUpdate);
      socket.off("config-update", handleConfigUpdate);
      setSocketObj(null);
    };
  }, []);

  // If token appears later (e.g., after login), update auth and reconnect to join rooms
  useEffect(() => {
    const s = socketRef.current;
    if (!s || typeof window === "undefined") return;
    const token = sessionStorage.getItem("token");
    // If we have a token and it's different from current auth, refresh connection
    if (token && (!s.auth || (s.auth as any).token !== token)) {
      s.auth = { token } as any;
      if (s.connected) {
        try { s.disconnect(); } catch { }
      }
      try { s.connect(); } catch { }
    }
  });

  const emit = <K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) => {
    if (socketRef.current) {
      socketRef.current.emit(event, ...args);
    }
  };


  return {
    socket: socketObj,
    isConnected,
    isReconnecting,
    currentState,
    auctionState,
    emit,
    requestState: () => {
      if (socketRef.current) {
        socketRef.current.emit("request-state", (snapshot: AuctionState) => {
          setAuctionState(snapshot);
        });
      }
    },
    allTeams,
    myTeams,
    serverConfig,
  };
}
