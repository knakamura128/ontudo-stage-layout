import { NextResponse } from "next/server";
import { createSession, sessionCookie, sessionMaxAge, verifyGoogleCredential } from "@/app/lib/google-auth";

function readCookie(cookieHeader: string | null, name: string) {
  return cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function adminRedirect(request: Request, error?: "failed" | "not_admin") {
  const url = new URL("/admin", request.url);
  if (error) url.searchParams.set("login_error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const credential = form.get("credential");
    const csrfToken = form.get("g_csrf_token");
    const csrfCookie = readCookie(request.headers.get("cookie"), "g_csrf_token");
    if (typeof credential !== "string" || !credential || typeof csrfToken !== "string" || !csrfCookie || csrfToken !== csrfCookie) return adminRedirect(request, "failed");
    const user = await verifyGoogleCredential(credential);
    if (user.role !== "admin") return adminRedirect(request, "not_admin");
    const response = adminRedirect(request);
    response.cookies.set(sessionCookie, await createSession(user), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: sessionMaxAge });
    return response;
  } catch {
    return adminRedirect(request, "failed");
  }
}
