"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUser } from "@clerk/nextjs";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingWorkspace, setCheckingWorkspace] = useState(true);

  // Form data
  const [workspaceName, setWorkspaceName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [defaultDueDateTerms, setDefaultDueDateTerms] = useState("net-30");
  const [defaultEmailTone, setDefaultEmailTone] = useState("friendly");

  // Check if user already has a workspace
  useEffect(() => {
    async function checkWorkspace() {
      if (!isLoaded || !user) return;

      try {
        const res = await fetch("/api/workspace");
        const data = await res.json();

        if (data.ok && data.workspace) {
          // User already has a workspace, redirect to dashboard
          router.push("/");
        }
      } catch (err) {
        console.error("Error checking workspace");
      } finally {
        setCheckingWorkspace(false);
      }
    }

    checkWorkspace();
  }, [isLoaded, user, router]);

  // Pre-fill display name with user's first name if available
  useEffect(() => {
    if (user && !displayName) {
      const firstName = user.firstName || "";
      setDisplayName(firstName);
    }
  }, [user, displayName]);

  const handleNext = () => {
    // Validate Step 2 before advancing to Step 3
    if (step === 2) {
      if (!workspaceName.trim()) {
        setError("Workspace name is required");
        return;
      }
      if (!displayName.trim()) {
        setError("Your name is required");
        return;
      }
      setError("");
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setError("");
    setStep(step - 1);
  };

  const handleFinish = async () => {
    // Just move to Step 4
    setStep(4);
  };

  const completeOnboarding = async (redirectTo = "/") => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName,
          displayName,
          defaultDueDateTerms,
          defaultEmailTone,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Failed to create workspace");
        setLoading(false);
        return;
      }

      // Success! Redirect to specified page
      router.push(redirectTo);
    } catch (err) {
      console.error("Error creating workspace");
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (checkingWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center bg-background px-4 py-6 sm:py-8">
      <div className="w-full max-w-xl">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <Card>
            <CardContent className="pt-6">
              {/* Centered Icon */}
              <div className="mb-4 flex justify-center">
                <Image
                  src="/nudge-icon.png"
                  alt="Nudge"
                  width={48}
                  height={48}
                  priority
                />
              </div>

              <CardHeader className="text-center px-0">
                <CardTitle className="text-2xl">Welcome to Nudge!</CardTitle>
                <CardDescription>
                  Let&apos;s set up your workspace.
                </CardDescription>
              </CardHeader>

              <div className="mt-6 flex justify-center">
                <Button onClick={handleNext} size="lg">
                  Get started
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Business Info */}
        {step === 2 && (
          <Card>
            <CardContent className="pt-6">
              {/* Centered Icon */}
              <div className="mb-4 flex justify-center">
                <Image
                  src="/nudge-icon.png"
                  alt="Nudge"
                  width={48}
                  height={48}
                />
              </div>

              <CardHeader className="text-center px-0">
                <CardTitle className="text-2xl">Business Info</CardTitle>
                <CardDescription>
                  Tell us a bit about your business
                </CardDescription>
              </CardHeader>

              <div className="mt-6 space-y-4">
                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor="workspaceName">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="workspaceName"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Acme Design Studio"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will appear on your invoices and in the
                    &apos;From&apos; name on emails. If you don&apos;t have a
                    company name, you can enter your full name (e.g.
                    &apos;Jordan Smith&apos;).
                  </p>
                </div>

                {/* Display Name / Sign-Off Name */}
                <div className="space-y-2">
                  <Label htmlFor="displayName">
                    Email Sign-Off Name{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="David"
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will appear at the end of your emails, like
                    &quot;Best, David.&quot;
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleBack} variant="outline">
                    Back
                  </Button>
                  <Button onClick={handleNext} className="flex-1">
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preferences */}
        {step === 3 && (
          <Card>
            <CardContent className="pt-6">
              {/* Centered Icon */}
              <div className="mb-4 flex justify-center">
                <Image
                  src="/nudge-icon.png"
                  alt="Nudge"
                  width={48}
                  height={48}
                />
              </div>

              <CardHeader className="text-center px-0">
                <CardTitle className="text-2xl">Preferences</CardTitle>
                <CardDescription>
                  Set your default invoice settings
                </CardDescription>
              </CardHeader>

              <div className="mt-6 space-y-6">
                {/* Default Due Date Terms */}
                <div className="space-y-2">
                  <Label htmlFor="dueDateTerms">Default Due Date Terms</Label>
                  <Select
                    value={defaultDueDateTerms}
                    onValueChange={setDefaultDueDateTerms}
                  >
                    <SelectTrigger id="dueDateTerms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due-on-receipt">
                        Due on receipt
                      </SelectItem>
                      <SelectItem value="net-7">Net 7</SelectItem>
                      <SelectItem value="net-15">Net 15</SelectItem>
                      <SelectItem value="net-30">Net 30</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This will be the default due date for new invoices. You can
                    change it on each invoice later.
                  </p>
                </div>

                {/* Default Email Tone */}
                <div className="space-y-2">
                  <Label htmlFor="emailTone">Default Email Tone</Label>
                  <Select
                    value={defaultEmailTone}
                    onValueChange={setDefaultEmailTone}
                  >
                    <SelectTrigger id="emailTone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="firm">
                        Firm but polite
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This is the tone we&apos;ll use for your invoice and
                    reminder templates. You can always adjust tone and copy on
                    individual invoices later.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleBack} variant="outline">
                    Back
                  </Button>
                  <Button
                    onClick={handleFinish}
                    className="flex-1"
                    disabled={loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Add First Client */}
        {step === 4 && (
          <Card>
            <CardContent className="pt-6">
              {/* Centered Icon */}
              <div className="mb-4 flex justify-center">
                <Image
                  src="/nudge-icon.png"
                  alt="Nudge"
                  width={48}
                  height={48}
                />
              </div>

              <CardHeader className="text-center px-0">
                <CardTitle className="text-2xl">
                  Add your first client (optional)
                </CardTitle>
                <CardDescription>
                  You&apos;re all set! You can add your first client now, or
                  skip and do it later from the dashboard.
                </CardDescription>
              </CardHeader>

              <div className="mt-6 space-y-4">
                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => completeOnboarding("/clients/new")}
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? "Setting up..." : "Add first client"}
                  </Button>
                  <Button
                    onClick={() => completeOnboarding("/")}
                    variant="outline"
                    size="lg"
                    disabled={loading}
                  >
                    Skip for now
                  </Button>
                </div>

                <Button
                  onClick={handleBack}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={loading}
                >
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step Indicator */}
        <div className="mt-6 flex justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 w-12 rounded-full transition-colors ${
                s === step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
