import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shared Pendo Dashboard",
  description:
    "Publicly-hostable mirror of a Pendo dashboard, rendered with live data from the Pendo API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
