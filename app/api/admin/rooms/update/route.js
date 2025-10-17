// app/api/admin/rooms/update/route.js
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import Room from "@/models/Room";
import fs from "fs";
import path from "path";

import { verifyJWTToken } from "@/utils/auth.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // JWT token kontrolü
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token gerekli" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let user;
    try {
      user = verifyJWTToken(token);
    } catch (error) {
      return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // İsteği parse et
    const body = await request.json();
    const { room_id, place_id, floor, ...updateData } = body;

    // Store owner için room_id'yi user.store_id'den al
    let effectiveRoomId = room_id;
    if (user.role === "store_owner") {
      effectiveRoomId = user.store_id;
      console.log("🔍 Store owner room_id:", effectiveRoomId);
    }

    // Yetkilendirme kontrolü
    if (user.role === "store_owner") {
      const allowedRoomId = user.store_id;
      if (!allowedRoomId || effectiveRoomId !== allowedRoomId) {
        console.log("❌ Store owner authorization failed:", {
          allowedRoomId,
          requestedRoomId: effectiveRoomId,
          userStoreId: user.store_id,
        });
        return NextResponse.json({ error: "Sadece kendi odanızı güncelleyebilirsiniz" }, { status: 403 });
      }
    } else if (user.role === "place_owner") {
      // Place owner sadece kendi place'indeki room'ları güncelleyebilir
      const User = require("@/models/User");
      const userDoc = await User.findById(user.id);
      const userPlaceId = userDoc?.place_id?.toString();

      if (!userPlaceId) {
        console.log("❌ Place owner'ın place_id'si yok");
        return NextResponse.json({ error: "Place bilgisi bulunamadı" }, { status: 400 });
      }

      if (place_id !== userPlaceId) {
        console.log("❌ Place owner farklı place'e erişmeye çalışıyor:", { requested: place_id, allowed: userPlaceId });
        return NextResponse.json(
          { error: "Sadece kendi mekanınızdaki birimleri güncelleyebilirsiniz" },
          { status: 403 }
        );
      }
    } else if (user.role !== "admin") {
      // Admin dışındaki roller için genel kontrol
      console.log("❌ Yetkisiz rol:", user.role);
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    // Room'u bul ve güncelle
    const room = await Room.findOne({ room_id: effectiveRoomId });
    if (!room) {
      return NextResponse.json({ error: "Room bulunamadı" }, { status: 404 });
    }

    // Sadece boş olmayan alanları güncelle
    const contentUpdate = {};
    const directUpdate = {};

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        // name field'ı direkt güncelle
        if (key === "name") {
          directUpdate[key] = value;
        } else {
          // Görsel path'lerine cache-busting ekle (sadece yeni yüklenen görseller için)
          if (
            (key === "logo" || key === "header_image") &&
            typeof value === "string" &&
            !value.startsWith("data:image/")
          ) {
            // Eğer path'te zaten timestamp varsa, onu kaldır ve yenisini ekle
            const cleanPath = value.split("?")[0];
            contentUpdate[`content.${key}`] = cleanPath; // MongoDB'de temiz path sakla
          } else {
            // TÜM diğer alanlar content içine (temel bilgiler dahil)
            contentUpdate[`content.${key}`] = value;
          }
        }
      }
    });

    console.log("🔍 Update data:", { contentUpdate, directUpdate });

    // MongoDB'de güncelle
    const updatedRoom = await Room.findOneAndUpdate(
      { room_id: effectiveRoomId },
      {
        ...contentUpdate,
        ...directUpdate,
        needs_sync: true, // GeoJSON sync gerekiyor
        last_synced: new Date(),
      },
      { new: true }
    );

    console.log("🔍 MongoDB update result:", {
      contentUpdateKeys: Object.keys(contentUpdate),
      directUpdateKeys: Object.keys(directUpdate),
      updatedRoomContent: updatedRoom?.content,
    });

    console.log("✅ Room güncellendi:", {
      room_id: updatedRoom.room_id,
      name: updatedRoom.name,
      content: updatedRoom.content,
    });

    // GeoJSON dosyasını güncelle
    await syncToGeoJSON(place_id, floor, updatedRoom);

    // CACHE TEMİZLEME - Tüm ilgili sayfaları revalidate et
    try {
      // Ana sayfa ve place sayfalarını revalidate et
      revalidatePath("/", "page");
      revalidatePath("/[slug]", "page");

      // API route'larını revalidate et
      revalidatePath("/api/places", "route");
      revalidatePath("/api/admin/rooms", "route");

      console.log("✅ Cache temizlendi (revalidated)");
    } catch (revalidateError) {
      console.warn("⚠️ Revalidation hatası:", revalidateError);
    }

    return NextResponse.json({
      success: true,
      room: updatedRoom,
      cacheCleared: true,
    });
  } catch (error) {
    console.error("❌ Room güncelleme hatası:", error);
    return NextResponse.json(
      {
        error: "Room güncelleme hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GeoJSON dosyasını güncelle
async function syncToGeoJSON(place_id, floor, room) {
  try {
    // MongoDB'den place'i al
    await connectDB();
    const Place = require("@/models/Place");
    const place = await Place.findById(place_id);

    if (!place) {
      throw new Error(`Place ${place_id} bulunamadı`);
    }

    const placeSlug = place.slug;
    const finalPath = path.join(process.cwd(), "public", "places", placeSlug, "final", `floor_${floor}.geojson`);

    if (!fs.existsSync(finalPath)) {
      console.warn(`⚠️ Final GeoJSON bulunamadı: ${finalPath}`);
      return;
    }

    // GeoJSON'u oku
    const geoJsonData = JSON.parse(fs.readFileSync(finalPath, "utf8"));

    // Room'u bul ve güncelle
    const featureIndex = geoJsonData.features.findIndex((f) => f.properties.id === room.room_id);
    if (featureIndex >= 0) {
      // Properties'leri güncelle - TÜM field'ları ekle
      geoJsonData.features[featureIndex].properties = {
        ...geoJsonData.features[featureIndex].properties,
        name: room.name,
        // Temel bilgiler
        category: room.content.category || "general",
        subtype: room.content.subtype || "",
        icon: room.content.icon || "",
        is_special: room.content.is_special || false,
        status: room.content.status || "open",
        phone: room.content.phone || "",
        hours: room.content.hours || "",
        promotion: room.content.promotion || "",
        // İçerik yönetimi
        description: room.content.description || "",
        header_image: room.content.header_image || "",
        logo: room.content.logo || "",
        website: room.content.website || "",
        email: room.content.email || "",
        instagram: room.content.instagram || "",
        twitter: room.content.twitter || "",
        services: room.content.services || "",
        tags: room.content.tags || "",
        updated_at: new Date().toISOString(),
      };

      // GeoJSON'u kaydet
      fs.writeFileSync(finalPath, JSON.stringify(geoJsonData, null, 2));
      console.log(`✅ GeoJSON güncellendi: ${room.room_id}`);

      // MongoDB'de sync durumunu güncelle
      await Room.findOneAndUpdate({ room_id: room.room_id }, { needs_sync: false, last_synced: new Date() });
    }
  } catch (error) {
    console.error("❌ GeoJSON sync hatası:", error);
    throw error;
  }
}
