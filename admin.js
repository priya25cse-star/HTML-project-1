"use strict";
// Shared DOM helpers and navigation are loaded from script.js first.
let csrfToken = "";
let authToken = "";
let menuItems = [];
const bookingStatuses = ["Pending", "Confirmed", "Cancelled"];
const orderStatuses = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Completed",
  "Cancelled",
];
function showLogin() {
  csrfToken = "";
  authToken = "";
  $("loginPanel").hidden = false;
  $("dashboard").hidden = true;
  $("logout").hidden = true;
  $("menuDialog").close();
  for (const id of ["adminMenu", "adminBookings", "adminOrders"])
    $(id).replaceChildren();
}
async function adminRequest(url, options = {}) {
  let response;
  const baseUrl = window.API_BASE_URL || "";
  const targetUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const headers = {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
    ...options.headers,
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  try {
    response = await fetch(targetUrl, {
      ...options,
      headers,
      credentials: "include",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }
  const result =
    response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !url.endsWith("/login")) showLogin();
    const error = new Error(
      result.message || "Unable to complete this action.",
    );
    error.status = response.status;
    throw error;
  }
  return result;
}
function actionButton(label, callback, danger = false) {
  const button = element(
    "button",
    `text-link${danger ? " danger-link" : ""}`,
    label,
  );
  button.type = "button";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await callback();
    } catch (error) {
      message($("adminMessage"), error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
  return button;
}
function cell(content) {
  const td = element("td");
  if (typeof content === "string") td.textContent = content;
  else if (Array.isArray(content)) td.append(...content);
  else td.append(content);
  return td;
}
function table(headers, rows) {
  const wrap = element("div", "table-wrap"),
    table = element("table");
  const thead = element("thead"),
    tr = element("tr");
  for (const title of headers) {
    const th = element("th", "", title);
    th.scope = "col";
    tr.append(th);
  }
  thead.append(tr);
  const tbody = element("tbody");
  tbody.append(...rows);
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}
function empty(target, label) {
  target.replaceChildren(element("p", "empty-state", label));
}
function openMenu(item) {
  $("menuForm").reset();
  $("editMenuId").value = item?.id || "";
  $("menuDialogHeading").textContent = item
    ? "Edit menu item"
    : "Add menu item";
  for (const [id, value] of Object.entries({
    menuName: item?.name || "",
    menuCategory: item?.category || "breakfast",
    menuDescription: item?.description || "",
    menuPrice: item?.price ?? "",
    menuAvailable: String(item?.available ?? true),
    menuImage: item?.image || "/assets/garden.jpg",
  }))
    $(id).value = value;
  message($("menuFormMessage"), "");
  $("menuDialog").showModal();
  $("menuName").focus();
}
function renderMenuAdmin(items) {
  menuItems = items;
  if (!items.length)
    return empty(
      $("adminMenu"),
      "Your menu is empty. Add the first dish above.",
    );
  const rows = items.map((item) => {
    const tr = element("tr");
    const image = element("img", "mini-image");
    image.src = item.image;
    image.alt = "";
    image.loading = "lazy";
    const details = [
      image,
      element("strong", "", item.name),
      element("p", "", item.description),
      element("p", "record-id", item.id),
    ];
    const actions = element("div", "table-actions");
    actions.append(
      actionButton("Edit", () => openMenu(item)),
      actionButton(
        "Delete",
        async () => {
          if (
            !confirm(
              `Delete “${item.name}” from the catering menu? This cannot be undone.`,
            )
          )
            return;
          await adminRequest(`/api/menu/${encodeURIComponent(item.id)}`, {
            method: "DELETE",
          });
          await refreshDashboard();
          message($("adminMessage"), "Menu item deleted.", "success");
        },
        true,
      ),
    );
    tr.append(
      cell(details),
      cell(item.category),
      cell(money(item.price)),
      cell(item.available ? "Available" : "Unavailable"),
      cell(actions),
    );
    return tr;
  });
  $("adminMenu").replaceChildren(
    table(["Dish", "Category", "Price", "Availability", "Actions"], rows),
  );
}
function renderRecords(kind, records) {
  const booking = kind === "bookings",
    target = $(booking ? "adminBookings" : "adminOrders");
  if (!records.length)
    return empty(
      target,
      booking ? "No booking requests yet." : "No orders yet.",
    );
  const rows = records.map((record) => {
    const tr = element("tr");
    const receipt = [
      element("p", "record-id", record._id),
      element(
        "p",
        "",
        new Date(record.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
      ),
    ];
    let details;
    if (booking) {
      details = [
        element("strong", "", record.name),
        element("p", "", record.phone),
        element("p", "", `${record.people} guests · ${record.date}`),
        element("p", "", record.message || "No special requirements"),
      ];
    } else {
      const list = element("ul", "record-items");
      const orderCurrency = record.currency || "USD";
      for (const item of record.items)
        list.append(
          element(
            "li",
            "",
            `${item.quantity} × ${item.name} · ${money(item.price, orderCurrency)} each`,
          ),
        );
      details = [
        element("strong", "", record.customerName || "Customer details not recorded (legacy order)"),
        element("p", "", record.customerPhone || "Contact number not recorded"),
        list,
        element("strong", "", `Total: ${money(record.total, orderCurrency)}${!record.currency || record.currency === "USD" ? " (historical USD)" : ""}`),
      ];
    }
    const status = element("select");
    status.setAttribute(
      "aria-label",
      `Status for ${booking ? record.name : record._id}`,
    );
    for (const value of booking ? bookingStatuses : orderStatuses) {
      const option = element("option", "", value);
      option.value = value;
      option.selected = value === record.status;
      status.append(option);
    }
    status.addEventListener("change", async () => {
      const previous = record.status;
      status.disabled = true;
      try {
        const updated = await adminRequest(`/api/${kind}/${record._id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: status.value }),
        });
        record.status = updated.status;
        await refreshDashboard();
        message($("adminMessage"), "Status updated.", "success");
      } catch (error) {
        status.value = previous;
        message($("adminMessage"), error.message, "error");
      } finally {
        status.disabled = false;
      }
    });
    const remove = actionButton(
      "Delete",
      async () => {
        if (
          !confirm(
            `Permanently delete this ${booking ? "booking" : "order"} request? This cannot be undone.`,
          )
        )
          return;
        await adminRequest(`/api/${kind}/${record._id}`, { method: "DELETE" });
        await refreshDashboard();
        message($("adminMessage"), "Request deleted.", "success");
      },
      true,
    );
    tr.append(cell(receipt), cell(details), cell(status), cell(remove));
    return tr;
  });
  target.replaceChildren(
    table(
      [
        "Reference / created (IST)",
        booking ? "Guest / event" : "Order details",
        "Status",
        "Actions",
      ],
      rows,
    ),
  );
}
async function refreshDashboard() {
  const button = $("refreshAdmin");
  button.disabled = true;
  message($("adminMessage"), "Loading the latest requests…");
  try {
    const results = await Promise.allSettled([
      adminRequest("/api/menu"),
      adminRequest("/api/bookings"),
      adminRequest("/api/orders"),
    ]);
    if (!csrfToken) return;
    const ids = ["adminMenu", "adminBookings", "adminOrders"];
    const counts = ["summaryMenu", "summaryBookings", "summaryOrders"];
    let pending = 0,
      errors = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        $(counts[index]).textContent = String(result.value.length);
        if (index === 0) renderMenuAdmin(result.value);
        else {
          renderRecords(index === 1 ? "bookings" : "orders", result.value);
          pending += result.value.filter(
            (record) => record.status === "Pending",
          ).length;
        }
      } else {
        $(counts[index]).textContent = "—";
        empty($(ids[index]), result.reason.message);
        errors.push(result.reason.message);
      }
    });
    $("summaryPending").textContent = errors.length ? "—" : String(pending);
    message(
      $("adminMessage"),
      errors.length
        ? [...new Set(errors)].join("\n")
        : "Your dashboard is up to date.",
      errors.length ? "error" : "success",
    );
  } finally {
    button.disabled = false;
  }
}
async function signedIn(result) {
  csrfToken = result.csrfToken;
  authToken = result.token || "";
  $("loginPanel").hidden = true;
  $("dashboard").hidden = false;
  $("logout").hidden = false;
  $("password").value = "";
  await refreshDashboard();
}
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("[type=submit]");
  if (button.disabled) return;
  button.disabled = true;
  try {
    await signedIn(
      await adminRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("username").value,
          password: $("password").value,
        }),
      }),
    );
  } catch (error) {
    message($("adminMessage"), error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("logout").addEventListener("click", async () => {
  $("logout").disabled = true;
  try {
    await adminRequest("/api/auth/logout", { method: "POST" });
    showLogin();
    message($("adminMessage"), "You have signed out.");
  } catch (error) {
    message($("adminMessage"), error.message, "error");
  } finally {
    $("logout").disabled = false;
  }
});
const tabs = [...document.querySelectorAll("[data-tab]")];
function selectTab(tab, focus = false) {
  tabs.forEach((button) => {
    const selected = button === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(`panel${button.dataset.tab}`).hidden = !selected;
  });
  if (focus) tab.focus();
}
tabs.forEach((button, index) => {
  button.addEventListener("click", () => selectTab(button));
  button.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectTab(tabs[next], true);
    }
  });
});
$("refreshAdmin").addEventListener("click", refreshDashboard);
$("addMenu").addEventListener("click", () => openMenu());
$("closeMenuDialog").addEventListener("click", () => $("menuDialog").close());
$("menuForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  const button = event.target.querySelector("[type=submit]");
  if (button.disabled) return;
  button.disabled = true;
  const id = $("editMenuId").value;
  const body = {
    name: $("menuName").value.trim(),
    category: $("menuCategory").value.trim(),
    description: $("menuDescription").value.trim(),
    price: Number($("menuPrice").value),
    available: $("menuAvailable").value === "true",
    image: $("menuImage").value.trim(),
  };
  try {
    await adminRequest(
      id ? `/api/menu/${encodeURIComponent(id)}` : "/api/menu",
      { method: id ? "PUT" : "POST", body: JSON.stringify(body) },
    );
    $("menuDialog").close();
    await refreshDashboard();
    message(
      $("adminMessage"),
      id ? "Menu item updated." : "Menu item added.",
      "success",
    );
  } catch (error) {
    message($("menuFormMessage"), error.message, "error");
  } finally {
    button.disabled = false;
  }
});
adminRequest("/api/auth/me")
  .then(signedIn)
  .catch((error) => {
    if (error.status !== 401)
      message($("adminMessage"), error.message, "error");
  });
