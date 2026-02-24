import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("name, zipcode")
    .eq("id", id)
    .single();

  const eventName = event?.name ?? "Group Event";
  const location = event?.zipcode ? `near ${event.zipcode}` : null;

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
          backgroundColor: "#09090b",
          fontFamily: "monospace",
          padding: "60px",
          border: "8px solid #22c55e",
        }}
      >
        {/* Logo chip */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconDataUrl}
          width={96}
          height={96}
          alt="what dough logo"
          style={{ borderRadius: 16, marginBottom: 40 }}
        />

        {/* Event name */}
        <div
          style={{
            color: "white",
            fontSize: eventName.length > 30 ? 64 : 80,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-2px",
            lineHeight: 1.1,
            flex: 1,
          }}
        >
          {eventName}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 40,
          }}
        >
          <span style={{ color: "#22c55e", fontSize: 28, fontWeight: 700 }}>
            what dough.
          </span>
          {location && (
            <span style={{ color: "#71717a", fontSize: 24 }}>{location}</span>
          )}
          <span style={{ color: "#71717a", fontSize: 24 }}>
            the yeast you can do for your group budget
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
