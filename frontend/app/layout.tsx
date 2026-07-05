import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tori | Recurring billing infrastructure for Nigerian businesses",
  description: "The subscription infrastructure layer missing from Nomba",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.0.0/dist/tabler-icons.min.css"
        />
      </head>
      <body
        style={{
          fontFamily: "'Satoshi', sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
