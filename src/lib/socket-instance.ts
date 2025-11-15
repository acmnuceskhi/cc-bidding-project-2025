// Shared Socket.IO instance for use in both server.js and API routes
// This allows API routes to emit socket events

let ioInstance: any = null;

export function setSocketInstance(io: any) {
  ioInstance = io;
}

export function getSocketInstance() {
  return ioInstance;
}

export function emitSocketEvent(event: string, data: any) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  } else if (process.env.NODE_ENV === "development") {
    console.warn(`Socket.IO instance not available. Event "${event}" not emitted.`);
  }
}

