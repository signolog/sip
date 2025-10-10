// app/api/auth/register/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Place from "@/models/Place";

const JWT_SECRET = process.env.JWT_SECRET || "signolog_assist_secret_key_2024";

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, email, role, placeName, placeAddress, phoneNumber, status } = body;

    console.log("📝 Register attempt:", { username, email, role });

    // Validasyon
    if (!username || !password) {
      return NextResponse.json({ error: "Kullanıcı adı ve şifre gerekli" }, { status: 400 });
    }

    if (!email || !phoneNumber || !placeAddress) {
      return NextResponse.json({ error: "E-posta, telefon ve adres zorunlu alanlardır" }, { status: 400 });
    }

    if (role === "place_owner" && !placeName) {
      return NextResponse.json({ error: "Mekan adı zorunludur" }, { status: 400 });
    }

    if (role !== "place_owner" && role !== "store_owner") {
      return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Kullanıcı adı kontrolü
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten kullanılıyor" }, { status: 400 });
    }

    // E-posta kontrolü
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanılıyor" }, { status: 400 });
    }

    let placeId = null;

    // Mekan sahibi için yeni mekan oluştur
    if (role === "place_owner") {
      // Slug oluştur
      const slug = placeName 
        ? placeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : `place-${Date.now()}`;

      // Yeni mekan oluştur
      const newPlace = new Place({
        name: placeName,
        slug: slug,
        center: {
          type: "Point",
          coordinates: [32.8597, 39.9334], // Ankara default koordinatları
        },
        zoom: 18,
        status: status || "draft", // Kayıt sırasında gelen status veya draft
        content: {
          contact: {
            phone: phoneNumber,
            email: email,
            address: placeAddress,
          },
        },
      });

      const savedPlace = await newPlace.save();
      placeId = savedPlace._id;
      console.log("✅ Place created:", { id: placeId, name: placeName, status: savedPlace.status });

      // Mekan için klasör yapısı oluştur
      try {
        const publicDir = path.join(process.cwd(), "public");
        const placesDir = path.join(publicDir, "places");
        const placeDir = path.join(placesDir, slug);

        // public/places klasörü yoksa oluştur
        if (!fs.existsSync(placesDir)) {
          fs.mkdirSync(placesDir, { recursive: true });
          console.log("📁 Created places directory");
        }

        // public/places/{slug} klasörü oluştur
        if (!fs.existsSync(placeDir)) {
          fs.mkdirSync(placeDir, { recursive: true });
          console.log(`📁 Created place directory: ${slug}`);
        }

        // Alt klasörleri oluştur (base ve final)
        const subDirs = ["base", "final"];
        subDirs.forEach((subDir) => {
          const subDirPath = path.join(placeDir, subDir);
          if (!fs.existsSync(subDirPath)) {
            fs.mkdirSync(subDirPath, { recursive: true });
            console.log(`📁 Created subdirectory: ${slug}/${subDir}`);
          }
        });

        console.log(`✅ Folder structure created for: ${slug}`);
      } catch (fsError) {
        console.error("❌ Folder creation error:", fsError);
        // Klasör oluşturma hatası kayıt işlemini engellemez
      }
    }

    // Yeni kullanıcı oluştur
    const newUser = new User({
      username,
      password, // Model'deki middleware otomatik hash'leyecek
      email,
      role,
      place_id: placeId,
      is_active: true,
    });

    const savedUser = await newUser.save();
    console.log("✅ User created:", { id: savedUser._id, username: savedUser.username, role: savedUser.role });

    // JWT token oluştur
    const tokenPayload = {
      id: savedUser._id,
      username: savedUser.username,
      role: savedUser.role,
      place_id: savedUser.place_id,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    // Kullanıcı bilgilerini döndür (şifre hariç)
    const userInfo = {
      id: savedUser._id,
      username: savedUser.username,
      email: savedUser.email,
      role: savedUser.role,
      place_id: savedUser.place_id,
    };

    return NextResponse.json({
      success: true,
      token,
      user: userInfo,
      message: "Kayıt başarılı",
    });
  } catch (error) {
    console.error("❌ Register hatası:", error);
    return NextResponse.json(
      {
        error: "Kayıt hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
