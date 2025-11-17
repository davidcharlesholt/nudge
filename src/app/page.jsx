"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState(30); // Default to last 30 days

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

  // Compute stats
  const totalClients = clients.length;
  const totalInvoices = invoices.length;
  const unpaidInvoices = invoices.filter(
    (inv) => inv.status === "sent" || inv.status === "overdue"
  ).length;

  // Filter invoices by date range
  const filterInvoicesByDate = (days) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return invoices.filter((invoice) => {
      const createdDate = new Date(invoice.createdAt);
      return createdDate >= cutoffDate;
    });
  };

  const recentInvoices = filterInvoicesByDate(dateFilter);

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your clients and invoices
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="font-medium">Error: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Total Clients Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs uppercase tracking-wide">
                  Total Clients
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {totalClients}
                </div>
              </CardContent>
            </Card>

            {/* Total Invoices Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs uppercase tracking-wide">
                  Total Invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {totalInvoices}
                </div>
              </CardContent>
            </Card>

            {/* Unpaid Invoices Card */}
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs uppercase tracking-wide text-destructive">
                  Unpaid Invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {unpaidInvoices}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Invoices Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Recent Invoices
              </h2>

              {/* Date Filter Dropdown */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="dateFilter"
                  className="text-sm text-muted-foreground font-medium"
                >
                  Show:
                </label>
                <select
                  id="dateFilter"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(Number(e.target.value))}
                  className="px-3 py-2 border border-input rounded-md text-sm bg-background cursor-pointer hover:bg-muted transition-colors"
                >
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
            </div>

            {recentInvoices.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground text-sm">
                    No invoices in this period yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-sm font-semibold text-muted-foreground">
                          Client
                        </th>
                        <th className="text-left p-3 text-sm font-semibold text-muted-foreground">
                          Amount
                        </th>
                        <th className="text-left p-3 text-sm font-semibold text-muted-foreground">
                          Status
                        </th>
                        <th className="text-left p-3 text-sm font-semibold text-muted-foreground">
                          Due Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentInvoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-3 text-sm">
                            {getClientName(invoice.clientId)}
                          </td>
                          <td className="p-3 text-sm font-medium">
                            {formatAmount(
                              invoice.amountCents,
                              invoice.currency
                            )}
                          </td>
                          <td className="p-3">
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
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* View All Invoices Button */}
            <div className="flex justify-end mt-4">
              <Button asChild>
                <Link href="/invoices">View All Invoices</Link>
              </Button>
            </div>
          </div>

          {/* Optional: Quick Summary */}
          {totalClients === 0 && totalInvoices === 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-xl">Welcome to Nudge!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground">
                  Get started by adding your first client, then create invoices
                  for them.
                </p>
                <p className="text-muted-foreground">
                  Nudge will help you track invoice statuses and send friendly
                  reminders when payments are overdue.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
