const { HttpError } = require("./errors");
function check(condition, message) {
  if (!condition) throw new HttpError(400, message);
}
function object(value) {
  check(
    value && typeof value === "object" && !Array.isArray(value),
    "Provide a JSON object.",
  );
}
function fields(value, allowed) {
  object(value);
  check(
    Object.keys(value).every((key) => allowed.includes(key)),
    "Request contains unsupported fields.",
  );
}
function text(value, label, max, required = true) {
  check(
    typeof value === "string" &&
      value.trim().length <= max &&
      (!required || value.trim().length > 0),
    `${label} must be ${required ? "1" : "0"} to ${max} characters.`,
  );
  return value.trim();
}
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function bookingData(body) {
  fields(body, ["name", "phone", "people", "date", "message"]);
  const name = text(body.name, "Customer name", 100);
  check(
    typeof body.phone === "string" && /^[0-9]{10}$/.test(body.phone),
    "Enter a 10-digit phone number.",
  );
  check(
    Number.isInteger(body.people) && body.people >= 1 && body.people <= 10000,
    "Guests must be an integer from 1 to 10000.",
  );
  check(
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date),
    "Use an event date in YYYY-MM-DD format.",
  );
  const parsed = new Date(`${body.date}T00:00:00Z`);
  check(
    !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === body.date &&
      body.date >= today(),
    "Choose a valid event date today or in the future (India time).",
  );
  return {
    name,
    phone: body.phone,
    people: body.people,
    date: body.date,
    message: text(body.message ?? "", "Special requirements", 200, false),
  };
}
function menuData(body) {
  fields(body, [
    "id",
    "name",
    "category",
    "description",
    "price",
    "image",
    "available",
  ]);
  if (body.id !== undefined)
    check(
      typeof body.id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(body.id),
      "ID must be 1 to 64 letters, digits, hyphens or underscores.",
    );
  const name = text(body.name, "Name", 100);
  const category = text(body.category, "Category", 40).toLowerCase();
  const description = text(body.description, "Description", 300);
  check(
    typeof body.price === "number" &&
      Number.isFinite(body.price) &&
      body.price > 0 &&
      body.price <= 50000 &&
      Math.abs(body.price * 100 - Math.round(body.price * 100)) < 0.000001,
    "Price must be greater than zero, at most 50000, with at most two decimal places.",
  );
  const image = text(body.image, "Image URL or path", 1000);
  check(
    /^\/assets\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|svg)$/.test(image) ||
      /^https:\/\//i.test(image),
    "Use an HTTPS image URL or an /assets/ image path.",
  );
  try {
    if (image.startsWith("https:")) {
      const url = new URL(image);
      check(
        !url.username && !url.password && Boolean(url.hostname),
        "Invalid image URL.",
      );
    }
  } catch {
    throw new HttpError(400, "Invalid image URL.");
  }
  check(
    typeof body.available === "boolean",
    "Availability must be true or false.",
  );
  return {
    ...(body.id ? { id: body.id } : {}),
    name,
    category,
    description,
    price: body.price,
    image,
    available: body.available,
  };
}
function statusData(body, allowed) {
  fields(body, ["status"]);
  check(
    allowed.includes(body.status),
    `Status must be one of: ${allowed.join(", ")}.`,
  );
  return { status: body.status };
}
function orderData(body, menu) {
  // Client prices are ignored; the file-backed menu is authoritative.
  fields(body, ["items", "total", "customerName", "customerPhone", "currency"]);
  const customerName = text(body.customerName, "Customer name", 100);
  const customerPhone = text(body.customerPhone, "Contact number", 10);
  check(/^[0-9]{10}$/.test(customerPhone), "Enter a 10-digit contact number.");
  check(
    Array.isArray(body.items) &&
      body.items.length >= 1 &&
      body.items.length <= 50,
    "An order must have 1 to 50 items.",
  );
  const seen = new Set();
  const items = body.items.map((item) => {
    fields(item, ["menuId", "quantity", "price", "name"]);
    check(
      typeof item.menuId === "string" && !seen.has(item.menuId),
      "Every order item needs a unique menuId.",
    );
    seen.add(item.menuId);
    check(
      Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 100,
      "Quantity must be an integer from 1 to 100.",
    );
    const food = menu.find((food) => food.id === item.menuId);
    check(
      food && food.available,
      "An item is unavailable or no longer on the menu. Refresh your menu.",
    );
    return {
      menuId: food.id,
      name: food.name,
      quantity: item.quantity,
      price: food.price,
    };
  });
  const cents = items.reduce(
    (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
    0,
  );
  return { customerName, customerPhone, items, total: cents / 100, currency: "INR" };
}
module.exports = {
  check,
  fields,
  bookingData,
  menuData,
  statusData,
  orderData,
  today,
};
