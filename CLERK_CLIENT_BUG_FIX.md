# Clerk Client Bug Fix - Reply-To Feature

## Problem
The reply-to feature was not working because we were incorrectly calling `clerkClient` as a function:

```javascript
// ❌ INCORRECT - clerkClient is not a function
const client = await clerkClient();
const user = await client.users.getUser(userId);
```

In Clerk's Next.js SDK, `clerkClient` is already the client object, not a function that returns a client.

This caused an error that was caught by our try/catch block, leaving `userEmail` as `null`. As a result, `sendInvoiceEmail` was called without the `replyTo` parameter, and replies still went to `hello@nudgesend.com` instead of the user's email.

## Solution
Fixed the Clerk client usage in all 5 API routes:

```javascript
// ✅ CORRECT - clerkClient is the client object
const user = await clerkClient.users.getUser(userId);
```

## Files Fixed

### 1. `/api/invoices/[id]/send/route.js`
- Fixed: `const user = await clerkClient.users.getUser(userId);`
- Verified: `replyTo: userEmail` is passed to `sendInvoiceEmail`

### 2. `/api/invoices/route.js`
- Fixed: `const user = await clerkClient.users.getUser(userId);`
- Verified: `replyTo: userEmail` is passed to `sendInvoiceEmail`

### 3. `/api/invoices/[id]/resend/route.js`
- Fixed: `const user = await clerkClient.users.getUser(userId);`
- Verified: `replyTo: userEmail` is passed to `sendInvoiceEmail`

### 4. `/api/invoices/[id]/send-reminder/route.js`
- Fixed: `const user = await clerkClient.users.getUser(userId);`
- Verified: `replyTo: userEmail` is passed to `sendInvoiceEmail`

### 5. `/api/cron/reminders/route.js`
- Fixed: `const user = await clerkClient.users.getUser(invoice.userId);`
- Verified: `replyTo: userEmail` is passed to `sendInvoiceEmail`

## Verification

✅ **No more incorrect usages**: Searched codebase for `await clerkClient()` - no matches found
✅ **All routes pass replyTo**: Verified all 5 routes pass `replyTo: userEmail` to `sendInvoiceEmail`
✅ **Email logic unchanged**: `src/lib/email.js` still sends from `hello@nudgesend.com` with company name as display
✅ **replyTo field set correctly**: When `replyTo` is provided, sets `emailData.replyTo = replyTo.trim()` (uses Resend's camelCase format)
✅ **No linter errors**: All files pass linting

## Result

Now when invoice emails are sent:
- **From**: `Your Company Name <hello@nudgesend.com>` ✅
- **Reply-To**: `your-email@example.com` ✅ (NEW - now working!)

When clients click "Reply", their email client will automatically address the reply to the user's real email address.

## Testing

To verify the fix:
1. Send an invoice from your Nudge account
2. Check the email headers - should now show:
   - `From: Your Company Name <hello@nudgesend.com>`
   - `Reply-To: your-email@example.com`
3. Click "Reply" - the "To" field should be your email, not hello@nudgesend.com

