"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export interface CertProps {
  name: string;
  title: string;
  code: string;
  issued: string;
  verifyUrl: string;
  score?: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Builds a standalone, high-resolution SVG certificate (downloadable + printable). */
export async function certificateSvg(p: CertProps) {
  const qr = await QRCode.toString(p.verifyUrl, { type: "svg", margin: 0, color: { dark: "#0b1020", light: "#ffffff" } });
  const qrInner = qr.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const qrViewBox = qr.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 33 33";
  const date = new Date(p.issued).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const title = p.title.replace("Rreal Certified: ", "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1131" width="1600" height="1131" role="img" aria-label="${esc(p.title)} awarded to ${esc(p.name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#070912"/><stop offset="1" stop-color="#151b38"/></linearGradient>
    <linearGradient id="ac" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#fb923c"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy="0" r=".8"><stop offset="0" stop-color="#22d3ee" stop-opacity=".18"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1600" height="1131" fill="url(#bg)"/>
  <rect width="1600" height="1131" fill="url(#glow)"/>
  <rect x="40" y="40" width="1520" height="1051" rx="28" fill="none" stroke="url(#ac)" stroke-width="4"/>
  <rect x="62" y="62" width="1476" height="1007" rx="20" fill="none" stroke="#2c365c" stroke-width="1.5"/>
  <g transform="translate(720 110)"><rect width="160" height="160" rx="44" fill="url(#ac)"/><path d="M52 118V42h34c17 0 26 9 26 22 0 10-5 17-14 20l16 34H95L81 87H69v31H52zm17-45h17c7 0 10-3 10-8s-3-8-10-8H69v16z" fill="#070912"/></g>
  <text x="800" y="330" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="30" letter-spacing="10" fill="#22d3ee">RREAL AI ACADEMY · CERTIFIED</text>
  <text x="800" y="420" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="64" font-weight="700" fill="#f4f6ff">${esc(title)}</text>
  <text x="800" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#aab4d6">This certifies that</text>
  <text x="800" y="600" text-anchor="middle" font-family="Georgia, serif" font-size="88" font-style="italic" fill="#ffffff">${esc(p.name)}</text>
  <rect x="460" y="630" width="680" height="3" fill="url(#ac)"/>
  <text x="800" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#aab4d6">has demonstrated applied mastery through interactive lessons, graded labs and assessments</text>
  <text x="800" y="740" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#aab4d6">in the Rreal AI Academy program${p.score ? ` · Final score ${p.score}%` : ""}.</text>
  <g font-family="Arial, sans-serif" fill="#aab4d6" font-size="22">
    <text x="160" y="900">ISSUED</text><text x="160" y="940" fill="#f4f6ff" font-size="30">${esc(date)}</text>
    <text x="160" y="990">CREDENTIAL ID</text><text x="160" y="1030" fill="#f4f6ff" font-size="30" font-family="Courier New, monospace">${esc(p.code)}</text>
  </g>
  <g transform="translate(1270 840)"><rect x="-14" y="-14" width="198" height="198" rx="14" fill="#ffffff"/><svg width="170" height="170" viewBox="${qrViewBox}">${qrInner}</svg></g>
  <text x="1355" y="1050" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#aab4d6">Scan to verify</text>
  <g transform="translate(800 960)" text-anchor="middle" font-family="Arial, sans-serif"><circle r="70" fill="none" stroke="url(#ac)" stroke-width="4"/><circle r="58" fill="none" stroke="#2c365c" stroke-width="2" stroke-dasharray="4 6"/><text y="-8" font-size="18" fill="#f4f6ff" font-weight="700">VERIFIED</text><text y="18" font-size="14" fill="#aab4d6">SIGNED · TAMPER-PROOF</text></g>
</svg>`;
}

export function CertificateArt(p: CertProps) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    certificateSvg(p).then(setSvg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.name, p.title, p.code, p.issued, p.verifyUrl, p.score]);
  return svg ? <div className="w-full overflow-hidden rounded-2xl shadow-2xl [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="aspect-[1600/1131] w-full animate-pulse rounded-2xl bg-raised" role="status"><span className="sr-only">Rendering certificate…</span></div>;
}
