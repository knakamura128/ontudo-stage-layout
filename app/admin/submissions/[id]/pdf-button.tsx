"use client";
import { useState } from "react";

export default function PdfButton() {
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const target = document.querySelector<HTMLElement>(".setup-sheet");
    if (!target || busy) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(target, { backgroundColor: "#fff", scale: 2 });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const sourceRatio = canvas.width / canvas.height;
      let width = 210;
      let height = width / sourceRatio;
      if (height > 297) { height = 297; width = height * sourceRatio; }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", (210 - width) / 2, (297 - height) / 2, width, height, undefined, "FAST");
      pdf.save("舞台設営・備品配置資料.pdf");
    } finally {
      setBusy(false);
    }
  };

  return <button className="pdf-button" onClick={create} disabled={busy}>{busy ? "PDFを作成中…" : "設営資料PDFを作成（A4・1枚）"}</button>;
}
