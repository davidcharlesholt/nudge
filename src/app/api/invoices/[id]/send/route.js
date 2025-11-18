import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { sendInvoiceEmail } from "@/lib/email";

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

    // Check if already sent
    if (invoice.status === "sent") {
      return Response.json(
        { ok: false, error: "Invoice has already been sent" },
        { status: 400 }
      );
    }

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

    // Fetch workspace for sender name
    const workspace = await db.collection("workspaces").findOne({ userId });
    const yourName = workspace?.displayName || "Nudge";

    // Get initial template
    const templates = invoice.templates || [];
    const initialTemplate = templates.find((t) => t.id === "initial");
    
    if (!initialTemplate) {
      return Response.json(
        { ok: false, error: "Invoice template not found" },
        { status: 400 }
      );
    }

    // Send the email
    try {
      await sendInvoiceEmail({
        to: clientDoc.email,
        ccEmails: invoice.ccEmails || [],
        subject: initialTemplate.subject,
        body: initialTemplate.body,
        client: {
          firstName: clientDoc.firstName,
          fullName: clientDoc.fullName,
        },
        amountCents: invoice.amountCents,
        dueDate: invoice.dueDate,
        paymentLink: invoice.paymentLink,
        yourName,
      });
    } catch (emailError) {
      console.error("Error sending invoice email:", emailError);
      return Response.json(
        { ok: false, error: "Failed to send email: " + emailError.message },
        { status: 500 }
      );
    }

    // Update invoice status to "sent" and set sentAt timestamp
    const now = new Date();
    await db.collection("invoices").updateOne(
      { _id: new ObjectId(id), userId },
      { 
        $set: { 
          status: "sent",
          sentAt: now,
          updatedAt: now,
        } 
      }
    );

    return Response.json({
      ok: true,
      invoice: {
        ...invoice,
        status: "sent",
        sentAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error("POST /api/invoices/[id]/send error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

