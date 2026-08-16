import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "音楽のつどい｜舞台配置",
  description: "学校ごとのステージを、迷わず。音楽のつどい舞台配置登録サイト。",
  openGraph: {
    title: "音楽のつどい｜舞台配置",
    description: "学校ごとのステージを、迷わず。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
