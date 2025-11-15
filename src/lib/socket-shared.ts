/**
 * Shared Socket.IO Instance
 * 
 * This module provides a way for API routes to access the Socket.IO server instance
 * created in server.js. This allows API routes to emit real-time events to connected clients.
 * 
 * Usage in API routes:
 *   import { getSocketInstance } from "@/lib/socket-shared";
 *   const io = getSocketInstance();
 *   io.emit("event-name", data);
 * 
 * Setup in server.js:
 *   import { setSocketInstance } from "./src/lib/socket-shared";
 *   setSocketInstance(io);
 */

import { Server as SocketIOServer } from "socket.io";

let ioInstance: SocketIOServer | null = null;

/**
 * Set the Socket.IO server instance (called from server.js)
 */
export function setSocketInstance(io: SocketIOServer) {
  ioInstance = io;
  console.log("[Socket] Instance registered and ready for API routes");
}

/**
 * Get the Socket.IO server instance (called from API routes)
 * @throws Error if instance not initialized
 */
export function getSocketInstance(): SocketIOServer {
  if (!ioInstance) {
    throw new Error(
      "Socket.IO instance not initialized. " +
      "Make sure server.js has called setSocketInstance() before API routes try to use it."
    );
  }
  return ioInstance;
}

/**
 * Convenience function to emit events to all connected clients
 * Safe to call even if socket is not initialized (logs warning instead of throwing)
 */
export function emitToAll(event: string, data: any) {
  if (ioInstance) {
    ioInstance.emit(event, data);
    console.log(`[Socket] Emitted '${event}' to all clients`);
  } else {
    console.warn(
      `[Socket] Cannot emit '${event}': Socket.IO instance not initialized. ` +
      "This is normal during server startup, but should not happen during normal operation."
    );
  }
}

/**
 * Check if Socket.IO is initialized and ready
 */
export function isSocketReady(): boolean {
  return ioInstance !== null;
}

