# Nudge – Project Instructions for AI

## 1. High-level product

Nudge is a **micro-SaaS for freelancers** (designers, copywriters, etc.) to:

- Store their **clients**
- Create **invoices** for those clients
- Eventually send **friendly automated reminders** (“nudges”) when invoices are overdue

For now, the focus is on **Clients + Invoices CRUD** with a nice, simple UI.  
No real auth yet – we are building everything around a single demo user.

---

## 2. Tech stack & conventions

- **Framework:** Next.js 14 with **App Router**
- **Src dir:** `src/` is enabled. All app code must live under `src/`.
- **Runtime:** Node / React server components (use `"use client";` only when needed)
- **Database:** MongoDB Atlas
- **DB connection helper:** `src/lib/db.js` exports a default `clientPromise` for the MongoDB Node driver.
- **Environment variables:**
  - `MONGODB_URI` – full Atlas connection string
  - `MONGODB_DB` – db name, currently `"nudge"`

Do **not** hard-code secrets or connection strings in source files.

---

## 3. Current structure (important)

Key files:

- `src/lib/db.js`

  - Creates `MongoClient` using `process.env.MONGODB_URI`
  - Exports `clientPromise`
  - **Do not delete or radically change this file.** You may import and use it.

- `src/app/api/test/route.js`

  - Simple GET route to verify DB connection (returns `{ ok: true }`).
  - This is mainly for debugging; keep it working.

- `src/app/api/clients/route.js`

  - API for Clients:
    - `GET /api/clients` – returns `{ ok: true, clients: [...] }`
    - `POST /api/clients` – accepts `{ name, email, companyName }` and creates a client.

- `src/app/clients/page.jsx`
  - UI page for listing + creating clients (to be improved/extended by AI).

All routes & pages should live under `src/app`.  
All helpers / shared code under `src/lib` or `src/components`.

---

## 4. User / auth model (for now)

There is **no real authentication yet**.  
All data is scoped to a hard-coded demo user:

```js
const DEMO_USER_ID = "demo-user";

When creating or querying data in MongoDB, always filter by userId: DEMO_USER_ID so the data model is future-proof for multi-user support later.

Do not add full auth flows (NextAuth, etc.) unless explicitly requested.

⸻

5. Data model (initial)

You may assume these collections and shapes unless told otherwise.

Clients (clients collection)
{
  _id: ObjectId,
  userId: string,          // "demo-user" for now
  name: string,            // required
  email: string,           // required
  companyName?: string,    // optional
  createdAt: Date,
  updatedAt: Date
}

Invoices (invoices collection) – to be implemented
{
  _id: ObjectId,
  userId: string,          // "demo-user"
  clientId: ObjectId,      // references clients._id
  amountCents: number,     // integer
  currency: string,        // e.g. "USD"
  dueDate: string,         // ISO date string
  status: "draft" | "sent" | "paid" | "overdue",
  notes?: string,
  remindersSent?: string[], // Array of template IDs that have been sent (e.g. ["reminder-1", "reminder-2"])
  createdAt: Date,
  updatedAt: Date
}
When adding new fields, keep names simple and use existing patterns.

6. API design guidelines
	•	Use App Router route handlers in src/app/api/**/route.js.
	•	Export named functions: export async function GET() {}, POST(), etc.
No default exports from route files.
	•	Always:
	•	Wrap DB calls in try/catch
	•	Log server errors (console.error) and return { ok: false, error: message } with appropriate HTTP status.
	•	All queries must be scoped by userId: DEMO_USER_ID for now.

⸻

7. UI design guidelines
	•	Keep the UI simple, clean, and text-focused:
	•	Plain HTML + minimal utility classes (Tailwind-style class names are OK even if not yet wired; user is a designer and may adjust later).
	•	Prioritize clarity over fanciness.
	•	app/clients/page.jsx behavior:
	•	"use client";
	•	On mount, fetch("/api/clients"), show loading + error states.
	•	Display a list/table of clients.
	•	Provide a small form to create a client, then refresh the list.
	•	Future app/invoices/page.jsx behavior:
	•	List invoices with client names, amounts, status, and due date.
	•	Form to create a new invoice linked to an existing client.

When in doubt, prefer easily editable markup over tightly-abstracted components.

⸻

8. Things the AI should NOT do unless asked
	•	Do not:
	•	Add authentication providers or full auth flows.
	•	Change the database connection mechanism (src/lib/db.js).
	•	Hard-code MongoDB URIs or passwords.
	•	Introduce heavy UI libraries (MUI, Chakra, etc.) without user request.
	•	Perform destructive DB operations (dropping collections, renaming DBs).
	•	Be conservative with new dependencies. If a new package is truly helpful, explain why in comments.

⸻

9. Developer workflow expectations

When modifying or generating code, the AI should:
	1.	Keep import paths aligned with /src alias:
	•	@/lib/db
	•	@/app/...
	2.	Ensure new files compile under Next.js App Router.
	3.	Prefer incremental, well-scoped changes (e.g. “implement clients page UI”) over refactoring the whole project.
	4.	Add short comments in tricky logic, but avoid cluttering simple code.

⸻

10. Project roadmap (rough)
	1.	✅ MongoDB connection + test route
	2.	✅ Clients API + Clients page
	3.	⏭ Invoices API + Invoices page
	4.	⏭ Simple dashboard/home (/) summarizing:
	•	number of clients
	•	number & status of invoices
	5.	⏭ Reminder scheduling model & basic UI (no actual email sending yet)
	6.	⏭ Later: real user accounts & auth

Follow this order unless the user explicitly asks to work on a different feature.
```

