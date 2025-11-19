import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { sendInvoiceEmail } from "@/lib/email";
import { getToneVariant } from "@/lib/invoice-templates";

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

    // Parse request body
    const requestPayload = await _req.json();
    const { templateId } = requestPayload;

    if (!templateId || typeof templateId !== "string") {
      return Response.json(
        { ok: false, error: "templateId is required" },
        { status: 400 }
      );
    }

    const dbClient = await clientPromise;
    const db = dbClient.db(process.env.MONGODB_DB || "nudge");

    // Find the invoice
    const invoice = await db.collection("invoices").findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!invoice) {
      return Response.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Find the requested template
    const template = (invoice.templates || []).find((t) => t.id === templateId);

    if (!template) {
      return Response.json(
        { ok: false, error: "Template not found on this invoice" },
        { status: 400 }
      );
    }

    // Get the email subject and body with fallback logic
    // Primary: use canonical fields (always present after normalization)
    // Fallback: use tone variant if canonical fields are missing
    const variant = template.toneVariants ? getToneVariant(template, "friendly") : null;
    const finalSubject = template.subject || variant?.subject || "";
    const finalBody = template.body || variant?.body || "";

    // Fetch client data
    const clientDoc = await db.collection("clients").findOne({
      _id: invoice.clientId,
      userId,
    });

    if (!clientDoc) {
      return Response.json(
        { ok: false, error: "Client not found" },
        { status: 404 }
      );
    }

    // Fetch workspace for sender names
    const workspace = await db.collection("workspaces").findOne({ userId });
    const companyName = workspace?.workspaceName || workspace?.companyName;
    const displayName = workspace?.displayName;
    const fromName = companyName || displayName || "Nudge";
    const yourName = displayName || companyName || "Nudge";

    // Send the email
    try {
      await sendInvoiceEmail({
        to: clientDoc.email,
        ccEmails: invoice.ccEmails || [],
        subject: finalSubject,
        body: finalBody,
        client: {
          firstName: clientDoc.firstName,
          fullName: clientDoc.fullName,
        },
        amountCents: invoice.amountCents,
        dueDate: invoice.dueDate,
        paymentLink: invoice.paymentLink,
        yourName,
        fromName,
      });
    } catch (emailError) {
      console.error("Error resending email:", emailError);
      return Response.json(
        { ok: false, error: "Failed to send email: " + emailError.message },
        { status: 500 }
      );
    }

    // Add entry to remindersSent
    const now = new Date();
    const newReminderEntry = {
      templateId,
      sentAt: now,
      type: "manual-resend",
    };

    const updatedRemindersSent = [
      ...(invoice.remindersSent || []),
      newReminderEntry,
    ];

    // Update invoice
    await db.collection("invoices").updateOne(
      { _id: new ObjectId(id), userId },
      {
        $set: {
          remindersSent: updatedRemindersSent,
          updatedAt: now,
        },
      }
    );

    const updatedInvoice = {
      ...invoice,
      remindersSent: updatedRemindersSent,
      updatedAt: now,
      id: invoice._id.toString(),
      _id: invoice._id.toString(),
      clientId: invoice.clientId.toString(),
    };

    return Response.json({
      ok: true,
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error("POST /api/invoices/[id]/resend error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

