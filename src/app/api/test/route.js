import clientPromise from "@/lib/db";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "nudge");

    // Optional: try touching a collection just to be sure
    await db.command({ ping: 1 });

    return Response.json({ ok: true, message: "Connected to MongoDB" });
  } catch (error) {
    console.error("DB connection error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
