const express = require("express");
const mongoose = require("mongoose");
const { HttpError } = require("../utils/errors");
const { requireDatabase } = require("../database");
const { statusData } = require("../utils/validation");
module.exports = function recordRoutes({
  Model,
  validateCreate,
  statuses,
  requireAdmin,
  submissionLimiter,
  kind,
}) {
  const router = express.Router();
  router.post(
    "/",
    submissionLimiter,
    async (req, res, next) => {
      req.recordData = await validateCreate(req.body);
      next();
    },
    requireDatabase,
    async (req, res) => {
      const record = await Model.create(req.recordData);
      res.status(201).json({
        message: `${kind} request saved successfully.`,
        [`${kind.toLowerCase()}Id`]: record.id,
        status: record.status,
        ...(kind === "Order"
          ? { total: record.total, currency: record.currency || "INR" }
          : {}),
      });
    },
  );
  router.use(requireAdmin);
  router.param("id", (req, res, next, id) => {
    if (!mongoose.isObjectIdOrHexString(id))
      return next(new HttpError(400, "Invalid record ID."));
    next();
  });
  router.get("/", requireDatabase, async (req, res) =>
    res.json(await Model.find().sort({ createdAt: -1 }).lean()),
  );
  router.get("/:id", requireDatabase, async (req, res) => {
    const record = await Model.findById(req.params.id).lean();
    if (!record) throw new HttpError(404, `${kind} not found.`);
    res.json(record);
  });
  router.patch(
    "/:id",
    (req, res, next) => {
      req.statusData = statusData(req.body, statuses);
      next();
    },
    requireDatabase,
    async (req, res) => {
      const record = await Model.findByIdAndUpdate(
        req.params.id,
        { $set: req.statusData },
        { returnDocument: "after", runValidators: true },
      );
      if (!record) throw new HttpError(404, `${kind} not found.`);
      res.json(record);
    },
  );
  router.delete("/:id", requireDatabase, async (req, res) => {
    const record = await Model.findByIdAndDelete(req.params.id);
    if (!record) throw new HttpError(404, `${kind} not found.`);
    res.status(204).end();
  });
  return router;
};
