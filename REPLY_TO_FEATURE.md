# Reply-To Email Feature

## Overview

Updated the invoice email system so that all emails are sent FROM `hello@nudgesend.com` (with the user's company name as the display name), but set the REPLY-TO header to the user's actual email address. This allows clients to reply directly to the user.

## What Changed

### 1. Updated Email Library (`src/lib/email.js`)

- Added `replyTo` parameter to `sendInvoiceEmail` function
- Added logic to set the `replyTo` field in the Resend email data when `replyTo` is provided
- Uses Resend's `replyTo` field (camelCase format as required by Resend API)

### 2. Updated All Invoice Sending Endpoints

#### a. Send Invoice (`src/app/api/invoices/[id]/send/route.js`)

- Added `clerkClient` import
- Fetches user's primary email address from Clerk
- Passes `replyTo: userEmail` to `sendInvoiceEmail`

#### b. Create Invoice (`src/app/api/invoices/route.js`)

- Added `clerkClient` import
- When creating an invoice with status "sent", fetches user's email
- Passes `replyTo: userEmail` to `sendInvoiceEmail`

#### c. Resend Invoice (`src/app/api/invoices/[id]/resend/route.js`)

- Added `clerkClient` import
- Fetches user's primary email address from Clerk
- Passes `replyTo: userEmail` to `sendInvoiceEmail`

#### d. Send Reminder (`src/app/api/invoices/[id]/send-reminder/route.js`)

- Added `clerkClient` import
- Fetches user's primary email address from Clerk
- Passes `replyTo: userEmail` to `sendInvoiceEmail`

#### e. Cron Reminders (`src/app/api/cron/reminders/route.js`)

- Added `clerkClient` import
- For each invoice processed, fetches the user's email from Clerk
- Passes `replyTo: userEmail` to `sendInvoiceEmail`

## How It Works

1. **Email Sent From**: `hello@nudgesend.com` (with company name as display)

   - Example: `Acme Corp <hello@nudgesend.com>`

2. **Reply-To Header**: User's actual email from Clerk

   - Example: `john@acmecorp.com`

3. **Client Experience**:
   - Receives email that appears to be from "Acme Corp"
   - When they hit "Reply", their email client automatically addresses the reply to `john@acmecorp.com`
   - The user receives the reply directly in their inbox

## Error Handling

- If fetching the user's email from Clerk fails, the system logs a warning but continues
- The email will still be sent, just without the reply-to header
- This ensures the core functionality isn't broken if Clerk has issues

## Code Pattern Used

In each endpoint that sends emails:

```javascript
// Get user's email from Clerk for reply-to
let userEmail = null;
try {
  const user = await clerkClient.users.getUser(userId);
  userEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId
  )?.emailAddress;
} catch (clerkError) {
  console.warn(
    `Could not fetch user email from Clerk for userId ${userId}:`,
    clerkError.message
  );
  // Continue without reply-to - not a critical failure
}

// Later in sendInvoiceEmail call:
await sendInvoiceEmail({
  // ... other parameters
  replyTo: userEmail,
});
```

## Testing

To test the reply-to feature:

1. **Send a test invoice** from your Nudge account
2. **Check the email headers** in the received email - should show:
   - `From: Your Company Name <hello@nudgesend.com>`
   - `Reply-To: your-email@example.com`
3. **Click Reply** in the email client
4. **Verify** that the "To" field is automatically populated with your email, not hello@nudgesend.com

## Benefits

- **Professional appearance**: Emails come from the Nudge domain
- **Direct communication**: Clients can reply directly to you
- **No email routing needed**: Replies go straight to your inbox
- **Better deliverability**: Sending from a verified domain (nudgesend.com)
- **User convenience**: No need to configure email servers or domain verification

## Files Modified

1. `src/lib/email.js` - Added replyTo parameter and logic
2. `src/app/api/invoices/[id]/send/route.js` - Added Clerk email fetching
3. `src/app/api/invoices/route.js` - Added Clerk email fetching
4. `src/app/api/invoices/[id]/resend/route.js` - Added Clerk email fetching
5. `src/app/api/invoices/[id]/send-reminder/route.js` - Added Clerk email fetching
6. `src/app/api/cron/reminders/route.js` - Added Clerk email fetching

## No Breaking Changes

- The `replyTo` parameter is optional
- Existing functionality continues to work without it
- If user email can't be fetched, emails still send successfully
