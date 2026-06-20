import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { Providers } from "@/lib/providers";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tori | Recurring billing for Nigerian businesses",
  description: "The subscription infrastructure layer missing from Nomba",
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
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.0.0/dist/tabler-icons.min.css"
        />
      </head>
      <body
        className={montserrat.className}
        style={{
          fontFamily: montserrat.style.fontFamily,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
