// app/api/auth/upgrade/route.js
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { verifyJWTToken, createJWTToken } from "@/utils/auth.js";

export async function POST(request) {
  try {
    // JWT token kontrolü
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token gerekli" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = verifyJWTToken(token);
    } catch (error) {
      return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
    }

    const body = await request.json();
    const { email, phone } = body;

    console.log("📝 Profile upgrade attempt:", { userId: decoded.id, email, phone });

    // Validasyon
    if (!email || !phone) {
      return NextResponse.json(
        { error: "E-posta ve telefon numarası gerekli" },
        { status: 400 }
      );
    }

    // Email formatı kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta adresi girin" },
        { status: 400 }
      );
    }

    // Telefon formatı kontrolü (0 ile başlayan 11 haneli)
    const phoneClean = phone.replace(/[\s-]/g, '');
    const phoneRegex = /^0[0-9]{10}$/;
    if (!phoneRegex.test(phoneClean)) {
      return NextResponse.json(
        { error: "Telefon numarası 0 ile başlamalı ve 11 haneli olmalıdır (örn: 05419675256)" },
        { status: 400 }
      );
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Kullanıcıyı bul
    const user = await User.findById(decoded.id);
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    // Email zaten kullanılıyor mu kontrol et
    if (email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return NextResponse.json(
          { error: "Bu e-posta adresi zaten kullanılıyor" },
          { status: 400 }
        );
      }
    }

    // Kullanıcıyı güncelle
    user.email = email;
    user.phone = phone;
    user.role = "advanced_user"; // Advanced user'a yükselt
    await user.save();

    console.log("✅ User upgraded to advanced_user:", {
      id: user._id,
      username: user.username,
      role: user.role,
    });

    // Yeni JWT token oluştur
    const newTokenPayload = {
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    const newToken = createJWTToken(newTokenPayload, "30d");

    // Kullanıcı bilgilerini döndür
    const userInfo = {
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    return NextResponse.json({
      success: true,
      token: newToken,
      user: userInfo,
    });
  } catch (error) {
    console.error("❌ Profile upgrade hatası:", error);
    return NextResponse.json(
      {
        error: "Profil güncelleme hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
