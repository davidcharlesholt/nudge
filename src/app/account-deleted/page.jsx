"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Account Deleted</CardTitle>
          <CardDescription className="text-base mt-2">
            Your Nudge account has been deleted. We&apos;re sorry to see you go!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            All your data including clients, invoices, and email flows have been permanently removed.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-up">Create a new account</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/sign-in">Sign in with a different account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



