// Shared Socket.IO instance for use in both server.ts and API routes
// This allows API routes to emit socket events

import type { Server as SocketIOServer } from "socket.io";

let ioInstance: SocketIOServer | null = null;

export function setSocketInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketInstance(): SocketIOServer | null {
  return ioInstance;
}

export function emitSocketEvent(event: string, data: any) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  } else if (process.env.NODE_ENV === "development") {
    console.warn(`Socket.IO instance not available. Event "${event}" not emitted.`);
  }
}
