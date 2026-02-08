import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moja - AI Call Center",
  description: "Voice-first AI assistant for bookings, scheduling, and budget management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
