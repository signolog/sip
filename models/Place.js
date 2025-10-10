// models/Place.js
const mongoose = require("mongoose");

const PlaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    legacy_id: {
      type: String,
      unique: true,
      sparse: true, // allows null values
    },
    center: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    zoom: {
      type: Number,
      default: 18,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    // Harita dosyaları
    floors: {
      type: Map,
      of: String, // floor number -> file path
    },

    // Kat planları
    floor_photos: {
      type: Map,
      of: String, // floor number -> file path
    },

    // İçerik yönetimi
    content: {
      description: String,
      header_image: String,
      logo: String,
      gallery: [String],
      working_hours: {
        monday: { open: String, close: String, closed: Boolean },
        tuesday: { open: String, close: String, closed: Boolean },
        wednesday: { open: String, close: String, closed: Boolean },
        thursday: { open: String, close: String, closed: Boolean },
        friday: { open: String, close: String, closed: Boolean },
        saturday: { open: String, close: String, closed: Boolean },
        sunday: { open: String, close: String, closed: Boolean },
      },
      contact: {
        phone: String,
        email: String,
        website: String,
        address: String,
      },
      amenities: [String],
    },
  },
  {
    timestamps: true,
  }
);

// GeoJSON index for location queries
PlaceSchema.index({ center: "2dsphere" });

module.exports = mongoose.models.Place || mongoose.model("Place", PlaceSchema);
