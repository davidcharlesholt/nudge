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
    const db = client.db(process.env.MONGODB_DB || "nudge");

    // Optional: try touching a collection just to be sure
    await db.command({ ping: 1 });

    return Response.json({ ok: true, message: "Connected to MongoDB" });
  } catch (error) {
    console.error("DB connection error");
    // Don't expose internal error details
    return Response.json({ ok: false, error: "Database connection failed" }, { status: 500 });
  }
}
