// scripts/cleanImagePaths.js
// MongoDB ve GeoJSON'daki görsel path'lerinden ?t= parametrelerini temizler

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// MongoDB bağlantısı
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/signolog";

async function cleanImagePaths() {
  try {
    // MongoDB'ye bağlan
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB'ye bağlanıldı");

    // Room modelini al
    const Room = mongoose.model("Room", new mongoose.Schema({}, { strict: false }));

    // Tüm room'ları al
    const rooms = await Room.find({});
    console.log(`🔍 ${rooms.length} room bulundu`);

    let updatedCount = 0;

    for (const room of rooms) {
      let needsUpdate = false;
      const updates = {};

      // Logo path'ini temizle
      if (room.content?.logo && room.content.logo.includes("?")) {
        const cleanLogo = room.content.logo.split("?")[0];
        updates["content.logo"] = cleanLogo;
        needsUpdate = true;
        console.log(`🧹 Logo temizlendi: ${room.room_id}`);
        console.log(`   Eski: ${room.content.logo}`);
        console.log(`   Yeni: ${cleanLogo}`);
      }

      // Header image path'ini temizle
      if (room.content?.header_image && room.content.header_image.includes("?")) {
        const cleanHeader = room.content.header_image.split("?")[0];
        updates["content.header_image"] = cleanHeader;
        needsUpdate = true;
        console.log(`🧹 Header temizlendi: ${room.room_id}`);
        console.log(`   Eski: ${room.content.header_image}`);
        console.log(`   Yeni: ${cleanHeader}`);
      }

      // Güncelleme gerekiyorsa uygula
      if (needsUpdate) {
        await Room.findByIdAndUpdate(room._id, {
          ...updates,
          needs_sync: true,
          last_synced: new Date(),
        });
        updatedCount++;
      }
    }

    console.log(`\n✅ ${updatedCount} room güncellendi`);
    console.log("🔄 GeoJSON sync için needs_sync flag'i ayarlandı");

    // Şimdi GeoJSON dosyalarını da temizle
    await cleanGeoJSONFiles();

    mongoose.connection.close();
    console.log("\n✅ İşlem tamamlandı!");
  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  }
}

async function cleanGeoJSONFiles() {
  console.log("\n🔍 GeoJSON dosyalarını temizliyorum...");

  const placesDir = path.join(process.cwd(), "public", "places");

  if (!fs.existsSync(placesDir)) {
    console.log("⚠️ Places klasörü bulunamadı");
    return;
  }

  const places = fs.readdirSync(placesDir);
  let cleanedFiles = 0;

  for (const place of places) {
    const finalDir = path.join(placesDir, place, "final");

    if (!fs.existsSync(finalDir)) continue;

    const files = fs.readdirSync(finalDir).filter((f) => f.endsWith(".geojson"));

    for (const file of files) {
      const filePath = path.join(finalDir, file);
      const geoJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
      let hasChanges = false;

      geoJson.features.forEach((feature) => {
        const props = feature.properties;

        // Logo temizle
        if (props.logo && props.logo.includes("?")) {
          props.logo = props.logo.split("?")[0];
          hasChanges = true;
        }

        // Header image temizle
        if (props.header_image && props.header_image.includes("?")) {
          props.header_image = props.header_image.split("?")[0];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        fs.writeFileSync(filePath, JSON.stringify(geoJson, null, 2));
        console.log(`🧹 GeoJSON temizlendi: ${place}/${file}`);
        cleanedFiles++;
      }
    }
  }

  console.log(`✅ ${cleanedFiles} GeoJSON dosyası temizlendi`);
}

// Scripti çalıştır
cleanImagePaths();

