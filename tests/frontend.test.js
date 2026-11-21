const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { buildFrontend } = require("../scripts/build-frontend");
const { apiDestination, createFrontendServer } = require("./frontend-server.cjs");
const config = require("../vercel.json");
const root = path.resolve(__dirname, "..");
const pages = ["Index.html", "Menu.html", "Contact.html", "Admin.html", "thankyou.html"];
const publicFiles = [...pages, "style.css", "script.js", "admin.js"];

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gourmet-frontend-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  for (const file of publicFiles) await fs.copyFile(path.join(root, file), path.join(directory, file));
  await fs.cp(path.join(root, "assets"), path.join(directory, "assets"), { recursive: true });
  return directory;
}
async function listen(t, server) {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test("Static build excludes secrets/backend/private sources and removes stale artifacts", async t => {
  const directory = await fixture(t);
  for (const file of [".env", "server.js", "assets/.env", "assets/private.js", "assets/debug.js.map", "assets/data.json"]) {
    await fs.writeFile(path.join(directory, file), "private-canary");
  }
  await fs.mkdir(path.join(directory, "assets/.private"));
  await fs.writeFile(path.join(directory, "assets/.private/secret.png"), "private-canary");
  const output = await buildFrontend(directory);
  const names = await fs.readdir(output, { recursive: true });
  assert.ok(names.includes("index.html"), "Root entry must have a lowercase filename even on Windows");
  for (const name of names) {
    const file = path.join(output, name);
    if (!(await fs.stat(file)).isFile()) continue;
    assert.doesNotMatch(await fs.readFile(file, "utf8"), /private-canary/);
    assert.ok(publicFiles.includes(name) || name === "index.html" || /^assets[/\\].+\.(jpg|svg)$/.test(name), name);
  }
  for (const file of publicFiles) assert.deepEqual(await fs.readFile(path.join(output, file)), await fs.readFile(path.join(root, file)));
  assert.deepEqual(await fs.readFile(path.join(output, "index.html")), await fs.readFile(path.join(root, "Index.html")));
  await fs.writeFile(path.join(output, "stale.env"), "old-secret");
  await buildFrontend(directory);
  await assert.rejects(fs.access(path.join(output, "stale.env")), { code: "ENOENT" });
});

test("Static pages, linked assets, fragments, menu images and private-file 404s", async t => {
  const directory = await fixture(t);
  const output = await buildFrontend(directory);
  const base = await listen(t, createFrontendServer({ directory: output }));
  for (const page of ["", "index.html", ...pages]) {
    const response = await fetch(`${base}/${page}`, { redirect: "manual" });
    assert.equal(response.status, 200, page);
    const html = await response.text();
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = new URL(match[1], `${base}/${page}`);
      if (url.origin !== base) continue;
      const target = await fetch(url, { redirect: "manual" });
      assert.equal(target.status, 200, `${page}: ${match[1]}`);
      if (url.hash) assert.ok((await target.text()).includes(`id="${url.hash.slice(1)}"`), match[1]);
    }
  }
  const css = await fs.readFile(path.join(output, "style.css"), "utf8");
  for (const match of css.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)) {
    const url = new URL(match[1], `${base}/style.css`);
    if (url.origin === base) assert.equal((await fetch(url)).status, 200, match[1]);
  }
  const menu = JSON.parse(await fs.readFile(path.join(root, "data/menu.json"), "utf8"));
  for (const item of menu) assert.equal((await fetch(`${base}${item.image}`)).status, 200, item.image);
  for (const file of [".env", ".env.example", "server.js", "src/app.js", "src/config.js", "package.json", "data/menu.json", "README.md", "assets/README.md", "scripts/build-frontend.js", "vercel.json"]) {
    assert.equal((await fetch(`${base}/${file}`)).status, 404, file);
  }
});

test("Vercel static settings and Render API rewrite preserve paths and queries", () => {
  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, "npm run build:frontend");
  assert.equal(config.outputDirectory, "frontend-dist");
  assert.equal(config.cleanUrls, false);
  for (const key of ["builds", "functions", "routes"]) assert.equal(config[key], undefined);
  for (const route of ["menu", "orders", "bookings", "auth/login", "auth/me", "auth/logout", "menu/bread-basket", "recipes?search=salad"]) {
    assert.equal(apiDestination(`/api/${route}`), `https://gourmet-catering-backend.onrender.com/api/${route}`);
  }
  for (const route of ["/", "/Menu.html", "/assets/hero.jpg", "/apiary"]) assert.equal(apiDestination(route), null);
});

test("Proxy forwards method, JSON, cookies, CSRF, query and upstream status without redirects", async t => {
  const backend = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.writeHead(201, { "Content-Type": "application/json", "Set-Cookie": "test=session; Path=/; HttpOnly; SameSite=Strict" });
    res.end(JSON.stringify({ url: req.url, method: req.method, cookie: req.headers.cookie, csrf: req.headers["x-csrf-token"], body: JSON.parse(body) }));
  });
  const backendOrigin = await listen(t, backend);
  const frontend = await listen(t, createFrontendServer({ backendOrigin }));
  const response = await fetch(`${frontend}/api/orders?test=1`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: "test=session", "X-CSRF-Token": "test-csrf" }, body: JSON.stringify({ quantity: 2 }), redirect: "manual",
  });
  assert.equal(response.status, 201);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.deepEqual(await response.json(), { url: "/api/orders?test=1", method: "POST", cookie: "test=session", csrf: "test-csrf", body: { quantity: 2 } });
});

test("Missing required frontend input fails the build", async t => {
  const directory = await fixture(t);
  await fs.unlink(path.join(directory, "Menu.html"));
  await assert.rejects(buildFrontend(directory), { code: "ENOENT" });
});
