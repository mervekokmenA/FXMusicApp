import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FX Machine — Real-time Audio Effects",
  description: "Professional real-time audio effects processor. Apply reverb, delay, distortion, chorus, tremolo and more to your microphone live.",
  keywords: ["audio effects", "reverb", "delay", "real-time", "microphone", "music"],
  openGraph: {
    title: "FX Machine",
    description: "Real-time audio effects processor in your browser",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen grid-bg">{children}</body>
    </html>
  );
}
