// Shared Socket.IO instance for use in both server.js and API routes
// This allows API routes to emit socket events

let ioInstance = null;

function setSocketInstance(io) {
  ioInstance = io;
}

function getSocketInstance() {
  return ioInstance;
}

function emitSocketEvent(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  } else if (process.env.NODE_ENV === "development") {
    console.warn(`Socket.IO instance not available. Event "${event}" not emitted.`);
  }
}

module.exports = {
  setSocketInstance,
  getSocketInstance,
  emitSocketEvent,
};

