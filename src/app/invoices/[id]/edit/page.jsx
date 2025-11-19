"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Sparkles, Undo2, Check, Plus, X } from "lucide-react";
import {
  REMINDER_SCHEDULES,
  TONE_OPTIONS,
  initializeTemplatesForSchedule,
  updateToneVariant,
  revertToneVariantToDefaults,
  getToneVariant,
  syncCanonicalFields,
  normalizeTemplates,
  rewriteWithAI,
} from "@/lib/invoice-templates";

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const invoiceId = params.id;

  const [clients, setClients] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("draft");
  const [ccEmails, setCcEmails] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState(null);

  // Email flow state
  const [currentFlow, setCurrentFlow] = useState("custom");
  const [savedFlows, setSavedFlows] = useState([]);

  // Message & Tone state
  const [reminderSchedule, setReminderSchedule] = useState("standard");
  const [templates, setTemplates] = useState(() =>
    initializeTemplatesForSchedule("standard", "friendly")
  );
  const [savedTemplates, setSavedTemplates] = useState(() =>
    initializeTemplatesForSchedule("standard", "friendly")
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("initial");

  // Editor state
  const [editorTone, setEditorTone] = useState("friendly");
  const [editorSubject, setEditorSubject] = useState("");
  const [editorBody, setEditorBody] = useState("");
  const [previousSubject, setPreviousSubject] = useState("");
  const [previousBody, setPreviousBody] = useState("");
  const [aiRewritten, setAiRewritten] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);

  // Dialog state
  const [showScheduleChangeDialog, setShowScheduleChangeDialog] =
    useState(false);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [showFlowApplyDialog, setShowFlowApplyDialog] = useState(false);
  const [pendingFlow, setPendingFlow] = useState(null);
  const [showSaveFlowDialog, setShowSaveFlowDialog] = useState(false);
  const [flowName, setFlowName] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTab, setPreviewTab] = useState("initial");

  // Load editor with selected template and tone
  useEffect(() => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (template) {
      const variant = getToneVariant(template, editorTone);
      setEditorSubject(variant.subject);
      setEditorBody(variant.body);
      setAiRewritten(false);
    }
  }, [selectedTemplateId, editorTone, templates]);

  // Auto-populate CC emails when client changes
  useEffect(() => {
    if (clientId && clients.length > 0) {
      const selectedClient = clients.find((c) => c.id === clientId);
      if (selectedClient && selectedClient.additionalEmails) {
        // Only auto-populate if ccEmails is currently empty
        // to avoid overwriting user changes
        if (ccEmails.length === 0) {
          setCcEmails(selectedClient.additionalEmails);
        }
      }
    }
  }, [clientId, clients, ccEmails.length]);

  // Fetch invoice and clients data on mount
  useEffect(() => {
    fetchData();
    loadSavedFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [invoiceRes, clientsRes, workspaceRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch("/api/clients"),
        fetch("/api/workspace"),
      ]);

      const invoiceData = await invoiceRes.json();
      const clientsData = await clientsRes.json();
      const workspaceData = await workspaceRes.json();

      if (!invoiceRes.ok || !invoiceData.ok) {
        throw new Error(invoiceData.error || "Failed to fetch invoice");
      }

      if (!clientsRes.ok || !clientsData.ok) {
        throw new Error(clientsData.error || "Failed to fetch clients");
      }

      if (workspaceRes.ok && workspaceData.ok) {
        setWorkspace(workspaceData.workspace);
      }

      // Pre-fill form with invoice data
      const invoice = invoiceData.invoice;
      setClientId(invoice.clientId || "");
      // Handle optional fields for drafts
      setAmount(invoice.amountCents ? (invoice.amountCents / 100).toFixed(2) : "");
      setPaymentLink(invoice.paymentLink || "");
      setDueDate(invoice.dueDate || "");
      setStatus(invoice.status || "draft");
      setCcEmails(invoice.ccEmails || []);

      // Pre-fill email configuration
      setCurrentFlow(invoice.emailFlow || "custom");
      setReminderSchedule(invoice.reminderSchedule || "standard");

      if (invoice.templates && Array.isArray(invoice.templates)) {
        // Normalize templates to ensure they have canonical fields
        const normalizedTemplates = normalizeTemplates(invoice.templates, "friendly");
        setTemplates(normalizedTemplates);
        setSavedTemplates(normalizedTemplates);
      } else {
        // Fallback for old invoices
        const defaultTemplates = initializeTemplatesForSchedule(
          invoice.reminderSchedule || "standard",
          "friendly"
        );
        setTemplates(defaultTemplates);
        setSavedTemplates(defaultTemplates);
      }

      setClients(clientsData.clients || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedFlows() {
    try {
      const res = await fetch("/api/email-flows");
      if (res.ok) {
        const data = await res.json();
        setSavedFlows(data.flows || []);
      }
    } catch (err) {
      console.error("Error loading flows:", err);
    }
  }

  // Handle schedule change
  function handleScheduleChange(newSchedule) {
    if (newSchedule === reminderSchedule) return;
    setPendingSchedule(newSchedule);
    setShowScheduleChangeDialog(true);
  }

  function confirmScheduleChange() {
    const newTemplates = initializeTemplatesForSchedule(
      pendingSchedule,
      "friendly"
    );
    setTemplates(newTemplates);
    setSavedTemplates(newTemplates);
    setReminderSchedule(pendingSchedule);
    setSelectedTemplateId("initial");
    setCurrentFlow("custom");
    setShowScheduleChangeDialog(false);
    setPendingSchedule(null);
  }

  function cancelScheduleChange() {
    setShowScheduleChangeDialog(false);
    setPendingSchedule(null);
  }

  // Handle flow change
  function handleFlowChange(flowId) {
    if (flowId === "custom") {
      setCurrentFlow("custom");
      return;
    }

    const flow = savedFlows.find((f) => f.id === flowId);
    if (!flow) return;

    setPendingFlow(flow);
    setShowFlowApplyDialog(true);
  }

  function confirmFlowApply() {
    if (!pendingFlow) return;

    setReminderSchedule(pendingFlow.schedule);
    setTemplates(pendingFlow.templates);
    setSavedTemplates(pendingFlow.templates);
    setCurrentFlow(pendingFlow.id);
    setSelectedTemplateId("initial");
    setShowFlowApplyDialog(false);
    setPendingFlow(null);
  }

  function cancelFlowApply() {
    setShowFlowApplyDialog(false);
    setPendingFlow(null);
  }

  // Save current flow
  async function handleSaveFlow() {
    if (!flowName.trim()) return;

    try {
      const flowData = {
        name: flowName.trim(),
        schedule: reminderSchedule,
        templates: savedTemplates,
      };

      const res = await fetch("/api/email-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flowData),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save flow");
      }

      setSavedFlows([...savedFlows, data.flow]);
      setCurrentFlow(data.flow.id);
      setFlowName("");
      setShowSaveFlowDialog(false);

      toast({
        title: "Flow saved",
        description: `"${flowName}" has been saved successfully.`,
      });
    } catch (err) {
      console.error("Error saving flow:", err);
      toast({
        variant: "destructive",
        title: "Failed to save flow",
        description: err.message,
      });
    }
  }

  // Save current template for the current tone
  function handleSaveTemplate() {
    const updatedTemplates = templates.map((t) => {
      if (t.id === selectedTemplateId) {
        // Update the tone variant and sync canonical fields
        return updateToneVariant(t, editorTone, editorSubject, editorBody);
      }
      // For other templates, ensure canonical fields reflect current tone
      return syncCanonicalFields(t, editorTone);
    });

    setTemplates(updatedTemplates);
    setSavedTemplates(updatedTemplates);
    setCurrentFlow("custom");
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 2000);
  }

  // Revert current tone variant to defaults
  function handleRevertTemplate() {
    const currentTemplate = templates.find((t) => t.id === selectedTemplateId);
    if (currentTemplate) {
      const reverted = revertToneVariantToDefaults(currentTemplate, editorTone);

      const updatedTemplates = templates.map((t) =>
        t.id === selectedTemplateId ? reverted : t
      );

      setTemplates(updatedTemplates);
      setSavedTemplates(updatedTemplates);
      
      const variant = getToneVariant(reverted, editorTone);
      setEditorSubject(variant.subject);
      setEditorBody(variant.body);
      setAiRewritten(false);
    }
  }

  // Check if current tone variant has unsaved changes
  function hasUnsavedChanges() {
    const savedTemplate = savedTemplates.find(
      (t) => t.id === selectedTemplateId
    );
    if (!savedTemplate) return false;

    const savedVariant = getToneVariant(savedTemplate, editorTone);
    return (
      savedVariant.subject !== editorSubject ||
      savedVariant.body !== editorBody
    );
  }

  // Handle AI rewrite for current tone variant only
  async function handleAiRewrite() {
    try {
      setAiRewriting(true);
      
      // Save current content for undo
      setPreviousSubject(editorSubject);
      setPreviousBody(editorBody);

      // Call AI rewrite API
      const rewritten = await rewriteWithAI(editorSubject, editorBody, editorTone);
      
      // Update editor with rewritten content
      setEditorSubject(rewritten.subject);
      setEditorBody(rewritten.body);
      setAiRewritten(true);

      // Update the current tone variant in templates state
      const updatedTemplates = templates.map((t) =>
        t.id === selectedTemplateId
          ? updateToneVariant(t, editorTone, rewritten.subject, rewritten.body)
          : t
      );
      setTemplates(updatedTemplates);

      toast({
        title: "Content rewritten",
        description: "AI has successfully rewritten your email.",
      });
    } catch (error) {
      console.error("AI rewrite error:", error);
      toast({
        variant: "destructive",
        title: "Failed to rewrite",
        description: error.message || "An error occurred while rewriting the content.",
      });
    } finally {
      setAiRewriting(false);
    }
  }

  // Handle undo AI rewrite
  function handleUndoRewrite() {
    if (previousSubject || previousBody) {
      setEditorSubject(previousSubject);
      setEditorBody(previousBody);
      setPreviousSubject("");
      setPreviousBody("");
      setAiRewritten(false);
    }
  }

  // Handle tone change - just update the tone, useEffect will load the variant
  function handleToneChange(newTone) {
    setEditorTone(newTone);
    setAiRewritten(false);
  }

  function addCcEmail() {
    setCcEmails([...ccEmails, ""]);
  }

  function removeCcEmail(index) {
    setCcEmails(ccEmails.filter((_, i) => i !== index));
  }

  function updateCcEmail(index, value) {
    const updated = [...ccEmails];
    updated[index] = value;
    setCcEmails(updated);
  }

  function handlePreviewAndSend() {
    // Sync all templates' canonical fields with the current editor tone before preview
    const syncedTemplates = templates.map((t) => syncCanonicalFields(t, editorTone));
    setSavedTemplates(syncedTemplates);
    
    setShowPreviewModal(true);
    setPreviewTab("initial");
  }

  async function handleActualSend() {
    setShowPreviewModal(false);
    setSending(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        // Show specific toast for email failures
        toast({
          variant: "destructive",
          title: "Email not sent",
          description:
            data.error ||
            "We couldn't send this email, but the invoice was still saved. You can try again later or use Resend from the invoice menu.",
        });
        // Redirect to invoices - the invoice exists, just email failed
        router.push("/invoices");
        return;
      }

      // Update local status
      setStatus("sent");

      toast({
        title: "Invoice sent",
        description: "Invoice has been sent successfully.",
      });

      router.push("/invoices");
    } catch (err) {
      console.error("Error sending invoice:", err);
      toast({
        variant: "destructive",
        title: "Failed to send invoice",
        description: err.message,
      });
      setSending(false);
    }
  }

  // Helper to replace placeholders in email templates
  function replacePlaceholders(text, clientData, workspaceData) {
    if (!text) return "";

    const formattedAmount = `$${parseFloat(amount || 0).toFixed(2)}`;
    const dueDateObj = new Date(dueDate);
    const formattedDueDate = isNaN(dueDateObj)
      ? dueDate
      : dueDateObj.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
    const dayOfWeek = isNaN(dueDateObj)
      ? ""
      : dueDateObj.toLocaleDateString("en-US", { weekday: "long" });

    return text
      .replace(/\{\{clientName\}\}/g, clientData?.fullName || "")
      .replace(/\{\{clientFirstName\}\}/g, clientData?.firstName || "")
      .replace(/\{\{amount\}\}/g, formattedAmount)
      .replace(/\{\{dueDate\}\}/g, formattedDueDate)
      .replace(/\{\{paymentLink\}\}/g, paymentLink || "")
      .replace(/\{\{yourName\}\}/g, workspaceData?.displayName || "")
      .replace(/\{\{dayOfWeek\}\}/g, dayOfWeek);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      // Build payload with all available fields
      const payload = {
        clientId,
        status,
        notes: "",
        ccEmails,
      };

      // Only include amount if it's provided
      if (amount) {
        payload.amount = parseFloat(amount);
      }

      // Only include other fields if provided
      if (paymentLink) payload.paymentLink = paymentLink;
      if (dueDate) payload.dueDate = dueDate;
      if (emailFlow) payload.emailFlow = emailFlow;
      if (reminderSchedule) payload.reminderSchedule = reminderSchedule;
      if (savedTemplates) payload.templates = savedTemplates;

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update invoice");
      }

      toast({
        title: "Invoice updated",
        description: "Invoice has been updated successfully.",
      });

      router.push("/invoices");
    } catch (err) {
      console.error("Error updating invoice:", err);
      toast({
        variant: "destructive",
        title: "Failed to update invoice",
        description: err.message,
      });
      setSubmitting(false);
    }
  }

  const scheduleConfig = REMINDER_SCHEDULES[reminderSchedule];

  return (
    <div className="max-w-3xl mx-auto mt-10">
      {/* Back Link */}
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/invoices">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to invoices
        </Link>
      </Button>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading invoice data...</p>
          </CardContent>
        </Card>
      )}

      {/* Error Loading Invoice */}
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>
                Basic information about this invoice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client Select */}
              <div className="space-y-2">
                <Label htmlFor="clientId">
                  Client <span className="text-destructive">*</span>
                </Label>
                <Select value={clientId} onValueChange={setClientId} required>
                  <SelectTrigger id="clientId">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.fullName} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Primary Email & CC Emails */}
              {clientId && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                  {/* Primary Email (Read-Only) */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Send to:
                    </p>
                    <p className="text-sm font-medium">
                      {clients.find((c) => c.id === clientId)?.email || ""}
                    </p>
                  </div>

                  {/* CC Emails */}
                  <div className="space-y-2">
                    {ccEmails.map((ccEmail, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          type="email"
                          value={ccEmail}
                          onChange={(e) => updateCcEmail(index, e.target.value)}
                          placeholder="cc@example.com"
                          className="bg-background"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCcEmail(index)}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCcEmail}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      Add CC email
                    </button>
                  </div>
                </div>
              )}

              {/* Amount Field */}
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Amount (in dollars){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="100.00"
                />
              </div>

              {/* Payment Link Field */}
              <div className="space-y-2">
                <Label htmlFor="paymentLink">
                  Payment link <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="paymentLink"
                  type="url"
                  value={paymentLink}
                  onChange={(e) => setPaymentLink(e.target.value)}
                  required
                  placeholder="https://…"
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll insert this link into your invoice emails so
                  clients can pay quickly.
                </p>
              </div>

              {/* Due Date Field */}
              <div className="space-y-2">
                <Label htmlFor="dueDate">
                  Due Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              {/* Status Select */}
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select value={status} onValueChange={setStatus} required>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Message & Tone Card */}
          <Card>
            <CardHeader>
              <CardTitle>Message & Tone</CardTitle>
              <CardDescription>
                Configure the invoice email and follow-up reminders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Flow Selector */}
              <div className="space-y-2">
                <Label htmlFor="emailFlow">Email flow</Label>
                <div className="flex gap-2">
                  <Select value={currentFlow} onValueChange={handleFlowChange}>
                    <SelectTrigger id="emailFlow" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom (unsaved)</SelectItem>
                      {savedFlows.map((flow) => (
                        <SelectItem key={flow.id} value={flow.id}>
                          {flow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSaveFlowDialog(true)}
                  >
                    Save current flow
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Finalize all email templates below, then save your flow to
                  reuse it on future invoices.
                </p>
              </div>

              {/* Reminder Schedule */}
              <div className="space-y-2">
                <Label htmlFor="reminderSchedule">Reminder schedule</Label>
                <Select
                  value={reminderSchedule}
                  onValueChange={handleScheduleChange}
                >
                  <SelectTrigger id="reminderSchedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REMINDER_SCHEDULES).map(
                      ([key, schedule]) => (
                        <SelectItem key={key} value={key}>
                          {schedule.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {scheduleConfig?.description}
                </p>
              </div>

              {/* Template Selector */}
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger id="template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-6">
                <div className="space-y-4">
                  {/* Tone Selector */}
                  <div className="space-y-2">
                    <Label>Tone</Label>
                    <ToggleGroup
                      type="single"
                      value={editorTone}
                      onValueChange={(value) =>
                        value && handleToneChange(value)
                      }
                      className="justify-start flex-wrap"
                    >
                      {TONE_OPTIONS.map((option) => (
                        <ToggleGroupItem
                          key={option.value}
                          value={option.value}
                          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          {option.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <Label htmlFor="subject">Email subject</Label>
                    <Input
                      id="subject"
                      type="text"
                      value={editorSubject}
                      onChange={(e) => setEditorSubject(e.target.value)}
                      placeholder="Invoice from {{yourName}}"
                    />
                  </div>

                  {/* Body */}
                  <div className="space-y-2">
                    <Label htmlFor="body">Message to client</Label>
                    <Textarea
                      id="body"
                      value={editorBody}
                      onChange={(e) => setEditorBody(e.target.value)}
                      rows={16}
                      placeholder="Type your message here..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Supports {"{"}
                      {"{"}clientName{"}"}, {"{"}
                      {"{"}clientFirstName{"}"}, {"{"}
                      {"{"}amount{"}"}, {"{"}
                      {"{"}dueDate{"}"}, and {"{"}
                      {"{"}paymentLink{"}"} placeholders.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAiRewrite}
                      disabled={aiRewriting}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {aiRewriting ? "Rewriting..." : "Rewrite with AI"}
                    </Button>

                    {aiRewritten && !aiRewriting && (
                      <>
                        <span className="text-xs text-muted-foreground">
                          Rewritten with AI
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleUndoRewrite}
                        >
                          <Undo2 className="mr-2 h-4 w-4" />
                          Undo
                        </Button>
                      </>
                    )}

                    <div className="flex-1" />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRevertTemplate}
                      disabled={!hasUnsavedChanges()}
                    >
                      Revert
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveTemplate}
                    >
                      {showSavedIndicator && <Check className="mr-2 h-4 w-4" />}
                      {showSavedIndicator ? "Saved" : "Save changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {formError && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm">
              {formError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {status === "draft" && (
              <Button
                type="button"
                onClick={handlePreviewAndSend}
                disabled={submitting || sending}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
              >
                Preview & Send
              </Button>
            )}
            <Button type="submit" disabled={submitting || sending}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/invoices">Cancel</Link>
            </Button>
          </div>
        </form>
      )}

      {/* Dialogs */}
      <Dialog
        open={showScheduleChangeDialog}
        onOpenChange={setShowScheduleChangeDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change reminder schedule?</DialogTitle>
            <DialogDescription>
              Changing reminder schedules will override your existing reminder
              timings and messages for this invoice. You&apos;ll get the
              defaults for the new schedule. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelScheduleChange}>
              Cancel
            </Button>
            <Button onClick={confirmScheduleChange}>Change schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFlowApplyDialog} onOpenChange={setShowFlowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply email flow?</DialogTitle>
            <DialogDescription>
              Applying this email flow will replace your current schedule and
              messages for this invoice with the flow&apos;s settings. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelFlowApply}>
              Cancel
            </Button>
            <Button onClick={confirmFlowApply}>Apply flow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveFlowDialog} onOpenChange={setShowSaveFlowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save email flow</DialogTitle>
            <DialogDescription>
              Give this email flow a name so you can reuse it on future
              invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="flowName">Flow name</Label>
            <Input
              id="flowName"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="e.g., Standard follow-ups"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveFlowDialog(false);
                setFlowName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveFlow} disabled={!flowName.trim()}>
              Save flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Email Flow Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview Email Flow</DialogTitle>
            <DialogDescription>
              Review all emails that will be sent as part of this invoice. You
              can switch between tabs to see each message.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={previewTab}
            onValueChange={setPreviewTab}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <TabsList
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${savedTemplates.length}, 1fr)`,
              }}
            >
              {savedTemplates.map((template) => (
                <TabsTrigger key={template.id} value={template.id}>
                  {template.id === "initial"
                    ? "Initial Invoice"
                    : template.id.replace("reminder", "Reminder ")}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              {savedTemplates.map((template) => {
                const selectedClient = clients.find((c) => c.id === clientId);
                const previewSubject = replacePlaceholders(
                  template.subject,
                  selectedClient,
                  workspace
                );
                const previewBody = replacePlaceholders(
                  template.body,
                  selectedClient,
                  workspace
                );

                // Get timing description
                const scheduleConfig = REMINDER_SCHEDULES[reminderSchedule];
                const scheduleTemplate = scheduleConfig.templates.find(
                  (t) => t.id === template.id
                );
                let timingText = "";
                if (template.id === "initial") {
                  timingText = "Sent immediately when you click 'Send Invoice'";
                } else if (scheduleTemplate) {
                  const offset = scheduleTemplate.offset;
                  if (offset === 0) {
                    timingText = "Sent on the due date";
                  } else if (offset < 0) {
                    timingText = `Sent ${Math.abs(offset)} day${
                      Math.abs(offset) > 1 ? "s" : ""
                    } before due date`;
                  } else {
                    timingText = `Sent ${offset} day${
                      offset > 1 ? "s" : ""
                    } after due date`;
                  }
                }

                // Compute From name for preview
                const companyName = workspace?.workspaceName || workspace?.companyName;
                const displayName = workspace?.displayName;
                const previewFromName = companyName || displayName || "Nudge";

                return (
                  <TabsContent
                    key={template.id}
                    value={template.id}
                    className="space-y-4 mt-0"
                  >
                    {/* Timing Info */}
                    {timingText && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-900">
                          <strong>When:</strong> {timingText}
                        </p>
                      </div>
                    )}

                    {/* From */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">From:</Label>
                      <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
                        <p className="text-sm">
                          {previewFromName} &lt;hello@sendnudge.com&gt;
                        </p>
                      </div>
                    </div>

                    {/* Recipients */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">To:</Label>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1 text-sm">
                          {selectedClient?.email || "No client selected"}
                        </span>
                        {ccEmails.map((cc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1 text-sm"
                          >
                            {cc}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Subject:</Label>
                      <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
                        <p className="text-sm">{previewSubject}</p>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Message:</Label>
                      <div className="rounded-lg border border-gray-300 bg-white p-4 max-h-96 overflow-y-auto">
                        <div className="text-sm whitespace-pre-wrap">
                          {previewBody}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </div>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowPreviewModal(false)}
              className="bg-[#1e293b] hover:bg-[#0f172a] text-white border-0"
            >
              Back to Editing
            </Button>
            <Button
              onClick={handleActualSend}
              disabled={sending}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
            >
              {sending ? "Sending..." : "Send Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
