/**
 * Email templates for Nudge invoices
 *
 * Structure: EMAIL_TEMPLATES[tone][templateKey] = { subject, body }
 *
 * Supported placeholders:
 * - {{clientName}} - Client's full name (first + last)
 * - {{clientFirstName}} - Client's first name only
 * - {{amount}}
 * - {{dueDate}}
 * - {{yourName}}
 * - {{invoiceNumber}}
 * - {{paymentLink}}
 * - {{dayOfWeek}}
 */

export const EMAIL_TEMPLATES = {
  friendly: {
    initial: {
      subject: "Your invoice is ready!",
      body: `Hi {{clientFirstName}},

Hope you're doing well!

Just a quick note to let you know your invoice for {{amount}} is ready.

You can take care of it here whenever you have a minute:

👉 {{paymentLink}}

Payment is due by {{dueDate}}, but if you need anything at all, I'm always happy to help.

Thanks again for trusting me with your project!

— {{yourName}}`,
    },
    reminder1: {
      subject: "Quick heads-up before your invoice is due",
      body: `Hi {{clientFirstName}},

Hope your week's going well!

Just popping in with a friendly reminder that your invoice for {{amount}} is due on {{dueDate}}. If you want to get it out of the way early, here's the link:

👉 {{paymentLink}}

Let me know if anything looks off or if you need any changes — happy to help!

Warmly,
{{yourName}}`,
    },
    reminder2: {
      subject: "Just a little reminder 😊",
      body: `Hi {{clientFirstName}},

I hope things are going smoothly on your end!

This is just a quick reminder that the invoice for {{amount}} is due in a few days ({{dueDate}}). You can take care of it here:

👉 {{paymentLink}}

If you've already handled it — thank you! And if not, no rush, just wanted to make sure it didn't fall through the cracks.

Thanks!
{{yourName}}`,
    },
    reminder3: {
      subject: "Your invoice is due today",
      body: `Hi {{clientFirstName}},

Happy {{dayOfWeek}}!

A quick reminder that your invoice for {{amount}} is due today. Here's the payment link when you're ready:

👉 {{paymentLink}}

If you've already taken care of it — thank you so much. Really appreciate you!

All the best,
{{yourName}}`,
    },
    reminder4: {
      subject: "Friendly follow-up on your overdue invoice",
      body: `Hi {{clientFirstName}},

Hope you're doing well!

I wanted to check in because it looks like the invoice for {{amount}} (due {{dueDate}}) still shows as unpaid on my side. No worries at all — these things slip by all the time.

Here's the link if you'd like to take care of it now:

👉 {{paymentLink}}

If you already sent payment or if there's anything you need from me, just let me know. I'm here to help!

Thanks so much,
{{yourName}}`,
    },
  },
  professional: {
    initial: {
      subject: "Invoice for {{amount}}",
      body: `Hi {{clientFirstName}},

I hope you're doing well. I'm sharing your invoice for {{amount}}, available here whenever you're ready:

👉 {{paymentLink}}

Payment is due by {{dueDate}}.

If you'd like me to walk through any part of the work or billing details, I'm happy to help.

Thank you,
{{yourName}}`,
    },
    reminder1: {
      subject: "Upcoming invoice due date",
      body: `Hi {{clientFirstName}},

I hope your week is going well. This is a courtesy reminder that your invoice for {{amount}} is due on {{dueDate}}.

Here's the link for convenience:

👉 {{paymentLink}}

If anything needs clarification, please feel free to reach out.

Thank you,
{{yourName}}`,
    },
    reminder2: {
      subject: "Invoice due soon",
      body: `Hi {{clientFirstName}},

Just a quick reminder that your invoice for {{amount}} is coming up on {{dueDate}}.

You can submit payment here:

👉 {{paymentLink}}

If you've already taken care of this, thank you — much appreciated.

Warm regards,
{{yourName}}`,
    },
    reminder3: {
      subject: "Invoice due today",
      body: `Hi {{clientFirstName}},

Your invoice for {{amount}} is due today.

When you're ready, you can submit payment here:

👉 {{paymentLink}}

If payment has already been sent, please disregard this message.

Thank you,
{{yourName}}`,
    },
    reminder4: {
      subject: "Follow-up on outstanding invoice",
      body: `Hi {{clientFirstName}},

I hope you're doing well. I'm following up regarding the invoice for {{amount}}, which was due on {{dueDate}} and appears to still be outstanding.

You can complete payment here:

👉 {{paymentLink}}

If payment has already been submitted, thank you — no further action needed.

Best regards,
{{yourName}}`,
    },
  },
  firm: {
    initial: {
      subject: "Invoice for {{amount}}",
      body: `Hi {{clientFirstName}},

I'm sending over your invoice for {{amount}}. You can review and submit payment at the link below:

👉 {{paymentLink}}

Payment is due by {{dueDate}}.

If anything needs clarification or adjustment, I'm available to help.

Thank you,
{{yourName}}`,
    },
    reminder1: {
      subject: "Reminder — upcoming invoice due",
      body: `Hi {{clientFirstName}},

This is a quick reminder that the invoice for {{amount}} is due on {{dueDate}}.

You can access and complete payment here:

👉 {{paymentLink}}

Please feel free to reach out if you have any questions.

Best regards,
{{yourName}}`,
    },
    reminder2: {
      subject: "Reminder — invoice due soon",
      body: `Hi {{clientFirstName}},

I'm touching base regarding your invoice for {{amount}}, which is due in a few days on ({{dueDate}}).

Here is the link to submit payment:

👉 {{paymentLink}}

If you've already submitted payment, thank you.

Warm regards,
{{yourName}}`,
    },
    reminder3: {
      subject: "Invoice due today",
      body: `Hi {{clientFirstName}},

Your invoice for {{amount}} is due today.

Here is the payment link when you're ready:

👉 {{paymentLink}}

Thank you for handling this promptly.

{{yourName}}`,
    },
    reminder4: {
      subject: "Follow-up on overdue invoice",
      body: `Hi {{clientFirstName}},

I'm following up regarding the invoice for {{amount}}, which was due on {{dueDate}} and currently appears overdue.

You can complete payment at the link below:

👉 {{paymentLink}}

If payment has already been submitted, thank you — no further action is needed.

Best regards,
{{yourName}}`,
    },
  },
};

/**
 * Get template defaults for a specific tone and template key
 * @param {string} templateKey - The template key (initial, reminder1, etc.)
 * @param {string} tone - The tone (friendly, professional, firm)
 * @returns {{subject: string, body: string}} The template subject and body
 */
export function getTemplateDefaults(templateKey, tone = "professional") {
  const toneTemplates = EMAIL_TEMPLATES[tone];
  if (!toneTemplates) {
    console.warn(`Unknown tone: ${tone}, falling back to professional`);
    return (
      EMAIL_TEMPLATES.professional[templateKey] || { subject: "", body: "" }
    );
  }

  const template = toneTemplates[templateKey];
  if (!template) {
    console.warn(`Unknown template key: ${templateKey} for tone: ${tone}`);
    return { subject: "", body: "" };
  }

  return {
    subject: template.subject,
    body: template.body,
  };
}
