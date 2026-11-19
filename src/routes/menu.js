const express = require("express");
module.exports = function menuRoutes(store, requireAdmin) {
  const router = express.Router();
  router.get("/", async (req, res) => res.json(await store.list()));
  router.get("/:id", async (req, res) =>
    res.json(await store.get(req.params.id)),
  );
  router.post("/", requireAdmin, async (req, res) =>
    res.status(201).json(await store.create(req.body)),
  );
  router.put("/:id", requireAdmin, async (req, res) =>
    res.json(await store.update(req.params.id, req.body)),
  );
  router.delete("/:id", requireAdmin, async (req, res) => {
    await store.remove(req.params.id);
    res.status(204).end();
  });
  return router;
};
