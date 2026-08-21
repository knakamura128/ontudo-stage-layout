import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { readSession, verifySignedValue } from "@/app/lib/google-auth";
import { saveDriveConnection } from "@/app/lib/google-drive";

const stateCookie = "music_stage_drive_state";

function cookieValue(header: string | null, name: string) {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

export async function GET(request: Request) {
  const redirect = new URL("/admin", request.url);
  const requestUrl = new URL(request.url);
  const user = await readSession(request.headers.get("cookie"));
  const state = requestUrl.searchParams.get("state") ?? "";
  const signedState = cookieValue(request.headers.get("cookie"), stateCookie);
  if (!user || user.role !== "admin" || !(await verifySignedValue(signedState, state))) {
    redirect.searchParams.set("drive", "invalid");
    return NextResponse.redirect(redirect);
  }
  const code = requestUrl.searchParams.get("code");
  if (!code) {
    redirect.searchParams.set("drive", "denied");
    return NextResponse.redirect(redirect);
  }
  try {
    const runtime = env as { GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string; GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string };
    if (!runtime.GOOGLE_DRIVE_OAUTH_CLIENT_ID || !runtime.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET) throw new Error("Google Drive連携の認証設定が完了していません。");
    const redirectUri = new URL("/api/auth/google-drive/callback", request.url).toString();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: runtime.GOOGLE_DRIVE_OAUTH_CLIENT_ID, client_secret: runtime.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    const token = await tokenResponse.json() as { refresh_token?: string; access_token?: string; error_description?: string };
    if (!tokenResponse.ok || !token.refresh_token || !token.access_token) throw new Error(token.error_description || "Google Driveの連携を完了できませんでした。");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as { email?: string };
    await saveDriveConnection(token.refresh_token, profile.email ?? user.email);
    redirect.searchParams.set("drive", "connected");
  } catch {
    redirect.searchParams.set("drive", "failed");
  }
  const response = NextResponse.redirect(redirect);
  response.cookies.set(stateCookie, "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  return response;
}
