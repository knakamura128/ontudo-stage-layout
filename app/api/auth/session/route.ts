import { NextResponse } from "next/server";
import { readSession } from "@/app/lib/google-auth";

export async function GET(request: Request) {
  const user = await readSession(request.headers.get("cookie"));
  return NextResponse.json({ user });
}
