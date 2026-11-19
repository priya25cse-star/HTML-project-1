const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium } = require("@playwright/test");
const { fixture, config } = require("./helpers.cjs");
const { databaseFixture } = require("./database-fixture.cjs");

async function main() {
  const results = [];
  const db = await databaseFixture();
  const f = await fixture({ models: db.models });
  const server = f.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const chromePaths = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  let executablePath;
  for (const path of chromePaths) {
    try {
      await fs.access(path);
      executablePath = path;
      break;
    } catch {}
  }
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const pass = (title) => {
    results.push(title);
    console.log(`PASS ${title}`);
  };
  await fs.mkdir("test-results", { recursive: true });
  try {
    await page.goto(base);
    await page.locator("#featuredMenu .food-card").first().waitFor();
    assert.equal(await page.locator("#featuredMenu .food-card").count(), 3);
    assert.equal(
      await page.locator("h1").innerText(),
      "Good food.\nBetter company.",
    );
    await page.screenshot({
      path: "test-results/home-desktop.png",
      fullPage: true,
    });
    pass("Homepage, live featured menu and desktop screenshot");
    await page.goto(`${base}/Menu.html`);
    await page.locator("#menuGrid .food-card").first().waitFor();
    assert.equal(await page.locator("#menuGrid .food-card").count(), 6);
    await page.locator("#menuSearch").fill("granola");
    assert.equal(await page.locator("#menuGrid .food-card").count(), 1);
    await page.locator("#menuSearch").fill("no-such-food");
    assert.match(await page.locator("#menuStatus").innerText(), /No matching/);
    await page.locator("#menuSearch").fill("");
    await page
      .getByRole("button", { name: "From the kitchen", exact: true })
      .click();
    assert.equal(await page.locator("#menuGrid .food-card").count(), 3);
    await page.getByRole("button", { name: "All dishes", exact: true }).click();
    pass("Menu loading, search, category filters and empty state");
    await page
      .getByRole("button", { name: "Add Bread Basket to order", exact: true })
      .click();
    assert.equal(await page.locator("#cartTotal").innerText(), "$5.50");
    await page
      .getByRole("button", { name: "Add one Bread Basket", exact: true })
      .click();
    assert.equal(await page.locator("#cartTotal").innerText(), "$11.00");
    await page
      .getByRole("button", { name: "Remove one Bread Basket", exact: true })
      .click();
    assert.equal(await page.locator("#cartTotal").innerText(), "$5.50");
    await page.reload();
    await page.locator("#menuGrid .food-card").first().waitFor();
    assert.equal(await page.locator("#cartTotal").innerText(), "$5.50");
    pass(
      "Cart add, increment, decrement, totals and persistence across reload",
    );
    await page
      .getByRole("button", {
        name: "Remove Bread Basket from order",
        exact: true,
      })
      .click();
    assert.equal(await page.locator("#cartTotal").innerText(), "$0.00");
    assert.ok(await page.locator("#placeOrder").isDisabled());
    await page.locator("#specialButton").click();
    assert.match(
      await page.locator("#specialMessage").innerText(),
      /Seasonal Garden Plate/,
    );
    pass("Cart removal, empty checkout guard and live daily special");
    await page.locator('#loadRecipes').click();
    await page.waitForFunction(() => !document.getElementById('loadRecipes').disabled);
    const recipeCount = await page.locator('#recipeGrid .food-card').count();
    if (recipeCount) {
      assert.equal(recipeCount, 3);
      assert.match(await page.locator('#recipeStatus').innerText(), /TheMealDB/);
      assert.equal(await page.locator('#recipeGrid button').count(), 0);
      pass('Live external recipe cards are separate from the purchasable menu');
    } else {
      assert.match(await page.locator('#recipeStatus').innerText(), /unavailable|No recipe/);
      pass('External recipe outage or empty results have a visible fallback');
    }
    await page
      .getByRole("button", { name: "Add Bread Basket to order", exact: true })
      .click();
    await page.route("**/api/orders", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Test: database unavailable" }),
      }),
    );
    await page.locator("#placeOrder").click();
    await page.waitForFunction(
      () => document.getElementById("orderMessage").dataset.state === "error",
    );
    assert.match(
      await page.locator("#orderMessage").innerText(),
      /database unavailable/,
    );
    assert.equal(await page.locator("#cartTotal").innerText(), "$5.50");
    await page.unroute("**/api/orders");
    pass("Failed orders show an error and preserve the cart");
    if (db) {
      await page.locator("#placeOrder").click();
      await page.waitForFunction(
        () =>
          document.getElementById("orderMessage").dataset.state === "success",
      );
      assert.equal(await db.models.Order.countDocuments(), 1);
      assert.equal((await db.models.Order.findOne()).total, 5.5);
      assert.equal(await page.locator("#cartTotal").innerText(), "$0.00");
      pass("Browser checkout persists an actual MongoDB order");
    }
    await page.goto(`${base}/Contact.html`);
    await page.locator("#name").fill("Browser Evaluation Guest");
    await page.locator("#phone").fill("9000000000");
    await page.locator("#people").fill("18");
    await page.locator("#date").fill("2099-12-01");
    await page
      .locator("#message")
      .fill("Vegetarian menu, fictional evaluation request.");
    assert.match(
      await page.locator("#characterCounter").innerText(),
      /characters remaining/,
    );
    let submissions = 0;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/bookings") && req.method() === "POST")
        submissions++;
    });
    await page.route("**/api/bookings", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Test: booking service unavailable" }),
      });
    });
    await page.locator("#contactForm button[type=submit]").click();
    assert.ok(
      await page.locator("#contactForm button[type=submit]").isDisabled(),
    );
    await page.waitForFunction(
      () =>
        document.getElementById("responseMessage").dataset.state === "error",
    );
    assert.ok(page.url().endsWith("Contact.html"));
    assert.equal(submissions, 1);
    assert.equal(
      await page.locator("#name").inputValue(),
      "Browser Evaluation Guest",
    );
    await page.unroute("**/api/bookings");
    pass(
      "Booking failure stays on form, retains input and sends exactly one request",
    );
    if (db) {
      await page.locator("#contactForm button[type=submit]").click();
      await page.waitForURL("**/thankyou.html");
      assert.equal(submissions, 2);
      assert.equal(await db.models.Booking.countDocuments(), 1);
      assert.match(
        await page.locator("#bookingReference").innerText(),
        /Booking reference:/,
      );
      pass(
        "Booking redirects only after actual MongoDB persistence and shows receipt",
      );
    }
    const fresh = await browser.newPage();
    await fresh.goto(`${base}/thankyou.html`);
    assert.match(
      await fresh.locator("#thankMessage").innerText(),
      /Start with a booking/,
    );
    await fresh.close();
    pass("Direct thank-you visits do not claim a saved booking");
    await page.goto(`${base}/Admin.html`);
    await page.locator("#username").fill(config.ADMIN_USERNAME);
    await page.locator("#password").fill(config.ADMIN_PASSWORD);
    await page.locator("#loginForm button[type=submit]").click();
    await page.locator("#dashboard").waitFor({ state: "visible" });
    await page.locator("#adminMenu table").waitFor();
    assert.equal(await page.locator("#summaryMenu").innerText(), "6");
    pass("Admin authentication and live summary counts");
    await page.locator("#addMenu").click();
    await page.locator("#menuName").fill("Browser evaluation bowl");
    await page
      .locator("#menuDescription")
      .fill("Fictional item for browser CRUD verification.");
    await page.locator("#menuPrice").fill("14.25");
    await page.locator("#menuForm button[type=submit]").click();
    await page.locator("#menuDialog").waitFor({ state: "hidden" });
    await page
      .getByRole("row")
      .filter({ hasText: "Browser evaluation bowl" })
      .waitFor();
    assert.equal(JSON.parse(await fs.readFile(f.filename, "utf8")).length, 7);
    const menuRow = page
      .getByRole("row")
      .filter({ hasText: "Browser evaluation bowl" });
    await menuRow.getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator("#menuPrice").fill("15.50");
    await page.locator("#menuAvailable").selectOption("false");
    await page.locator("#menuForm button[type=submit]").click();
    await page.locator("#menuDialog").waitFor({ state: "hidden" });
    await page.waitForFunction(() =>
      document.getElementById("adminMenu").textContent.includes("$15.50"),
    );
    const newItem = JSON.parse(await fs.readFile(f.filename, "utf8")).find(
      (item) => item.name === "Browser evaluation bowl",
    );
    assert.equal(newItem.price, 15.5);
    assert.equal(newItem.available, false);
    page.once("dialog", (dialog) => dialog.dismiss());
    await menuRow.getByRole("button", { name: "Delete", exact: true }).click();
    assert.equal(JSON.parse(await fs.readFile(f.filename, "utf8")).length, 7);
    page.once("dialog", (dialog) => dialog.accept());
    await menuRow.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForFunction(
      () =>
        !document
          .getElementById("adminMenu")
          .textContent.includes("Browser evaluation bowl"),
    );
    assert.equal(JSON.parse(await fs.readFile(f.filename, "utf8")).length, 6);
    pass(
      "Admin menu create, edit, availability, delete confirmation and on-disk changes",
    );
    if (db) {
      await page.locator("#tabBookings").click();
      await page.locator("#adminBookings select").selectOption("Confirmed");
      await page.waitForFunction(() =>
        document
          .getElementById("adminMessage")
          .textContent.includes("Status updated"),
      );
      assert.equal((await db.models.Booking.findOne()).status, "Confirmed");
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .locator("#adminBookings")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await page.locator("#adminBookings .empty-state").waitFor();
      assert.equal(await db.models.Booking.countDocuments(), 0);
      await page.locator("#tabOrders").click();
      await page.locator("#adminOrders select").selectOption("Preparing");
      await page.waitForFunction(() =>
        document
          .getElementById("adminMessage")
          .textContent.includes("Status updated"),
      );
      assert.equal((await db.models.Order.findOne()).status, "Preparing");
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .locator("#adminOrders")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await page.locator("#adminOrders .empty-state").waitFor();
      assert.equal(await db.models.Order.countDocuments(), 0);
      pass(
        "Admin booking/order status updates and deletions persist in actual MongoDB",
      );
    }
    await page.locator("#logout").click();
    await page.locator("#loginPanel").waitFor({ state: "visible" });
    assert.ok(await page.locator("#dashboard").isHidden());
    pass("Admin logout clears the authenticated dashboard");
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const file of [
        "Index.html",
        "Menu.html",
        "Contact.html",
        "Admin.html",
        "thankyou.html",
      ]) {
        await page.goto(`${base}/${file}`);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert.equal(overflow, false, `${file} overflows at ${width}px`);
      }
    }
    pass("All five pages fit mobile, tablet and desktop widths");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(base);
    await page.locator("#menuToggle").click();
    assert.equal(
      await page.locator("#menuToggle").getAttribute("aria-expanded"),
      "true",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("#menuToggle").getAttribute("aria-expanded"),
      "false",
    );
    await page.locator("#menuToggle").click();
    await page
      .locator("#navLinks")
      .getByRole("link", { name: "The menu", exact: true })
      .click();
    await page.waitForURL("**/Menu.html");
    assert.equal(
      await page.locator("#menuToggle").getAttribute("aria-expanded"),
      "false",
    );
    await page.goto(base);
    await page.locator("#featuredMenu .food-card").first().waitFor();
    await page.screenshot({
      path: "test-results/home-mobile.png",
      fullPage: true,
    });
    pass(
      "Mobile navigation, Escape key, link navigation and mobile screenshot",
    );
    assert.deepEqual(errors, []);
    pass("No uncaught browser JavaScript errors");
    await fs.writeFile(
      "test-results/browser-results.json",
      JSON.stringify(
        { realMongoDB: Boolean(db), passed: results, errors },
        null,
        2,
      ),
    );
    console.log(`Browser checks: ${results.length} passed. Real MongoDB: verified. Database success flows skipped: 0.`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await f.cleanup();
    if (db) await db.cleanup();
  }
}
main().catch((error) => {
  if (error.name === 'DatabaseConnectionError') console.error(error.message);
  else if (error.name?.startsWith('Mongo')) console.error(require('../src/utils/database-errors').safeDatabaseError(error).message);
  else console.error(error);
  process.exitCode = 1;
});
