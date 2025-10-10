// /app/api/updates/route.js
// Public/updates klasöründen room updates'leri döndürür

import fs from "fs";
import path from "path";

export async function GET(request) {
  const url = new URL(request.url);
  const placeId = url.searchParams.get("placeId");
  const floor = url.searchParams.get("floor");

  console.log("🔄 Updates API çağrısı:", { placeId, floor });

  // Place ID kontrolü
  if (!placeId) {
    return new Response(JSON.stringify({ error: "placeId gerekli" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const updatesData = {};

    // MongoDB'den place'i al
    const mongoose = require("mongoose");
    const Place = require("@/models/Place");

    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/signolog_assist");
    const place = await Place.findById(placeId);

    if (!place) {
      return new Response(JSON.stringify({ error: "Place bulunamadı" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const placeSlug = place.slug;
    const floorsObj = Object.fromEntries(place.floors || new Map());
    const floorKeys = Object.keys(floorsObj);

    for (const floorNum of floorKeys) {
      const updatesPath = path.join(
        process.cwd(),
        "public",
        "places",
        placeSlug,
        "updates",
        `floor_${floorNum}-updates.geojson`
      );

      try {
        const updatesContent = fs.readFileSync(updatesPath, "utf8");
        const updates = JSON.parse(updatesContent);
        updatesData[floorNum] = updates;
        console.log(`✅ Updates Floor ${floorNum} yüklendi:`, updates.features?.length || 0, "update");
      } catch (err) {
        console.log(`ℹ️ Updates Floor ${floorNum} bulunamadı, boş döndürülüyor`);
        updatesData[floorNum] = { type: "FeatureCollection", features: [] };
      }
    }

    // Belirli bir kat için updates
    if (floor !== null) {
      const floorUpdates = updatesData[floor];
      if (!floorUpdates) {
        return new Response(JSON.stringify({ error: "Floor not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(floorUpdates), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Tüm katlar için updates
    return new Response(JSON.stringify(updatesData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Updates yükleme hatası:", error);
    return new Response(
      JSON.stringify({
        error: "Updates yüklenemedi",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST endpoint - DB'ye update eklemek için
export async function POST(request) {
  try {
    const body = await request.json();
    const { placeId, floor, roomId, action, properties } = body;

    console.log("📝 Update ekleniyor:", { placeId, floor, roomId, action });

    // Burada gerçek DB işlemi yapılacak
    // Şimdilik mock response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Update başarıyla eklendi",
        id: `update_${Date.now()}`,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Update ekleme hatası:", error);
    return new Response(
      JSON.stringify({
        error: "Update eklenemedi",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
