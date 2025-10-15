// scripts/addRoomTypeProperty.js
// DB'deki tüm room'lara type: "room" property'si ekler
require("dotenv").config({ path: ".env.local" });

const mongoose = require("mongoose");
const Room = require("../models/Room.js");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/signolog_assist";

async function addRoomTypeProperty() {
  try {
    console.log("🔄 MongoDB'ye bağlanıyor...");
    console.log("📍 Connection URI:", MONGODB_URI ? "✅ Mevcut" : "❌ YOK!");

    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB'ye başarıyla bağlandı!");

    // Tüm room'ları bul
    console.log("\n🔍 Room'lar kontrol ediliyor...");
    const allRooms = await Room.find({});
    console.log(`📊 Toplam ${allRooms.length} room bulundu`);

    if (allRooms.length === 0) {
      console.log("❌ Hiç room bulunamadı!");
      return;
    }

    // Room'ları kat bazında grupla
    const roomsByFloor = {};
    allRooms.forEach((room) => {
      if (!roomsByFloor[room.floor]) {
        roomsByFloor[room.floor] = [];
      }
      roomsByFloor[room.floor].push(room);
    });

    console.log("\n📁 Kat bazında room dağılımı:");
    Object.keys(roomsByFloor).forEach((floor) => {
      console.log(`   Kat ${floor}: ${roomsByFloor[floor].length} room`);
    });

    // Her room'a type: "room" property'si ekle
    console.log("\n🔄 Room'lara type property'si ekleniyor...");
    let updatedCount = 0;

    for (const room of allRooms) {
      // Room'un content objesine type property'si ekle
      if (!room.content) {
        room.content = {};
      }

      // Eğer zaten type property'si varsa güncelle, yoksa ekle
      room.content.type = "room";

      await room.save();
      updatedCount++;

      if (updatedCount % 10 === 0) {
        console.log(`✅ ${updatedCount}/${allRooms.length} room güncellendi...`);
      }
    }

    console.log(`\n🎉 Migration tamamlandı!`);
    console.log(`📊 ${updatedCount} room'a type: "room" property'si eklendi`);

    // Kontrol için birkaç room'u göster
    console.log("\n🔍 Örnek room'lar:");
    const sampleRooms = await Room.find({}).limit(3);
    sampleRooms.forEach((room) => {
      console.log(`   - ${room.name} (Kat ${room.floor}): type = "${room.content?.type || "YOK"}"`);
    });
  } catch (error) {
    console.error("\n❌ MIGRATION HATASI:");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🔴 Hata Tipi:", error.name);
    console.error("💬 Mesaj:", error.message);
    if (error.code) console.error("📟 Kod:", error.code);
    if (error.stack) console.error("📚 Stack:", error.stack);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } finally {
    console.log("\n🔌 MongoDB bağlantısı kapatılıyor...");
    await mongoose.disconnect();
    console.log("✅ MongoDB bağlantısı başarıyla kapatıldı");
  }
}

// Script'i çalıştır
addRoomTypeProperty();
