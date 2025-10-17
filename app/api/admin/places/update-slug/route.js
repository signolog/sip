import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";

import { verifyJWTToken } from "@/utils/auth.js";

export const dynamic = "force-dynamic";

export async function PUT(request) {
  try {
    console.log("🔄 PUT /api/admin/places/update-slug - Slug güncelleme başladı");

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

    // Admin veya place_owner slug değiştirebilir
    if (user.role !== "admin" && user.role !== "place_owner") {
      console.log("❌ Sadece admin ve place_owner slug değiştirebilir");
      return NextResponse.json({ error: "Bu işlem için admin veya place_owner yetkisi gerekli" }, { status: 403 });
    }

    const body = await request.json();
    console.log("📦 Request body:", body);

    const { placeId, newName, newSlug } = body;

    console.log("🏢 Place ID:", placeId);
    console.log("📝 Yeni İsim:", newName);
    console.log("🔗 Yeni Slug:", newSlug);

    if (!placeId || !newName || !newSlug) {
      console.log("❌ Eksik parametreler");
      return NextResponse.json({ error: "Place ID, yeni isim ve slug gerekli" }, { status: 400 });
    }

    // Place owner kontrolü
    if (user.role === "place_owner" && user.place_id !== placeId) {
      console.log("❌ Place owner sadece kendi yerini güncelleyebilir");
      return NextResponse.json({ error: "Bu place'i güncelleme yetkiniz yok" }, { status: 403 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Place'i bul (MongoDB ObjectId ile)
    const place = await Place.findById(placeId);
    if (!place) {
      console.log("❌ Place bulunamadı:", placeId);
      return NextResponse.json({ error: "Place bulunamadı" }, { status: 404 });
    }

    console.log("✅ Place bulundu:", place.name);

    const oldSlug = place.slug;
    const oldName = place.name;

    // Slug'un benzersiz olduğunu kontrol et
    const existingPlace = await Place.findOne({ slug: newSlug, _id: { $ne: placeId } });
    if (existingPlace) {
      console.log("❌ Slug zaten kullanılıyor:", newSlug);
      return NextResponse.json({ error: "Bu slug zaten kullanılıyor" }, { status: 400 });
    }

    console.log("🔄 Slug güncelleme işlemi başlıyor:");
    console.log("  - Eski slug:", oldSlug);
    console.log("  - Yeni slug:", newSlug);

    // ⚠️ UYARI: Vercel'de filesystem read-only olduğu için dosya taşıma işlemleri devre dışı
    // Dosyaları manuel olarak taşımanız ve yeniden deploy etmeniz gerekiyor!

    // Sadece MongoDB'i güncelle
    place.name = newName;
    place.slug = newSlug;
    place.updatedAt = new Date();

    // Floor dosya yollarını güncelle (path'ler slug'a göre olduğu için)
    if (place.floors) {
      const floorsObj = place.floors instanceof Map ? Object.fromEntries(place.floors) : place.floors;
      Object.keys(floorsObj).forEach((floor) => {
        const oldPath = floorsObj[floor];
        const newPath = oldPath.replace(`places/${oldSlug}/`, `places/${newSlug}/`);
        floorsObj[floor] = newPath;
        console.log(`🔄 Floor ${floor} yolu güncellendi:`, oldPath, "->", newPath);
      });
      place.floors = floorsObj;
    }

    // Header image yolunu güncelle
    if (place.content && place.content.header_image) {
      const oldHeaderImagePath = place.content.header_image;
      const newHeaderImagePath = oldHeaderImagePath.replace(`${oldSlug}-header`, `${newSlug}-header`);
      place.content.header_image = newHeaderImagePath;
      console.log("🔄 Header image yolu güncellendi:", oldHeaderImagePath, "->", newHeaderImagePath);
    }

    // MongoDB'de kaydet
    await place.save();
    console.log("✅ MongoDB güncellendi");

    return NextResponse.json({
      success: true,
      oldSlug: oldSlug,
      newSlug: newSlug,
      oldName: oldName,
      newName: newName,
    });
  } catch (error) {
    console.error("❌ Slug güncelleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
