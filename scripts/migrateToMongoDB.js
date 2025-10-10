// scripts/migrateToMongoDB.js
require("dotenv").config({ path: ".env.local" });

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Models
const Place = require("../models/Place.js");
const Room = require("../models/Room.js");
const User = require("../models/User.js");
const Visit = require("../models/Visit.js");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/signolog_assist";

async function migrateToMongoDB() {
  try {
    console.log("🔄 MongoDB'ye bağlanıyor...");
    console.log("📍 Connection URI:", MONGODB_URI ? "✅ Mevcut" : "❌ YOK!");
    console.log("🔗 Tam Bağlantı Adresi:", MONGODB_URI);

    await mongoose.connect(MONGODB_URI);

    console.log("✅ MongoDB'ye başarıyla bağlandı!");
    console.log("📊 Bağlantı durumu:", mongoose.connection.readyState === 1 ? "✅ Aktif" : "❌ Pasif");
    console.log("🗄️  Database:", mongoose.connection.db.databaseName);

    // 1. Places kontrolü (places.json yoksa, MongoDB'den al veya manuel ekle)
    console.log("\n📁 Places kontrol ediliyor...");
    const placesPath = path.join(process.cwd(), "public", "places", "places.json");

    let existingPlaces = await Place.find();

    if (fs.existsSync(placesPath)) {
      console.log("📄 places.json bulundu, migrate ediliyor...");
      const placesData = JSON.parse(fs.readFileSync(placesPath, "utf8"));

      for (const [placeId, placeData] of Object.entries(placesData)) {
        const place = new Place({
          name: placeData.name,
          slug: placeData.slug,
          legacy_id: placeId,
          center: {
            type: "Point",
            coordinates: placeData.center,
          },
          zoom: placeData.zoom,
          status: placeData.status,
          floors: placeData.floors || {},
          floor_photos: placeData.floor_photos || {},
          content: placeData.content || {},
        });

        const placeObj = place.toObject();
        delete placeObj._id;

        await Place.findOneAndUpdate({ name: placeData.name }, placeObj, { upsert: true, new: true });
        console.log(`✅ Place kaydedildi: ${placeData.name}`);
      }
      existingPlaces = await Place.find();
    } else {
      console.log("⚠️ places.json bulunamadı");
      if (existingPlaces.length === 0) {
        console.log("❌ MongoDB'de de place yok, manuel eklenecek...");
        // Manuel place ekleme
        const manualPlaces = [
          {
            name: "Ankamall",
            slug: "ankamall",
            center: { type: "Point", coordinates: [32.8315, 39.9503] },
            zoom: 18,
            status: "published",
            floors: {
              0: "places/ankamall/final/floor_0.geojson",
              1: "places/ankamall/final/floor_1.geojson",
              2: "places/ankamall/final/floor_2.geojson",
            },
            floor_photos: {
              0: "images/places/acity/floors/ankamall-floor-K0.svg",
            },
            content: {
              description:
                "Ankara'nın en büyük alışveriş merkezlerinden biri olan Ankamall, 200+ mağaza ve restoran ile ziyaretçilerine unutulmaz bir deneyim sunuyor.",
              header_image: "/images/places/ankamall-header.png",
              logo: "/images/places/ankamall-logo.png",
              gallery: [
                "/images/places/ankamall-1.jpg",
                "/images/places/ankamall-2.jpg",
                "/images/places/ankamall-3.jpg",
              ],
              working_hours: {
                monday: {},
                tuesday: {},
                wednesday: {},
                thursday: {},
                friday: {},
                saturday: {},
                sunday: {},
              },
              contact: {
                phone: "+90 312 123 45 67",
                email: "info@ankamall.com",
                website: "https://www.ankamall.com",
                address: "Bilkent, Ankara",
              },
              amenities: ["Ücretsiz WiFi", "Çocuk Oyun Alanı", "Eczane", "Kütüphane"],
            },
          },
          {
            name: "Mall of Ankara",
            slug: "mall-of-ankara",
            center: { type: "Point", coordinates: [32.8597, 39.9334] },
            zoom: 18,
            status: "published",
            floors: {
              0: "places/mall-of-ankara/final/floor_0.geojson",
              1: "places/mall-of-ankara/final/floor_1.geojson",
              2: "places/mall-of-ankara/final/floor_2.geojson",
            },
            floor_photos: {
              0: "images/places/mall-of-ankara/floors/floor-0.svg",
            },
            content: {
              description:
                "Mall of Ankara, modern mimarisi ve geniş mağaza seçenekleriyle Ankara'nın önemli alışveriş merkezlerinden biridir.",
              header_image: "/images/places/mall-of-ankara-header.png",
              logo: "/images/places/mall-of-ankara-logo.png",
              gallery: [],
              working_hours: {
                monday: {},
                tuesday: {},
                wednesday: {},
                thursday: {},
                friday: {},
                saturday: {},
                sunday: {},
              },
              contact: {
                phone: "+90 312 987 65 43",
                email: "info@mallofankara.com",
                website: "https://www.mallofankara.com",
                address: "Çankaya, Ankara",
              },
              amenities: ["Ücretsiz WiFi", "Çocuk Oyun Alanı", "Sinema"],
            },
          },
        ];

        for (const placeData of manualPlaces) {
          await Place.findOneAndUpdate({ slug: placeData.slug }, placeData, { upsert: true, new: true });
          console.log(`✅ Manuel place eklendi: ${placeData.name}`);
        }
        existingPlaces = await Place.find();
      } else {
        console.log(`✅ MongoDB'de ${existingPlaces.length} place mevcut`);
      }
    }

    // 2. Place'leri al (user'lar için place_id atamak için)
    const allPlaces = await Place.find();
    const ankamallPlace = allPlaces.find((p) => p.slug === "ankamall");
    const mallOfAnkaraPlace = allPlaces.find((p) => p.slug === "mall-of-ankara");

    console.log("\n👥 Users migrate ediliyor...");
    const users = [
      {
        username: "admin",
        password: "admin123",
        role: "admin",
        email: "admin@signolog.com",
      },
      {
        username: "ankamall_owner",
        password: "ankamall123",
        role: "place_owner",
        email: "ankamall@signolog.com",
        place_id: ankamallPlace?._id, // Ankamall'ın place_id'si
      },
      {
        username: "mallankara_owner",
        password: "mallankara123",
        role: "place_owner",
        email: "mallankara@signolog.com",
        place_id: mallOfAnkaraPlace?._id, // Mall of Ankara'nın place_id'si
      },
      {
        username: "teknosa_admin",
        password: "teknosa123",
        role: "store_owner",
        email: "teknosa@signolog.com",
        place_id: ankamallPlace?._id, // Teknosa'nın olduğu mekan
        store_id: "room-157", // Teknosa'nın room_id'si
      },
    ];

    for (const userData of users) {
      // Önce kullanıcı var mı kontrol et
      const existingUser = await User.findOne({ username: userData.username });

      if (existingUser) {
        console.log(`⏭️  User zaten mevcut: ${userData.username}`);
        continue;
      }

      // Yeni kullanıcı oluştur (save middleware'i çalışsın diye new + save kullanıyoruz)
      const user = new User(userData);
      await user.save(); // Bu şifreyi otomatik hash'leyecek
      console.log(`✅ User kaydedildi: ${userData.username} (place_id: ${userData.place_id || "yok"})`);
    }

    // 3. GeoJSON dosyalarından rooms migrate et
    console.log("\n🏠 Rooms migrate ediliyor...");
    const places = await Place.find();

    for (const place of places) {
      if (place.floors && Object.keys(place.floors).length > 0) {
        // Map objesini Object'e çevir
        const floorsObj = place.floors instanceof Map ? Object.fromEntries(place.floors) : place.floors;

        for (const [floor, filePath] of Object.entries(floorsObj)) {
          try {
            const fullPath = path.join(process.cwd(), "public", filePath);
            if (fs.existsSync(fullPath)) {
              const geoJsonData = JSON.parse(fs.readFileSync(fullPath, "utf8"));

              for (const feature of geoJsonData.features) {
                if (feature.properties && feature.properties.id && feature.properties.id.startsWith("room-")) {
                  const room = new Room({
                    room_id: feature.properties.id,
                    place_id: place._id,
                    floor: parseInt(floor),
                    name: feature.properties.name || feature.properties.title || "İsimsiz",
                    geometry: feature.geometry,
                    content: {
                      description: feature.properties.description || "",
                      header_image: feature.properties.header_image || "",
                      logo: feature.properties.logo || "",
                      website: feature.properties.website || "",
                      email: feature.properties.email || "",
                      instagram: feature.properties.instagram || "",
                      twitter: feature.properties.twitter || "",
                      services: feature.properties.services || "",
                      tags: feature.properties.tags || "",
                      special_offers: feature.properties.special_offers || "",
                    },
                    needs_sync: false, // Zaten sync'li
                    last_synced: new Date(),
                  });

                  await room.save();
                  console.log(`✅ Room kaydedildi: ${feature.properties.id}`);
                }
              }
            }
          } catch (error) {
            console.error(`❌ Floor ${floor} migrate hatası:`, error.message);
          }
        }
      }
    }

    console.log("\n🎉 Migration tamamlandı!");
    console.log(`📊 İstatistikler:`);
    console.log(`   - Places: ${await Place.countDocuments()}`);
    console.log(`   - Rooms: ${await Room.countDocuments()}`);
    console.log(`   - Users: ${await User.countDocuments()}`);
    console.log(`   - Visits: ${await Visit.countDocuments()}`);
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
migrateToMongoDB();
