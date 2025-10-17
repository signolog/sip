import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";

import { verifyJWTToken } from "@/utils/auth.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    console.log("🔄 POST /api/admin/places/upload-floor - Dosya yükleme başladı");

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

    // FormData'yı parse et
    const formData = await request.formData();
    const file = formData.get("file");
    const placeId = formData.get("placeId");
    const floor = formData.get("floor");

    console.log("📁 Yüklenecek dosya:", file?.name);
    console.log("🏢 Place ID:", placeId);
    console.log("🏗️ Kat:", floor);

    if (!file || !placeId || !floor) {
      console.log("❌ Eksik parametreler");
      return NextResponse.json({ error: "Dosya, place ID ve kat bilgisi gerekli" }, { status: 400 });
    }

    // Place owner kontrolü
    if (user.role === "place_owner" && user.place_id !== placeId) {
      console.log("❌ Place owner erişim hatası:", { userPlaceId: user.place_id, requestedPlaceId: placeId });
      return NextResponse.json({ error: "Bu place'e erişim yetkiniz yok" }, { status: 403 });
    }

    // Dosya uzantısı kontrolü - Kat fotoğrafları ve bilgi dosyaları için
    const fileExtension = path.extname(file.name).toLowerCase();
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".json", ".geojson"];
    if (!allowedExtensions.includes(fileExtension)) {
      console.log("❌ Geçersiz dosya uzantısı:", fileExtension);
      return NextResponse.json(
        { error: "Desteklenen formatlar: Fotoğraflar (PNG, JPG, JPEG, GIF, WEBP), Vektörler (SVG), JSON dosyaları" },
        { status: 400 }
      );
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

    // Dosya içeriğini oku ve JSON olarak parse et (sadece JSON/GeoJSON için)
    const fileBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(fileBuffer).toString("utf-8");

    // Sadece JSON/GeoJSON dosyaları için validasyon yap
    if ([".geojson", ".json"].includes(fileExtension)) {
      try {
        const jsonContent = JSON.parse(fileContent);
        console.log("✅ JSON dosyası geçerli");
      } catch (error) {
        console.log("❌ Geçersiz JSON dosyası:", error.message);
        return NextResponse.json({ error: "Geçersiz JSON dosyası" }, { status: 400 });
      }
    }

    // Dosya adını oluştur (kat fotoğrafları için)
    const floorPrefix = floor < 0 ? `B${Math.abs(floor)}` : `K${floor}`;
    const fileName = `${place.slug}-floor-${floorPrefix}${fileExtension}`;

    // Kat fotoğrafları için ayrı klasör yapısı
    const uploadDir = path.join(process.cwd(), "public", "images", "places", place.slug, "floors");
    const filePath = path.join(uploadDir, fileName);

    // Upload dizinini oluştur
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Upload dizini oluşturuldu:", uploadDir);
    }

    // Dosyayı kaydet
    fs.writeFileSync(filePath, fileContent);
    console.log("✅ Dosya kaydedildi:", filePath);

    // MongoDB'de floor_photos'u güncelle
    if (!place.floor_photos) {
      place.floor_photos = new Map();
    }

    place.floor_photos.set(floor, `images/places/${place.slug}/floors/${fileName}`);
    await place.save();

    console.log("✅ MongoDB floor_photos güncellendi");

    return NextResponse.json({
      success: true,
      fileName: fileName,
      filePath: `images/places/${place.slug}/floors/${fileName}`,
      floor: floor,
    });
  } catch (error) {
    console.error("❌ Dosya yükleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
