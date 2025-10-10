// app/api/auth/verify/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET || "signolog_assist_secret_key_2024";

export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token gerekli" }, { status: 400 });
    }

    // Token'ı verify et
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: "Geçersiz token" }, { status: 401 });
    }

    // MongoDB'ye bağlan
    await connectDB();

    // Kullanıcıyı bul
    const user = await User.findById(decoded.id);
    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 401 });
    }

    // Kullanıcı bilgilerini döndür
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
      user: userInfo,
    });
  } catch (error) {
    console.error("❌ Token verify hatası:", error);
    return NextResponse.json(
      {
        error: "Token verify hatası",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
