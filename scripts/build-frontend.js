"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

// These are public browser entry points, never the whole repository.
const frontendFiles = [
  "Index.html", "Menu.html", "Contact.html", "Admin.html", "thankyou.html",
  "style.css", "script.js", "admin.js",
];
const assetExtensions = new Set([
  ".avif", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp4", ".webm",
]);

async function buildFrontend(root = path.resolve(__dirname, "..")) {
  root = path.resolve(root);
  const output = path.join(root, "frontend-dist");
  const files = [...frontendFiles];

  async function assets(relative) {
    const info = await fs.lstat(path.join(root, relative));
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Public asset directory must be a real directory: ${relative}`);
    }
    const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".")) continue;
      const file = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Refusing public asset symlink: ${file}`);
      if (entry.isDirectory()) await assets(file);
      else if (assetExtensions.has(path.extname(entry.name).toLowerCase())) files.push(file);
    }
  }
  await assets("assets");
  for (const file of files) {
    const info = await fs.lstat(path.join(root, file));
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`Frontend input must be a regular file: ${file}`);
    }
  }
  const previous = await fs.lstat(output).catch(error => {
    if (error.code !== "ENOENT") throw error;
  });
  if (previous?.isSymbolicLink()) throw new Error("Refusing frontend-dist symlink.");
  // The deletion target is the fixed child above, never a caller-supplied output path.
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  // Create the lowercase name first, including on case-insensitive Windows filesystems.
  await fs.copyFile(path.join(root, "Index.html"), path.join(output, "index.html"));
  for (const file of files) {
    const destination = path.join(output, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(root, file), destination);
  }
  return output;
}

if (require.main === module) {
  buildFrontend().then(() => console.log("Static frontend built in frontend-dist/ (no backend or environment files)."))
    .catch(error => { console.error(`Frontend build failed: ${error.message}`); process.exitCode = 1; });
}
module.exports = { buildFrontend };
