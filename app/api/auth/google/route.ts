import { NextResponse } from "next/server";
import { createSession, sessionCookie, sessionMaxAge, verifyGoogleCredential } from "@/app/lib/google-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { credential?: string };
    if (!body.credential) return NextResponse.json({ error: "Googleの認証情報がありません。" }, { status: 400 });
    const user = await verifyGoogleCredential(body.credential);
    const response = NextResponse.json({ user });
    response.cookies.set(sessionCookie, await createSession(user), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: sessionMaxAge });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "ログインできませんでした。";
    return NextResponse.json({ error: message }, { status: message.includes("設定") ? 503 : 401 });
  }
}
