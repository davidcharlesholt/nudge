"use client";

import { UserProfile } from "@clerk/nextjs";

export default function AccountSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Account & Login
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage your account settings and authentication preferences
          </p>
        </div>

        <div className="flex justify-center w-full">
          <div className="w-full max-w-4xl">
            <UserProfile
              path="/settings/account"
              routing="path"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-lg border border-border rounded-lg bg-card",
                  navbar: "bg-card",
                  navbarMobileMenuButton: "text-foreground",
                  pageScrollBox: "bg-card",
                  page: "bg-card",
                  profileSection: "bg-card",
                  profileSectionPrimaryButton: "bg-primary text-primary-foreground hover:bg-primary/90",
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

