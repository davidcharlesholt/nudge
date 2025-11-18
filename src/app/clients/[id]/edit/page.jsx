"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, X } from "lucide-react";

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [additionalEmails, setAdditionalEmails] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Fetch client data on mount
  useEffect(() => {
    fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchClient() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to fetch client");
      }

      // Pre-fill form
      setFirstName(data.client.firstName || "");
      setLastName(data.client.lastName || "");
      setEmail(data.client.email || "");
      setCompanyName(data.client.companyName || "");
      setAdditionalEmails(data.client.additionalEmails || []);
    } catch (err) {
      console.error("Error fetching client:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function addAdditionalEmail() {
    setAdditionalEmails([...additionalEmails, ""]);
  }

  function removeAdditionalEmail(index) {
    setAdditionalEmails(additionalEmails.filter((_, i) => i !== index));
  }

  function updateAdditionalEmail(index, value) {
    const updated = [...additionalEmails];
    updated[index] = value;
    setAdditionalEmails(updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, companyName, additionalEmails }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update client");
      }

      toast({
        title: "Client updated",
        description: `${firstName} ${lastName}`.trim() + " has been updated successfully.",
      });

      // Redirect back to clients list
      router.push("/clients");
    } catch (err) {
      console.error("Error updating client:", err);
      toast({
        variant: "destructive",
        title: "Failed to update client",
        description: err.message,
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10">
      {/* Back Link */}
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/clients">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to clients
        </Link>
      </Button>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading client data...</p>
          </CardContent>
        </Card>
      )}

      {/* Error Loading Client */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4">
              <p className="font-medium">Error: {error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Form */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Client</CardTitle>
            <CardDescription>
              Update client information and contact details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* First Name Field */}
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="John"
                />
              </div>

              {/* Last Name Field */}
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="john@example.com"
                />
              </div>

              {/* Additional Emails */}
              <div className="space-y-2">
                {additionalEmails.map((additionalEmail, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      value={additionalEmail}
                      onChange={(e) => updateAdditionalEmail(index, e.target.value)}
                      placeholder="additional@example.com"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAdditionalEmail(index)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAdditionalEmail}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add another email
                </button>
              </div>

              {/* Company Name Field */}
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc. (optional)"
                />
              </div>

              {/* Error Message */}
              {formError && (
                <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm">
                  {formError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/clients">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

