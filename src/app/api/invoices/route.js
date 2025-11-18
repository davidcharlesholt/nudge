import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");
    const invoices = await db
      .collection("invoices")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Convert _id and clientId to strings and add id field for frontend
    const invoicesWithStringIds = invoices.map((inv) => ({
      ...inv,
      id: inv._id.toString(),
      _id: inv._id.toString(),
      clientId: inv.clientId.toString(),
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

    const now = new Date();
    const doc = {
      userId,
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
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("invoices").insertOne(doc);

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
