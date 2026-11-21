"use strict";
const $ = (id) => document.getElementById(id);
const money = (value, currency = "INR") =>
  new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", {
    style: "currency",
    currency: currency || "INR",
  }).format(value);
function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
function message(target, value, state = "") {
  if (!target) return;
  target.textContent = value;
  target.dataset.state = state;
}
async function api(url, options = {}) {
  let response;
  const baseUrl = window.API_BASE_URL || "";
  const targetUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  try {
    response = await fetch(targetUrl, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      credentials: "include",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "Unable to reach the server. Check your connection and try again.",
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result.message || "Unable to complete your request. Please try again.",
    );
  return result;
}
function navigation() {
  const toggle = $("menuToggle");
  const links = $("navLinks");
  function close() {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");
  }
  toggle?.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? "Close navigation menu" : "Open navigation menu",
    );
  });
  links?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
    const target = new URL(link.href);
    if (
      !target.hash &&
      target.pathname.toLowerCase() ===
        (location.pathname === "/"
          ? "/index.html"
          : location.pathname.toLowerCase())
    )
      link.setAttribute("aria-current", "page");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && links?.classList.contains("open")) {
      close();
      toggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (links?.classList.contains("open") && !event.target.closest(".navbar"))
      close();
  });
}
function foodCard(item, action) {
  const card = element("article", "food-card");
  const img = element("img");
  img.src = item.image;
  img.alt = item.name;
  img.loading = "lazy";
  img.width = 600;
  img.height = 450;
  img.addEventListener(
    "error",
    () => {
      if (!img.src.endsWith("/assets/garden.jpg"))
        img.src = "/assets/garden.jpg";
    },
    { once: true },
  );
  const body = element("div", "food-card-content");
  body.append(
    element(
      "p",
      "eyebrow",
      item.category === "kitchen" ? "From the kitchen" : item.category,
    ),
    element("h3", "", item.name),
    element("p", "", item.description),
  );
  const bottom = element("div", "food-card-bottom");
  bottom.append(element("span", "price", money(item.price)));
  if (action) {
    const button = element(
      "button",
      "button",
      item.available ? "Add to order +" : "Unavailable",
    );
    button.type = "button";
    button.disabled = !item.available;
    button.setAttribute(
      "aria-label",
      item.available
        ? `Add ${item.name} to order`
        : `${item.name} is unavailable`,
    );
    button.addEventListener("click", () => action(item));
    bottom.append(button);
  } else {
    const link = element("a", "text-link", "View menu ↗");
    link.href = "Menu.html";
    bottom.append(link);
  }
  body.append(bottom);
  card.append(img, body);
  return card;
}
async function featured() {
  if (!$("featuredMenu")) return;
  $("retryFeatured").hidden = true;
  message($("featuredStatus"), "Bringing the menu to your table…");
  try {
    const items = await api("/api/menu");
    const available = items.filter((item) => item.available).slice(0, 3);
    $("featuredMenu").replaceChildren(
      ...available.map((item) => foodCard(item)),
    );
    message(
      $("featuredStatus"),
      available.length
        ? ""
        : "Our next seasonal menu is on its way. Please check back soon.",
    );
  } catch (error) {
    message($("featuredStatus"), error.message, "error");
    $("retryFeatured").hidden = false;
  }
}
async function menuPage() {
  if (!$("menuGrid")) return;
  let items = [],
    category = "all",
    sending = false;
  const cart = new Map();
  function saveCart() {
    try {
      localStorage.setItem(
        "gourmetCart",
        JSON.stringify(
          Array.from(cart, ([menuId, quantity]) => ({ menuId, quantity })),
        ),
      );
    } catch {
      /* Cart still works when storage is disabled. */
    }
  }
  function renderCart() {
    let totalCents = 0,
      count = 0;
    const rows = [];
    for (const [id, quantity] of cart) {
      const item = items.find((item) => item.id === id);
      if (!item) continue;
      totalCents += Math.round(item.price * 100) * quantity;
      count += quantity;
      const row = element("div", "cart-row");
      row.append(
        element("h3", "", item.name),
        element("span", "cart-price", money(item.price * quantity)),
      );
      const controls = element("div", "quantity-controls");
      const minus = element("button", "", "−");
      minus.type = "button";
      minus.disabled = sending;
      minus.setAttribute("aria-label", `Remove one ${item.name}`);
      minus.addEventListener("click", () => change(id, -1));
      const qty = element("output", "", String(quantity));
      qty.setAttribute("aria-label", `${item.name} quantity`);
      const plus = element("button", "", "+");
      plus.type = "button";
      plus.disabled = sending || quantity >= 100;
      plus.setAttribute("aria-label", `Add one ${item.name}`);
      plus.addEventListener("click", () => change(id, 1));
      controls.append(minus, qty, plus);
      const remove = element("button", "cart-remove", "Remove");
      remove.type = "button";
      remove.disabled = sending;
      remove.setAttribute("aria-label", `Remove ${item.name} from order`);
      remove.addEventListener("click", () => {
        cart.delete(id);
        saveCart();
        renderCart();
      });
      row.append(controls, remove);
      rows.push(row);
    }
    $("cartItems").replaceChildren(
      ...(rows.length
        ? rows
        : [
            element(
              "p",
              "muted",
              "Your cart is empty. Add something delicious from the menu.",
            ),
          ]),
    );
    $("cartTotal").textContent = money(totalCents / 100);
    $("cartCount").textContent = String(count);
    $("placeOrder").disabled = sending || cart.size === 0;
    $("checkoutDetails").disabled = sending;
  }
  function change(id, amount) {
    if (sending) return;
    const quantity = (cart.get(id) || 0) + amount;
    if (quantity > 100) {
      message(
        $("orderMessage"),
        "You can request up to 100 servings per item.",
        "error",
      );
      return;
    }
    if (quantity <= 0) cart.delete(id);
    else cart.set(id, quantity);
    saveCart();
    renderCart();
  }
  function add(item) {
    if (!item.available || sending) return;
    change(item.id, 1);
    message($("orderMessage"), `${item.name} added to your table.`);
  }
  function renderMenu() {
    const query = $("menuSearch").value.trim().toLowerCase();
    const filtered = items.filter(
      (item) =>
        (category === "all" || item.category === category) &&
        `${item.name} ${item.category} ${item.description}`
          .toLowerCase()
          .includes(query),
    );
    $("menuGrid").replaceChildren(
      ...filtered.map((item) => foodCard(item, add)),
    );
    message(
      $("menuCount"),
      `${filtered.length} ${filtered.length === 1 ? "dish" : "dishes"} to discover`,
    );
    $("menuStatus").hidden = filtered.length > 0;
    message(
      $("menuStatus"),
      filtered.length
        ? ""
        : "No matching dishes. Try another search or category.",
    );
  }
  async function load() {
    $("retryMenu").hidden = true;
    message($("menuCount"), "Loading our seasonal menu…");
    try {
      items = await api("/api/menu");
      for (const id of cart.keys()) {
        if (!items.some((item) => item.id === id && item.available))
          cart.delete(id);
      }
      const categories = [
        "all",
        ...new Set(items.map((item) => item.category)),
      ];
      if (!categories.includes(category)) category = "all";
      $("categoryFilters").replaceChildren(
        ...categories.map((value) => {
          const label =
            value === "all"
              ? "All dishes"
              : value === "breakfast"
                ? "Breakfast favourites"
                : value === "kitchen"
                  ? "From the kitchen"
                  : value;
          const button = element("button", "", label);
          button.type = "button";
          button.dataset.filter = value;
          button.setAttribute("aria-pressed", String(value === category));
          button.addEventListener("click", () => {
            category = value;
            $("categoryFilters")
              .querySelectorAll("button")
              .forEach((other) =>
                other.setAttribute("aria-pressed", String(other === button)),
              );
            renderMenu();
          });
          return button;
        }),
      );
      saveCart();
      renderMenu();
      renderCart();
    } catch (error) {
      message($("menuCount"), "Menu unavailable");
      $("menuStatus").hidden = false;
      message($("menuStatus"), error.message, "error");
      $("retryMenu").hidden = false;
    }
  }
  try {
    const stored = JSON.parse(localStorage.getItem("gourmetCart") || "[]");
    if (Array.isArray(stored))
      for (const entry of stored.slice(0, 50)) {
        if (
          entry &&
          typeof entry.menuId === "string" &&
          Number.isInteger(entry.quantity) &&
          entry.quantity >= 1 &&
          entry.quantity <= 100
        )
          cart.set(entry.menuId, entry.quantity);
      }
  } catch {
    /* Ignore invalid or unavailable browser storage. */
  }
  $("menuSearch").addEventListener("input", renderMenu);
  $("retryMenu").addEventListener("click", load);
  $("specialButton").addEventListener("click", () => {
    const special =
      items.find(
        (item) => item.id === "seasonal-garden-plate" && item.available,
      ) || items.find((item) => item.available);
    message(
      $("specialMessage"),
      special
        ? `Today’s special: ${special.name} · ${money(special.price)} per serving. Find it in the menu above.`
        : "Our seasonal special is unavailable right now. Please try loading the menu again.",
    );
  });
  $("customerName").addEventListener("input", () => $("customerName").setCustomValidity(""));
  $("checkoutForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (sending || !cart.size) return;
    const checkout = $("checkoutForm");
    const customerName = $("customerName").value.trim();
    const customerPhone = $("customerPhone").value.trim();
    $("customerName").setCustomValidity(customerName ? "" : "Please enter your name.");
    if (!checkout.reportValidity()) return;
    sending = true;
    renderCart();
    $("placeOrder").textContent = "Sending your request…";
    message($("orderMessage"), "Saving your order request…");
    try {
      const result = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName,
          customerPhone,
          items: Array.from(cart, ([menuId, quantity]) => ({
            menuId,
            quantity,
          })),
        }),
      });
      cart.clear();
      saveCart();
      checkout.reset();
      message(
        $("orderMessage"),
        `Your order request is saved.\nReference: ${result.orderId}\nTotal: ${money(result.total)} · ${result.status}`,
        "success",
      );
    } catch (error) {
      message($("orderMessage"), error.message, "error");
    } finally {
      sending = false;
      $("placeOrder").textContent = "Send order request ↗";
      renderCart();
    }
  });
  await load();
}
function contactPage() {
  const form = $("contactForm");
  if (!form) return;
  const india = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (key) => india.find((p) => p.type === key).value;
  $("date").min = `${part("year")}-${part("month")}-${part("day")}`;
  $("message").addEventListener("input", () => {
    $("characterCounter").textContent =
      `${200 - $("message").value.length} characters remaining`;
  });
  $("name").addEventListener("input", () => {
    $("livePreview").textContent = $("name").value.trim()
      ? `A gathering for ${$("name").value.trim()}.`
      : "";
  });
  let sending = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const data = {
      name: $("name").value.trim(),
      phone: $("phone").value.trim(),
      people: Number($("people").value),
      date: $("date").value,
      message: $("message").value.trim(),
    };
    if (!data.name) {
      message($("responseMessage"), "Please enter your name.", "error");
      return;
    }
    sending = true;
    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    message($("responseMessage"), "Saving your booking request…");
    try {
      const result = await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify(data),
      });
      // Persistence has succeeded before any redirect or success state.
      try {
        sessionStorage.setItem(
          "gourmetBookingReceipt",
          JSON.stringify({ name: data.name, id: result.bookingId }),
        );
      } catch {
        /* Do not retry an already saved booking if browser storage is blocked. */
      }
      location.assign("thankyou.html");
    } catch (error) {
      message($("responseMessage"), error.message, "error");
      sending = false;
      submit.disabled = false;
    }
  });
}
function thankYouPage() {
  if (!$("thankMessage")) return;
  try {
    const receipt = JSON.parse(
      sessionStorage.getItem("gourmetBookingReceipt") || "null",
    );
    if (receipt?.id && receipt?.name) {
      $("thankHeading").textContent = `Thank you, ${receipt.name}.`;
      $("thankMessage").textContent =
        "Your booking request has been saved. Our team will follow up by phone to confirm the details. We look forward to gathering with you.";
      $("bookingReference").textContent = `Booking reference: ${receipt.id}`;
    }
  } catch {
    /* A direct visit must not claim a booking was saved. */
  }
}
async function recipes() {
  const button = $("loadRecipes");
  if (!button) return;
  button.addEventListener("click", async () => {
    button.disabled = true;
    message($("recipeStatus"), "Finding a little inspiration…");
    try {
      const result = await api("/api/recipes");
      $("recipeGrid").replaceChildren(
        ...result.recipes.map((recipe) => {
          const card = element("article", "food-card");
          const image = element("img");
          image.src = recipe.image;
          image.alt = recipe.name;
          image.loading = "lazy";
          const body = element("div", "food-card-content");
          const link = element("a", "text-link", "Read recipe at TheMealDB ↗");
          link.href = recipe.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          body.append(
            element("p", "eyebrow", `${recipe.category} · Recipe inspiration`),
            element("h3", "", recipe.name),
            link,
          );
          card.append(image, body);
          return card;
        }),
      );
      message(
        $("recipeStatus"),
        result.recipes.length
          ? "For your home kitchen, courtesy of TheMealDB."
          : "No recipe suggestions right now. Try again later.",
      );
      button.textContent = "Refresh recipe ideas ↻";
    } catch (error) {
      message($("recipeStatus"), error.message, "error");
      button.textContent = "Try recipe ideas again ↗";
    } finally {
      button.disabled = false;
    }
  });
}
navigation();
featured();
menuPage();
contactPage();
thankYouPage();
recipes();
$("retryFeatured")?.addEventListener("click", featured);
