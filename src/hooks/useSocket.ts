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
    if (!socketRef.current) {
      socketRef.current = io({
        path: "/socket.io",
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ["websocket", "polling"],
      });

      const socket = socketRef.current;
      setSocketObj(socket);

      const handleConnect = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("Socket connected");
        }
        setIsConnected(true);
        setIsReconnecting(false);
        // Request an authoritative snapshot via socket ack (no /status fetch)
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

      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("state-update", handleStateUpdate);
      socket.on("auction-state", handleAuctionState);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("connect");
        socketRef.current.off("disconnect");
        socketRef.current.off("state-update");
        socketRef.current.off("auction-state");
        // No additional engine event cleanup
      }
      setSocketObj(null);
    };
  }, []);

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
  };
}
