const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const request = require("supertest");
const { fixture, config, sampleMenu } = require("./helpers.cjs");
const { createApp } = require("../src/app");
const { createMenuStore } = require("../src/utils/menu-store");
const { orderData, bookingData } = require("../src/utils/validation");

test("File-backed menu: CRUD, IDs, validation, actual disk changes and persistence with a fresh store", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  await request(f.app)
    .get("/api/menu")
    .expect(200)
    .expect((res) => assert.equal(res.body.length, 6));
  await request(f.app).get("/api/menu/bread-basket").expect(200);
  await f.agent
    .post("/api/menu")
    .set("X-CSRF-Token", f.csrf)
    .send(sampleMenu)
    .expect(201);
  assert.ok(
    JSON.parse(await fs.readFile(f.filename, "utf8")).some(
      (item) => item.id === sampleMenu.id,
    ),
  );
  await f.agent
    .post("/api/menu")
    .set("X-CSRF-Token", f.csrf)
    .send(sampleMenu)
    .expect(409);
  await f.agent
    .put(`/api/menu/${sampleMenu.id}`)
    .set("X-CSRF-Token", f.csrf)
    .send({ ...sampleMenu, price: 13.5, available: false })
    .expect(200);
  assert.equal(
    (await createMenuStore(f.filename).get(sampleMenu.id)).price,
    13.5,
  );
  const restarted = createApp({
    config,
    menuStore: createMenuStore(f.filename),
  });
  await request(restarted)
    .get(`/api/menu/${sampleMenu.id}`)
    .expect(200)
    .expect((res) => assert.equal(res.body.available, false));
  await f.agent
    .delete(`/api/menu/${sampleMenu.id}`)
    .set("X-CSRF-Token", f.csrf)
    .expect(204);
  await request(f.app).get(`/api/menu/${sampleMenu.id}`).expect(404);
  assert.equal(JSON.parse(await fs.readFile(f.filename, "utf8")).length, 6);
  for (const invalid of [
    { ...sampleMenu, price: -1 },
    { ...sampleMenu, price: 1.001 },
    { ...sampleMenu, available: "yes" },
    { ...sampleMenu, image: "javascript:alert(1)" },
    { ...sampleMenu, id: "../bad" },
    { ...sampleMenu, name: "" },
  ]) {
    await f.agent
      .post("/api/menu")
      .set("X-CSRF-Token", f.csrf)
      .send(invalid)
      .expect(400);
  }
  await f.agent
    .put("/api/menu/bread-basket")
    .set("X-CSRF-Token", f.csrf)
    .send(sampleMenu)
    .expect(400);
  await f.agent
    .put("/api/menu/missing")
    .set("X-CSRF-Token", f.csrf)
    .send({ ...sampleMenu, id: "missing" })
    .expect(404);
  await f.agent
    .delete("/api/menu/missing")
    .set("X-CSRF-Token", f.csrf)
    .expect(404);
});

test("Concurrent writes retain every record; failed operations do not poison the queue", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      f.agent
        .post("/api/menu")
        .set("X-CSRF-Token", f.csrf)
        .send({ ...sampleMenu, id: `parallel-${index}` })
        .expect(201),
    ),
  );
  assert.equal(JSON.parse(await fs.readFile(f.filename, "utf8")).length, 26);
  await f.agent
    .delete("/api/menu/missing")
    .set("X-CSRF-Token", f.csrf)
    .expect(404);
  await f.agent
    .post("/api/menu")
    .set("X-CSRF-Token", f.csrf)
    .send({ ...sampleMenu, id: "after-failure" })
    .expect(201);
  assert.equal((await createMenuStore(f.filename).list()).length, 27);
});

test("Missing, malformed and duplicate-ID JSON return 503 and are never overwritten", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  for (const content of [
    "not json",
    "{}",
    JSON.stringify([sampleMenu, sampleMenu]),
  ]) {
    await fs.writeFile(f.filename, content);
    await request(f.app).get("/api/menu").expect(503);
    await f.agent
      .post("/api/menu")
      .set("X-CSRF-Token", f.csrf)
      .send(sampleMenu)
      .expect(503);
    assert.equal(await fs.readFile(f.filename, "utf8"), content);
  }
  await fs.unlink(f.filename);
  await request(f.app).get("/api/menu").expect(503);
});

test("Private lists, individual records and all modification routes require admin authorization", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const id = "507f1f77bcf86cd799439011";
  for (const path of [
    "/api/bookings",
    `/api/bookings/${id}`,
    "/api/orders",
    `/api/orders/${id}`,
    "/api/auth/me",
  ])
    await request(f.app).get(path).expect(401);
  for (const kind of ["bookings", "orders"]) {
    await request(f.app)
      .patch(`/api/${kind}/${id}`)
      .send({ status: "Confirmed" })
      .expect(401);
    await request(f.app).delete(`/api/${kind}/${id}`).expect(401);
  }
  await request(f.app).post("/api/menu").send(sampleMenu).expect(401);
  await request(f.app)
    .put("/api/menu/bread-basket")
    .send(sampleMenu)
    .expect(401);
  await request(f.app).delete("/api/menu/bread-basket").expect(401);
  await f.agent.post("/api/menu").send(sampleMenu).expect(403);
  await f.agent
    .post("/api/menu")
    .set("X-CSRF-Token", "bad")
    .send(sampleMenu)
    .expect(403);
  await f.agent
    .post("/api/menu")
    .set("X-CSRF-Token", f.csrf)
    .set("Origin", "https://attacker.example")
    .send(sampleMenu)
    .expect(403);
  await f.agent.get("/api/auth/me").expect(200);
  await f.agent
    .post("/api/auth/logout")
    .set("X-CSRF-Token", f.csrf)
    .expect(204);
  await f.agent.get("/api/auth/me").expect(401);
});

