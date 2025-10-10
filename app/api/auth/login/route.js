// app/api/auth/login/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET || "signolog_assist_secret_key_2024";

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    console.log("🔐 Login attempt:", { username, password: password ? "***" : "undefined" });

    if (!username || !password) {
      console.log("❌ Missing username or password");
      return NextResponse.json({ error: "Username ve password gerekli" }, { status: 400 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Kullanıcıyı bul
    const user = await User.findOne({ username, is_active: true });
    console.log("👤 User found:", user ? { username: user.username, role: user.role } : "null");

    if (!user) {
      console.log("❌ User not found");
      return NextResponse.json({ error: "Geçersiz kullanıcı adı veya şifre" }, { status: 401 });
    }

    // Şifreyi kontrol et
    const isPasswordValid = await user.comparePassword(password);
    console.log("🔑 Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("❌ Invalid password");
      return NextResponse.json({ error: "Geçersiz kullanıcı adı veya şifre" }, { status: 401 });
    }

    // JWT token oluştur
    const tokenPayload = {
      id: user._id,
      username: user.username,
      role: user.role,
      place_id: user.place_id,
      store_id: user.store_id,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    // Son giriş zamanını güncelle
    await User.findByIdAndUpdate(user._id, { last_login: new Date() });

    // Kullanıcı bilgilerini döndür (şifre hariç)
    const userInfo = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      place_id: user.place_id?.toString(),
      store_id: user.store_id,
      last_login: user.last_login,
    };

    return NextResponse.json({
      success: true,
      token,
      user: userInfo,
    });
  } catch (error) {
    console.error("❌ Login hatası:", error);
    return NextResponse.json(
      {
        error: "Login hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
