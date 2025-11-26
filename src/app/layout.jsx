// src/app/layout.jsx (or layout.js)

import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
} from "@clerk/nextjs";
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
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={{
        variables: {
          colorPrimary: "#042C4C", // Nudge navy
          colorText: "#0F172A",
          colorBackground: "#FFFFFF",
          colorInputBackground: "#F9FAFB",
          colorInputText: "#0F172A",
          borderRadius: "0.5rem",
        },
      }}
    >
      <html lang="en">
        <body
          className={`${inter.className} bg-background text-foreground antialiased`}
        >
          <Header />
          <SignedIn>
            <main className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
              {children}
            </main>
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
