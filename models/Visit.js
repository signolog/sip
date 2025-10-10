// models/Visit.js
const mongoose = require("mongoose");

const VisitSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    visited_at: {
      type: Date,
      default: Date.now,
    },

    // Analytics için ekstra bilgiler
    session_duration: {
      type: Number, // seconds
      default: 0,
    },
    device_type: {
      type: String,
      enum: ["mobile", "desktop", "tablet"],
      default: "desktop",
    },
    source: {
      type: String,
      enum: ["search", "direct", "navigation"],
      default: "direct",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
VisitSchema.index({ user_id: 1, visited_at: -1 });
VisitSchema.index({ room_id: 1, visited_at: -1 });

module.exports = mongoose.models.Visit || mongoose.model("Visit", VisitSchema);
