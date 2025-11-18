// Shared Socket.IO instance for use in both server.js and API routes
// This allows API routes to emit socket events
// Re-export from the JavaScript version to ensure both share the same module instance

const socketInstance = require("./socket-instance.js");

export function setSocketInstance(io: any) {
  socketInstance.setSocketInstance(io);
}

export function getSocketInstance() {
  return socketInstance.getSocketInstance();
}

export function emitSocketEvent(event: string, data: any) {
  socketInstance.emitSocketEvent(event, data);
}

