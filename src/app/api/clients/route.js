import clientPromise from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { isValidEmail, getSafeErrorMessage } from "@/lib/utils";

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
    console.error("GET /api/clients error");
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to fetch clients") }, { status: 500 });
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
    const { firstName, lastName, email, companyName, additionalEmails } = body;

    // Validate required fields
    if (!firstName || !email) {
      return Response.json(
        { ok: false, error: "First name and email are required." },
        { status: 400 }
      );
    }

    // Validate email format
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      return Response.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Validate additional emails if provided
    const validAdditionalEmails = [];
    if (Array.isArray(additionalEmails)) {
      for (const additionalEmail of additionalEmails) {
        if (additionalEmail && additionalEmail.trim()) {
          const trimmed = additionalEmail.trim();
          if (!isValidEmail(trimmed)) {
            return Response.json(
              { ok: false, error: `Invalid additional email address: ${trimmed}` },
              { status: 400 }
            );
          }
          validAdditionalEmails.push(trimmed);
        }
      }
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName?.trim() || "";
    const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim();

    const now = new Date();
    const doc = {
      userId,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      fullName,
      email: trimmedEmail,
      companyName: companyName?.trim() || "",
      additionalEmails: validAdditionalEmails,
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
    console.error("POST /api/clients error");
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to create client") }, { status: 500 });
  }
}

