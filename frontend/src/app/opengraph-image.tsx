import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  const iconSvg = readFileSync(join(process.cwd(), "src/app/icon.svg"));
  const iconDataUrl = `data:image/svg+xml;base64,${iconSvg.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          fontFamily: "monospace",
          border: "8px solid #22c55e",
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconDataUrl}
          width={160}
          height={160}
          alt="what dough logo"
          style={{ borderRadius: 24, marginBottom: 48 }}
        />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            color: "white",
            fontSize: 96,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-3px",
          }}
        >
          <span>what dough</span>
          <span style={{ color: "#22c55e" }}>.</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            color: "#71717a",
            fontSize: 32,
            marginTop: 24,
            letterSpacing: "1px",
          }}
        >
          the yeast you can do for your group budget
        </div>
      </div>
    ),
    { ...size }
  );
}
