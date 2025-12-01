"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { getWorkspace } from "@/lib/workspace";
import { useToast } from "@/components/ui/use-toast";
import { getErrorToastDetails } from "@/lib/utils";

export default function BusinessSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Form data
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [defaultDueDateTerms, setDefaultDueDateTerms] = useState("net-30");
  const [defaultEmailTone, setDefaultEmailTone] = useState("friendly");

  // Load existing workspace data
  useEffect(() => {
    async function loadWorkspace() {
      try {
        const workspace = await getWorkspace();
        if (workspace) {
          // Handle both old (workspaceName) and new (companyName) field names
          setCompanyName(workspace.companyName || workspace.workspaceName || "");
          setDisplayName(workspace.displayName || "");
          setDefaultDueDateTerms(workspace.defaultDueDateTerms || "net-30");
          setDefaultEmailTone(workspace.defaultEmailTone || "friendly");
          setLastUpdated(workspace.updatedAt ? new Date(workspace.updatedAt) : null);
        }
      } catch (err) {
        console.error("Error loading workspace:", err);
        setError("Failed to load workspace settings");
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          displayName: displayName.trim(),
          defaultDueDateTerms,
          defaultEmailTone,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update workspace settings");
      }

      // Update last updated timestamp
      setLastUpdated(new Date());

      toast({
        title: "Saved",
        description: "Your business settings have been updated.",
      });

      // Refresh the page to update header workspace name
      router.refresh();
    } catch (err) {
      console.error("Error updating workspace:", err);
      const errorDetails = getErrorToastDetails(err, "Failed to save");
      setError(errorDetails.description);
      toast({
        variant: "destructive",
        title: errorDetails.title,
        description: errorDetails.description,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="space-y-6">
          <div>
            <div className="h-9 w-64 bg-muted animate-pulse rounded-md mb-2" />
            <div className="h-5 w-96 bg-muted animate-pulse rounded-md" />
          </div>
          <Card>
            <CardHeader>
              <div className="h-6 w-48 bg-muted animate-pulse rounded-md mb-2" />
              <div className="h-4 w-72 bg-muted animate-pulse rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded-md mb-2" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded-md mb-2" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Business Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage your workspace settings and invoice defaults
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Business Settings</CardTitle>
            <CardDescription>
              Update your company name and how Nudge signs your emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Design Studio"
                  required
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  This will appear as the sender name in your invoice emails. Use your business name or your full name.
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  Email Sign-Off Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="David"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Used inside email sign-offs (e.g., &quot;Best, Sarah&quot;). Optional.
                </p>
              </div>

              {/* Default Due Date Terms */}
              <div className="space-y-2">
                <Label htmlFor="dueDateTerms">Default Due Date Terms</Label>
                <Select
                  value={defaultDueDateTerms}
                  onValueChange={setDefaultDueDateTerms}
                  disabled={submitting}
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
                  Default payment terms for new invoices.
                </p>
              </div>

              {/* Default Email Tone */}
              <div className="space-y-2">
                <Label htmlFor="emailTone">Default Email Tone</Label>
                <Select
                  value={defaultEmailTone}
                  onValueChange={setDefaultEmailTone}
                  disabled={submitting}
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
                  Default tone for invoice and reminder email templates.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex gap-3">
                  <Button type="submit" disabled={submitting} variant="accent">
                    {submitting ? "Saving..." : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    Last updated {lastUpdated.toLocaleDateString()}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

