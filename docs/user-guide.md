# Arkit Vedham India — User Guide

**Operator billing console for hourly tractor / field service billing**

Version: 1.0 · English

This guide walks through every day-to-day task in the app: customers, billing, live sessions, approvals, reports, settings, members, and backup.

---

## 1. Getting started

### What this app does

Arkit Vedham India helps your team:

- Register farmers (customers)
- Create hourly bills with ERT tracking
- Run live check-in / check-out sessions
- Record Unpaid, Partial, or Fully Paid amounts
- Approve invoices and download Tax Invoice PDFs
- Export GST sales reports and full data backups

Your **organization’s business name**, logo, GSTIN, and invoice settings come from **Settings** (Admin) and appear on invoices and reports.

### Sign in

1. Open the app in your browser.
2. Click **Sign in**.
3. Enter the email and password you were invited with (or use the sign-in method your Admin configured).
4. If you belong to more than one organization, choose the correct organization when prompted.

After sign-in:

- **Admin** and **Business Operations Lead** land on the **Dashboard**.
- **Supervisor** lands on **New Bill** (Billing).

### Navigation (sidebar)

| Menu item | Purpose |
|-----------|---------|
| Dashboard | Revenue overview and recent bills |
| New Bill | Create express bills and live check-ins |
| Bills List | Search bills, payments, approvals, invoices |
| Customers | Farmer database |
| Members | Invite and manage team (Admin) |
| Reports | Approved bills and GST export |
| Backup | Export / restore data (Admin) |
| Settings | Business profile and invoice setup (Admin) |

---

## 2. Customers

**Who can do this:** Admin, Business Operations Lead, Supervisor  
**Delete customer:** Admin only

### Add a customer

1. Open **Customers**.
2. Click **Add Customer** (or similar).
3. Fill in:
   - **Name** (required)
   - **Mobile** — must be **exactly 10 digits**
   - Location, state, pincode, notes (optional)
4. Save.

### Quick-add from Billing

While creating a bill:

1. Open **New Bill**.
2. Use **Add farmer** / quick-add if the person is not in the list.
3. Enter name and 10-digit mobile (and optional location).
4. You may use **GPS** to fill location when the browser allows it.
5. Save — the new farmer is selected for the bill.

### Edit or search customers

1. Open **Customers**.
2. Use search to find by name or mobile.
3. Open edit, update fields, and save.

### View bill history

1. Open a customer’s history / bills view from the Customers page.
2. Review past bills linked to that farmer.

### Delete a customer

1. Admin only: open the customer and choose delete.
2. Confirm. Prefer editing over deleting if bills still reference the farmer.

---

## 3. Express bill (create or edit)

**Who can create:** Admin, Business Operations Lead, Supervisor  
**Who can edit Approved bills:** Admin and Business Operations Lead only (Supervisors cannot)

### Create an express bill

1. Open **New Bill**.
2. Stay on the **Express Bill** tab.
3. **Select a farmer** from the search list (or quick-add).
4. Use **Change** if you need a different farmer — search opens again.
5. Enter **ERT Number** (Estimated Running Cost reference):
   - Required
   - Unique in your organization
   - Letters, digits, and dashes only (example: `ERT-2401`)
6. Set **start date**, **end date**, **start time**, and **end time**.
   - Hours are calculated from dates and times.
   - Same-day end time must not be before start time.
   - Overnight work: use a later **end date**.
7. Confirm **hours** and **hourly rate** (rate usually comes from Settings).
8. Add **extra charges** if needed (name + amount).
9. Enter **discount** if any.
10. Totals are saved in **whole rupees** (nearest rupee).
11. Choose **payment status**:
    - **Unpaid**
    - **Partial Paid** — enter amount paid; balance is calculated
    - **Fully Paid** — choose **Cash** or **Online**
12. Save / generate the bill.

### What happens after save

| Payment | Invoice number | Approval status |
|---------|----------------|-----------------|
| Unpaid or Partial | Not assigned yet | Usually **Pending Approval** |
| Fully Paid | Assigned (from Settings prefix + sequence) | **Approved** if Admin/Ops Lead created it; **Pending Approval** if Supervisor |

### Edit a bill

1. Open **Bills List**.
2. Find the bill → **Edit** (opens Billing with the bill loaded).
3. Update details and save.

**Supervisor rules:**

- You can edit **Pending Approval**, **Rejected**, and **In Progress** bills (typically your own).
- You **cannot** edit **Approved** bills.

