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
    console.log("🔄 POST /api/admin/places/upload-header - Header image yükleme başladı");

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

    console.log("📁 Yüklenecek header image:", file?.name);
    console.log("🏢 Place ID:", placeId);

    if (!file || !placeId) {
      console.log("❌ Eksik parametreler");
      return NextResponse.json({ error: "Dosya ve place ID gerekli" }, { status: 400 });
    }

    // Place owner kontrolü
    if (user.role === "place_owner" && user.place_id !== placeId) {
      console.log("❌ Place owner erişim hatası:", { userPlaceId: user.place_id, requestedPlaceId: placeId });
      return NextResponse.json({ error: "Bu place'e erişim yetkiniz yok" }, { status: 403 });
    }

    // Dosya uzantısı kontrolü
    const fileExtension = path.extname(file.name).toLowerCase();
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    if (!allowedExtensions.includes(fileExtension)) {
      console.log("❌ Geçersiz dosya uzantısı:", fileExtension);
      return NextResponse.json({ error: "Desteklenen formatlar: .png, .jpg, .jpeg, .gif, .webp" }, { status: 400 });
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

    // Dosya içeriğini oku
    const fileBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(fileBuffer);

    // Dosya adını oluştur
    const fileName = `${place.slug}-header${fileExtension}`;
    const uploadDir = path.join(process.cwd(), "public", "images", "places");
    const filePath = path.join(uploadDir, fileName);

    // Upload dizinini oluştur
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Upload dizini oluşturuldu:", uploadDir);
    }

    // Dosyayı kaydet
    fs.writeFileSync(filePath, fileContent);
    console.log("✅ Header image kaydedildi:", filePath);
    console.log("📁 Dosya boyutu:", fileContent.length, "bytes");

    // MongoDB'de content'i güncelle
    if (!place.content) {
      place.content = {};
      console.log("📝 Content objesi oluşturuldu");
    }

    const oldHeaderImage = place.content.header_image;
    place.content.header_image = `/images/places/${fileName}`;
    await place.save();

    console.log("🔄 Header image güncelleniyor:");
    console.log("  - Eski:", oldHeaderImage);
    console.log("  - Yeni:", `/images/places/${fileName}`);
    console.log("✅ MongoDB content güncellendi");

    return NextResponse.json({
      success: true,
      fileName: fileName,
      filePath: `/images/places/${fileName}`,
    });
  } catch (error) {
    console.error("❌ Header image yükleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
