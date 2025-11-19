"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { REMINDER_SCHEDULES } from "@/lib/invoice-templates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { MoreVertical, Pencil, Trash2, CheckCircle2, ChevronDown } from "lucide-react";

export default function InvoicesPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const { toast } = useToast();

  // Status filter state - all selected by default
  const [selectedStatuses, setSelectedStatuses] = useState([
    "draft",
    "sent",
    "paid",
    "past-due",
  ]);

  useEffect(() => {
    checkWorkspaceAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkWorkspaceAndFetch() {
    const workspace = await requireWorkspace(router);
    if (!workspace) return; // Will redirect to onboarding
    fetchData();
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch all clients and invoices (no filter param)
      const [clientsRes, invoicesRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/invoices"),
      ]);

      const clientsData = await clientsRes.json();
      const invoicesData = await invoicesRes.json();

      if (!clientsRes.ok || !clientsData.ok) {
        throw new Error(clientsData.error || "Failed to fetch clients");
      }

      if (!invoicesRes.ok || !invoicesData.ok) {
        throw new Error(invoicesData.error || "Failed to fetch invoices");
      }

      setClients(clientsData.clients || []);
      setAllInvoices(invoicesData.invoices || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Toggle status filter
  function toggleStatus(status) {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status);
      } else {
        return [...prev, status];
      }
    });
  }

  // Filter invoices based on selected statuses
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((invoice) => {
      // Check if invoice is past due
      const isPastDueInvoice =
        invoice.status === "sent" &&
        !invoice.paidAt &&
        new Date(invoice.dueDate) < new Date();

      // Check if invoice matches any selected status
      if (selectedStatuses.includes(invoice.status)) return true;
      if (selectedStatuses.includes("past-due") && isPastDueInvoice) return true;

      return false;
    });
  }, [allInvoices, selectedStatuses]);

  function openDeleteDialog(invoice) {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!invoiceToDelete) return;

    try {
      const res = await fetch(`/api/invoices/${invoiceToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete invoice");
      }

      // Remove from local state
      setAllInvoices((prev) =>
        prev.filter((inv) => inv.id !== invoiceToDelete.id)
      );

      toast({
        title: "Invoice deleted",
        description: `Invoice has been removed successfully.`,
      });

      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      toast({
        variant: "destructive",
        title: "Failed to delete invoice",
        description: err.message,
      });
    }
  }

  function handleEdit(invoiceId) {
    window.location.href = `/invoices/${invoiceId}/edit`;
  }

  async function handleMarkAsPaid(invoice) {
    try {
      // Optimistically update UI
      setAllInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id
            ? { ...inv, status: "paid", paidAt: new Date().toISOString() }
            : inv
        )
      );

      const res = await fetch(`/api/invoices/${invoice.id}/mark-paid`, {
        method: "PATCH",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        // Revert optimistic update on error
        setAllInvoices((prev) =>
          prev.map((inv) => (inv.id === invoice.id ? invoice : inv))
        );
        throw new Error(data.error || "Failed to mark invoice as paid");
      }

      toast({
        title: "Invoice marked as paid",
        description: "Invoice has been marked as paid.",
      });
    } catch (err) {
      console.error("Error marking invoice as paid:", err);
      toast({
        variant: "destructive",
        title: "Failed to mark invoice as paid",
        description: err.message,
      });
    }
  }

  // Helper to get client name by ID
  function getClientName(clientId) {
    const client = clients.find((c) => c.id === clientId);
    return client ? client.fullName : "Unknown";
  }

  // Helper to format amount in dollars
  function formatAmount(amountCents) {
    const dollars = (amountCents / 100).toFixed(2);
    return `$${dollars}`;
  }

  // Helper to check if invoice is past due
  function isPastDue(invoice) {
    return (
      invoice.status !== "paid" &&
      new Date(invoice.dueDate) < new Date()
    );
  }

  // Status configuration with colors
  const statusConfig = [
    {
      value: "draft",
      label: "Draft",
      dotColor: "bg-gray-400",
    },
    {
      value: "sent",
      label: "Sent",
      dotColor: "bg-blue-500",
    },
    {
      value: "paid",
      label: "Paid",
      dotColor: "bg-green-500",
    },
    {
      value: "past-due",
      label: "Past Due",
      dotColor: "bg-red-500",
    },
  ];

  // Helper component to render reminder timeline for an invoice
  function ReminderTimeline({ invoice }) {
    // Skip if no reminder schedule
    if (!invoice.reminderSchedule) return null;

    const scheduleConfig = REMINDER_SCHEDULES[invoice.reminderSchedule];
    if (!scheduleConfig) return null;

    const remindersSent = invoice.remindersSent || [];

    // Get template labels (simple names)
    const getSimpleLabel = (id) => {
      if (id === "initial") return "Initial";
      if (id === "reminder1") return "Reminder 1";
      if (id === "reminder2") return "Reminder 2";
      if (id === "reminder3") return "Reminder 3";
      if (id === "reminder4") return "Reminder 4";
      return id;
    };

    // Check if a reminder was sent
    const getReminderStatus = (templateId) => {
      // Special case for "initial" - it's sent if invoice status is "sent", "paid", or "overdue"
      if (templateId === "initial") {
        const sentFromArray = remindersSent.find((r) => r.id === templateId);
        if (sentFromArray) return sentFromArray;
        
        // If invoice is sent/paid/overdue, initial was sent (use sentAt or fallback)
        if (["sent", "paid", "overdue"].includes(invoice.status)) {
          return {
            id: "initial",
            sentAt: invoice.sentAt || invoice.createdAt,
          };
        }
      }
      
      return remindersSent.find((r) => r.id === templateId);
    };

    // Format sent date
    const formatSentDate = (sentAt) => {
      if (!sentAt) return "";
      const date = new Date(sentAt);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">Timeline:</span>
        {scheduleConfig.templates.map((template) => {
          const sentInfo = getReminderStatus(template.id);
          const isSent = !!sentInfo;

          return (
            <div
              key={template.id}
              className={`
                inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium
                ${
                  isSent
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "border border-muted text-muted-foreground bg-background"
                }
              `}
              title={
                isSent
                  ? `Sent ${formatSentDate(sentInfo.sentAt)}`
                  : "Not sent yet"
              }
            >
              {getSimpleLabel(template.id)}
              {isSent && (
                <span className="ml-1 text-[10px] opacity-70">
                  ✓
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            All Invoices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage invoices and track payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`
                  ${
                    selectedStatuses.length < statusConfig.length
                      ? "border-blue-500"
                      : ""
                  }
                `}
              >
                Status
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {selectedStatuses.length}/{statusConfig.length}
                </span>
                <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              {statusConfig.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status.value}
                  checked={selectedStatuses.includes(status.value)}
                  onCheckedChange={() => toggleStatus(status.value)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${status.dotColor}`}
                    />
                    <span>{status.label}</span>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            asChild
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
          >
            <Link href="/invoices/new">Create Invoice</Link>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading invoices...</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="font-medium">Error: {error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredInvoices.length === 0 && allInvoices.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-muted-foreground text-center mb-4">
              No invoices yet. Create your first invoice to get started!
            </p>
            <Button
              asChild
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
            >
              <Link href="/invoices/new">Create Your First Invoice</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* No Results from Filter */}
      {!loading && !error && filteredInvoices.length === 0 && allInvoices.length > 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-muted-foreground text-center">
              No invoices match the selected filters.
            </p>
          </div>
        </Card>
      )}

      {/* Invoices Table */}
      {!loading && !error && filteredInvoices.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-[70px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <React.Fragment key={invoice.id}>
                  <TableRow>
                    <TableCell className="font-medium">
                      {getClientName(invoice.clientId)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(invoice.amountCents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`
                            inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium
                            ${
                              invoice.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : invoice.status === "overdue"
                                ? "bg-red-100 text-red-800"
                                : invoice.status === "sent"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }
                          `}
                        >
                          {invoice.status}
                        </span>
                        {isPastDue(invoice) && (
                          <Badge variant="destructive">Past Due</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEdit(invoice.id)}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit invoice
                          </DropdownMenuItem>
                          {invoice.status !== "paid" && (
                            <DropdownMenuItem
                              onClick={() => handleMarkAsPaid(invoice)}
                              className="cursor-pointer"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(invoice)}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {invoice.reminderSchedule && (
                    <TableRow className="border-none">
                      <TableCell colSpan={5} className="py-2 bg-muted/30">
                        <ReminderTimeline invoice={invoice} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice for{" "}
              <strong>
                {invoiceToDelete && getClientName(invoiceToDelete.clientId)}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
