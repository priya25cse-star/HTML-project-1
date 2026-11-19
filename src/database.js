const mongoose = require("mongoose");
const { setTimeout: delay } = require("node:timers/promises");
const { diagnoseDatabaseError, safeDatabaseError } = require("./utils/database-errors");
mongoose.set("bufferCommands", false);

const connectionOptions = Object.freeze({
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 10000,
  maxPoolSize: 5,
});
let lastFailure = null;
let previouslyConnected = false;

// Subsequent driver errors must be sanitized too, not just initial failures.
mongoose.connection.on("connected", () => {
  previouslyConnected = true;
  lastFailure = null;
});
mongoose.connection.on("error", error => {
  if (!previouslyConnected) return; // Initial failures are handled by connectDatabase.
  lastFailure = diagnoseDatabaseError(error);
  console.warn(`MongoDB [${lastFailure.category}]: ${lastFailure.message}`);
});
mongoose.connection.on("disconnected", () => {
  if (previouslyConnected) console.warn("MongoDB disconnected. Database requests return 503 until the connection is restored.");
});

async function connectDatabaseOrThrow(uri = process.env.MONGODB_URI, options = {}) {
  if (typeof uri !== "string" || !uri.trim()) {
    const error = new Error("MongoDB [CONFIGURATION]: MONGODB_URI is missing. Configure it privately in the project .env.");
    error.name = "DatabaseConnectionError";
    error.diagnostic = { category: "CONFIGURATION", retryable: false, message: "MONGODB_URI is missing. Configure it privately in the project .env." };
    throw error;
  }
  const client = options.client || mongoose;
  const attempts = options.attempts ?? 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await client.connect(uri, { ...connectionOptions, ...(options.connectionOptions || {}) });
      // A completed handshake and authenticated ping are required for readiness.
      await client.connection.db.command({ ping: 1 }, { maxTimeMS: 5000 });
      return true;
    } catch (rawError) {
      const error = safeDatabaseError(rawError);
      await client.disconnect().catch(() => {});
      if (!error.diagnostic.retryable || attempt === attempts) throw error;
      options.onRetry?.(error.diagnostic, attempt);
      await delay(options.retryDelayMs ?? attempt * 1000);
    }
  }
  throw new Error("MongoDB connection requires at least one attempt.");
}

async function connectDatabase(uri = process.env.MONGODB_URI) {
  try {
    await connectDatabaseOrThrow(uri, {
      onRetry: (diagnostic, attempt) => console.warn(`MongoDB attempt ${attempt}/3 [${diagnostic.category}]: ${diagnostic.message} Retrying.`),
    });
    lastFailure = null;
    console.log("MongoDB connected and authenticated ping passed.");
    return true;
  } catch (error) {
    // connectDatabaseOrThrow exposes only fixed safe messages, not raw driver errors.
    lastFailure = error.diagnostic || diagnoseDatabaseError(error);
    console.warn(`MongoDB connection failed [${lastFailure.category}]: ${lastFailure.message}`);
    return false;
  }
}
function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({
    message: "Bookings and orders are temporarily unavailable. Please try again later.",
  });
  next();
}
module.exports = { connectDatabase, connectDatabaseOrThrow, connectionOptions, requireDatabase, getDatabaseFailure: () => lastFailure };
