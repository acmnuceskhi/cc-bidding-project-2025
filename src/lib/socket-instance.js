// Shared Socket.IO instance across server.js and Next API routes.
// Use a global holder to avoid separate webpack module instances.

const GLOBAL_KEY = "__SOCKET_IO_INSTANCE__";

function getGlobal() {
  // Works in both Node and Next server runtime
  // eslint-disable-next-line no-new-func
  return Function("return this")();
}

function setSocketInstance(io) {
  const g = getGlobal();
  g[GLOBAL_KEY] = io;
}

function getSocketInstance() {
  const g = getGlobal();
  return g[GLOBAL_KEY] || null;
}

function emitSocketEvent(event, data) {
  const io = getSocketInstance();
  if (io) {
    io.emit(event, data);
  } else if (process.env.NODE_ENV === "development") {
    console.warn(`Socket.IO instance not available. Event "${event}" not emitted.`);
  }
}

module.exports = {
  setSocketInstance,
  getSocketInstance,
  emitSocketEvent,
};

