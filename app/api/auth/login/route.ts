import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@netlify/database";
import { verifyPassword, generateJWT } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    
    // Rate limit by IP
    const rateLimitResult = checkRateLimit(`login:${ip}`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em 15 minutos." },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha obrigatórios" },
        { status: 400 }
      );
    }

    const db = getDatabase({ connectionString: process.env.DATABASE_URL });

    // Query user by email
    const result = await db.sql`
      SELECT id, password_hash, is_admin, token_version FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Email ou senha inválidos" },
        { status: 401 }
      );
    }

    const user = result[0];

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Email ou senha inválidos" },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = generateJWT(user.id);

    // Return JSON response with redirect URL
    // Client will handle the navigation
    const response = NextResponse.json(
      {
        success: true,
        redirectUrl: "/explore?workspace=wsk_5aca88d3450bce5975e1265277b9f5f6a8c5740bd5df3f5c"
      },
      { status: 200 }
    );

    // Set cookie on response
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  }
}
