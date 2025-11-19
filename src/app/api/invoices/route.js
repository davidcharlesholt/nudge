import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { sendInvoiceEmail } from "@/lib/email";

export async function GET(req) {
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

    // Parse filter from query params
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");
    
    // Build query based on filter
    let query = { userId };
    
    if (filter === "draft") {
      query.status = "draft";
    } else if (filter === "sent") {
      query.status = "sent";
    } else if (filter === "paid") {
      query.status = "paid";
    } else if (filter === "pastdue") {
      // Past due: not paid and due date is before today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];
      
      query.status = { $ne: "paid" };
      query.dueDate = { $lt: todayStr };
    }
    // else filter === "all", no additional filters
    
    const invoices = await db
      .collection("invoices")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Convert _id and clientId to strings and add id field for frontend
    // Ensure remindersSent defaults to empty array for back-compat
    const invoicesWithStringIds = invoices.map((inv) => ({
      ...inv,
      id: inv._id.toString(),
      _id: inv._id.toString(),
      clientId: inv.clientId.toString(),
      remindersSent: Array.isArray(inv.remindersSent) ? inv.remindersSent : [],
    }));

    return Response.json({ ok: true, invoices: invoicesWithStringIds });
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
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

    const body = await req.json();
    const {
      clientId,
      amount,
      dueDate,
      status,
      notes,
      paymentLink,
      ccEmails,
      emailFlow,
      reminderSchedule,
      templates,
    } = body;

    // Validate required fields
    if (!clientId || !amount || !dueDate || !status || !paymentLink) {
      return Response.json(
        {
          ok: false,
          error:
            "clientId, amount, dueDate, status, and paymentLink are required.",
        },
        { status: 400 }
      );
    }

    // Validate paymentLink is a valid URL
    if (typeof paymentLink !== "string" || paymentLink.trim() === "") {
      return Response.json(
        {
          ok: false,
          error: "paymentLink must be a non-empty string.",
        },
        { status: 400 }
      );
    }

    // Validate status enum (only draft or sent allowed)
    const normalizedStatus = status.toLowerCase().trim();
    if (normalizedStatus !== "draft" && normalizedStatus !== "sent") {
      return Response.json(
        {
          ok: false,
          error: "status must be either 'draft' or 'sent'",
        },
        { status: 400 }
      );
    }

    const dbClient = await clientPromise;
    const db = dbClient.db(process.env.MONGODB_DB || "nudge");

    // Convert amount from dollars to cents
    const amountCents = Math.round(amount * 100);

    const now = new Date();
    const doc = {
      userId,
      clientId: new ObjectId(clientId),
      amountCents,
      dueDate: dueDate.trim(),
      status: normalizedStatus,
      notes: notes?.trim() || "",
      paymentLink: paymentLink.trim(),
      ccEmails: Array.isArray(ccEmails)
        ? ccEmails.filter((e) => e && e.trim()).map((e) => e.trim())
        : [],
      // Email configuration
      emailFlow: emailFlow || "custom",
      reminderSchedule: reminderSchedule || "standard",
      templates: templates || [],
      remindersSent: Array.isArray(body.remindersSent) ? body.remindersSent : [],
      createdAt: now,
      updatedAt: now,
    };

    // Add sentAt timestamp if status is "sent"
    if (normalizedStatus === "sent") {
      doc.sentAt = now;
    }

    const result = await db.collection("invoices").insertOne(doc);

    // If status is "sent", send the invoice email
    if (normalizedStatus === "sent") {
      try {
        // Fetch client data
        const clientDoc = await db.collection("clients").findOne({
          _id: new ObjectId(clientId),
          userId,
        });

        if (!clientDoc) {
          throw new Error("Client not found");
        }

        // Fetch workspace for sender name
        const workspace = await db.collection("workspaces").findOne({ userId });
        const yourName = workspace?.displayName || "Nudge";

        // Get initial template
        const initialTemplate = templates.find((t) => t.id === "initial");
        if (initialTemplate) {
          await sendInvoiceEmail({
            to: clientDoc.email,
            ccEmails: doc.ccEmails,
            subject: initialTemplate.subject,
            body: initialTemplate.body,
            client: {
              firstName: clientDoc.firstName,
              fullName: clientDoc.fullName,
            },
            amountCents: doc.amountCents,
            dueDate: doc.dueDate,
            paymentLink: doc.paymentLink,
            yourName,
          });
        }
      } catch (emailError) {
        console.error("Error sending invoice email:", emailError);
        // Don't fail the invoice creation if email fails
        // The invoice is already created at this point
      }
    }

    return Response.json(
      {
        ok: true,
        invoice: {
          ...doc,
          id: result.insertedId.toString(),
          _id: result.insertedId.toString(),
          clientId: doc.clientId.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/invoices error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
