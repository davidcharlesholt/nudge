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
      emailFlow,
      reminderSchedule,
      templates,
    } = body;

    // Validate required fields
    if (!clientId || !amount || !dueDate || !status || !paymentLink) {
      return Response.json(
        {
          ok: false,
          error: "clientId, amount, dueDate, status, and paymentLink are required.",
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

    // Validate status enum
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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    // Convert amount from dollars to cents
    const amountCents = Math.round(amount * 100);

    const updateDoc = {
      clientId: new ObjectId(clientId),
      amountCents,
      dueDate: dueDate.trim(),
      status: status.trim(),
      notes: notes?.trim() || "",
      paymentLink: paymentLink.trim(),
      // Email configuration
      emailFlow: emailFlow || "custom",
      reminderSchedule: reminderSchedule || "standard",
      templates: templates || [],
      updatedAt: new Date(),
    };

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
