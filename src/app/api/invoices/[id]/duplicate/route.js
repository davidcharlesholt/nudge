import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

export async function POST(_req, context) {
  try {
    // Get the current user's ID from Clerk
    const { userId } = await auth();

    // Return 401 if no user is authenticated
    if (!userId) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Await params in case it's a Promise (Next.js 14/15 compatibility)
    const params = await Promise.resolve(context.params);
    const { id } = params;

    // Validate ObjectId
    if (!id || !ObjectId.isValid(id)) {
      return Response.json(
        { ok: false, error: "Invalid invoice ID" },
        { status: 400 }
      );
    }

    const dbClient = await clientPromise;
    const db = dbClient.db(process.env.MONGODB_DB || "nudge");

    // Find the original invoice
    const originalInvoice = await db.collection("invoices").findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!originalInvoice) {
      return Response.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Create a new draft invoice with copied fields
    const now = new Date();
    const newInvoice = {
      userId,
      clientId: originalInvoice.clientId,
      amountCents: originalInvoice.amountCents || null,
      dueDate: originalInvoice.dueDate || null,
      paymentLink: originalInvoice.paymentLink || null,
      notes: originalInvoice.notes || "",
      ccEmails: originalInvoice.ccEmails || [],
      status: "draft", // Always create as draft
      emailFlow: originalInvoice.emailFlow || "custom",
      reminderSchedule: originalInvoice.reminderSchedule || "standard",
      templates: originalInvoice.templates || [],
      // Clear sent/reminder tracking fields
      sentAt: null,
      remindersSent: [],
      // Clear email error fields
      lastEmailErrorMessage: null,
      lastEmailErrorAt: null,
      lastEmailErrorContext: null,
      // Set timestamps
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("invoices").insertOne(newInvoice);

    return Response.json({
      ok: true,
      invoice: {
        ...newInvoice,
        id: result.insertedId.toString(),
        _id: result.insertedId.toString(),
        clientId: newInvoice.clientId.toString(),
      },
    });
  } catch (error) {
    console.error("POST /api/invoices/[id]/duplicate error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

