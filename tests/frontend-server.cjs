// Local verification of static output plus the external rewrite contract.
// This is a test server, never part of the published frontend.
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const config = require("../vercel.json");

function apiDestination(requestPath) {
  const [rule] = config.rewrites;
  assert.equal(config.rewrites.length, 1);
  assert.equal(rule.source, "/api/:path*");
  const url = new URL(requestPath, "http://localhost");
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return null;
  return rule.destination.replace(":path*", url.pathname.slice(5)) + url.search;
}

function createFrontendServer({ directory, backendOrigin } = {}) {
  const root = path.resolve(directory || path.join(__dirname, "../frontend-dist"));
  return http.createServer(async (req, res) => {
    try {
      const destination = apiDestination(req.url);
      if (destination) {
        const target = new URL(destination);
        // Browser success tests substitute only the origin with an isolated Express fixture.
        if (backendOrigin) {
          const local = new URL(backendOrigin);
          target.protocol = local.protocol;
          target.host = local.host;
        }
        const transport = target.protocol === "https:" ? https : http;
        const upstream = transport.request(target, {
          method: req.method,
          headers: { ...req.headers, host: target.host },
        }, response => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        });
        upstream.on("error", () => { res.writeHead(502); res.end("Proxy upstream unavailable"); });
        req.pipe(upstream);
        return;
      }
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const filename = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
      const relative = path.relative(root, filename);
      if (relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep).some(p => p.startsWith("."))) {
        res.writeHead(404); res.end(); return;
      }
      const content = await fs.readFile(filename);
      const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
      res.writeHead(200, { "Content-Type": types[path.extname(filename)] || "application/octet-stream" });
      res.end(content);
    } catch (error) {
      res.writeHead(error.code === "ENOENT" || error.code === "EISDIR" ? 404 : 500);
      res.end();
    }
  });
}
module.exports = { apiDestination, createFrontendServer };
