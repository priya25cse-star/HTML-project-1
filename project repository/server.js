
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, "data");

app.use(express.json({ limit: "20kb" }));

// ==================================
// JSON FILE FUNCTIONS
// ==================================

async function readData(fileName) {
    const filePath = path.join(DATA_DIR, fileName);

    try {
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") {
            await fs.writeFile(filePath, "[]", "utf8");
            return [];
        }
        throw error;
    }
}

async function saveData(fileName, data) {
    const filePath = path.join(DATA_DIR, fileName);

    await fs.writeFile(
        filePath,
        JSON.stringify(data, null, 4),
        "utf8"
    );
}

// ==================================
// MENU DATA
// ==================================

const menuItems = [
    {
        name: "Bread Basket",
        category: "breakfast",
        price: 5.50,
        description: "Fresh baked fruit breads and warm muffins"
    },
    {
        name: "Belgian Waffle",
        category: "breakfast",
        price: 7.50,
        description: "Vanilla batter with malted flour and berries"
    },
    {
        name: "Blueberry Pancakes",
        category: "breakfast",
        price: 8.50,
        description: "Stacked with syrup, butter, and fresh berries"
    },
    {
        name: "Honey Almond Granola",
        category: "kitchen",
        price: 7.00,
        description: "Toasted oats, raisins, almonds, and dates"
    },
    {
        name: "Scrambled Eggs",
        category: "kitchen",
        price: 7.50,
        description: "Roasted pepper, garlic, and green onions"
    },
    {
        name: "Seasonal Garden Plate",
        category: "kitchen",
        price: 9.50,
        description: "Market vegetables with herbs and house dressing"
    }
];

// ==================================
// API: GET MENU
// ==================================

app.get("/api/menu", function (req, res) {
    res.json(menuItems);
});

// ==================================
// API: CREATE BOOKING
// ==================================

app.post("/api/bookings", async function (req, res) {
    try {
        const { name, phone, people, date } = req.body;
        const message = req.body.message || "";

        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 100
        ) {
            return res.status(400).json({
                message: "Please enter a valid name."
            });
        }

        if (
            typeof phone !== "string" ||
            !/^[0-9]{10}$/.test(phone)
        ) {
            return res.status(400).json({
                message: "Enter a valid 10-digit phone number."
            });
        }

        if (
            !Number.isInteger(people) ||
            people < 1 ||
            people > 10000
        ) {
            return res.status(400).json({
                message: "Enter a valid number of people."
            });
        }

        if (
            typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)
        ) {
            return res.status(400).json({
                message: "Please enter a valid date."
            });
        }

        const parsedDate = new Date(date + "T00:00:00Z");

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== date
        ) {
            return res.status(400).json({
                message: "Invalid date."
            });
        }

        const now = new Date();
        const today =
            now.getFullYear() + "-" +
            String(now.getMonth() + 1).padStart(2, "0") + "-" +
            String(now.getDate()).padStart(2, "0");

        if (date < today) {
            return res.status(400).json({
                message: "Date cannot be in the past."
            });
        }

        if (
            typeof message !== "string" ||
            message.length > 200
        ) {
            return res.status(400).json({
                message: "Message must be 200 characters or fewer."
            });
        }

        const reservations = await readData("reservations.json");

        const booking = {
            id: randomUUID(),
            name: name.trim(),
            phone,
            people,
            date,
            message: message.trim(),
            status: "Pending",
            createdAt: new Date().toISOString()
        };

        reservations.push(booking);

        await saveData("reservations.json", reservations);

        res.status(201).json({
            message: "Booking saved successfully.",
            bookingId: booking.id
        });

    } catch (error) {
        console.error("Booking error:", error);

        res.status(500).json({
            message: "Unable to save booking."
        });
    }
});
// ==================================
// API: CREATE CONTACT ENQUIRY
// ==================================

app.post("/api/contact", async function (req, res) {
    try {
        const { name, email, subject, message } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 100
        ) {
            return res.status(400).json({
                message: "Please enter a valid name."
            });
        }

        if (
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({
                message: "Please enter a valid email."
            });
        }

        if (
            typeof subject !== "string" ||
            !subject.trim() ||
            subject.trim().length > 150
        ) {
            return res.status(400).json({
                message: "Please enter a valid subject."
            });
        }

        if (
            typeof message !== "string" ||
            !message.trim() ||
            message.trim().length > 1000
        ) {
            return res.status(400).json({
                message: "Please enter a valid message."
            });
        }

        const contacts = await readData("contacts.json");

        const contact = {
            id: randomUUID(),
            name: name.trim(),
            email: email.trim(),
            subject: subject.trim(),
            message: message.trim(),
            createdAt: new Date().toISOString()
        };

        contacts.push(contact);

        await saveData("contacts.json", contacts);

        res.status(201).json({
            message: "Contact enquiry saved successfully."
        });

    } catch (error) {
        console.error("Contact error:", error);

        res.status(500).json({
            message: "Unable to save contact enquiry."
        });
    }
});

// ==================================
// API: CREATE ORDER
// ==================================

app.post("/api/orders", async function (req, res) {
    try {
        const { items } = req.body;

        if (
            !Array.isArray(items) ||
            items.length === 0 ||
            items.length > 50
        ) {
            return res.status(400).json({
                message: "Please provide valid order items."
            });
        }

        const orderItems = [];

        for (const item of items) {
            if (
                !item ||
                typeof item.name !== "string" ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 100
            ) {
                return res.status(400).json({
                    message: "Invalid order item or quantity."
                });
            }

            const menuItem = menuItems.find(
                food => food.name === item.name
            );

            if (!menuItem) {
                return res.status(400).json({
                    message: "Selected food item does not exist."
                });
            }

            orderItems.push({
                name: menuItem.name,
                quantity: item.quantity,
                price: menuItem.price
            });
        }

        const total = Number(
            orderItems.reduce(
                (sum, item) =>
                    sum + item.price * item.quantity,
                0
            ).toFixed(2)
        );

        const orders = await readData("orders.json");

        const order = {
            id: randomUUID(),
            items: orderItems,
            total,
            status: "Pending",
            createdAt: new Date().toISOString()
        };

        orders.push(order);

        await saveData("orders.json", orders);

        res.status(201).json({
            message: "Order saved successfully.",
            orderId: order.id,
            total: order.total
        });

    } catch (error) {
        console.error("Order error:", error);

        res.status(500).json({
            message: "Unable to save order."
        });
    }
});

// ==================================
// PROTECT JSON DATA FILES
// ==================================

app.use("/data", function (req, res) {
    res.sendStatus(404);
});

// ==================================
// SERVE WEBSITE FILES
// ==================================

app.use(express.static(__dirname, {
    dotfiles: "deny"
}));

// ==================================
// START SERVER
// ==================================

async function startServer() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });

        for (const file of [
            "contacts.json",
            "reservations.json",
            "orders.json"
        ]) {
            await readData(file);
        }

        app.listen(PORT, function () {
            console.log("Gourmet Catering server started!");
            console.log(
                `Open http://localhost:${PORT}/index.html`
            );
        });

    } catch (error) {
        console.error("Server startup failed:", error);
    }
}

startServer();
