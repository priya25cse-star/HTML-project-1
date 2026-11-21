const { test } = require("node:test");
const assert = require("node:assert/strict");
const { databaseFixture } = require("./database-fixture.cjs");
const mongoose = require("mongoose");
const request = require("supertest");
const { fixture, sampleCustomer } = require("./helpers.cjs");

require("../src/config").loadEnv();

test("REAL MongoDB: complete booking and order CRUD, server pricing and durable independent read", async (t) => {
  const db = await databaseFixture();
  const { Booking, Order } = db.models;
  const f = await fixture({ models: db.models });
  t.after(async () => {
    await db.cleanup();
    await f.cleanup();
  });
  const booking = await request(f.app)
    .post("/api/bookings")
    .send({
      name: "Evaluation Guest",
      phone: "9000000000",
      people: 24,
      date: "2099-12-01",
      message: "Fictional evaluation booking",
    })
    .expect(201);
  const bookingId = booking.body.bookingId;
  assert.ok(await Booking.findById(bookingId));
  await f.agent
    .get("/api/bookings")
    .expect(200)
    .expect((res) => assert.equal(res.body.length, 1));
  await f.agent
    .get(`/api/bookings/${bookingId}`)
    .expect(200)
    .expect((res) => assert.equal(res.body.status, "Pending"));
  await f.agent
    .patch(`/api/bookings/${bookingId}`)
    .set("X-CSRF-Token", f.csrf)
    .send({ status: "Confirmed" })
    .expect(200)
    .expect((res) => assert.equal(res.body.status, "Confirmed"));
  const order = await request(f.app)
    .post("/api/orders")
    .send({
      ...sampleCustomer,
      items: [
        { menuId: "bread-basket", quantity: 2, price: 0.01 },
        { menuId: "belgian-waffle", quantity: 3 },
      ],
      total: 0,
    })
    .expect(201);
  const orderId = order.body.orderId;
  assert.equal(order.body.customerName, undefined);
  assert.equal(order.body.customerPhone, undefined);
  assert.equal(order.body.total, 1550);
  const saved = await Order.findById(orderId);
  assert.equal(saved.customerName, sampleCustomer.customerName);
  assert.equal(saved.customerPhone, sampleCustomer.customerPhone);
  assert.equal(saved.currency, "INR");
  await request(f.app).get('/api/orders').expect(401);
  await request(f.app).get(`/api/orders/${orderId}`).expect(401);
  assert.equal(saved.items[0].price, 250);
  assert.ok(saved.createdAt);
  assert.ok(saved.updatedAt);
  await f.agent
    .get("/api/orders")
    .expect(200)
    .expect((res) => assert.equal(res.body.length, 1));
  await f.agent.get(`/api/orders/${orderId}`).expect(200)
    .expect(res => assert.equal(res.body.customerPhone, sampleCustomer.customerPhone));
  await f.agent
    .patch(`/api/orders/${orderId}`)
    .set("X-CSRF-Token", f.csrf)
    .send({ status: "Preparing" })
    .expect(200)
    .expect((res) => assert.equal(res.body.status, "Preparing"));
  await f.agent
    .patch(`/api/orders/${orderId}`)
    .set("X-CSRF-Token", f.csrf)
    .send({ total: 1 })
    .expect(400);
  // A second Mongoose client reads the persisted records independently.
  const verifier = new mongoose.Mongoose();
  try {
    await require('../src/database').connectDatabaseOrThrow(db.uri, {
      client: verifier,
      connectionOptions: { maxPoolSize: 1, autoCreate: false, autoIndex: false },
    });
    const freshBooking = await verifier.connection.db
      .collection(Booking.collection.collectionName)
      .findOne({ _id: new mongoose.Types.ObjectId(bookingId) });
    const freshOrder = await verifier.connection.db
      .collection(Order.collection.collectionName)
      .findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    assert.equal(freshBooking.status, "Confirmed");
    assert.equal(freshOrder.total, 1550);
    assert.equal(freshOrder.customerPhone, sampleCustomer.customerPhone);
  } finally {
    await verifier.disconnect();
  }
  assert.equal((await Booking.findById(bookingId)).status, "Confirmed");
  assert.equal((await Order.findById(orderId)).total, 1550);
  // A pre-upgrade document is inserted only into this isolated test collection.
  const legacy = await Order.collection.insertOne({
    items: [{ menuId: 'bread-basket', name: 'Bread Basket', quantity: 1, price: 5.5 }],
    total: 5.5, status: 'Pending', createdAt: new Date(), updatedAt: new Date(),
  });
  const legacyId = legacy.insertedId.toString();
  await f.agent.get(`/api/orders/${legacyId}`).expect(200).expect(res => {
    assert.equal(res.body.customerName, undefined);
    assert.equal(res.body.customerPhone, undefined);
  });
  await request(f.app).get(`/api/orders/${legacyId}`).expect(401);
  await f.agent.patch(`/api/orders/${legacyId}`).set('X-CSRF-Token', f.csrf)
    .send({ status: 'Confirmed' }).expect(200);
  assert.equal((await Order.findById(legacyId)).status, 'Confirmed');
  await f.agent.delete(`/api/orders/${legacyId}`).set('X-CSRF-Token', f.csrf).expect(204);
  for (const [kind, id] of [
    ["bookings", bookingId],
    ["orders", orderId],
  ]) {
    await f.agent
      .delete(`/api/${kind}/${id}`)
      .set("X-CSRF-Token", f.csrf)
      .expect(204);
    await f.agent.get(`/api/${kind}/${id}`).expect(404);
    await f.agent
      .patch(`/api/${kind}/${id}`)
      .set("X-CSRF-Token", f.csrf)
      .send({ status: "Cancelled" })
      .expect(404);
    await f.agent
      .delete(`/api/${kind}/${id}`)
      .set("X-CSRF-Token", f.csrf)
      .expect(404);
  }
  assert.equal(await Booking.countDocuments(), 0);
  assert.equal(await Order.countDocuments(), 0);
});
