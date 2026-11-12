import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hosting.com Coffee Campaign",
  description: "Coffee perks for Hosting.com customers",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading request headers makes every route render per request, so each page gets the CSP nonce
  // that middleware generated (a prerendered page would carry scripts without it and be blocked).
  await headers();
  return (
    // Font variables live on <html> because globals.css applies `font-sans` there.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        {/* One toaster for the whole app; it survives client navigation, so a toast can follow a redirect. */}
        <Toaster position="top-center" closeButton />
      </body>
    </html>
  );
}
