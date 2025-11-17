import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";

const DEMO_USER_ID = "demo-user";

export async function GET(_req, context) {
  try {
    // Await params in case it's a Promise (Next.js 14/15 compatibility)
    const params = await Promise.resolve(context.params);
    const { id } = params;

    // Validate ObjectId
    if (!id || !ObjectId.isValid(id)) {
      return Response.json(
        { ok: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const clientDoc = await db.collection("clients").findOne({
      _id: new ObjectId(id),
      userId: DEMO_USER_ID,
    });

    if (!clientDoc) {
      return Response.json(
        { ok: false, error: "Client not found" },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      client: {
        ...clientDoc,
        id: clientDoc._id.toString(),
        _id: clientDoc._id.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/clients/[id] error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req, context) {
  try {
    // Await params in case it's a Promise (Next.js 14/15 compatibility)
    const params = await Promise.resolve(context.params);
    const { id } = params;

    // Validate ObjectId
    if (!id || !ObjectId.isValid(id)) {
      return Response.json(
        { ok: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, email, companyName } = body;

    // Validate required fields
    if (!name || !email) {
      return Response.json(
        { ok: false, error: "Name and email are required." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const updateDoc = {
      name: name.trim(),
      email: email.trim(),
      companyName: companyName?.trim() || "",
      updatedAt: new Date(),
    };

    const result = await db.collection("clients").updateOne(
      { _id: new ObjectId(id), userId: DEMO_USER_ID },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return Response.json(
        { ok: false, error: "Client not found" },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      client: {
        ...updateDoc,
        id,
        _id: id,
      },
    });
  } catch (error) {
    console.error("PUT /api/clients/[id] error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req, context) {
  try {
    // Await params in case it's a Promise (Next.js 14/15 compatibility)
    const params = await Promise.resolve(context.params);
    const { id } = params;

    // Validate ObjectId
    if (!id || !ObjectId.isValid(id)) {
      return Response.json(
        { ok: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const result = await db.collection("clients").deleteOne({
      _id: new ObjectId(id),
      userId: DEMO_USER_ID,
    });

    if (result.deletedCount === 0) {
      return Response.json(
        { ok: false, error: "Client not found" },
        { status: 404 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/clients/[id] error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
