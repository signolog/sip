import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";

import { verifyJWTToken } from "@/utils/auth.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const placeId = url.searchParams.get("placeId");

    if (!placeId) {
      return NextResponse.json({ error: "Place ID gerekli" }, { status: 400 });
    }

    // Token kontrolü
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

    // Place'i bul (sadece MongoDB ObjectId ile)
    const place = await Place.findById(placeId);
    if (!place) {
      return NextResponse.json({ error: "Place bulunamadı" }, { status: 404 });
    }

    // İçerik döndür
    return NextResponse.json({
      success: true,
      content: place.content || {},
    });
  } catch (error) {
    console.error("Content API hatası:", error);
    return NextResponse.json(
      {
        error: "Content API hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { placeId, content } = body;

    console.log("🔄 PUT /api/admin/places/content - placeId:", placeId);
    console.log("🔄 PUT /api/admin/places/content - content:", JSON.stringify(content, null, 2));

    if (!placeId || !content) {
      console.log("❌ Place ID veya content eksik");
      return NextResponse.json({ error: "Place ID ve content gerekli" }, { status: 400 });
    }

    // Token kontrolü
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ Token header eksik");
      return NextResponse.json({ error: "Token gerekli" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let user;
    try {
      user = verifyJWTToken(token);
      console.log("✅ Token doğrulandı, user:", user);
    } catch (error) {
      console.log("❌ Token doğrulama hatası:", error.message);
      return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Place'i bul (sadece MongoDB ObjectId ile)
    const place = await Place.findById(placeId);
    if (!place) {
      console.log("❌ Place bulunamadı:", placeId);
      return NextResponse.json({ error: "Place bulunamadı" }, { status: 404 });
    }

    console.log("✅ Place bulundu:", place.name);

    // Place owner kontrolü
    if (user.role === "place_owner" && user.place_id !== place._id.toString()) {
      console.log("❌ Place owner erişim hatası:", { userPlaceId: user.place_id, requestedPlaceId: place._id });
      return NextResponse.json({ error: "Bu place'e erişim yetkiniz yok" }, { status: 403 });
    }

    // Content'i güncelle
    place.content = content;
    await place.save();

    console.log("✅ Content güncellendi:", place.name);

    return NextResponse.json({
      success: true,
      message: "Content başarıyla güncellendi",
    });
  } catch (error) {
    console.error("❌ Content güncelleme hatası:", error);
    return NextResponse.json(
      {
        error: "Content güncelleme hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
