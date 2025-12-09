import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

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
        { ok: false, error: "Invalid flow ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    // Delete the flow (only if it belongs to the user)
    const result = await db.collection("email_flows").deleteOne({
      _id: new ObjectId(id),
      userId,
    });

    if (result.deletedCount === 0) {
      return Response.json(
        { ok: false, error: "Flow not found or already deleted" },
        { status: 404 }
      );
    }

    // Note: We intentionally do NOT update invoices that reference this flow.
    // Invoices store their own copy of templates, so deleting a flow
    // only removes the saved preset - it doesn't affect existing invoices.

    return Response.json({ ok: true, message: "Flow deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/email-flows/[id] error");
    return Response.json({ ok: false, error: "An error occurred" }, { status: 500 });
  }
}