**Admin / Business Operations Lead:** can edit Approved bills when correction is needed.

---

## 4. Live check-in and check-out

**Who can do this:** Admin, Business Operations Lead, Supervisor

Use this when work is starting now and you will finish the bill later.

### Check in (start a live session)

1. Open **New Bill**.
2. Select the farmer and enter a unique **ERT**.
3. Start a **check-in** / live session (creates a bill with status **In Progress**, usually Unpaid).
4. The session appears under **Active Check-Ins**.

### Find running sessions

- On **New Bill**, open the **Active Check-Ins** / sessions tab  
  (or open `/billing?tab=sessions`).
- From **Bills List**, use **Live Running** to jump to active sessions.

### Check out (complete the session)

1. Open the running session (Check out / Edit with checkout).
2. End date and current time are filled for you; adjust if needed.
3. Confirm hours, extras, discount, and payment.
4. Save to complete the bill (same payment rules as Express Bill).

Always check out unfinished sessions so hours and payment stay accurate.

---

## 5. Bills list and payments

**Who can view:** All roles (Supervisors mainly see bills they created)  
**Delete bill:** Admin only

### Browse and filter bills

1. Open **Bills List** (elevated roles may see **Bills & Approvals**).
2. Use filters:
   - Approval status (Pending, Approved, Rejected, In Progress, or All)
   - Payment status (Paid, Unpaid, Partial, or All)
   - Date range
   - Search by invoice number, ERT, or farmer name
3. Partial payments show as **Partial** with the amount paid.

### Activity log

1. Open the bill’s **history / activity** control.
2. Review who created, updated, approved, rejected, or changed payment.

### Update payment on an existing bill

1. Open the payment action on the bill.
2. Change status to Partial or Fully Paid.
3. For Fully Paid, select **Cash** or **Online**.
4. Save.

When a bill becomes **Fully Paid**, an **invoice number** is assigned if it did not have one.

### View or download Tax Invoice PDF

1. Open a **Fully Paid** bill that has an invoice number.
2. Use **View** / **Download PDF**.
3. The Tax Invoice uses your Settings (business name, address, GSTIN, logo, HSN, notes, footer).

---

## 6. Approvals

**Who can approve or reject:** Admin and Business Operations Lead only  
**Supervisors:** submit bills; they do not approve

### Rules

- Only bills that are **Fully Paid** and **Pending Approval** can be approved or rejected.
- Unpaid or Partial bills cannot be approved until payment is completed.

### Approve or reject one bill

1. Open **Bills List**.
2. Find a Fully Paid pending bill.
3. Click **Approve** (check) or **Reject** (X).
4. Status updates; the activity log records who did it.

### Bulk approve / reject

1. Select multiple eligible pending Fully Paid bills (where the UI allows).
2. Run bulk approve or reject.
3. Confirm the result toast / counts.

### After approval

- Approved bills appear in **Reports**.
- Supervisors can no longer edit those bills.
- Tax Invoice PDF remains available for Fully Paid invoices.

---

## 7. Reports

**Who can do this:** Admin and Business Operations Lead

### Open reports

1. Open **Reports**.
2. Set filters:
   - Date range
   - Payment status (optional)
   - Location (optional)
3. The list shows **Approved** bills that match your filters.

### Review stats

Use the summary cards (counts, revenue, hours) to review the selected period.

### Export GST sales Excel

1. Set the date range (and other filters as needed).
2. Click **Export** / GST Excel.
3. Open the downloaded `.xlsx` file for GST filing support (business name, GSTIN, invoice lines, tax-style columns).

### Invoices from reports

From a report row you can **view** or **download** the Tax Invoice PDF for Fully Paid invoices.

---

## 8. Dashboard

**Who can do this:** Admin and Business Operations Lead  
**Supervisors:** redirected to Billing

### What you see

1. Open **Dashboard** (home).
2. Review:
   - Farmer / bill counts
   - Revenue (including today where shown)
   - Charts and recent bills
3. Use recent bills as a shortcut into Bills or Billing when available.

---

## 9. Settings

**Who can do this:** Admin only

Settings control what appears on every Tax Invoice and GST export.

### Business profile

1. Open **Settings**.
2. Update:
   - Business name
   - Business address
   - Phone number
3. Save.

### Logo

1. Upload a logo (PNG/SVG as supported by the form).
2. Remove/replace when you need a new brand mark on invoices.

