import { ImageResponse } from "next/og";
import { city } from "../lib/pujas";

export const dynamic = "force-static";
export const alt = `${city.brand} — Durga Puja 2026 Guide`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #78100d 0%, #b3231f 60%, #e11d48 100%)",
          fontFamily: "sans-serif",
          color: "white",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Subtle decorative gold frame */}
        <div
          style={{
            position: "absolute",
            inset: "24px",
            border: "2px solid rgba(255, 215, 0, 0.4)",
            borderRadius: "24px",
            display: "flex",
          }}
        />

        {/* Maa Durga Icon */}
        <svg
          viewBox="0 0 100 100"
          width="130"
          height="130"
          fill="none"
          style={{ marginBottom: "20px", display: "flex" }}
        >
          {/* Trinayan / Third Eye */}
          <path
            d="M50 14 C44 26, 44 34, 50 44 C56 34, 56 26, 50 14 Z"
            fill="#ffd700"
          />
          {/* Left Eye */}
          <path
            d="M16 53 C26 37, 42 37, 48 53 C42 64, 26 64, 16 53 Z"
            fill="#ffffff"
          />
          <circle cx="34" cy="52.5" r="4.5" fill="#1c1917" />
          {/* Right Eye */}
          <path
            d="M84 53 C74 37, 58 37, 52 53 C58 64, 74 64, 84 53 Z"
            fill="#ffffff"
          />
          <circle cx="66" cy="52.5" r="4.5" fill="#1c1917" />
          {/* Bengali Nath */}
          <circle
            cx="41"
            cy="69"
            r="9"
            stroke="#ffd700"
            strokeWidth="3.5"
            fill="none"
          />
          <circle cx="32" cy="69" r="2.2" fill="#ffd700" />
        </svg>

        {/* Bengali Brand */}
        <div
          style={{
            display: "flex",
            fontSize: "36px",
            color: "#ffd700",
            fontWeight: "700",
            letterSpacing: "1px",
            marginBottom: "8px",
          }}
        >
          {city.brandBn}
        </div>

        {/* English Title */}
        <div
          style={{
            display: "flex",
            fontSize: "56px",
            fontWeight: "800",
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: "960px",
            textShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {city.brand} · 2026
        </div>

        {/* Subtitle / Value prop */}
        <div
          style={{
            display: "flex",
            fontSize: "24px",
            color: "rgba(255, 255, 255, 0.9)",
            marginTop: "16px",
            textAlign: "center",
            maxWidth: "840px",
          }}
        >
          Schedules, Bhog, Verified Venues &amp; Multi-Stop Parikrama Planner
        </div>

        {/* Footer Tag */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            alignItems: "center",
            fontSize: "18px",
            color: "#ffd700",
            fontWeight: "600",
          }}
        >
          rabimba.github.io/{city.repoName}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
