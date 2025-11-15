"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentState, setCurrentState] = useState<any>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    if (!socket) {
      socket = io({
        path: "/socket.io",
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ["websocket", "polling"],
      });

      socket.on("connect", async () => {
        if (process.env.NODE_ENV === "development") {
          console.log("Socket connected");
        }
        setIsConnected(true);
        setIsReconnecting(false);

        // Re-sync state from DB after reconnection
        try {
          const res = await fetch("/api/status", { cache: "no-store" });
          const freshState = await res.json();
          // Convert to socket state format
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
      });

      socket.on("disconnect", () => {
        if (process.env.NODE_ENV === "development") {
          console.log("Socket disconnected");
        }
        setIsConnected(false);
      });

      socket.on("reconnect_attempt", () => {
        setIsReconnecting(true);
      });

      socket.on("reconnect_failed", () => {
        setIsReconnecting(false);
        if (process.env.NODE_ENV === "development") {
          console.warn("Socket reconnection failed");
        }
      });

      socket.on("state-update", (state) => {
        if (process.env.NODE_ENV === "development") {
          console.log("State update received:", state);
        }
        setCurrentState(state);
      });
    }

    return () => {
      // Don't disconnect on unmount, keep connection alive
    };
  }, []);

  const emit = (event: string, data: any) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  const on = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket?.off(event, callback);
    }
  };

  return {
    socket,
    isConnected,
    isReconnecting,
    currentState,
    emit,
    on,
  };
}
