import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { createSignedValue, readSession } from "@/app/lib/google-auth";

const stateCookie = "music_stage_drive_state";

export async function GET(request: Request) {
  const user = await readSession(request.headers.get("cookie"));
  if (!user || user.role !== "admin") return NextResponse.redirect(new URL("/admin", request.url));
  const clientId = (env as { GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string }).GOOGLE_DRIVE_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/admin?drive=setup", request.url));
  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/auth/google-drive/callback", request.url).toString();
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: "openid email https://www.googleapis.com/auth/drive.file", state }).toString();
  const response = NextResponse.redirect(authorize);
  response.cookies.set(stateCookie, await createSignedValue(state), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return response;
}
