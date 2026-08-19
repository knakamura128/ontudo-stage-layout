import { NextResponse } from "next/server";
import { sessionCookie } from "@/app/lib/google-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  return response;
}
