const {
  randomBytes,
  createHmac,
  timingSafeEqual,
  createHash,
} = require("node:crypto");
const { HttpError } = require("../utils/errors");
const { fields, check } = require("../utils/validation");
function createAuth(config = process.env) {
  const sessions = new Map();
  const maxAge = 8 * 60 * 60 * 1000;
  const cookieName = "gourmet_admin";
  const secure = config.NODE_ENV === "production";
  function configured() {
    return Boolean(
      config.ADMIN_USERNAME &&
        config.ADMIN_PASSWORD?.length >= 12 &&
        config.SESSION_SECRET?.length >= 32,
    );
  }
  function digest(value) {
    return createHash("sha256").update(value).digest();
  }
  function equal(a, b) {
    return timingSafeEqual(digest(a), digest(b));
  }
  function signature(token) {
    return createHmac("sha256", config.SESSION_SECRET)
      .update(token)
      .digest("hex");
  }
  function cleanup() {
    for (const [key, value] of sessions)
      if (value.expires <= Date.now()) sessions.delete(key);
  }
  function tokenFrom(req) {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName}=`));
    if (raw) {
      const [token, signed] = raw.slice(cookieName.length + 1).split(".");
      if (configured() && token && signed && equal(signature(token), signed))
        return token;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const rawBearer = authHeader.slice(7).trim();
      const [token, signed] = rawBearer.split(".");
      if (configured() && token && signed && equal(signature(token), signed))
        return token;
    }
    return null;
  }
  function session(req) {
    cleanup();
    return sessions.get(tokenFrom(req));
  }
  return {
    login(req, res) {
      if (!configured())
        throw new HttpError(
          503,
          "Admin login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD (12+ characters), and SESSION_SECRET (32+ characters) in .env.",
        );
      fields(req.body, ["username", "password"]);
      check(
        typeof req.body.username === "string" &&
          typeof req.body.password === "string",
        "Enter your username and password.",
      );
      const validUser = equal(req.body.username, config.ADMIN_USERNAME);
      const validPassword = equal(req.body.password, config.ADMIN_PASSWORD);
      if (!validUser || !validPassword)
        throw new HttpError(401, "Invalid username or password.");
      cleanup();
      if (sessions.size >= 1000)
        throw new HttpError(429, "Too many active sessions. Try again later.");
      const oldToken = tokenFrom(req);
      if (oldToken) sessions.delete(oldToken);
      const token = randomBytes(32).toString("hex");
      const csrfToken = randomBytes(32).toString("hex");
      sessions.set(token, { csrfToken, expires: Date.now() + maxAge });
      res.cookie(cookieName, `${token}.${signature(token)}`, {
        httpOnly: true,
        secure,
        sameSite: config.COOKIE_SAMESITE || "strict",
        maxAge,
        path: "/",
      });
      res.json({
        username: config.ADMIN_USERNAME,
        csrfToken,
        token: `${token}.${signature(token)}`,
      });
    },
    requireAdmin(req, res, next) {
      const current = session(req);
      if (!current)
        return next(new HttpError(401, "Please sign in as an administrator."));
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        (!req.headers["x-csrf-token"] ||
          !equal(req.headers["x-csrf-token"], current.csrfToken))
      )
        return next(
          new HttpError(403, "Session verification failed. Sign in again."),
        );
      req.adminSession = current;
      next();
    },
    me(req, res) {
      res.json({
        username: config.ADMIN_USERNAME,
        csrfToken: req.adminSession.csrfToken,
      });
    },
    logout(req, res) {
      sessions.delete(tokenFrom(req));
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure,
        sameSite: config.COOKIE_SAMESITE || "strict",
        path: "/",
      });
      res.status(204).end();
    },
  };
}
module.exports = { createAuth };
