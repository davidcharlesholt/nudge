# Resend Reply-To Field Name Fix

## Problem
The reply-to feature was still not working even after fixing the Clerk client bug. The issue was that we were using the wrong field name for Resend's API.

### What Was Wrong
In `src/lib/email.js`, we were using:
```javascript
// ❌ INCORRECT - Resend expects camelCase
emailData.reply_to = [replyTo.trim()];
```

But Resend's API requires the field name to be in **camelCase**, not snake_case.

## Solution
Changed to use Resend's correct field name format:

```javascript
// ✅ CORRECT - Resend expects camelCase 'replyTo'
emailData.replyTo = replyTo.trim();
```

### Changes Made

**File: `src/lib/email.js`**

Changed from:
```javascript
if (replyTo && replyTo.trim()) {
  emailData.reply_to = [replyTo.trim()];
}
```

To:
```javascript
if (replyTo && replyTo.trim()) {
  emailData.replyTo = replyTo.trim();
}
```

**Note:** Also simplified from an array to a string since we only have one reply-to address.

## How It Works Now

When an invoice email is sent with the `replyTo` parameter:

1. The email is sent **FROM**: `Your Company Name <hello@nudgesend.com>`
2. The **Reply-To** header is set to: `your-email@example.com`
3. When the recipient clicks "Reply", their email client automatically addresses the reply to your email

## Email Flow

```javascript
// In API routes (already working):
const user = await clerkClient.users.getUser(userId);
const userEmail = user.emailAddresses.find(
  (email) => email.id === user.primaryEmailAddressId
)?.emailAddress;

await sendInvoiceEmail({
  // ... other params
  replyTo: userEmail,  // ← Passed from routes
});

// In src/lib/email.js (NOW FIXED):
const emailData = {
  from: `${companyName} <${process.env.RESEND_FROM_EMAIL}>`,
  to: [clientEmail],
  subject: "...",
  html: "...",
  replyTo: replyTo.trim(),  // ← Now uses correct field name
};

await resend.emails.send(emailData);
```

## Testing

To verify the fix:

1. **Send an invoice** from your Nudge account
2. **Check the received email** in Gmail or another client
3. **Click "Reply"**
4. **Verify** the "To" field shows your Clerk email, not hello@nudgesend.com

You can also inspect the email headers - should show:
```
From: Your Company Name <hello@nudgesend.com>
Reply-To: your-email@example.com
```

## Result

✅ **Emails sent from**: hello@nudgesend.com with company name  
✅ **Replies go to**: User's actual email from Clerk  
✅ **No changes needed** to any API routes (they already pass `replyTo`)  
✅ **No linter errors**

## Files Modified

- `src/lib/email.js` - Fixed field name from `reply_to` to `replyTo`
- `REPLY_TO_FEATURE.md` - Updated documentation
- `CLERK_CLIENT_BUG_FIX.md` - Updated documentation

## Reference

Resend API documentation confirms the field name should be `replyTo` (camelCase):
https://resend.com/docs/api-reference/emails/send-email

