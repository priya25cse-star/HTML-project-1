const fs = require("node:fs");
const dotenv = require("dotenv");
const path = require("node:path");
function loadEnv(filename = path.join(__dirname, "..", ".env")) {
  // Resolve against the project, even when Node is launched from another folder.
  // Existing process environment values retain priority; the file is never changed.
  if (!fs.existsSync(filename)) return;
  const buffer = fs.readFileSync(filename);
  const encoding =
    buffer[0] === 0xff && buffer[1] === 0xfe ? "utf16le" : "utf8";
  const values = dotenv.parse(buffer.toString(encoding));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
module.exports = { loadEnv };
