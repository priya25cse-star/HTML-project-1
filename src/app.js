const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const path = require("node:path");
const mongoose = require("mongoose");
const { createMenuStore } = require("./utils/menu-store");
const { errorHandler } = require("./utils/errors");
const { createAuth } = require("./middleware/auth");
const { bookingData, orderData } = require("./utils/validation");
const { Booking, Order, bookingStatuses, orderStatuses } = require("./models");
const menuRoutes = require("./routes/menu");
const recordRoutes = require("./routes/records");
const recipeRoutes = require("./routes/recipes");
function createApp(options = {}) {
  const app = express();
  const models = options.models || { Booking, Order };
  const config = options.config || process.env;
  app.disable("x-powered-by");
  if (config.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: config.NODE_ENV === "production" ? [] : null,
        },
      },
      strictTransportSecurity:
        config.NODE_ENV === "production" ? undefined : false,
    }),
  );
  app.use(express.json({ limit: "20kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin")) {
      try {
        if (new URL(req.get("origin")).host !== req.get("host"))
          return res
            .status(403)
            .json({ message: "Cross-origin requests are not allowed." });
      } catch {
        return res.status(403).json({ message: "Invalid request origin." });
      }
    }
    next();
  });
  const limiter = (limit, windowMs) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests. Please try again later." },
    });
  const auth = createAuth(config);
  app.post("/api/auth/login", limiter(10, 15 * 60 * 1000), auth.login);
  app.get("/api/auth/me", auth.requireAdmin, auth.me);
  app.post("/api/auth/logout", auth.requireAdmin, auth.logout);
  app.get("/api/health", (req, res) =>
    res.json({
      status: "ok",
      database:
        mongoose.connection.readyState === 1 ? "connected" : "unavailable",
    }),
  );
  const store = options.menuStore || createMenuStore();
  app.use("/api/menu", menuRoutes(store, auth.requireAdmin));
  const submissionLimiter = limiter(30, 15 * 60 * 1000);
  app.use(
    "/api/bookings",
    recordRoutes({
      Model: models.Booking,
      validateCreate: bookingData,
      statuses: bookingStatuses,
      requireAdmin: auth.requireAdmin,
      submissionLimiter,
      kind: "Booking",
    }),
  );
  app.use(
    "/api/orders",
    recordRoutes({
      Model: models.Order,
      validateCreate: async (body) => orderData(body, await store.list()),
      statuses: orderStatuses,
      requireAdmin: auth.requireAdmin,
      submissionLimiter,
      kind: "Order",
    }),
  );
  app.use("/api/recipes", limiter(60, 60 * 1000), recipeRoutes());
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "API endpoint not found." }),
  );
  // Only allow intended frontend files, never the repository or configuration.
  const root = path.join(__dirname, "..");
  for (const file of [
    "Index.html",
    "Menu.html",
    "Contact.html",
    "thankyou.html",
    "Admin.html",
    "style.css",
    "script.js",
    "admin.js",
  ])
    app.get(`/${file}`, (req, res) => res.sendFile(path.join(root, file)));
  app.get("/", (req, res) => res.sendFile(path.join(root, "Index.html")));
  app.use(
    "/assets",
    express.static(path.join(root, "assets"), {
      dotfiles: "deny",
      index: false,
    }),
  );
  app.use((req, res) =>
    res.status(404).type("text").send("Page not found. Return to /"),
  );
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
