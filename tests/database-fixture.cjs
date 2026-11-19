const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const schemas = require("../src/models");
const { connectDatabaseOrThrow } = require("../src/database");
require("../src/config").loadEnv();

async function databaseFixture() {
  const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  // Readiness is strict: unavailable MongoDB fails this command instead of skipping.
  await connectDatabaseOrThrow(uri, {
    connectionOptions: { maxPoolSize: 2, autoCreate: false, autoIndex: false },
  });
  const suffix = randomUUID().replaceAll("-", "");
  // Use isolated collections in the configured database, preserving auth/database selection.
  const models = {
    Booking: mongoose.model(
      `EvaluationBooking_${suffix}`,
      schemas.Booking.schema.clone(),
      `evaluation_bookings_${suffix}`,
    ),
    Order: mongoose.model(
      `EvaluationOrder_${suffix}`,
      schemas.Order.schema.clone(),
      `evaluation_orders_${suffix}`,
    ),
  };
  return {
    uri,
    models,
    async cleanup() {
      for (const model of Object.values(models)) {
        if (
          !/^evaluation_(bookings|orders)_[a-f0-9]{32}$/.test(
            model.collection.collectionName,
          )
        )
          throw new Error("Refusing to clean an application collection.");
        await model.collection.drop().catch((error) => {
          if (error.code !== 26) throw error;
        });
      }
      await mongoose.disconnect();
    },
  };
}
module.exports = { databaseFixture };
