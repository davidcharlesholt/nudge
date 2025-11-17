// src/app/layout.jsx (or layout.js)

import Header from "@/components/Header";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Nudge",
  description: "Friendly invoice nudges for freelancers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-background text-foreground antialiased`}
      >
        <Header />
        <main className="max-w-6xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
