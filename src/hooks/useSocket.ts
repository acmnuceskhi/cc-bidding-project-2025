"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentState, setCurrentState] = useState<any>(null);

  useEffect(() => {
    // Initialize socket connection
    if (!socket) {
      socket = io({
        path: "/socket.io",
      });

      socket.on("connect", () => {
        console.log("Socket connected");
        setIsConnected(true);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
        setIsConnected(false);
      });

      socket.on("state-update", (state) => {
        console.log("State update received:", state);
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
    currentState,
    emit,
    on,
  };
}
