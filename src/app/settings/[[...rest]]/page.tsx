import { UserProfile } from "@clerk/nextjs";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="flex justify-center">
        <UserProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-lg border border-border rounded-lg",
            },
          }}
        />
      </div>
    </div>
  );
}