test("Login cookies, invalid credentials, disabled configuration and request throttling", async () => {
  const app = createApp({ config });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ username: config.ADMIN_USERNAME, password: config.ADMIN_PASSWORD })
    .expect(200);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Strict/);
  for (let i = 0; i < 9; i++)
    await request(app)
      .post("/api/auth/login")
      .send({ username: config.ADMIN_USERNAME, password: "wrong" })
      .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ username: config.ADMIN_USERNAME, password: "wrong" })
    .expect(429);
  await request(createApp({ config: {} }))
    .post("/api/auth/login")
    .send({ username: "admin", password: "anything" })
    .expect(503);
});

test("Static hosting allowlist protects secrets, source, data and dependencies", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  for (const path of [
    "/",
    "/Index.html",
    "/index.html",
    "/Menu.html",
    "/Contact.html",
    "/thankyou.html",
    "/Admin.html",
    "/script.js",
    "/admin.js",
    "/style.css",
    "/assets/garden.jpg",
  ])
    await request(f.app).get(path).expect(200);
  for (const path of [
    "/.env",
    "/.git/config",
    "/server.js",
    "/src/app.js",
    "/data/menu.json",
    "/package.json",
    "/package-lock.json",
    "/node_modules/express/package.json",
    "/README.md",
  ])
    await request(f.app).get(path).expect(404);
  const health = await request(f.app).get("/api/health").expect(200);
  assert.equal(health.body.database, "unavailable");
  assert.ok(health.headers["content-security-policy"]);
  assert.equal(health.headers["x-powered-by"], undefined);
  await request(f.app)
    .get("/api/missing")
    .expect(404)
    .expect("Content-Type", /json/);
  await request(f.app)
    .post("/api/bookings")
    .set("Content-Type", "application/json")
    .send("{bad")
    .expect(400);
  await request(f.app)
    .post("/api/bookings")
    .send({ message: "x".repeat(22000) })
    .expect(413);
});

test("Booking validation handles malformed dates, past events, quantities and unsupported fields", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  const valid = {
    name: "Evaluation Guest",
    phone: "9000000000",
    people: 25,
    date: "2099-12-01",
    message: "Sample data only",
  };
  for (const invalid of [
    {},
    { ...valid, name: " " },
    { ...valid, phone: "abc" },
    { ...valid, people: 1.5 },
    { ...valid, people: 10001 },
    { ...valid, date: "2026-02-30" },
    { ...valid, date: "2020-01-01" },
    { ...valid, message: "a".repeat(201) },
    { ...valid, status: "Confirmed" },
  ])
    await request(f.app).post("/api/bookings").send(invalid).expect(400);
  await request(f.app).post("/api/bookings").send(valid).expect(503);
  assert.equal(bookingData(valid).name, valid.name);
  await f.agent.get("/api/bookings/bad-id").expect(400);
  await f.agent
    .patch("/api/bookings/507f1f77bcf86cd799439011")
    .set("X-CSRF-Token", f.csrf)
    .send({ status: "Unknown" })
    .expect(400);
});

test("Order validation rejects invalid/unavailable items and server prices override tampered prices", async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  for (const body of [
    {},
    { items: [] },
    { items: [{ menuId: "missing", quantity: 1 }] },
    { items: [{ menuId: "bread-basket", quantity: 0 }] },
    { items: [{ menuId: "bread-basket", quantity: 101 }] },
    { items: [{ menuId: "bread-basket", quantity: 1.5 }] },
    {
      items: [
        { menuId: "bread-basket", quantity: 1 },
        { menuId: "bread-basket", quantity: 1 },
      ],
    },
  ])
    await request(f.app).post("/api/orders").send(body).expect(400);
  const menu = await createMenuStore(f.filename).list();
  const result = orderData(
    {
      total: 0.01,
      items: [{ menuId: "bread-basket", quantity: 3, price: 0.01 }],
    },
    menu,
  );
  assert.equal(result.total, 16.5);
  assert.equal(result.items[0].price, 5.5);
  assert.throws(
    () =>
      orderData({ items: [{ menuId: sampleMenu.id, quantity: 1 }] }, [
        { ...sampleMenu, available: false },
      ]),
    /unavailable/,
  );
  await request(f.app)
    .post("/api/orders")
    .send({ items: [{ menuId: "bread-basket", quantity: 2 }] })
    .expect(503);
});

test("External recipes: normalize real API fields, cache, empty result and network errors", async (t) => {
  const original = global.fetch;
  t.after(() => {
    global.fetch = original;
  });
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        meals: [
          {
            idMeal: "123",
            strMeal: "Test Salad",
            strCategory: "Vegetarian",
            strMealThumb: "https://example.com/salad.jpg",
          },
        ],
      }),
    };
  };
  const app = createApp({ config });
  await request(app)
    .get("/api/recipes")
    .expect(200)
    .expect((res) => assert.equal(res.body.recipes[0].name, "Test Salad"));
  await request(app).get("/api/recipes").expect(200);
  assert.equal(calls, 1);
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ meals: null }),
  });
  await request(createApp({ config }))
    .get("/api/recipes")
    .expect(200)
    .expect((res) => assert.equal(res.body.recipes.length, 0));
  global.fetch = async () => {
    throw new Error("network down");
  };
  await request(createApp({ config })).get("/api/recipes").expect(502);
});
