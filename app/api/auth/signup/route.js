// app/api/auth/signup/route.js
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { createJWTToken } from "@/utils/auth.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    console.log("📝 Signup attempt:", { username });

    // Validasyon - Sadece username ve password
    if (!username || !password) {
      return NextResponse.json(
        { error: "Kullanıcı adı ve şifre gerekli" },
        { status: 400 }
      );
    }

    // Şifre uzunluğu kontrolü
    if (password.length < 4) {
      return NextResponse.json(
        { error: "Şifre en az 4 karakter olmalıdır" },
        { status: 400 }
      );
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Kullanıcı adı kontrolü
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json(
        { error: "Bu kullanıcı adı zaten kullanılıyor" },
        { status: 400 }
      );
    }

    // Yeni kullanıcı oluştur - basic_user olarak
    const newUser = new User({
      username,
      password, // Model'deki middleware otomatik hash'leyecek
      role: "basic_user",
      is_active: true,
    });

    const savedUser = await newUser.save();
    console.log("✅ User created:", {
      id: savedUser._id,
      username: savedUser.username,
    });

    // JWT token oluştur
    const tokenPayload = {
      id: savedUser._id,
      username: savedUser.username,
      role: savedUser.role,
      email: savedUser.email,
      phone: savedUser.phone,
    };

    const token = createJWTToken(tokenPayload, "30d"); // 30 gün geçerli

    // Kullanıcı bilgilerini döndür (şifre hariç)
    const userInfo = {
      id: savedUser._id,
      username: savedUser.username,
      role: savedUser.role,
      email: savedUser.email,
      phone: savedUser.phone,
    };

    return NextResponse.json({
      success: true,
      token,
      user: userInfo,
    });
  } catch (error) {
    console.error("❌ Signup hatası:", error);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error name:", error.name);
    return NextResponse.json(
      {
        error: "Kayıt hatası",
        details: error.message,
        errorName: error.name,
      },
      { status: 500 }
    );
  }
}
