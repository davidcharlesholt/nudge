"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default function ClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [showSuccessCard, setShowSuccessCard] = useState(false);
  const [createdClientId, setCreatedClientId] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    checkWorkspaceAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Check if we should show the success card
    const created = searchParams.get("created");
    const clientId = searchParams.get("clientId");

    if (created === "true" && clientId) {
      setShowSuccessCard(true);
      setCreatedClientId(clientId);
      // Remove query params from URL without reloading
      router.replace("/clients", { scroll: false });
    }
  }, [searchParams, router]);

  async function checkWorkspaceAndFetch() {
    const workspace = await requireWorkspace(router);
    if (!workspace) return; // Will redirect to onboarding
    fetchClients();
  }

  async function fetchClients() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/clients");
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to fetch clients");
      }

      setClients(data.clients || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openDeleteDialog(client) {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!clientToDelete) return;

    try {
      const res = await fetch(`/api/clients/${clientToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete client");
      }

      // Remove from local state
      setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));

      toast({
        title: "Client deleted",
        description: `${clientToDelete.name} has been removed.`,
      });

      setDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (err) {
      console.error("Error deleting client:", err);
      toast({
        variant: "destructive",
        title: "Failed to delete client",
        description: err.message,
      });
    }
  }

  function handleEdit(clientId) {
    window.location.href = `/clients/${clientId}/edit`;
  }

  function handleDismissSuccessCard() {
    setShowSuccessCard(false);
    setCreatedClientId(null);
  }

  function handleCreateInvoice() {
    if (createdClientId) {
      router.push(`/invoices/new?clientId=${createdClientId}`);
    } else {
      router.push("/invoices/new");
    }
  }

  return (
    <div>
      {/* Success Card Overlay */}
      {showSuccessCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Client added</CardTitle>
              <CardDescription>
                You can create their first invoice now or do it later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                <Button onClick={handleCreateInvoice} size="lg">
                  Create first invoice
                </Button>
                <Button
                  onClick={handleDismissSuccessCard}
                  variant="outline"
                  size="lg"
                >
                  Skip for now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              All Clients
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your client contacts
            </p>
          </div>
          
          <Button
            asChild
            variant="accent"
            className="shadow-md w-full sm:w-auto min-h-[44px]"
          >
            <Link href="/clients/new">Add New Client</Link>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading clients...</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && clients.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-muted-foreground text-center mb-4">
              No clients yet. Add your first client to get started!
            </p>
            <Button asChild variant="accent" className="shadow-md">
              <Link href="/clients/new">Add Your First Client</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Clients Table */}
      {!loading && !error && clients.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="w-[70px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    {client.fullName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.companyName || "—"}
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
                          onClick={() => handleEdit(client.id)}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit client
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(client)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete client
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
            <AlertDialogTitle>Delete Client?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{clientToDelete?.name}</strong>? This action cannot be
              undone and will remove all associated data.
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
