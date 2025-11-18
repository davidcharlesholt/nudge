"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  updateTemplateTone,
  customizeTemplate,
  revertTemplateToDefaults,
  rewriteWithAI,
} from "@/lib/invoice-templates";
import { getWorkspace } from "@/lib/workspace";

/**
 * Calculate due date based on payment terms
 * @param {string} terms - Payment terms (e.g., "due-on-receipt", "net-7", "net-15", "net-30")
 * @returns {string} Date in YYYY-MM-DD format
 */
function calculateDueDateFromTerms(terms) {
  const today = new Date();
  let daysToAdd = 0;

  if (terms === "due-on-receipt") {
    daysToAdd = 0;
  } else if (terms === "net-7") {
    daysToAdd = 7;
  } else if (terms === "net-15") {
    daysToAdd = 15;
  } else if (terms === "net-30") {
    daysToAdd = 30;
  } else {
    // Default to net-30 if unknown
    daysToAdd = 30;
  }

  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + daysToAdd);

  // Format as YYYY-MM-DD for date input
  const year = dueDate.getFullYear();
  const month = String(dueDate.getMonth() + 1).padStart(2, "0");
  const day = String(dueDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [ccEmails, setCcEmails] = useState([]);
  const [submitting, setSubmitting] = useState(false);
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
  const [previousBody, setPreviousBody] = useState("");
  const [aiRewritten, setAiRewritten] = useState(false);
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

  // Load editor with selected template
  useEffect(() => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (template) {
      setEditorTone(template.tone);
      setEditorSubject(template.subject);
      setEditorBody(template.body);
      setAiRewritten(false);
    }
  }, [selectedTemplateId, templates]);

  // Auto-populate CC emails when client changes
  useEffect(() => {
    if (clientId && clients.length > 0) {
      const selectedClient = clients.find((c) => c.id === clientId);
      if (selectedClient && selectedClient.additionalEmails) {
        setCcEmails(selectedClient.additionalEmails);
      } else {
        setCcEmails([]);
      }
    }
  }, [clientId, clients]);

  // Fetch clients on mount
  useEffect(() => {
    async function fetchClientsAndInit() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/clients");
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to fetch clients");
        }

        setClients(data.clients || []);

        // Pre-select client from query parameter if provided
        const preselectedClientId = searchParams.get("clientId");
        if (preselectedClientId) {
          setClientId(preselectedClientId);
        }

        // Fetch workspace and auto-populate due date based on default payment terms
        const workspaceData = await getWorkspace();
        setWorkspace(workspaceData);
        if (workspaceData && workspaceData.defaultDueDateTerms) {
          const calculatedDueDate = calculateDueDateFromTerms(
            workspaceData.defaultDueDateTerms
          );
          setDueDate(calculatedDueDate);
        }
      } catch (err) {
        console.error("Error fetching clients:", err);
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

    fetchClientsAndInit();
    loadSavedFlows();
  }, [searchParams]);

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

  // Save current template
  function handleSaveTemplate() {
    const updatedTemplates = templates.map((t) =>
      t.id === selectedTemplateId
        ? customizeTemplate(
            { ...t, tone: editorTone },
            editorSubject,
            editorBody
          )
        : t
    );

    setTemplates(updatedTemplates);
    setSavedTemplates(updatedTemplates);
    setCurrentFlow("custom");
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 2000);
  }

  // Revert current template to defaults
  function handleRevertTemplate() {
    const currentTemplate = templates.find((t) => t.id === selectedTemplateId);
    if (currentTemplate) {
      const reverted = revertTemplateToDefaults(currentTemplate);

      const updatedTemplates = templates.map((t) =>
        t.id === selectedTemplateId ? reverted : t
      );

      setTemplates(updatedTemplates);
      setSavedTemplates(updatedTemplates);
      setEditorTone(reverted.tone);
      setEditorSubject(reverted.subject);
      setEditorBody(reverted.body);
      setAiRewritten(false);
    }
  }

  // Check if current template has unsaved changes
  function hasUnsavedChanges() {
    const savedTemplate = savedTemplates.find(
      (t) => t.id === selectedTemplateId
    );
    if (!savedTemplate) return false;

    return (
      savedTemplate.tone !== editorTone ||
      savedTemplate.subject !== editorSubject ||
      savedTemplate.body !== editorBody
    );
  }

  // Handle AI rewrite
  function handleAiRewrite() {
    setPreviousBody(editorBody);
    const rewritten = rewriteWithAI(editorBody, editorTone);
    setEditorBody(rewritten);
    setAiRewritten(true);
  }

  // Handle undo AI rewrite
  function handleUndoRewrite() {
    if (previousBody) {
      setEditorBody(previousBody);
      setPreviousBody("");
      setAiRewritten(false);
    }
  }

  // Handle tone change
  function handleToneChange(newTone) {
    const currentTemplate = templates.find((t) => t.id === selectedTemplateId);
    if (currentTemplate) {
      const updated = updateTemplateTone(currentTemplate, newTone);

      // Update the template in state
      const updatedTemplates = templates.map((t) =>
        t.id === selectedTemplateId ? updated : t
      );
      setTemplates(updatedTemplates);

      // Update editor state
      setEditorTone(updated.tone);
      setEditorSubject(updated.subject);
      setEditorBody(updated.body);
      setAiRewritten(false);
    }
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

  async function handleSubmit(status) {
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          amount: parseFloat(amount),
          paymentLink,
          dueDate,
          status,
          notes: "",
          ccEmails,
          // Email configuration
          emailFlow: currentFlow,
          reminderSchedule,
          templates: savedTemplates,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create invoice");
      }

      const message =
        status === "sent"
          ? "Invoice has been created and sent successfully."
          : "Invoice has been saved as a draft.";

      toast({
        title: status === "sent" ? "Invoice sent" : "Draft saved",
        description: message,
      });

      router.push("/invoices");
    } catch (err) {
      console.error("Error creating invoice:", err);
      toast({
        variant: "destructive",
        title: "Failed to create invoice",
        description: err.message,
      });
      setSubmitting(false);
    }
  }

  function handlePreviewAndSend(e) {
    e.preventDefault();
    setShowPreviewModal(true);
    setPreviewTab("initial");
  }

  function handleSaveAsDraft(e) {
    e.preventDefault();
    handleSubmit("draft");
  }

  async function handleActualSend() {
    setShowPreviewModal(false);
    await handleSubmit("sent");
  }

  // Helper to replace placeholders in email templates
  function replacePlaceholders(text, clientData, workspaceData) {
    if (!text) return "";

    const formattedAmount = `$${parseFloat(amount || 0).toFixed(2)}`;
    const dueDateObj = new Date(dueDate);
    const dayOfWeek = dueDateObj.toLocaleDateString("en-US", {
      weekday: "long",
    });

    return text
      .replace(/\{\{clientName\}\}/g, clientData?.fullName || "")
      .replace(/\{\{clientFirstName\}\}/g, clientData?.firstName || "")
      .replace(/\{\{amount\}\}/g, formattedAmount)
      .replace(/\{\{dueDate\}\}/g, dueDate || "")
      .replace(/\{\{paymentLink\}\}/g, paymentLink || "")
      .replace(/\{\{yourName\}\}/g, workspaceData?.displayName || "")
      .replace(/\{\{dayOfWeek\}\}/g, dayOfWeek);
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
            <p className="text-muted-foreground">Loading clients...</p>
          </CardContent>
        </Card>
      )}

      {/* Error Loading Clients */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4">
              <p className="font-medium">Error: {error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {!loading && !error && (
        <form className="space-y-6">
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
                {clients.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No clients available.{" "}
                    <Link
                      href="/clients/new"
                      className="text-foreground underline"
                    >
                      Add a client first
                    </Link>
                    .
                  </p>
                )}
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
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Rewrite with AI
                    </Button>

                    {aiRewritten && (
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
            <Button
              onClick={handlePreviewAndSend}
              disabled={submitting || clients.length === 0}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
            >
              Preview & Send
            </Button>
            <Button
              onClick={handleSaveAsDraft}
              disabled={submitting || clients.length === 0}
              className="bg-[#1e293b] hover:bg-[#0f172a] text-white"
            >
              {submitting ? "Saving..." : "Save as Draft"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/invoices">Cancel</Link>
            </Button>
          </div>
        </form>
      )}

      {/* Schedule Change Dialog */}
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

      {/* Flow Apply Dialog */}
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

      {/* Save Flow Dialog */}
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
              disabled={submitting}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
            >
              {submitting ? "Sending..." : "Send Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
