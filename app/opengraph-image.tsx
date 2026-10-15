import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BUSINESS, SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

export const alt = `${SITE_NAME} – ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link-preview image (WhatsApp, Facebook, X, search) for every page.
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public", "samradhi-classes-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1d4ed8 0%, #312e81 60%, #0f172a 100%)", color: "white", fontFamily: "sans-serif", padding: 60 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={150} height={150} alt="" style={{ borderRadius: 75, background: "white" }} />
        <div style={{ marginTop: 28, fontSize: 76, fontWeight: 900, letterSpacing: -1 }}>SAMRADHI CLASSES</div>
        <div style={{ marginTop: 12, fontSize: 36, color: "#dbeafe", textAlign: "center" }}>{SITE_TAGLINE}</div>
        <div style={{ marginTop: 30, display: "flex", gap: 18, fontSize: 26, color: "#e0e7ff" }}>
          <span>SSC</span><span>•</span><span>Railway</span><span>•</span><span>High Court</span><span>•</span><span>State Exams</span><span>•</span><span>Hindi & English</span>
        </div>
        <div style={{ marginTop: 30, fontSize: 28, fontWeight: 700, color: "#fde68a" }}>{`sctyping.com · Sanganer, Jaipur · Call ${BUSINESS.phoneDisplay}`}</div>
      </div>
    ),
    size,
  );
}
