import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const inputCode = String(body?.code || "").trim();

    const expectedCode = process.env.DEMO_ACCESS_CODE;

    if (!expectedCode) {
      return NextResponse.json(
        { ok: false, message: "Server access code is not configured." },
        { status: 500 }
      );
    }

    if (!inputCode) {
      return NextResponse.json(
        { ok: false, message: "Access code is required." },
        { status: 400 }
      );
    }

    if (inputCode !== expectedCode) {
      return NextResponse.json(
        { ok: false, message: "Invalid access code." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      message: "Access granted.",
    });

    response.cookies.set("demo_access", "granted", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 hour
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: "Failed to verify access code." },
      { status: 500 }
    );
  }
}