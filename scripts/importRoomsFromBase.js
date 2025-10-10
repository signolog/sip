// scripts/importRoomsFromBase.js
// Base GeoJSON dosyalarından room'ları MongoDB'ye aktarır

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Room = require("../models/Room.js");
const Place = require("../models/Place.js");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/signolog_assist";

async function importRoomsFromBase() {
  try {
    console.log("🔄 MongoDB'ye bağlanıyor...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB bağlantısı başarılı");

    // Tüm place'leri al
    const places = await Place.find();
    console.log(`📋 ${places.length} place bulundu`);

    for (const place of places) {
      console.log(`\n🏢 ${place.name} işleniyor...`);

      const floorsObj = Object.fromEntries(place.floors || new Map());
      const floorKeys = Object.keys(floorsObj);

      console.log(`📊 Katlar: ${floorKeys.join(", ")}`);

      for (const floorNum of floorKeys) {
        const basePath = path.join(process.cwd(), "public", "places", place.slug, "base", `floor_${floorNum}.geojson`);

        if (!fs.existsSync(basePath)) {
          console.log(`⚠️ Base dosyası bulunamadı: ${basePath}`);
          continue;
        }

        console.log(`📖 ${place.name} - Kat ${floorNum} base dosyası okunuyor...`);
        const baseData = JSON.parse(fs.readFileSync(basePath, "utf8"));

        let roomCount = 0;
        for (const feature of baseData.features) {
          if (
            feature.properties &&
            feature.properties.id &&
            feature.properties.id.startsWith("room-") &&
            !feature.properties.id.includes("-to-")
          ) {
            const roomId = feature.properties.id;

            // Room zaten var mı kontrol et
            const existingRoom = await Room.findOne({
              room_id: roomId,
              place_id: place._id.toString(),
            });

            if (existingRoom) {
              console.log(`  ⚠️ Room ${roomId} zaten mevcut, atlanıyor`);
              continue;
            }

            // Geometry validation - LineString'lerde aynı koordinatları filtrele
            let geometry = feature.geometry;
            if (geometry.type === "LineString" && geometry.coordinates) {
              // Aynı koordinatları filtrele
              const uniqueCoords = [];
              for (const coord of geometry.coordinates) {
                const lastCoord = uniqueCoords[uniqueCoords.length - 1];
                if (
                  !lastCoord ||
                  Math.abs(coord[0] - lastCoord[0]) > 0.000001 ||
                  Math.abs(coord[1] - lastCoord[1]) > 0.000001
                ) {
                  uniqueCoords.push(coord);
                }
              }

              // En az 2 farklı koordinat olmalı
              if (uniqueCoords.length < 2) {
                console.log(`  ⚠️ Room ${roomId} geçersiz LineString, atlanıyor`);
                continue;
              }

              geometry = {
                ...geometry,
                coordinates: uniqueCoords,
              };
            }

            // Yeni room oluştur
            const roomData = {
              room_id: roomId, // Sadece room-157, room-201 vs.
              place_id: place._id.toString(),
              floor: parseInt(floorNum),
              name: feature.properties.name || `Room ${roomId}`,
              geometry: geometry,
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
                category: feature.properties.category || "general",
                subtype: feature.properties.subtype || "",
                icon: feature.properties.icon || "",
                is_special: feature.properties.is_special || false,
                special_type: feature.properties.special_type || "",
                phone: feature.properties.phone || "",
                hours: feature.properties.hours || "",
                promotion: feature.properties.promotion || "",
              },
              needs_sync: false,
              last_synced: new Date(),
            };

            await Room.create(roomData);
            roomCount++;
            console.log(`  ✅ Room ${roomId} eklendi`);
          }
        }

        console.log(`📊 Kat ${floorNum}: ${roomCount} room eklendi`);
      }
    }

    console.log("\n🎉 Tüm room'lar başarıyla aktarıldı!");

    // İstatistikler
    const totalRooms = await Room.countDocuments();
    console.log(`📈 Toplam room sayısı: ${totalRooms}`);

    const roomsByPlace = await Room.aggregate([
      { $group: { _id: "$place_id", count: { $sum: 1 } } },
      { $lookup: { from: "places", localField: "_id", foreignField: "_id", as: "place" } },
    ]);

    console.log("\n📊 Place bazında room sayıları:");
    for (const stat of roomsByPlace) {
      const placeName = stat.place[0]?.name || "Bilinmeyen";
      console.log(`  ${placeName}: ${stat.count} room`);
    }
  } catch (error) {
    console.error("❌ Hata:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB bağlantısı kapatıldı");
  }
}

// Script'i çalıştır
importRoomsFromBase();
