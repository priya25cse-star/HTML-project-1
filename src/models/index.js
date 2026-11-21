const mongoose = require("mongoose");
const { Schema } = mongoose;
const bookingStatuses = ["Pending", "Confirmed", "Cancelled"];
const orderStatuses = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Completed",
  "Cancelled",
];
const bookingSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, match: /^[0-9]{10}$/ },
    people: { type: Number, required: true, min: 1, max: 10000 },
    date: { type: String, required: true },
    message: { type: String, default: "", maxlength: 200 },
    status: { type: String, enum: bookingStatuses, default: "Pending" },
  },
  { timestamps: true },
);
const orderItemSchema = new Schema(
  {
    menuId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, max: 100 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
const orderSchema = new Schema(
  {
    // Optional on stored documents so historical orders remain readable/editable.
    // The POST API requires both fields for every new order.
    customerName: { type: String, trim: true, maxlength: 100 },
    customerPhone: { type: String, match: /^[0-9]{10}$/ },
    items: {
      type: [orderItemSchema],
      validate: (value) => value.length > 0 && value.length <= 50,
    },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: orderStatuses, default: "Pending" },
  },
  { timestamps: true },
);
module.exports = {
  Booking: mongoose.model("Booking", bookingSchema),
  Order: mongoose.model("Order", orderSchema),
  bookingStatuses,
  orderStatuses,
};
