// 1. Select HTML elements
const form = document.getElementById("contactForm");
const nameInput = document.getElementById("name");
const livePreview = document.getElementById("livePreview");
const responseMessage = document.getElementById("responseMessage");

// 2. Live name preview using input event
if (nameInput && livePreview) {

    nameInput.addEventListener("input", function() {

        livePreview.innerText =
            nameInput.value ? "Your name: " + nameInput.value : "";

    });

}

// 3. Form submission using submit event
if (form && responseMessage) {

    form.addEventListener("submit", function(event) {

        event.preventDefault();

        responseMessage.innerText =
            "Thank you! Your details have been submitted.";

        responseMessage.style.color = "green";

        // Redirect to Thank You page
        setTimeout(function() {

            window.location.href = "thankyou.html";

        }, 1500);

    });

}
// Today's Special button
const specialButton = document.getElementById("specialButton");
const specialMessage = document.getElementById("specialMessage");

if (specialButton && specialMessage) {

    specialButton.addEventListener("click", function() {

        specialMessage.innerText =
            "Today's Special: Belgian Waffle";

    });

}
document.addEventListener("DOMContentLoaded", function () {

    // ==================================
    // 1. MOBILE NAVBAR TOGGLE
    // ==================================

    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");

    if (menuToggle && navLinks) {

        menuToggle.addEventListener("click", function () {

            const isOpen = navLinks.classList.toggle("open");

            menuToggle.setAttribute("aria-expanded", isOpen);
            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation menu" : "Open navigation menu"
            );

            menuToggle.textContent = isOpen ? "✕" : "☰";

        });

        navLinks.querySelectorAll("a").forEach(function (link) {

            link.addEventListener("click", function () {
                navLinks.classList.remove("open");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Open navigation menu");
                menuToggle.textContent = "☰";
            });

        });

    }


    // ==================================
    // 2. ACTIVE NAVBAR LINKS
    // ==================================

    const currentPage = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    document.querySelectorAll(".nav-links a").forEach(function (link) {

        const href = link.getAttribute("href");

        if (!href) return;

        const linkPage = href.split("#")[0].toLowerCase();

        const isHomePage =
            currentPage === "" || currentPage === "index.html";

        if (
            (linkPage === "index.html" && isHomePage && href.includes("#about")) ||
            (linkPage && linkPage === currentPage &&
                !href.includes("#about"))
        ) {
            link.setAttribute("aria-current", "page");
        }

    });


    // ==================================
    // 3. REVEAL ON SCROLL
    // ==================================

    const revealSections = document.querySelectorAll(
        ".about, .home-info, .menu-page-content, .contact"
    );

    if ("IntersectionObserver" in window) {

        const observer = new IntersectionObserver(
            function (entries, observerInstance) {

                entries.forEach(function (entry) {

                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        observerInstance.unobserve(entry.target);
                    }

                });

            },
            { threshold: 0.1 }
        );

        revealSections.forEach(function (section) {
            section.classList.add("reveal");
            observer.observe(section);
        });

    } else {

        revealSections.forEach(function (section) {
            section.classList.add("visible");
        });

    }


    // ==================================
    // 4. MENU SEARCH AND CATEGORY FILTER
    // ==================================

    const menuSearch = document.getElementById("menuSearch");

    const menuItems = Array.from(
        document.querySelectorAll(".menu-page-item")
    );

    const filterButtons = document.querySelectorAll("[data-filter]");

    const menuNoResults = document.getElementById("menuNoResults");

    let selectedCategory = "all";

    function filterMenu() {

        if (!menuSearch) return;

        const searchTerm = menuSearch.value.trim().toLowerCase();

        let visibleCount = 0;

        menuItems.forEach(function (item) {

            const itemText = item.textContent.toLowerCase();
            const itemCategory = item.dataset.category || "";

            const matchesSearch = itemText.includes(searchTerm);

            const matchesCategory =
                selectedCategory === "all" ||
                itemCategory === selectedCategory;

            const shouldShow = matchesSearch && matchesCategory;

            item.hidden = !shouldShow;

            if (shouldShow) {
                visibleCount++;
            }

        });

        if (menuNoResults) {
            menuNoResults.hidden = visibleCount !== 0;
        }

    }

    if (menuSearch) {
        menuSearch.addEventListener("input", filterMenu);
    }

    filterButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            selectedCategory = button.dataset.filter;

            filterButtons.forEach(function (otherButton) {
                otherButton.classList.remove("active");
            });

            button.classList.add("active");

            filterMenu();

        });

    });

    const allFilter = document.querySelector('[data-filter="all"]');

    if (allFilter) {
        allFilter.classList.add("active");
    }


    // ==================================
    // 5. ADD TO ORDER AND TOTAL PRICE
    // ==================================

    const cartItemsElement = document.getElementById("cartItems");
    const cartTotalElement = document.getElementById("cartTotal");
    const placeOrderButton = document.getElementById("placeOrder");
    const orderMessage = document.getElementById("orderMessage");

    const cart = new Map();

    function getFoodPrice(item) {

        const priceElement = item.querySelector("span");

        if (!priceElement) return NaN;

        return Number(
            priceElement.textContent.replace(/[^0-9.]/g, "")
        );

    }

    function renderCart() {

        if (!cartItemsElement || !cartTotalElement) return;

        cartItemsElement.replaceChildren();

        let total = 0;

        if (cart.size === 0) {

            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "Your cart is empty.";

            cartItemsElement.appendChild(emptyMessage);

        }

        cart.forEach(function (cartItem, itemName) {

            const row = document.createElement("div");
            row.className = "cart-row";

            const title = document.createElement("span");
            title.textContent = itemName;

            const quantity = document.createElement("span");
            quantity.textContent = "Quantity: " + cartItem.quantity;

            const subtotal = document.createElement("span");
            subtotal.textContent =
                "$" + (cartItem.price * cartItem.quantity).toFixed(2);

            const minusButton = document.createElement("button");
            minusButton.type = "button";
            minusButton.textContent = "−";
            minusButton.setAttribute(
                "aria-label",
                "Remove one " + itemName
            );

            minusButton.addEventListener("click", function () {

                cartItem.quantity--;

                if (cartItem.quantity <= 0) {
                    cart.delete(itemName);
                }

                renderCart();

            });

            const plusButton = document.createElement("button");
            plusButton.type = "button";
            plusButton.textContent = "+";
            plusButton.setAttribute(
                "aria-label",
                "Add one " + itemName
            );

            plusButton.addEventListener("click", function () {

                cartItem.quantity++;
                renderCart();

            });

            row.append(
                title,
                quantity,
                subtotal,
                minusButton,
                plusButton
            );

            cartItemsElement.appendChild(row);

            total += cartItem.price * cartItem.quantity;

        });

        cartTotalElement.textContent = "$" + total.toFixed(2);

    }

    menuItems.forEach(function (item) {

        const itemNameElement = item.querySelector("h3");

        if (!itemNameElement) return;

        const itemName = itemNameElement.textContent.trim();

        const price = getFoodPrice(item);

        const addButton = document.createElement("button");

        addButton.type = "button";
        addButton.className = "add-to-order";
        addButton.textContent = "Add to Order";

        addButton.addEventListener("click", function () {

            if (!Number.isFinite(price) || price < 0) {
                return;
            }

            if (cart.has(itemName)) {
                cart.get(itemName).quantity++;
            } else {
                cart.set(itemName, {
                    price: price,
                    quantity: 1
                });
            }

            if (orderMessage) {
                orderMessage.textContent = "";
            }

            renderCart();

        });

        item.appendChild(addButton);

    });

    renderCart();


    // ==================================
    // 6. PLACE ORDER THROUGH BACKEND
    // ==================================

    if (placeOrderButton) {

        placeOrderButton.addEventListener("click", async function () {

            if (cart.size === 0) {

                if (orderMessage) {
                    orderMessage.textContent =
                        "Please add at least one item to your order.";
                }

                return;

            }

            placeOrderButton.disabled = true;

            try {

                const items = Array.from(cart.entries()).map(
                    function ([name, item]) {
                        return {
                            name: name,
                            quantity: item.quantity
                        };
                    }
                );

                const response = await fetch("/api/orders", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({ items: items })

                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || "Order failed.");
                }

                if (orderMessage) {
                    orderMessage.textContent =
                        "Order request submitted successfully! Order ID: " +
                        result.orderId;
                }

                cart.clear();
                renderCart();

            } catch (error) {

                if (orderMessage) {
                    orderMessage.textContent =
                        error.message ||
                        "Could not submit order. Please try again.";
                }

            } finally {

                placeOrderButton.disabled = false;

            }

        });

    }


    // ==================================
    // 7. CONTACT FORM CHARACTER COUNTER
    // ==================================

    const messageInput = document.getElementById("message");

    const characterCounter =
        document.getElementById("characterCounter");

    if (messageInput && characterCounter) {

        function updateCharacterCounter() {

            const maxLength = Number(messageInput.maxLength);

            const remaining =
                maxLength - messageInput.value.length;

            characterCounter.textContent =
                remaining + " characters remaining";

        }

        messageInput.addEventListener(
            "input",
            updateCharacterCounter
        );

        updateCharacterCounter();

    }


    // ==================================
    // 8. CONTACT FORM VALIDATION
    // ==================================

    const contactForm = document.getElementById("contactForm");

    const responseMessage =
        document.getElementById("responseMessage");

    const dateInput = document.getElementById("date");

    if (dateInput) {

        const today = new Date();

        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");

        dateInput.min = `${year}-${month}-${day}`;

    }

    if (contactForm) {

        contactForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            if (!contactForm.reportValidity()) {
                return;
            }

            const name = document.getElementById("name").value.trim();

            const phone = document.getElementById("phone").value.trim();

            const people = Number(
                document.getElementById("people").value
            );

            const date = document.getElementById("date").value;

            const message = document.getElementById("message").value.trim();

            if (!name || !/^[0-9]{10}$/.test(phone)) {

                responseMessage.textContent =
                    "Enter your name and a valid 10-digit phone number.";

                return;

            }

            if (!Number.isInteger(people) || people < 1) {

                responseMessage.textContent =
                    "Please enter a valid number of people.";

                return;

            }

            const todayString = new Date();

            const todayDate =
                `${todayString.getFullYear()}-` +
                `${String(todayString.getMonth() + 1).padStart(2, "0")}-` +
                `${String(todayString.getDate()).padStart(2, "0")}`;

            if (!date || date < todayDate) {

                responseMessage.textContent =
                    "Please select today or a future date.";

                return;

            }

            const submitButton =
                contactForm.querySelector('button[type="submit"]');

            submitButton.disabled = true;

            responseMessage.textContent = "Submitting your request...";

            try {

                const response = await fetch("/api/bookings", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        name: name,
                        phone: phone,
                        people: people,
                        date: date,
                        message: message
                    })

                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.message || "Could not submit your request."
                    );
                }

                sessionStorage.setItem(
                    "gourmetThankYouName",
                    name
                );

                window.location.href = "thankyou.html";

            } catch (error) {

                responseMessage.textContent =
                    error.message ||
                    "Something went wrong. Please try again.";

            } finally {

                submitButton.disabled = false;

            }

        });

    }


    // ==================================
    // 9. TODAY'S SPECIAL
    // ==================================

    const specialButton = document.getElementById("specialButton");

    const specialMessage = document.getElementById("specialMessage");

    if (specialButton && specialMessage) {

        specialButton.addEventListener("click", function () {

            specialMessage.textContent =
                "Today's special: Seasonal Garden Plate — $9.50";

        });

    }

});
