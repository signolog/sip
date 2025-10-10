// app/api/places/route.js
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const id = searchParams.get("id");

    console.log("🔍 /api/places GET request - slug:", slug, "id:", id);
    console.log("🔍 Request URL:", request.url);

    // MongoDB'ye bağlan
    await connectDB();

    if (slug) {
      console.log("🔍 Tek place aranıyor - slug:", slug);

      // Slug ile ara
      const place = await Place.findOne({ slug: slug });
      console.log("🔍 Place bulundu (slug):", place ? { name: place.name, slug: place.slug } : "null");

      if (!place) {
        console.log("❌ Place bulunamadı - slug:", slug);
        return NextResponse.json({ error: "Place bulunamadı", slug: slug }, { status: 404 });
      }

      // Anasayfa için uyumlu format
      const response = {
        place: place.name,
        floors: Object.fromEntries(place.floors || new Map()),
        center: place.center.coordinates,
        zoom: place.zoom,
      };

      return NextResponse.json(response);
    } else if (id) {
      console.log("🔍 Tek place aranıyor - id:", id);

      // ID ile ara
      const place = await Place.findById(id);
      console.log("🔍 Place bulundu (id):", place ? { name: place.name, _id: place._id } : "null");

      if (!place) {
        console.log("❌ Place bulunamadı - id:", id);
        return NextResponse.json({ error: "Place bulunamadı", id: id }, { status: 404 });
      }

      // Admin panel için uyumlu format
      const response = {
        id: place._id.toString(),
        name: place.name,
        slug: place.slug,
        floors: Object.fromEntries(place.floors || new Map()),
        floor_photos: Object.fromEntries(place.floor_photos || new Map()),
        center: place.center.coordinates,
        zoom: place.zoom,
        status: place.status,
        content: place.content,
        created_at: place.createdAt,
        updated_at: place.updatedAt,
      };

      return NextResponse.json(response);
    } else {
      // Tüm places getir
      const places = await Place.find({ status: "published" });
      const placesData = {};

      places.forEach((place) => {
        placesData[place._id.toString()] = {
          id: place._id.toString(),
          name: place.name,
          slug: place.slug,
          center: place.center.coordinates,
          zoom: place.zoom,
          status: place.status,
          floors: Object.fromEntries(place.floors || new Map()),
          floor_photos: Object.fromEntries(place.floor_photos || new Map()),
          content: place.content,
          created_at: place.createdAt,
          updated_at: place.updatedAt,
        };
      });

      return NextResponse.json(placesData);
    }
  } catch (error) {
    console.error("❌ Places API hatası:", error);
    return NextResponse.json(
      {
        error: "Places API hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
