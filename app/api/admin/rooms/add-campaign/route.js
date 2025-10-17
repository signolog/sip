// app/api/admin/rooms/add-campaign/route.js
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import connectDB from "@/lib/mongodb";
import Room from "@/models/Room";
import Place from "@/models/Place";

import { verifyJWTToken } from "@/utils/auth.js";

export const dynamic = "force-dynamic";

// Final GeoJSON dosyasını güncelleme fonksiyonu
async function updateFinalGeoJSON(placeId, roomId, room) {
  try {
    console.log("🔍 GeoJSON güncelleme başladı:", { placeId, roomId, floor: room.floor });
    
    // Place'i bul
    const place = await Place.findById(placeId);
    if (!place) {
      throw new Error("Place bulunamadı");
    }

    const placeSlug = place.slug;
    const floor = room.floor;
    
    console.log("🔍 Place bilgileri:", { placeSlug, floor });
    
    // Final GeoJSON dosya yolu
    const finalPath = path.join(
      process.cwd(),
      "public",
      "places",
      placeSlug,
      "final",
      `floor_${floor}.geojson`
    );

    console.log("🔍 GeoJSON dosya yolu:", finalPath);

    // Dosya var mı kontrol et
    if (!fs.existsSync(finalPath)) {
      console.warn(`⚠️ Final GeoJSON dosyası bulunamadı: ${finalPath}`);
      return;
    }

    console.log("✅ GeoJSON dosyası bulundu, okunuyor...");

    // GeoJSON dosyasını oku
    const geoJsonData = JSON.parse(fs.readFileSync(finalPath, "utf8"));
    
    console.log("🔍 GeoJSON features sayısı:", geoJsonData.features?.length || 0);
    
    // Room'u bul ve güncelle
    const roomFeature = geoJsonData.features.find(
      feature => feature.properties.id === roomId
    );

    console.log("🔍 Room feature bulundu mu:", !!roomFeature);
    
    if (roomFeature) {
      console.log("🔍 Mevcut room properties:", Object.keys(roomFeature.properties));
      console.log("🔍 Room kampanyaları:", room.content?.campaigns?.length || 0);
      
      // Kampanya bilgilerini properties'e ekle
      roomFeature.properties.campaigns = room.content?.campaigns || [];
      roomFeature.properties.active_campaigns = room.content?.campaigns?.filter(c => c.is_active && 
        (!c.end_date || new Date(c.end_date) > new Date())) || [];
      
      console.log("🔍 Güncellenmiş campaigns:", roomFeature.properties.campaigns?.length || 0);
      console.log("🔍 Güncellenmiş active_campaigns:", roomFeature.properties.active_campaigns?.length || 0);
      
      console.log(`✅ GeoJSON'da kampanyalar güncellendi: ${roomId}`);
    } else {
      console.warn(`⚠️ GeoJSON'da room bulunamadı: ${roomId}`);
      console.log("🔍 Mevcut room ID'leri:", geoJsonData.features?.slice(0, 5).map(f => f.properties.id));
    }

    console.log("🔍 GeoJSON dosyası kaydediliyor...");

    // Dosyayı kaydet
    fs.writeFileSync(finalPath, JSON.stringify(geoJsonData, null, 2));
    console.log(`✅ Final GeoJSON kaydedildi: floor_${floor}.geojson`);

  } catch (error) {
    console.error("❌ GeoJSON güncelleme hatası:", error);
    throw error;
  }
}

