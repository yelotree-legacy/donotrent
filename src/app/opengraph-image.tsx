import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "They Can't Be Trusted — The rental industry's accountability network";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #161616 50%, #0a0a0a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            !
          </div>
          <div style={{ fontSize: 28, color: "#a3a3a3", letterSpacing: -0.5 }}>
            theycantbetrusted.com
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>
            They Can't Be<span style={{ color: "#f87171" }}> Trusted</span>.
          </div>
          <div style={{ fontSize: 32, color: "#d4d4d8", maxWidth: 900 }}>
            The rental industry's accountability network. Cross-source Do Not Rent + Broker Registry, in one place.
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 22, color: "#71717a" }}>
          <span>Cross-source DNR</span>
          <span>·</span>
          <span>OFAC sanctions</span>
          <span>·</span>
          <span>Broker reviews</span>
          <span>·</span>
          <span>API access</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
