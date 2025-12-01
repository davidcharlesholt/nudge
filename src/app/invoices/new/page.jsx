"use client";

import { useState, useEffect, useRef } from "react";
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
import { ArrowLeft, Sparkles, Undo2, Check, Plus, X, ChevronDown, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  REMINDER_SCHEDULES,
  TONE_OPTIONS,
  initializeTemplatesForSchedule,
  updateToneVariant,
  revertToneVariantToDefaults,
  getToneVariant,
  syncCanonicalFields,
  rewriteWithAI,
} from "@/lib/invoice-templates";
import { getWorkspace } from "@/lib/workspace";
import { getErrorToastDetails } from "@/lib/utils";

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
  // Default tone order: invoice tone → workspace.defaultEmailTone → 'friendly'
  const [reminderSchedule, setReminderSchedule] = useState("standard");
  const [templates, setTemplates] = useState(() =>
    initializeTemplatesForSchedule("standard", "friendly")
  );
  const [savedTemplates, setSavedTemplates] = useState(() =>
    initializeTemplatesForSchedule("standard", "friendly")
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("initial");
  const [initialToneSet, setInitialToneSet] = useState(false);

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
  const [showDeleteFlowDialog, setShowDeleteFlowDialog] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState(null);

  // Track previous template ID to detect template selection changes vs tone changes
  const prevSelectedTemplateIdRef = useRef(selectedTemplateId);

  // Load editor with selected template and tone
  // IMPORTANT: Each template can have its own tone. When switching templates,
  // we sync editorTone to that template's saved tone so the editor displays
  // the content the user actually saved, not a different tone variant.
  // This is critical for Email Flows to work correctly - all 4 templates
  // (Initial, Reminder 1, Reminder 2, Reminder 3) must round-trip correctly.
  useEffect(() => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (template) {
      // Determine which tone to use for loading content
      let toneToUse = editorTone;
      
      // If template selection changed (not just tone toggle clicked),
      // sync editorTone to the template's saved tone
      const templateChanged = prevSelectedTemplateIdRef.current !== selectedTemplateId;
      if (templateChanged) {
        prevSelectedTemplateIdRef.current = selectedTemplateId;
        if (template.tone) {
          toneToUse = template.tone;
          // Update the tone toggle to reflect the template's saved tone
          setEditorTone(template.tone);
        }
      }
      
      const variant = getToneVariant(template, toneToUse);
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

        // Fetch workspace and auto-populate due date and tone based on defaults
        const workspaceData = await getWorkspace();
        setWorkspace(workspaceData);
        
        // Auto-populate due date based on default payment terms
        if (workspaceData && workspaceData.defaultDueDateTerms) {
          const calculatedDueDate = calculateDueDateFromTerms(
            workspaceData.defaultDueDateTerms
          );
          setDueDate(calculatedDueDate);
        }
        
        // Initialize tone and templates with workspace default
        // Default tone order: workspace.defaultEmailTone → 'friendly'
        if (workspaceData && workspaceData.defaultEmailTone && !initialToneSet) {
          const defaultTone = workspaceData.defaultEmailTone;
          setEditorTone(defaultTone);
          const initialTemplates = initializeTemplatesForSchedule("standard", defaultTone);
          setTemplates(initialTemplates);
          setSavedTemplates(initialTemplates);
          setInitialToneSet(true);
        }
      } catch (err) {
        console.error("Error fetching clients:", err);
        const errorDetails = getErrorToastDetails(err, "Failed to load clients");
        setError(errorDetails.description);
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
    // Use current editor tone when changing schedule
    const newTemplates = initializeTemplatesForSchedule(
      pendingSchedule,
      editorTone
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

  // Apply a saved email flow to this invoice
  // IMPORTANT: Each template in the flow has its own tone, subject, and body.
  // All 4 templates must be restored exactly as saved - the flow stores the
  // complete state of each template independently.
  function confirmFlowApply() {
    if (!pendingFlow) return;

    setReminderSchedule(pendingFlow.schedule);
    setTemplates(pendingFlow.templates);
    setSavedTemplates(pendingFlow.templates);
    setCurrentFlow(pendingFlow.id);
    setSelectedTemplateId("initial");
    
    // Sync editorTone to the initial template's tone so the editor
    // displays the correct content immediately after applying the flow
    const initialTemplate = pendingFlow.templates.find(t => t.id === "initial");
    if (initialTemplate && initialTemplate.tone) {
      setEditorTone(initialTemplate.tone);
    }
    
    setShowFlowApplyDialog(false);
    setPendingFlow(null);
  }

  function cancelFlowApply() {
    setShowFlowApplyDialog(false);
    setPendingFlow(null);
  }

  // Save the current email flow (all templates) as a reusable named flow
  // IMPORTANT: savedTemplates contains ALL templates (Initial + all Reminders),
  // each with their own subject, body, tone, and toneVariants. Each template
  // is independent - saving one template should never affect others.
  // When this flow is applied later, ALL templates must be restored exactly.
  async function handleSaveFlow() {
    if (!flowName.trim()) return;

    try {
      const flowData = {
        name: flowName.trim(),
        schedule: reminderSchedule,
        templates: savedTemplates, // Contains all 4 templates with full state
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
      const errorDetails = getErrorToastDetails(err, "Failed to save flow");
      toast({
        variant: "destructive",
        title: errorDetails.title,
        description: errorDetails.description,
      });
    }
  }

  // Handle delete flow button click - shows confirmation dialog
  function handleDeleteFlowClick(e, flow) {
    e.stopPropagation();
    e.preventDefault();
    setFlowToDelete(flow);
    setShowDeleteFlowDialog(true);
  }

  // Confirm and execute flow deletion
  async function confirmDeleteFlow() {
    if (!flowToDelete) return;

    try {
      const res = await fetch(`/api/email-flows/${flowToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete flow");
      }

      // Remove flow from local state
      setSavedFlows(savedFlows.filter((f) => f.id !== flowToDelete.id));

      // If the deleted flow was currently selected, switch to custom
      if (currentFlow === flowToDelete.id) {
        setCurrentFlow("custom");
      }

      toast({
        title: "Flow deleted",
        description: `"${flowToDelete.name}" has been deleted.`,
      });
    } catch (err) {
      console.error("Error deleting flow:", err);
      const errorDetails = getErrorToastDetails(err, "Failed to delete flow");
      toast({
        variant: "destructive",
        title: errorDetails.title,
        description: errorDetails.description,
      });
    } finally {
      setShowDeleteFlowDialog(false);
      setFlowToDelete(null);
    }
  }

  function cancelDeleteFlow() {
    setShowDeleteFlowDialog(false);
    setFlowToDelete(null);
  }

  // Save current template for the current tone
  function handleSaveTemplate() {
    const updatedTemplates = templates.map((t) => {
      if (t.id === selectedTemplateId) {
        // Update the tone variant and sync canonical fields
        return updateToneVariant(t, editorTone, editorSubject, editorBody);
      }
      // For other templates, keep their existing canonical fields and tone
      // Each template maintains its own tone from when it was individually saved
      return t;
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
      const errorDetails = getErrorToastDetails(error, "Failed to rewrite");
      toast({
        variant: "destructive",
        title: errorDetails.title,
        description: errorDetails.description,
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

  async function handleSubmit(status) {
    setFormError(null);
    setSubmitting(true);

    try {
      // Build request payload based on status
      const payload = {
        clientId,
        status,
      };

      // For drafts, only include optional fields if they're filled in
      if (status === "draft") {
        if (amount) payload.amount = parseFloat(amount);
        if (paymentLink) payload.paymentLink = paymentLink;
        if (dueDate) payload.dueDate = dueDate;
        if (ccEmails && ccEmails.length > 0) payload.ccEmails = ccEmails;
        // Save tone even for drafts
        payload.emailTone = editorTone;
        // Don't include templates/schedule for drafts
      } else {
        // For sent invoices, include all required fields
        payload.amount = parseFloat(amount);
        payload.paymentLink = paymentLink;
        payload.dueDate = dueDate;
        payload.notes = "";
        payload.ccEmails = ccEmails;
        payload.emailFlow = currentFlow;
        payload.reminderSchedule = reminderSchedule;
        payload.templates = savedTemplates;
        payload.emailTone = editorTone;
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create invoice");
      }

      // Check if email failed (invoice created but email didn't send)
      if (data.emailError) {
        toast({
          variant: "destructive",
          title: "Email not sent",
          description:
            data.warning ||
            "We couldn't send this email, but the invoice was still saved. You can try again later or use Resend from the invoice menu.",
        });
        // Still redirect to invoices page - the invoice was created
        router.push("/invoices");
        return;
      }

      // Success - invoice created and email sent (or draft saved)
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
      const errorDetails = getErrorToastDetails(err, "Failed to create invoice");
      toast({
        variant: "destructive",
        title: errorDetails.title,
        description: errorDetails.description,
      });
      setSubmitting(false);
    }
  }

  function handlePreviewAndSend(e) {
    e.preventDefault();
    
    // Ensure each template's canonical fields are synced with its own tone
    // This preserves each template's individually saved tone
    const syncedTemplates = templates.map((t) => syncCanonicalFields(t, t.tone || editorTone));
    setSavedTemplates(syncedTemplates);
    
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 justify-between font-normal"
                        id="emailFlow"
                      >
                        <span>
                          {currentFlow === "custom"
                            ? "Custom (unsaved)"
                            : savedFlows.find((f) => f.id === currentFlow)?.name ||
                              "Select flow"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                      <DropdownMenuRadioGroup
                        value={currentFlow}
                        onValueChange={handleFlowChange}
                      >
                        <DropdownMenuRadioItem value="custom">
                          Custom (unsaved)
                        </DropdownMenuRadioItem>
                        {savedFlows.length > 0 && <DropdownMenuSeparator />}
                        {savedFlows.map((flow) => (
                          <DropdownMenuRadioItem
                            key={flow.id}
                            value={flow.id}
                            className="pr-10"
                          >
                            <span className="flex-1 truncate">{flow.name}</span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteFlowClick(e, flow)}
                              className="absolute right-2 p-1 rounded hover:bg-destructive/10 transition-colors"
                              title="Delete flow"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            <Button
              onClick={handlePreviewAndSend}
              disabled={submitting || clients.length === 0}
              variant="accent"
              className="shadow-md"
            >
              Preview & Send
            </Button>
            <Button
              onClick={handleSaveAsDraft}
              disabled={submitting || !clientId}
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

      {/* Delete Flow Confirmation Dialog */}
      <Dialog open={showDeleteFlowDialog} onOpenChange={setShowDeleteFlowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete email flow?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{flowToDelete?.name}&quot;?
              This cannot be undone. Existing invoices using this flow will not
              be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDeleteFlow}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteFlow}>
              Delete flow
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
              disabled={submitting}
              variant="accent"
              className="shadow-md"
            >
              {submitting ? "Sending..." : "Send Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
