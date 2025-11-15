"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type {
  AppState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/types/socket";

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentState, setCurrentState] = useState<AppState | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
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

      const handleConnect = async () => {
        if (process.env.NODE_ENV === "development") {
          console.log("Socket connected");
        }
        setIsConnected(true);
        setIsReconnecting(false);

        try {
          const res = await fetch("/api/status", { cache: "no-store" });
          const freshState = await res.json();
          if (freshState.roundStatus === "active" && freshState.roundId) {
            const timeLeft = freshState.timerEnd
              ? Math.max(0, new Date(freshState.timerEnd).getTime() - Date.now())
              : 0;
            setCurrentState({
              screen: "bidding",
              roundId: freshState.roundId,
              teamId: freshState.team?.teamId || "",
              timeLeft,
            });
          } else if (freshState.roundEnded && freshState.winner) {
            setCurrentState({
              screen: "results",
              roundId: freshState.roundId || null,
              winner: freshState.winner
                ? {
                    houseId: freshState.winner.houseId || "",
                    houseName: freshState.winner.houseName || "",
                    amount: freshState.winner.amount || 0,
                    timestamp: new Date().toISOString(),
                  }
                : null,
              losers: freshState.allBids || [],
            });
          } else {
            setCurrentState({
              screen: "waiting",
              message: "Waiting for admin to start...",
            });
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error syncing state after reconnect:", error);
          }
        }
      };

      const handleDisconnect = (reason: string) => {
        if (process.env.NODE_ENV === "development") {
          console.log("Socket disconnected:", reason);
        }
        setIsConnected(false);
      };

      const handleReconnectAttempt = () => {
        setIsReconnecting(true);
      };

      const handleReconnectFailed = () => {
        setIsReconnecting(false);
        if (process.env.NODE_ENV === "development") {
          console.warn("Socket reconnection failed");
        }
      };

      const handleStateUpdate = (state: AppState) => {
        if (process.env.NODE_ENV === "development") {
          console.log("State update received:", state);
        }
        setCurrentState(state);
      };

      const handleError = (error: Error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Socket error:", error);
        }
      };

      const handleConnectError = (error: Error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Socket connection error:", error);
        }
      };

      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("reconnect_attempt" as any, handleReconnectAttempt);
      socket.on("reconnect_failed" as any, handleReconnectFailed);
      socket.on("state-update", handleStateUpdate);
      socket.on("error" as any, handleError);
      socket.on("connect_error", handleConnectError);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("connect");
        socketRef.current.off("disconnect");
        socketRef.current.off("reconnect_attempt" as any);
        socketRef.current.off("reconnect_failed" as any);
        socketRef.current.off("state-update");
        socketRef.current.off("error" as any);
        socketRef.current.off("connect_error");
      }
    };
  }, []);

  const emit = <K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) => {
    if (socketRef.current) {
      socketRef.current.emit(event, ...(args as any));
    }
  };

  const on = <K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback as any);
      return () => {
        socketRef.current?.off(event, callback as any);
      };
    }
    return () => {};
  };

  return {
    socket: socketRef.current,
    isConnected,
    isReconnecting,
    currentState,
    emit,
    on,
  };
}
