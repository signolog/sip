// app/api/auth/signin/route.js
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { createJWTToken } from "@/utils/auth.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    console.log("🔐 Signin attempt:", { username });

    // Validasyon
    if (!username || !password) {
      return NextResponse.json(
        { error: "Kullanıcı adı ve şifre gerekli" },
        { status: 400 }
      );
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Kullanıcıyı bul
    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı adı veya şifre hatalı" },
        { status: 401 }
      );
    }

    // Şifre kontrolü
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Kullanıcı adı veya şifre hatalı" },
        { status: 401 }
      );
    }

    // Kullanıcı aktif mi kontrol et
    if (!user.is_active) {
      return NextResponse.json(
        { error: "Hesabınız devre dışı bırakılmış" },
        { status: 403 }
      );
    }

    // Son giriş tarihini güncelle
    user.last_login = new Date();
    await user.save();

    // JWT token oluştur
    const tokenPayload = {
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    const token = createJWTToken(tokenPayload, "30d"); // 30 gün geçerli

    // Kullanıcı bilgilerini döndür (şifre hariç)
    const userInfo = {
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    console.log("✅ Signin successful:", { username: user.username, role: user.role });

    return NextResponse.json({
      success: true,
      token,
      user: userInfo,
    });
  } catch (error) {
    console.error("❌ Signin hatası:", error);
    return NextResponse.json(
      {
        error: "Giriş hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
