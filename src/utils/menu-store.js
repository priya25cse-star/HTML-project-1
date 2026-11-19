const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { HttpError } = require("./errors");
const { menuData } = require("./validation");
function createMenuStore(
  filename = path.join(__dirname, "../../data/menu.json"),
) {
  let queue = Promise.resolve();
  async function readFile() {
    try {
      const items = JSON.parse(await fs.readFile(filename, "utf8"));
      if (!Array.isArray(items)) throw new Error("Invalid menu");
      const ids = new Set();
      for (const item of items) {
        menuData(item);
        if (!item.id || ids.has(item.id))
          throw new Error("Invalid or duplicate ID");
        ids.add(item.id);
      }
      return items;
    } catch {
      throw new HttpError(
        503,
        "Menu storage is missing or invalid. Ask the administrator to check data/menu.json.",
      );
    }
  }
  function mutate(change) {
    // Serialize the entire read/modify/write operation to prevent lost updates.
    const operation = queue.then(async () => {
      const items = await readFile();
      const result = change(items);
      const temporary = `${filename}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, `${JSON.stringify(items, null, 2)}\n`, {
          flag: "wx",
        });
        await fs.rename(temporary, filename);
      } finally {
        await fs.rm(temporary, { force: true });
      }
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return {
    async list() {
      await queue;
      return readFile();
    },
    async get(id) {
      const item = (await this.list()).find((item) => item.id === id);
      if (!item) throw new HttpError(404, "Menu item not found.");
      return item;
    },
    create(body) {
      const data = menuData(body);
      return mutate((items) => {
        const item = { ...data, id: data.id || randomUUID() };
        if (items.some((existing) => existing.id === item.id))
          throw new HttpError(409, "Menu ID already exists.");
        items.push(item);
        return item;
      });
    },
    update(id, body) {
      const data = menuData(body);
      if (data.id && data.id !== id)
        throw new HttpError(400, "A menu ID cannot be changed.");
      return mutate((items) => {
        const index = items.findIndex((item) => item.id === id);
        if (index < 0) throw new HttpError(404, "Menu item not found.");
        items[index] = { ...data, id };
        return items[index];
      });
    },
    remove(id) {
      return mutate((items) => {
        const index = items.findIndex((item) => item.id === id);
        if (index < 0) throw new HttpError(404, "Menu item not found.");
        items.splice(index, 1);
      });
    },
  };
}
module.exports = { createMenuStore };
