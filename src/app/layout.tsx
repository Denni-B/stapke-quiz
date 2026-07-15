import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GhPagesRedirect } from "@/components/gh-pages-redirect";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

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
  title: "Stapke — Quiz App",
  description: "Create quizzes and let friends join with a code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <GhPagesRedirect />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
