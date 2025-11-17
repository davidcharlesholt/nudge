import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

const DEMO_USER_ID = "demo-user";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");
    const flows = await db
      .collection("email_flows")
      .find({ userId: DEMO_USER_ID })
      .sort({ createdAt: -1 })
      .toArray();

    // Convert _id to string
    const flowsWithStringIds = flows.map((flow) => ({
      ...flow,
      id: flow._id.toString(),
      _id: flow._id.toString(),
    }));

    return Response.json({ ok: true, flows: flowsWithStringIds });
  } catch (error) {
    console.error("GET /api/email-flows error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, schedule, templates } = body;

    // Validate required fields
    if (!name || !schedule || !templates) {
      return Response.json(
        {
          ok: false,
          error: "name, schedule, and templates are required.",
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const now = new Date();
    const doc = {
      userId: DEMO_USER_ID,
      name: name.trim(),
      schedule,
      templates,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("email_flows").insertOne(doc);

    return Response.json(
      {
        ok: true,
        flow: {
          ...doc,
          id: result.insertedId.toString(),
          _id: result.insertedId.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/email-flows error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

