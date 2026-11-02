require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

app.use(express.json({ limit: "20kb" }));

// Serve the existing website files.
app.use(express.static(__dirname, { dotfiles: "deny" }));

// ==================================
// DATABASE MODELS
// ==================================

const bookingSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        phone: {
            type: String,
            required: true,
            match: /^[0-9]{10}$/
        },

        people: {
            type: Number,
            required: true,
            min: 1,
            max: 10000
        },

        date: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/
        },

        message: {
            type: String,
            default: "",
            maxlength: 200
        },

        status: {
            type: String,
            default: "Pending",
            enum: ["Pending", "Confirmed", "Cancelled"]
        }
    },
    { timestamps: true }
);

const orderSchema = new mongoose.Schema(
    {
        items: {
            type: [
                {
                    name: {
                        type: String,
                        required: true
                    },

                    quantity: {
                        type: Number,
                        required: true,
                        min: 1,
                        max: 100
                    },

                    price: {
                        type: Number,
                        required: true,
                        min: 0
                    }
                }
            ],
            validate: {
                validator: items => items.length > 0 && items.length <= 50,
                message: "An order must contain 1 to 50 items."
            }
        },

        total: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            default: "Pending"
        }
    },
    { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);
const Order = mongoose.model("Order", orderSchema);


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

        const { name, phone, people, date, message } = req.body;

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
                message: "The selected date is invalid."
            });
        }

        const today = new Date().toISOString().slice(0, 10);

        if (date < today) {
            return res.status(400).json({
                message: "The date cannot be in the past."
            });
        }

        if (
            typeof message !== "string" ||
            message.length > 200
        ) {
            return res.status(400).json({
                message: "The message must be 200 characters or fewer."
            });
        }

        const booking = await Booking.create({
            name: name.trim(),
            phone,
            people,
            date,
            message: message.trim()
        });

        res.status(201).json({
            message: "Booking request saved successfully.",
            bookingId: booking._id
        });

    } catch (error) {

        console.error("Booking error:", error);

        res.status(500).json({
            message: "Unable to save the booking request."
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
                menuItem => menuItem.name === item.name
            );

            if (!menuItem) {
                return res.status(400).json({
                    message: "A selected menu item does not exist."
                });
            }

            // Never trust prices sent by the browser.
            orderItems.push({
                name: menuItem.name,
                quantity: item.quantity,
                price: menuItem.price
            });

        }

        const total = Number(
            orderItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            ).toFixed(2)
        );

        const order = await Order.create({
            items: orderItems,
            total
        });

        res.status(201).json({
            message: "Order saved successfully.",
            orderId: order._id,
            total: order.total
        });

    } catch (error) {

        console.error("Order error:", error);

        res.status(500).json({
            message: "Unable to save the order."
        });

    }

});


// ==================================
// START SERVER
// ==================================

async function startServer() {

    try {

        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing from .env");
        }

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected successfully.");

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, function () {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {

        console.error("Server startup failed:", error.message);
        process.exit(1);

    }

}

startServer();
