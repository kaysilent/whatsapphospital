import { ImageResponse } from "next/og";

// Replaces the default Next.js favicon with the brand mark — Hostinger
// violet rounded square + white chat-square glyph — matching the
// sidebar logo in `src/components/layout/sidebar.tsx`. Next.js renders
// this at build time and auto-injects <link rel="icon"> into <head>.
//
// This route takes precedence over src/app/favicon.ico, which is the
// Next.js default and can stay on disk harmlessly (or be removed).

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
          borderRadius: 8,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          {/* White WhatsApp Chat Bubble */}
          <path
            d="M12 2.5C6.75 2.5 2.5 6.75 2.5 12c0 1.77.49 3.42 1.34 4.84L2.5 21.5l4.82-1.27C8.69 21.05 10.3 21.5 12 21.5c5.25 0 9.5-4.25 9.5-9.5s-4.25-9.5-9.5-9.5z"
            fill="#ffffff"
          />
          {/* Emerald Medical Cross */}
          <path
            d="M12 7.5v8"
            stroke="#059669"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M8 11.5h8"
            stroke="#059669"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
