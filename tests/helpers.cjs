const { randomBytes } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const request = require("supertest");
const { createApp } = require("../src/app");
const { createMenuStore } = require("../src/utils/menu-store");
const config = {
  ADMIN_USERNAME: "evaluation-admin",
  ADMIN_PASSWORD: randomBytes(24).toString("hex"),
  SESSION_SECRET: randomBytes(48).toString("hex"),
  NODE_ENV: "test",
};
async function fixture(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gourmet-test-"));
  const filename = path.join(directory, "menu.json");
  await fs.copyFile(path.join(__dirname, "../data/menu.json"), filename);
  const seedMenu = JSON.parse(await fs.readFile(filename, 'utf8'));
  const app = createApp({
    config,
    menuStore: createMenuStore(filename),
    ...options,
  });
  const agent = request.agent(app);
  const login = await agent
    .post("/api/auth/login")
    .send({ username: config.ADMIN_USERNAME, password: config.ADMIN_PASSWORD })
    .expect(200);
  return {
    app,
    agent,
    csrf: login.body.csrfToken,
    filename,
    seedMenu,
    seedCount: seedMenu.length,
    cleanup: () => fs.rm(directory, { recursive: true, force: true }),
  };
}
const sampleMenu = {
  id: "evaluation-dish",
  name: "Evaluation garden bowl",
  category: "kitchen",
  description: "Illustrative seasonal vegetables for an API test.",
  price: 450,
  image: "/assets/garden.jpg",
  available: true,
};
const sampleCustomer = { customerName: 'Evaluation Customer', customerPhone: '9000000000' };
module.exports = { fixture, config, sampleMenu, sampleCustomer };
