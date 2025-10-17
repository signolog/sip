// app/api/admin/migrate-places/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";

import { verifyJWTToken } from "@/utils/auth.js";

export async function POST(request) {
  try {
    // Token kontrolü
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token bulunamadı" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyJWTToken(token);

    // Sadece admin yapabilir
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
    }

    await connectDB();

    // Place'leri güncelle/oluştur
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
          gallery: ["/images/places/ankamall-1.jpg", "/images/places/ankamall-2.jpg", "/images/places/ankamall-3.jpg"],
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

    const results = [];
    for (const placeData of manualPlaces) {
      const place = await Place.findOneAndUpdate({ slug: placeData.slug }, placeData, {
        upsert: true,
        new: true,
        runValidators: true,
      });
      results.push({ name: place.name, slug: place.slug, id: place._id });
    }

    return NextResponse.json({
      success: true,
      places: results,
    });
  } catch (error) {
    console.error("❌ Place update hatası:", error);
    return NextResponse.json(
      {
        error: "Place update hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
