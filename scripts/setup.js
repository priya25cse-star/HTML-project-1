const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const { loadEnv } = require("../src/config");
loadEnv();
const lines = [];
if (!process.env.ADMIN_USERNAME) lines.push("ADMIN_USERNAME=admin");
if (!process.env.ADMIN_PASSWORD)
  lines.push(`ADMIN_PASSWORD=${randomBytes(24).toString("hex")}`);
if (!process.env.SESSION_SECRET)
  lines.push(`SESSION_SECRET=${randomBytes(48).toString("hex")}`);
if (!process.env.MONGODB_URI)
  lines.push("MONGODB_URI=mongodb://127.0.0.1:27017/gourmet_catering");
if (!process.env.PORT) lines.push("PORT=3000");
if (lines.length) {
  // Preserve the existing Windows encoding and all existing values.
  const current = fs.existsSync(".env")
    ? fs.readFileSync(".env")
    : Buffer.alloc(0);
  const encoding =
    current[0] === 0xff && current[1] === 0xfe ? "utf16le" : "utf8";
  fs.appendFileSync(".env", `\n${lines.join("\n")}\n`, encoding);
}
console.log(
  lines.length
    ? "Missing settings added to ignored .env. Open .env to read your locally generated admin password."
    : "Configuration already exists; no values changed.",
);
