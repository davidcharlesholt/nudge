import { NextResponse } from "next/server";
import { sendInvoiceEmail } from "@/lib/email";

export async function GET() {
  try {
    // Adjust this to any email you control
    const to = "davidcharlesholt@gmail.com";

    const res = await sendInvoiceEmail({
      to,
      ccEmails: [],
      subject: "Nudge + Resend debug test",
      body: "If you see this, RESEND_FROM_ADDRESS is working with hello@send.nudgesend.com.",
      client: { firstName: "David", fullName: "David Holt" },
      amountCents: 2500,
      dueDate: "2025-12-18",
      paymentLink: "https://example.com",
      yourName: "Nudge",
    });

    console.log("resend-debug success:", res);
    return NextResponse.json({ ok: true, res });
  } catch (err) {
    console.error("resend-debug error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
