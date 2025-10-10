const mongoose = require("mongoose");
const Room = require("../models/Room.js");

async function clearRooms() {
  try {
    await mongoose.connect("mongodb://localhost:27017/signolog_assist");
    console.log("🔗 MongoDB bağlandı");

    await Room.deleteMany({});
    console.log("✅ Tüm room'lar silindi");

    await mongoose.disconnect();
    console.log("🔌 MongoDB bağlantısı kapatıldı");
  } catch (error) {
    console.error("❌ Hata:", error);
  }
}

clearRooms();