### Rates and tax

1. Set **hourly rate** (default used on new bills).
2. Set **currency symbol** (for example ₹).
3. Set **default tax** percentage used on invoice tax breakdown.
4. Optionally set **HSN / SAC** code for line items.

### GST and invoice numbering

1. Enter **GSTIN** if registered.
2. Set **invoice prefix** (example: `INV-`).
3. Set **next invoice number** and **digit width** (padded sequence).
4. Preview how the next invoice will look (prefix + padded number).

Invoice numbers are assigned when a bill becomes **Fully Paid** and are not regenerated later.

### Notes and footer

1. Enter **invoice notes** and **footer text**.
2. Save — they print on the Tax Invoice.

---

## 10. Members

**Who can do this:** Admin only

### View and sync

1. Open **Members**.
2. Review the team list (name, email, role).
3. Use **Sync** if Clerk membership and the app list look out of date.

### Invite a member

1. Click add / invite.
2. Enter their email.
3. Choose a role:
   - **Admin** — full access including Settings, Members, Backup, deletes
   - **Business Operations Lead** — dashboard, reports, approvals; no Settings/Members/Backup/deletes
   - **Supervisor** — billing, bills list, customers; no approvals/reports/settings
4. Send the invite and ask them to sign in and join the organization.

### Change role or remove

1. Open the member row.
2. Change role and save, or remove the member from the organization.
3. Confirm removal — they lose access to this organization’s data.

---

## 11. Backup and restore

**Who can do this:** Admin only

Backup includes **customers**, **bills**, and **settings**. It does **not** include members or login accounts.

### Export a backup

1. Open **Backup**.
2. Choose a date range, or **All Time** for a full backup.
3. Download:
   - **CSV backup** (ZIP with customers, bills, settings), or
   - **Excel backup** (workbook with those sheets)
4. Store the file safely offline.

**Date-range export:** only bills in that range (and customers linked to those bills) are included. Settings are still included.

### Restore a backup

1. Open **Backup**.
2. Choose **Import** and select a full ZIP or Excel backup (must include Customers and Bills).
3. Confirm the warning.
4. Wait for success — existing customers and bills in the organization are **replaced** by the file.

### Important warnings

- Restore is **destructive**: current customers and bills are deleted, then backup data is inserted.
- Restoring a **date-range** backup can wipe bills outside that range.
- Prefer exporting **All Time** before any restore, and keep that file as your safety copy.
- After restore, verify invoice sequence in **Settings** if you create new Fully Paid bills.

---

## 12. Quick reference

### Roles at a glance

| Capability | Admin | Business Operations Lead | Supervisor |
|------------|:-----:|:------------------------:|:----------:|
| Dashboard | Yes | Yes | No |
| New Bill / live sessions | Yes | Yes | Yes |
| Bills list & payments | Yes | Yes | Yes (mainly own) |
| Approve / reject | Yes | Yes | No |
| Edit Approved bills | Yes | Yes | No |
| Reports & GST export | Yes | Yes | No |
| Customers | Yes | Yes | Yes |
| Delete bills / customers | Yes | No | No |
| Members | Yes | No | No |
| Settings | Yes | No | No |
| Backup / restore | Yes | No | No |

### Common mistakes and fixes

| Problem | Fix |
|---------|-----|
| Mobile not accepted | Enter exactly **10 digits** |
| ERT rejected | Use letters/digits/dashes only; ERT must be unique |
| Hours look wrong | Check start/end **dates** and times; overnight needs a later end date |
| Cannot approve | Bill must be **Fully Paid** and **Pending Approval** |
| Supervisor cannot edit bill | Approved bills are locked for Supervisors; ask Admin/Ops Lead |
| No invoice number | Complete payment to **Fully Paid** |
| Invoice looks wrong | Admin updates **Settings** (name, GSTIN, logo, HSN, notes) |
| Restore lost recent bills | You imported a partial/date-range backup; restore from a full All Time export |

### Suggested daily flow

1. Add or select the farmer (**Customers** or quick-add).
2. **Check in** or create an **Express Bill** with a unique ERT.
3. On finish, set payment (Partial or Fully Paid + Cash/Online).
4. Admin/Ops Lead **approves** Fully Paid pending invoices.
5. Download **Tax Invoice PDF** for the farmer when needed.
6. At period end, run **Reports** → GST Excel, and optionally **Backup** → All Time export.

---

*End of user guide · Arkit Vedham India*
