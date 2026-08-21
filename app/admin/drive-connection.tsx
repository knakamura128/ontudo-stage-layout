"use client";

import { useEffect, useState } from "react";

export default function DriveConnection() {
  const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null);
  useEffect(() => { fetch("/api/auth/google-drive/status").then(async (response) => response.ok ? response.json() : null).then(setStatus).catch(() => setStatus(null)); }, []);
  if (status?.connected) return <div className="drive-connection connected"><span>✓</span><div><b>Google Drive 連携済み</b><small>{status.email || "連携アカウント"} のマイドライブへ提出PDFを保存します</small></div><a href="/api/auth/google-drive/start">連携を変更</a></div>;
  return <div className="drive-connection"><span>☁</span><div><b>Google Drive 未連携</b><small>提出PDFの保存先となるGoogleアカウントで、一度だけ連携してください。</small></div><a href="/api/auth/google-drive/start">Google Driveを連携</a></div>;
}