export async function POST(request) {
  try {
    console.log("🎯 POST /api/admin/rooms/add-campaign - Kampanya ekleme başladı");

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
    const roomId = formData.get("roomId");
    const placeId = formData.get("placeId");
    const title = formData.get("title");
    const description = formData.get("description");
    const discountPercentage = formData.get("discountPercentage");
    const discountAmount = formData.get("discountAmount");
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const imageFile = formData.get("image");
    const isActive = formData.get("is_active");

    console.log("📋 Kampanya bilgileri:", {
      roomId,
      placeId,
      title,
      discountPercentage,
      discountAmount,
      startDate,
      endDate,
      isActive,
      hasImage: !!imageFile
    });

    // Validasyon
    if (!roomId || !placeId || !title) {
      console.log("❌ Eksik parametreler");
      return NextResponse.json({ error: "Room ID, Place ID ve başlık gerekli" }, { status: 400 });
    }

    if (!discountPercentage && !discountAmount) {
      console.log("❌ İndirim bilgisi eksik");
      return NextResponse.json({ error: "İndirim yüzdesi veya miktarı gerekli" }, { status: 400 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Place'i bul
    const place = await Place.findById(placeId);
    if (!place) {
      console.log("❌ Place bulunamadı:", placeId);
      return NextResponse.json({ error: "Place bulunamadı" }, { status: 404 });
    }

    // Room'u bul
    const room = await Room.findOne({ room_id: roomId, place_id: placeId });
    if (!room) {
      console.log("❌ Room bulunamadı:", { roomId, placeId });
      return NextResponse.json({ error: "Room bulunamadı" }, { status: 404 });
    }

    console.log("✅ Room bulundu:", room.name);

    // Yetkilendirme kontrolü
    const isAdmin = user.role === "admin";
    const isPlaceOwner = place.owner_id === user.userId;
    const isStoreOwner = room.content?.owner_id === user.userId;

    if (!isAdmin && !isPlaceOwner && !isStoreOwner) {
      return NextResponse.json(
        { error: "Bu işlem için yetkiniz yok" },
        { status: 403 }
      );
    }

    // Kampanya görseli yükle
    let imagePath = "";
    if (imageFile && imageFile.size > 0) {
      try {
        // Dosya uzantısını al
        const fileExtension = path.extname(imageFile.name).toLowerCase();
        const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
        
        if (!allowedExtensions.includes(fileExtension)) {
          console.log("❌ Geçersiz dosya uzantısı:", fileExtension);
          return NextResponse.json({ error: "Desteklenen formatlar: PNG, JPG, JPEG, GIF, WEBP" }, { status: 400 });
        }

        // Dosya adını oluştur (timestamp ile unique)
        const timestamp = Date.now();
        const fileName = `discount-${timestamp}${fileExtension}`;
        
        // Upload dizinini oluştur
        const uploadDir = path.join(process.cwd(), "public", "images", "rooms", place.slug, roomId);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
          console.log("📁 Upload dizini oluşturuldu:", uploadDir);
        }

        // Dosyayı kaydet
        const filePath = path.join(uploadDir, fileName);
        const fileBuffer = await imageFile.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(fileBuffer));
        
        imagePath = `images/rooms/${place.slug}/${roomId}/${fileName}`;
        console.log("✅ Kampanya görseli kaydedildi:", imagePath);
      } catch (error) {
        console.error("❌ Görsel yükleme hatası:", error);
        return NextResponse.json({ error: "Görsel yüklenemedi" }, { status: 500 });
      }
    }

    // Kampanya objesini oluştur
    const campaign = {
      title,
      description: description || "",
      discount_percentage: discountPercentage ? parseFloat(discountPercentage) : null,
      discount_amount: discountAmount ? parseFloat(discountAmount) : null,
      start_date: startDate ? new Date(startDate) : new Date(),
      end_date: endDate ? new Date(endDate) : null,
      image: imagePath,
      is_active: isActive === "true", // String'den boolean'a çevir
      created_at: new Date(),
      updated_at: new Date()
    };

    // Room'a kampanyayı ekle
    if (!room.content.campaigns) {
      room.content.campaigns = [];
    }

    room.content.campaigns.push(campaign);
    room.needs_sync = true;
    room.last_synced = new Date();

    await room.save();
    console.log("✅ Kampanya eklendi:", campaign.title);

    // Final GeoJSON dosyasını güncelle
    try {
      await updateFinalGeoJSON(placeId, roomId, room);
      console.log("✅ Final GeoJSON güncellendi");
    } catch (geoJsonError) {
      console.warn("⚠️ GeoJSON güncelleme hatası:", geoJsonError);
    }

    // Cache temizleme
    try {
      revalidatePath("/", "page");
      revalidatePath("/[slug]", "page");
      revalidatePath("/api/places", "route");
      revalidatePath("/api/rooms", "route");
      console.log("✅ Cache temizlendi");
    } catch (revalidateError) {
      console.warn("⚠️ Revalidation hatası:", revalidateError);
    }

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        id: room.content.campaigns.length - 1 // Array index
      },
      room: {
        room_id: room.room_id,
        name: room.name,
        campaigns_count: room.content.campaigns.length
      }
    });

  } catch (error) {
    console.error("❌ Kampanya ekleme hatası:", error);
    return NextResponse.json(
      {
        error: "Kampanya ekleme hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    console.log("🎯 PUT /api/admin/rooms/add-campaign - Kampanya güncelleme başladı");
    console.log("🔍 Request URL:", request.url);
    console.log("🔍 Request Method:", request.method);

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
    const roomId = formData.get("roomId");
    const placeId = formData.get("placeId");
    const campaignIndex = formData.get("campaignIndex");
    const title = formData.get("title");
    const description = formData.get("description");
    const discountPercentage = formData.get("discountPercentage");
    const discountAmount = formData.get("discountAmount");
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const imageFile = formData.get("image");
    const isActive = formData.get("is_active");

    console.log("📋 Kampanya güncelleme bilgileri:", {
      roomId,
      placeId,
      campaignIndex,
      title,
      description,
      discountPercentage,
      discountAmount,
      startDate,
      endDate,
      isActive,
      hasImage: !!imageFile
    });

    // Gerekli alanları kontrol et
    if (!roomId || !placeId || !campaignIndex || !title) {
      console.log("❌ Gerekli alanlar eksik:", { roomId, placeId, campaignIndex, title });
      return NextResponse.json(
        { error: "Room ID, Place ID, Campaign Index ve başlık gerekli" },
        { status: 400 }
      );
    }

    await connectDB();
    console.log("✅ MongoDB'ye bağlandı");

    // Room'u bul
    console.log("🔍 Room aranıyor:", { roomId, placeId });
    const room = await Room.findOne({ room_id: roomId, place_id: placeId });
    if (!room) {
      console.log("❌ Room bulunamadı:", { roomId, placeId });
      return NextResponse.json({ error: "Room bulunamadı" }, { status: 404 });
    }
    console.log("✅ Room bulundu:", room.name);

    // Kullanıcı yetkisi kontrolü
    console.log("🔍 Place aranıyor:", { placeId });
    const place = await Place.findById(placeId);
    if (!place) {
      console.log("❌ Place bulunamadı:", { placeId });
      return NextResponse.json({ error: "Place bulunamadı" }, { status: 404 });
    }
    console.log("✅ Place bulundu:", place.name);

    const isAdmin = user.role === "admin";
    const isPlaceOwner = place.owner_id === user.userId;
    const isStoreOwner = room.content?.owner_id === user.userId;

    if (!isAdmin && !isPlaceOwner && !isStoreOwner) {
      return NextResponse.json(
        { error: "Bu işlem için yetkiniz yok" },
        { status: 403 }
      );
    }

    // Campaign index kontrolü
    const campaignIdx = parseInt(campaignIndex);
    if (campaignIdx < 0 || campaignIdx >= room.content.campaigns.length) {
      return NextResponse.json({ error: "Geçersiz kampanya indeksi" }, { status: 400 });
    }

    // Mevcut kampanyayı al
    const existingCampaign = room.content.campaigns[campaignIdx];

    // Görsel yükleme
    let imagePath = existingCampaign.image; // Mevcut görseli koru

    if (imageFile && imageFile.size > 0) {
      // Eski görseli sil
      if (existingCampaign.image) {
        try {
          const oldImagePath = path.join(process.cwd(), "public", existingCampaign.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("✅ Eski kampanya görseli silindi:", existingCampaign.image);
          }
        } catch (error) {
          console.warn("⚠️ Eski görsel silme hatası:", error);
        }
      }

      // Yeni görseli yükle
      const uploadDir = path.join(
        process.cwd(),
        "public",
        "images",
        "rooms",
        placeId,
        roomId
      );

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileExtension = path.extname(imageFile.name);
      const fileName = `discount-${Date.now()}${fileExtension}`;
      imagePath = `images/rooms/${placeId}/${roomId}/${fileName}`;

      const filePath = path.join(uploadDir, fileName);
      const buffer = await imageFile.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));

      console.log("✅ Kampanya görseli yüklendi:", imagePath);
    }

    // Kampanya objesini güncelle
    const updatedCampaign = {
      title,
      description: description || "",
      discount_percentage: discountPercentage ? parseFloat(discountPercentage) : null,
      discount_amount: discountAmount ? parseFloat(discountAmount) : null,
      start_date: startDate ? new Date(startDate) : new Date(),
      end_date: endDate ? new Date(endDate) : null,
      image: imagePath,
      is_active: isActive === "true",
      created_at: existingCampaign.created_at, // Orijinal tarihi koru
      updated_at: new Date()
    };

    // Kampanyayı güncelle
    room.content.campaigns[campaignIdx] = updatedCampaign;
    room.needs_sync = true;
    room.last_synced = new Date();

    await room.save();

    console.log("✅ Kampanya güncellendi:", title);

    // Final GeoJSON dosyasını güncelle
    try {
      await updateFinalGeoJSON(placeId, roomId, room);
      console.log("✅ Final GeoJSON güncellendi");
    } catch (geoJsonError) {
      console.warn("⚠️ GeoJSON güncelleme hatası:", geoJsonError);
    }

    // Cache'i temizle
    revalidatePath("/admin/rooms");
    revalidatePath("/");

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign
    });

  } catch (error) {
    console.error("❌ Kampanya güncelleme hatası:", error);
    return NextResponse.json(
      {
        error: "Kampanya güncelleme hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Kampanya silme endpoint'i
export async function DELETE(request) {
  try {
    console.log("🗑️ DELETE /api/admin/rooms/add-campaign - Kampanya silme başladı");

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

    const { roomId, placeId, campaignIndex } = await request.json();

    if (!roomId || !placeId || campaignIndex === undefined) {
      return NextResponse.json({ error: "Room ID, Place ID ve kampanya index gerekli" }, { status: 400 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Room'u bul
    const room = await Room.findOne({ room_id: roomId, place_id: placeId });
    if (!room || !room.content.campaigns || !room.content.campaigns[campaignIndex]) {
      return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
    }

    // Yetkilendirme kontrolü
    if (user.role === "place_owner" && user.place_id !== placeId) {
      return NextResponse.json({ error: "Bu place'e erişim yetkiniz yok" }, { status: 403 });
    }

    if (user.role === "store_owner" && user.store_id !== roomId) {
      return NextResponse.json({ error: "Bu room'a erişim yetkiniz yok" }, { status: 403 });
    }

    // Kampanyayı sil
    const deletedCampaign = room.content.campaigns.splice(campaignIndex, 1)[0];
    room.needs_sync = true;
    room.last_synced = new Date();

    await room.save();

    // Görsel dosyasını da sil
    if (deletedCampaign.image) {
      try {
        const imagePath = path.join(process.cwd(), "public", deletedCampaign.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log("✅ Kampanya görseli silindi:", deletedCampaign.image);
        }
      } catch (error) {
        console.warn("⚠️ Görsel silme hatası:", error);
      }
    }

    console.log("✅ Kampanya silindi:", deletedCampaign.title);

    // Final GeoJSON dosyasını güncelle
    try {
      await updateFinalGeoJSON(placeId, roomId, room);
      console.log("✅ Final GeoJSON güncellendi");
    } catch (geoJsonError) {
      console.warn("⚠️ GeoJSON güncelleme hatası:", geoJsonError);
    }

    return NextResponse.json({
      success: true,
      deletedCampaign: deletedCampaign.title
    });

  } catch (error) {
    console.error("❌ Kampanya silme hatası:", error);
    return NextResponse.json(
      {
        error: "Kampanya silme hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
