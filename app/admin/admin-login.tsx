"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
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

  useEffect(() => {
    const signIn = async (credential: string) => {
      setError("");
      try {
        const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error || "ログインできませんでした。");
        window.location.reload();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "ログインできませんでした。");
      }
    };
    const renderButton = () => {
      if (!window.google || !buttonRef.current) return;
      buttonRef.current.replaceChildren();
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: ({ credential }) => void signIn(credential) });
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
  }, []);

  return <div className="admin-login"><div ref={buttonRef} aria-label="Googleでログイン" />{error && <p>{error}</p>}</div>;
}
