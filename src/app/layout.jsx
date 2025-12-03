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
import { headers } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Nudge",
  description: "Friendly invoice nudges for freelancers",
};

// Public routes that don't require authentication
const publicRoutes = ["/account-deleted", "/sign-in", "/sign-up"];

export default async function RootLayout({ children }) {
  // Get the current path from headers
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  
  // Check if current route is public (allow account-deleted page without auth)
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

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
            {isPublicRoute ? (
              <main className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
                {children}
              </main>
            ) : (
              <RedirectToSignIn />
            )}
          </SignedOut>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