🧩 Design System – Nudge (for all UI work)

Overall vibe
• Modern, minimal SaaS
• Clean, professional but friendly
• Light mode only for now
• Plenty of white space, not cramped
• Default rounded corners, soft shadows, smooth hover states

Core stack
• Next.js App Router
• Tailwind CSS
• ShadCN UI components in @/components/ui/\*

1. Colors
   Use logo colors as the brand base.

Brand / Primary
• primary = #042C4C (deep navy)
• primary-foreground = #FFFFFF

Accent gradient – for special bits (badges, highlights, not backgrounds everywhere)
• Gradient stops: #92278F → #82399A → #6F50A9 → #5570BD → #3499D6 → #27AAE1

Neutrals
Use soft grays for background and borders:
• Background: very light gray or white
• Border: light gray
• Text: dark gray, almost black

Rough mapping (you can base this off Tailwind neutrals):
• background = #F9FAFB
• foreground = #0F172A
• muted = #E5E7EB
• muted-foreground = #6B7280
• border = #E5E7EB
• input = #E5E7EB
• card = #FFFFFF
• card-foreground = #0F172A

Status colors
• success = #16A34A (green)
• warning = #EAB308 (yellow)
• destructive = #DC2626 (red)
• Use these for badges, status pills, and toasts.

2. Typography
   • Font: a clean sans, like Inter or system UI
   • Base size: text-sm for most body text
   • Page titles: text-2xl font-semibold
   • Section titles: text-lg font-semibold
   • Labels / meta: text-xs text-muted-foreground

Rules:
• Never cram text; use line-height that’s easy to read.
• Titles should have space around them (mb-4 / mb-6).

3. Layout & Spacing
   • Main layout max width: max-w-5xl or max-w-6xl, centered.
   • Page padding: px-4 lg:px-6 py-6 lg:py-8.
   • Use a simple vertical stack:
   • Page header (title + actions)
   • Summary cards (stats)
   • Main content (tables, forms, etc.)

Spacing scale:
• Small gaps: gap-2
• Normal gaps: gap-4
• Big section breaks: mt-8, mb-6

4. Components (ShadCN)
   Always use ShadCN primitives where possible:
   • Buttons → @/components/ui/button
   • Primary: for main actions
   • Outline / ghost: for secondary actions
   • Cards → @/components/ui/card
   • Use for dashboard stats, panels, form containers
   • Input / Textarea / Select / Label / Form
   • For all forms; no raw HTML inputs with random styles
   • Dropdown Menu
   • For the 3-dot row actions menus in tables
   • Table
   • For Clients and Invoices lists
   • Dialog (Modal)
   • For confirmations, editing in-place later
   • Toast
   • For success/error feedback after create/edit/delete

5. Tables (Clients & Invoices)
   • Use full-width tables inside a Card.
   • Row hover state: subtle background change.
   • Status should be shown as small badges (e.g., paid / sent / overdue).
   • Rightmost column: row actions menu with 3-dot trigger.

6. Dashboard
   • Top: page title “Dashboard” + very simple subtitle.
   • Below: three Card components for:
   • Total Clients
   • Total Invoices
   • Unpaid Invoices
   • Under that: sections like “Latest invoices”, each inside Cards.

7. Interactions & Feedback
   • Show toasts for:
   • Client created / updated / deleted
   • Invoice created / updated / deleted
   • Use a confirmation (dialog or at least confirm) before deleting.
   • Show loading states (spinners or skeletons) when fetching.

Important rule for Cursor:
• Always prefer ShadCN + Tailwind over inline styles.
• When adding new pages or features, follow this design system for colors, spacing, and component usage.
