import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";

import "./globals.css";

// Same fonts Pendo uses: Sora for display, Inter for body.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pulse · Public dashboard",
  description:
    "Public mirror of a Pendo Pulse dashboard — live KPIs, DAU, stickiness, and visitor segmentation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-pendo-cream font-sans text-pendo-body antialiased">
        {children}
      </body>
    </html>
  );
}
