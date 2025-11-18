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
        { ok: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const clientDoc = await db.collection("clients").findOne({
      _id: new ObjectId(id),
      userId,
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
        { ok: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { firstName, lastName, email, companyName, additionalEmails } = body;

    // Validate required fields
    if (!firstName || !email) {
      return Response.json(
        { ok: false, error: "First name and email are required." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName?.trim() || "";
    const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim();

    const updateDoc = {
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      fullName,
      email: email.trim(),
      companyName: companyName?.trim() || "",
      additionalEmails: Array.isArray(additionalEmails) 
        ? additionalEmails.filter(e => e && e.trim()).map(e => e.trim())
        : [],
      updatedAt: new Date(),
    };

    const result = await db.collection("clients").updateOne(
      { _id: new ObjectId(id), userId },
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
        { ok: false, error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const result = await db.collection("clients").deleteOne({
      _id: new ObjectId(id),
      userId,
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
