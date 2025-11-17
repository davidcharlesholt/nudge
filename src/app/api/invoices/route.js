import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

const DEMO_USER_ID = "demo-user";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");
    const invoices = await db
      .collection("invoices")
      .find({ userId: DEMO_USER_ID })
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
    const body = await req.json();
    const {
      clientId,
      amount,
      currency,
      dueDate,
      status,
      notes,
      emailFlow,
      reminderSchedule,
      templates,
    } = body;

    // Validate required fields
    if (!clientId || !amount || !currency || !dueDate || !status) {
      return Response.json(
        {
          ok: false,
          error:
            "clientId, amount, currency, dueDate, and status are required.",
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
      userId: DEMO_USER_ID,
      clientId: new ObjectId(clientId),
      amountCents,
      currency: currency.trim(),
      dueDate: dueDate.trim(),
      status: status.trim(),
      notes: notes?.trim() || "",
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
