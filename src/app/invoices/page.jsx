"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

export default function InvoicesPage() {
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch clients and invoices in parallel
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
      setInvoices(invoicesData.invoices || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceToDelete.id));
      
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

  // Helper to get client name by ID
  function getClientName(clientId) {
    const client = clients.find((c) => c.id === clientId);
    return client ? client.name : "Unknown";
  }

  // Helper to format amount in dollars
  function formatAmount(amountCents, currency) {
    const dollars = (amountCents / 100).toFixed(2);
    return `${currency} $${dollars}`;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">All Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage invoices and track payments
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">Create Invoice</Link>
        </Button>
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
      {!loading && !error && invoices.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-muted-foreground text-center mb-4">
              No invoices yet. Create your first invoice to get started!
            </p>
            <Button asChild>
              <Link href="/invoices/new">Create Your First Invoice</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Invoices Table */}
      {!loading && !error && invoices.length > 0 && (
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
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {getClientName(invoice.clientId)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatAmount(invoice.amountCents, invoice.currency)}
                  </TableCell>
                  <TableCell>
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
              <strong>{invoiceToDelete && getClientName(invoiceToDelete.clientId)}</strong>?
              This action cannot be undone.
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
