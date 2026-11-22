import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "QR Attendance — College Attendance System",
  description:
    "QR-based attendance for college classes. A rotating QR code stops proxy attendance: screenshots expire in 15 seconds.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};
export const viewport: Viewport = { themeColor: "#0b1220" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="main">{children}</main>
        <ServiceWorker />
      </body>
    </html>
  );
}
