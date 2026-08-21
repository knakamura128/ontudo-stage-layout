import { NextResponse } from "next/server";
import { readSession } from "@/app/lib/google-auth";
import { getDriveConnection } from "@/app/lib/google-drive";

export async function GET(request: Request) {
  const user = await readSession(request.headers.get("cookie"));
  if (!user || user.role !== "admin") return NextResponse.json({ error: "管理者としてログインしてください。" }, { status: 403 });
  try { return NextResponse.json(await getDriveConnection()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Google Driveの状態を取得できませんでした。" }, { status: 500 }); }
}
