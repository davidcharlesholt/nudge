import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";
import { getSafeErrorMessage } from "@/lib/utils";

export async function PATCH(_req, context) {
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

    const result = await db.collection("invoices").updateOne(
      { _id: new ObjectId(id), userId },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return Response.json(
        { ok: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/invoices/[id]/mark-paid error:", error);
    return Response.json({ ok: false, error: getSafeErrorMessage(error, "Failed to mark invoice as paid") }, { status: 500 });
  }
}

