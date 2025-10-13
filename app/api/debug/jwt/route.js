// Debug endpoint - JWT secret kontrolü için
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const secret = process.env.JWT_SECRET;
    
    return NextResponse.json({
      hasSecret: !!secret,
      secretLength: secret ? secret.length : 0,
      secretPreview: secret ? secret.substring(0, 4) + "..." : "undefined"
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
