// app/api/rooms/route.js - Public endpoint for getting rooms as GeoJSON
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Room from "@/models/Room";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("place_id");

    console.log("🔍 /api/rooms GET request - place_id:", placeId);

    if (!placeId) {
      return NextResponse.json({ error: "place_id parametresi gerekli" }, { status: 400 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Place'e ait tüm room'ları getir
    const rooms = await Room.find({ place_id: placeId });
    console.log("✅ Rooms bulundu:", rooms.length, "adet");

    // Room'ları kat bazında GeoJSON formatına dönüştür
    const roomsByFloor = {};

    rooms.forEach((room) => {
      const floor = room.floor;

      if (!roomsByFloor[floor]) {
        roomsByFloor[floor] = {
          type: "FeatureCollection",
          features: [],
        };
      }

      // Room'u GeoJSON feature olarak ekle
      roomsByFloor[floor].features.push({
        type: "Feature",
        geometry: room.geometry,
        properties: {
          id: room.room_id,
          name: room.name,
          floor: room.floor,
          type: room.content?.type || "room", // DB'den al, yoksa default "room"
          category: room.content?.category || "general",
          subtype: room.content?.subtype || "",
          icon: room.content?.icon || "",
          is_special: room.content?.is_special || false,
          special_type: room.content?.special_type || "",
          phone: room.content?.phone || "",
          hours: room.content?.hours || "",
          promotion: room.content?.promotion || "",
          description: room.content?.description || "",
          header_image: room.content?.header_image || "",
          logo: room.content?.logo || "",
          website: room.content?.website || "",
          email: room.content?.email || "",
          instagram: room.content?.instagram || "",
          twitter: room.content?.twitter || "",
          services: room.content?.services || "",
          tags: room.content?.tags || "",
          
          // Kampanya/İndirim Bilgileri
          campaigns: room.content?.campaigns || [],
          active_campaigns: room.content?.campaigns?.filter(c => c.is_active && 
            (!c.end_date || new Date(c.end_date) > new Date())) || [],
        },
      });
    });

    console.log("✅ GeoJSON formatına dönüştürüldü:", Object.keys(roomsByFloor));

    // Cache kontrolü
    const response = NextResponse.json(roomsByFloor);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error("❌ Rooms API hatası:", error);
    return NextResponse.json(
      {
        error: "Rooms API hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
