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
    const flows = await db
      .collection("email_flows")
      .find({ userId })
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
    console.error("GET /api/email-flows error");
    return Response.json({ ok: false, error: "An error occurred" }, { status: 500 });
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
      userId,
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
    console.error("POST /api/email-flows error");
    return Response.json({ ok: false, error: "An error occurred" }, { status: 500 });
  }
}

