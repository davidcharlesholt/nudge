import clientPromise from "@/lib/db";
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
    const db = client.db("nudge");
    const clients = await db
      .collection("clients")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Convert _id to string and add id field for frontend
    const clientsWithStringId = clients.map((c) => ({
      ...c,
      id: c._id.toString(),
      _id: c._id.toString(),
    }));

    return Response.json({ ok: true, clients: clientsWithStringId });
  } catch (error) {
    console.error("GET /api/clients error:", error);
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
    const { name, email, companyName } = body;

    // Validate required fields
    if (!name || !email) {
      return Response.json(
        { ok: false, error: "Name and email are required." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("nudge");

    const now = new Date();
    const doc = {
      userId,
      name: name.trim(),
      email: email.trim(),
      companyName: companyName?.trim() || "",
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("clients").insertOne(doc);

    return Response.json(
      {
        ok: true,
        client: { 
          ...doc, 
          id: result.insertedId.toString(),
          _id: result.insertedId.toString() 
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

