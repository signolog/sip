import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import Room from "@/models/Room";
import Place from "@/models/Place";

const JWT_SECRET = process.env.JWT_SECRET || "signolog_assist_secret_key_2024";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token gerekli" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
    }

    const { placeId, roomId, imageData } = await request.json();
    if (!placeId || !roomId || !imageData) {
      return NextResponse.json({ error: "placeId, roomId ve imageData gerekli" }, { status: 400 });
    }

    await connectDB();

    // Yetki kontrolü
    if (user.role === "store_owner") {
      if (user.place_id !== placeId || user.store_id !== roomId) {
        return NextResponse.json({ error: "Sadece kendi mağazanız için görsel yükleyebilirsiniz" }, { status: 403 });
      }
    } else if (!(user.role === "admin" || user.role === "place_owner")) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    if (user.role === "place_owner" && user.place_id !== placeId) {
      return NextResponse.json({ error: "Sadece kendi mekanınız için yükleyebilirsiniz" }, { status: 403 });
    }

    // Place slug bul
    const place = await Place.findById(placeId);
    if (!place) {
      return NextResponse.json({ error: "Place bulunamadı" }, { status: 404 });
    }
    const slug = place.slug;

    // Base64 parse
    const match = imageData.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Geçersiz imageData" }, { status: 400 });
    }
    const mimeType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");
    const ext = mimeType.split("/")[1].replace("svg+xml", "svg");

    const roomDir = path.join(process.cwd(), "public", "images", "rooms", slug, `room-${roomId}`);
    fs.mkdirSync(roomDir, { recursive: true });
    const fileName = `logo.${ext}`;
    const filePath = path.join(roomDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const publicPath = `/images/rooms/${slug}/room-${roomId}/${fileName}`;
    // CACHE-BUSTING: Timestamp ekle
    const publicPathWithCache = `${publicPath}?t=${Date.now()}`;

    // MongoDB'de room'un logo path'ini güncelle
    await Room.findOneAndUpdate(
      { room_id: roomId, place_id: placeId },
      {
        "content.logo": publicPath,
        needs_sync: true,
        last_synced: new Date(),
      }
    );

    return NextResponse.json({ success: true, path: publicPathWithCache });
  } catch (error) {
    console.error("Room logo upload error:", error);
    return NextResponse.json({ error: "Sunucu hatası", details: error.message }, { status: 500 });
  }
}
