// scripts/clearDatabase.js
require("dotenv").config({ path: ".env.local" });

const mongoose = require("mongoose");

// Models
const Place = require("../models/Place.js");
const Room = require("../models/Room.js");
const User = require("../models/User.js");
const Visit = require("../models/Visit.js");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/signolog_assist";

async function clearDatabase() {
  try {
    console.log("🔄 MongoDB'ye bağlanıyor...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB'ye başarıyla bağlandı!");
    console.log("🗄️  Database:", mongoose.connection.db.databaseName);

    console.log("\n🗑️  Veritabanı temizleniyor...");

    // Tüm collections'ları temizle
    await Place.deleteMany({});
    console.log("✅ Places temizlendi");

    await Room.deleteMany({});
    console.log("✅ Rooms temizlendi");

    await User.deleteMany({});
    console.log("✅ Users temizlendi");

    await Visit.deleteMany({});
    console.log("✅ Visits temizlendi");

    console.log("\n🎉 Veritabanı başarıyla temizlendi!");

    console.log("\n🔌 MongoDB bağlantısı kapatılıyor...");
    await mongoose.connection.close();
    console.log("✅ MongoDB bağlantısı kapatıldı");
  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  }
}

clearDatabase();
