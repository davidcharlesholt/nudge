import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

export async function GET(_req, context) {
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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const invoiceDoc = await db.collection("invoices").findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!invoiceDoc) {
      return Response.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      invoice: {
        ...invoiceDoc,
        id: invoiceDoc._id.toString(),
        _id: invoiceDoc._id.toString(),
        clientId: invoiceDoc.clientId.toString(),
        remindersSent: Array.isArray(invoiceDoc.remindersSent) ? invoiceDoc.remindersSent : [],
      },
    });
  } catch (error) {
    console.error("GET /api/invoices/[id] error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req, context) {
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

    // Validate status enum first
    if (!status) {
      return Response.json(
        {
          ok: false,
          error: "status is required",
        },
        { status: 400 }
      );
    }

    const validStatuses = ["draft", "sent", "paid", "overdue"];
    if (!validStatuses.includes(status)) {
      return Response.json(
        {
          ok: false,
          error: `status must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate required fields based on status
    // Drafts only require clientId
    // Other statuses require full validation
    if (!clientId) {
      return Response.json(
        {
          ok: false,
          error: "clientId is required",
        },
        { status: 400 }
      );
    }

    if (status !== "draft") {
      // Strict validation for sent/paid/overdue invoices
      if (!amount || !dueDate || !paymentLink) {
        return Response.json(
          {
            ok: false,
            error: "amount, dueDate, and paymentLink are required for non-draft invoices",
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
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    // Check if invoice exists and get current status
    const existingInvoice = await db.collection("invoices").findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!existingInvoice) {
      return Response.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Block updates to locked fields if invoice is already sent
    if (existingInvoice.status === "sent") {
      const lockedFields = [];
      
      if (clientId && clientId !== existingInvoice.clientId.toString()) {
        lockedFields.push("client");
      }
      if (amount !== undefined && Math.round(parseFloat(amount) * 100) !== existingInvoice.amountCents) {
        lockedFields.push("amount");
      }
      if (dueDate && dueDate.trim() !== existingInvoice.dueDate) {
        lockedFields.push("dueDate");
      }
      if (paymentLink && paymentLink.trim() !== existingInvoice.paymentLink) {
        lockedFields.push("paymentLink");
      }

      if (lockedFields.length > 0) {
        return Response.json(
          {
            ok: false,
            error: `Cannot update ${lockedFields.join(", ")} on a sent invoice. These fields are locked once an invoice is sent.`,
          },
          { status: 400 }
        );
      }
    }

    // Build update document with required fields
    const updateDoc = {
      clientId: new ObjectId(clientId),
      status: status.trim(),
      notes: notes?.trim() || "",
      updatedAt: new Date(),
    };

    // Add optional fields if provided
    if (amount !== undefined && amount !== null && amount !== "") {
      updateDoc.amountCents = Math.round(parseFloat(amount) * 100);
    }

    if (dueDate) {
      updateDoc.dueDate = dueDate.trim();
    }

    if (paymentLink) {
      updateDoc.paymentLink = paymentLink.trim();
    }

    if (ccEmails !== undefined) {
      updateDoc.ccEmails = Array.isArray(ccEmails) 
        ? ccEmails.filter(e => e && e.trim()).map(e => e.trim())
        : [];
    }

    // Email configuration
    if (emailFlow) updateDoc.emailFlow = emailFlow;
    if (reminderSchedule) updateDoc.reminderSchedule = reminderSchedule;
    if (templates) updateDoc.templates = templates;

    const result = await db.collection("invoices").updateOne(
      { _id: new ObjectId(id), userId },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return Response.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      invoice: {
        ...updateDoc,
        id,
        _id: id,
        clientId: updateDoc.clientId.toString(),
      },
    });
  } catch (error) {
    console.error("PUT /api/invoices/[id] error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req, context) {
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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const result = await db.collection("invoices").deleteOne({
      _id: new ObjectId(id),
      userId,
    });

    if (result.deletedCount === 0) {
      return Response.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/invoices/[id] error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
