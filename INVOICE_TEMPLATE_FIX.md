# Invoice Template Fix

## Problem
Users were getting a 400 error with "Invoice template not found" when trying to send invoices. This occurred because:
1. Draft invoices could be created without email templates
2. When trying to send these drafts later, the system expected templates to exist but they didn't

## Solution

### 1. Updated Send Invoice Endpoint (`/api/invoices/[id]/send`)
The endpoint now automatically creates default email templates if they're missing:
- Uses the workspace's `defaultEmailTone` (or "friendly" as fallback)
- Uses the invoice's `reminderSchedule` (or "standard" as fallback)
- Creates a complete set of templates using `initializeTemplatesForSchedule()`
- Saves the templates to the invoice for future use
- Logs the operation for debugging

**File Changed:** `src/app/api/invoices/[id]/send/route.js`

### 2. Created Backfill Script
A script to fix existing invoices that are missing templates.

**File Created:** `scripts/backfill-invoice-templates.mjs`

#### How to Run the Backfill Script

**Dry Run (recommended first):**
```bash
node scripts/backfill-invoice-templates.mjs --dry-run
```

**Actual Update:**
```bash
node scripts/backfill-invoice-templates.mjs
```

The script will:
- Find all invoices without templates
- Create default templates based on each invoice's settings and user's workspace preferences
- Update the invoices in the database
- Provide a summary of operations

## Testing Instructions

### 1. Test New Invoice Flow
1. Start the dev server: `npm run dev`
2. Log out and create a brand new workspace through onboarding
3. Create a new client
4. Create a new invoice (save as draft)
5. Go to the invoice and click "Preview & Send"
6. Click "Send Invoice"
7. **Expected:** Email sends successfully without "Invoice template not found" error

### 2. Test Existing Draft Invoice
1. Find an existing draft invoice (or create one and save as draft without filling all fields)
2. Fill in all required fields (amount, due date, payment link)
3. Click "Preview & Send" → "Send Invoice"
4. **Expected:** Email sends successfully, templates are auto-created

### 3. Verify in Production
After deploying:
1. Run the backfill script to fix existing invoices:
   ```bash
   node scripts/backfill-invoice-templates.mjs
   ```
2. Test sending a previously-failing invoice
3. Check server logs for template creation messages

## What Happens Now

### For New Invoices
When creating invoices in the UI, templates are initialized on the frontend based on workspace settings. This continues to work as before.

### For Draft Invoices Without Templates
When someone tries to send a draft invoice that doesn't have templates:
1. The send endpoint detects missing templates
2. Automatically creates default templates using workspace settings
3. Saves templates to the invoice
4. Proceeds with sending the email
5. Logs the operation (shows in production logs)

### Error Handling
If templates still can't be created (should never happen):
- Returns a clear error message to the user
- Logs detailed debugging information
- Suggests editing and saving the invoice as a workaround

## Files Modified
1. `src/app/invoices/page.jsx` - Fixed CardContent import
2. `src/app/api/invoices/[id]/send/route.js` - Auto-create templates logic
3. `scripts/backfill-invoice-templates.mjs` - New backfill script (ES module)

## Deployment Checklist
- [ ] Test locally with the flow above
- [ ] Deploy to production
- [ ] Run backfill script in production
- [ ] Monitor logs for any "missing templates" messages
- [ ] Verify no more "Invoice template not found" errors

