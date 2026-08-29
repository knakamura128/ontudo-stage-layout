"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback?: (response: { credential: string }) => void; login_uri?: string; ux_mode?: "popup" | "redirect"; auto_select?: boolean; itp_support?: boolean }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = "395301319192-sr44o695g8se9vkklp2485rb15jqpum2.apps.googleusercontent.com";

export default function AdminLogin() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const redirectMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("login") === "redirect";

  useEffect(() => {
    const loginError = new URLSearchParams(window.location.search).get("login_error");
    if (loginError === "not_admin") setError("このGoogleアカウントには管理者権限がありません。登録されたアカウントでログインしてください。");
    if (loginError === "failed") setError("Googleログインを完了できませんでした。もう一度お試しください。");
    const signIn = async (credential: string) => {
      setError("");
      try {
        const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error || "ログインできませんでした。");
        window.location.assign("/admin");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "ログインできませんでした。");
      }
    };
    const renderButton = () => {
      if (!window.google || !buttonRef.current) return;
      buttonRef.current.replaceChildren();
      window.google.accounts.id.initialize(redirectMode
        ? { client_id: GOOGLE_CLIENT_ID, ux_mode: "redirect", login_uri: `${window.location.origin}/api/auth/google/redirect`, auto_select: false, itp_support: true }
        : { client_id: GOOGLE_CLIENT_ID, callback: ({ credential }) => void signIn(credential), auto_select: false, itp_support: true });
      window.google.accounts.id.renderButton(buttonRef.current, { type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "pill", width: 240 });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google) renderButton();
      else existing.addEventListener("load", renderButton, { once: true });
      return () => existing.removeEventListener("load", renderButton);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderButton, { once: true });
    document.head.appendChild(script);
    return () => script.removeEventListener("load", renderButton);
  }, [redirectMode]);

  return <div className="admin-login"><div ref={buttonRef} aria-label="Googleでログイン" />{redirectMode ? <><p className="admin-login-guide">Googleのログイン画面へ移動します。完了後、自動的にこのページへ戻ります。</p><a className="admin-login-fallback" href="/admin">通常のログインに戻る</a></> : <a className="admin-login-fallback" href="/admin?login=redirect">ログイン画面が白い場合はこちら</a>}<p className="admin-login-browser-note">LINEアプリ内ブラウザではGoogleのログイン画面が白くなる場合があります。Chrome・Edge・Safariなどの通常ブラウザでURLを開いてログインしてください。</p>{error && <p>{error}</p>}</div>;
}
