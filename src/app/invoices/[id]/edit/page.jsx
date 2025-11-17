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
import { ArrowLeft, Sparkles, Undo2, Check } from "lucide-react";
import {
  REMINDER_SCHEDULES,
  TONE_OPTIONS,
  initializeTemplatesForSchedule,
  updateTemplateTone,
  customizeTemplate,
  revertTemplateToDefaults,
  rewriteWithAI,
} from "@/lib/invoice-templates";

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const invoiceId = params.id;

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("draft");
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

      const [invoiceRes, clientsRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch("/api/clients"),
      ]);

      const invoiceData = await invoiceRes.json();
      const clientsData = await clientsRes.json();

      if (!invoiceRes.ok || !invoiceData.ok) {
        throw new Error(invoiceData.error || "Failed to fetch invoice");
      }

      if (!clientsRes.ok || !clientsData.ok) {
        throw new Error(clientsData.error || "Failed to fetch clients");
      }

      // Pre-fill form with invoice data
      const invoice = invoiceData.invoice;
      setClientId(invoice.clientId || "");
      setAmount((invoice.amountCents / 100).toFixed(2));
      setCurrency(invoice.currency || "USD");
      setDueDate(invoice.dueDate || "");
      setStatus(invoice.status || "draft");

      // Pre-fill email configuration
      setCurrentFlow(invoice.emailFlow || "custom");
      setReminderSchedule(invoice.reminderSchedule || "standard");

      if (invoice.templates && Array.isArray(invoice.templates)) {
        setTemplates(invoice.templates);
        setSavedTemplates(invoice.templates);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          amount: parseFloat(amount),
          currency,
          dueDate,
          status,
          notes: "",
          // Email configuration
          emailFlow: currentFlow,
          reminderSchedule,
          templates: savedTemplates,
        }),
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
                        {client.name} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              {/* Currency Field */}
              <div className="space-y-2">
                <Label htmlFor="currency">
                  Currency <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="currency"
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  required
                  placeholder="USD"
                />
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
                      rows={8}
                      placeholder="Type your message here..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Supports {"{"}
                      {"{"}clientName{"}"}, {"{"}
                      {"{"}amount{"}"}, {"{"}
                      {"{"}dueDate{"}"}, and {"{"}
                      {"{"}invoiceNumber{"}"} placeholders.
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
            <Button type="submit" disabled={submitting}>
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
    </div>
  );
}
