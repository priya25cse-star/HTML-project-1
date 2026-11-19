const { loadEnv } = require("./src/config");
loadEnv();
const http = require("node:http");
const mongoose = require("mongoose");
const { createApp } = require("./src/app");
const { connectDatabase, getDatabaseFailure } = require("./src/database");

function readPort(value = process.env.PORT ?? "3000") {
  if (!/^\d+$/.test(String(value)) || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 65535) {
    const error = new Error("PORT must be an integer from 0 to 65535 (0 selects a temporary available port).");
    error.code = "INVALID_PORT";
    throw error;
  }
  return Number(value);
}

function listenHttp(app, port, host) {
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    function failed(error) {
      server.removeListener("listening", ready);
      reject(error);
    }
    function ready() {
      server.removeListener("error", failed);
      const address = server.address();
      if (!address || typeof address !== "object") {
        const error = new Error("HTTP listener closed before startup completed.");
        error.code = "LISTENER_CLOSED";
        return reject(error);
      }
      resolve(server);
    }
    server.once("error", failed);
    server.once("listening", ready);
    server.listen({ port, ...(host ? { host } : {}) });
  });
}

function startupErrorMessage(error, port) {
  if (error.code === "EADDRINUSE") return `Port ${port} is already in use (EADDRINUSE). If this project is already running, use http://localhost:${port}. Otherwise choose another PORT or stop the verified project server from its own terminal with Ctrl+C. No process was terminated.`;
  if (error.code === "EACCES" || error.code === "EPERM") return `Permission denied while binding port ${port}. Choose an available permitted port.`;
  if (error.code === "EADDRNOTAVAIL") return "The configured HTTP address is unavailable on this computer.";
  if (error.code === "INVALID_PORT" || error.code === "ERR_SOCKET_BAD_PORT") return "Invalid PORT. Use an integer from 0 to 65535; 3000 is the normal project port.";
  return "HTTP startup failed. Check the configured port and local server configuration.";
}

async function startServer() {
  const port = readPort();
  // Bind before opening MongoDB: a duplicate launch fails promptly without a DB session.
  const server = await listenHttp(createApp(), port);
  const address = server.address(); // listenHttp resolved only after a successful bind.
  console.log(`Gourmet au Catering: http://localhost:${address.port}`);
  let stopping = false;
  let retry;
  let shutdownPromise;
  let connecting;

  async function attemptConnection() {
    const connected = await connectDatabase();
    if (stopping || connected || !getDatabaseFailure()?.retryable) return;
    retry = setTimeout(() => {
      if (!stopping) connecting = attemptConnection();
    }, 15000);
    retry.unref();
  }
  function removeSignalHandlers() {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
  async function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    stopping = true;
    clearTimeout(retry);
    removeSignalHandlers();
    shutdownPromise = (async () => {
      const forceClose = setTimeout(() => server.closeAllConnections(), 10000);
      forceClose.unref();
      try {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        await connecting;
        await mongoose.disconnect();
      } finally { clearTimeout(forceClose); }
    })();
    return shutdownPromise;
  }
  function onSignal() {
    shutdown().catch(() => {
      console.error("Unable to finish server shutdown cleanly.");
      process.exitCode = 1;
    });
  }
  server.on("error", error => {
    console.error(startupErrorMessage(error, port));
    process.exitCode = 1;
    onSignal();
  });
  server.once("close", () => { clearTimeout(retry); removeSignalHandlers(); });
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  // Expose lifecycle completion for callers/tests without an unauthenticated HTTP endpoint.
  server.shutdown = shutdown;
  connecting = attemptConnection();
  return server;
}
if (require.main === module) startServer().catch(error => {
  console.error(`Server startup failed: ${startupErrorMessage(error, process.env.PORT || 3000)}`);
  process.exitCode = 1;
});
module.exports = { startServer, listenHttp, readPort, startupErrorMessage };
