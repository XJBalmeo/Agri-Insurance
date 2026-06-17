# 📸 Visual Documentation — PCIC High Value Crop Insurance

A visual tour of the app: every **page**, every **step** of the application form (filled with a sample applicant), the **UI state indicators ("flags")**, every **admin table**, and the notable **features**. All screenshots were captured against the running app (backend on port 3000, frontend on port 5501) using the 8-policy sample dataset in [`pcic-backend/seed.sql`](../pcic-backend/seed.sql).

---

## 1. Pages

### Landing page (`landing.html`)
The public entry point — hero, "Start your application" call to action, and a live "System online" indicator.

![Landing page](screenshots/page-landing.png)

### Submission success (`index.html`)
After a valid submission, the form is replaced by a confirmation showing the generated **reference number** and next steps.

![Submission success](screenshots/page-success.png)

### Admin login (`admin.html`)
All admin routes require a session token. The dashboard opens to a password gate (`POST /api/login`, password from `ADMIN_PASSWORD`), which issues an 8-hour token sent as `Authorization: Bearer <token>` on every admin request.

![Admin login](screenshots/page-admin-login.png)

---

## 2. The application form — step by step

A six-step wizard, shown here filled in for a sample applicant (**Maria Santos Reyes**, a mango farmer). The numbered **step pills** show progress and let the user jump back to a completed step.

### Step 1 — Personal Information
Name, address, birthday, civil status, sex, beneficiary, spouse, and multi-valued contact numbers (the green chip).

![Step 1 — Personal information](screenshots/step-1-personal.png)

### Step 2 — Insurance Coverage
Crop, plantation size, coverage dates, desired cover (peso-formatted), and the perils checklist.

![Step 2 — Insurance coverage](screenshots/step-2-coverage.png)

### Step 3 — Farm Overview
![Step 3 — Farm overview](screenshots/step-3-farm.png)

### Step 4 — Crop Variety & Irrigation
![Step 4 — Crop variety & irrigation](screenshots/step-4-crops.png)

### Step 5 — Cost of Production Inputs (CPI)
Per-schedule materials and labor rows; the grand total (₱5,500.00 here) is derived automatically.

![Step 5 — Cost of production inputs](screenshots/step-5-cpi.png)

### Step 6 — Validation & Signatures
A read-only **Review your application** recap of every answer, plus the supervising-technician signature fields, then submit.

![Step 6 — Validation & signatures](screenshots/step-6-validation.png)

---

## 3. UI state indicators ("the flags")

States the UI surfaces to guide the user and protect data integrity.

### Active-policy warning
As soon as a returning farmer's **name and birthday** are entered, the app checks the backend (`POST /api/proposer/active-policy`) and shows an **amber warning** if that farmer already has a policy whose coverage hasn't ended (and isn't `Rejected`). Shown here for **Jack Garcia** (policy **INS003**, active until 2027-01-01) — it appears right under the birthday field on Step 1, before the rest of the form is even filled.

![Active policy warning](screenshots/flag-active-policy-warning.png)

### Inline validation errors
Trying to advance with missing or invalid fields highlights each offending field in **red** with a message beneath it. Validation is enforced on the form, in the API (`pcic-backend/validators.js`), and in the database.

![Inline validation errors](screenshots/flag-validation-errors.png)

### "System under maintenance" banner
If the server or database is unreachable (a `503`/timeout), the form shows a persistent **amber maintenance banner** instead of a raw error, and reassures the user their answers are safe.

![Maintenance banner](screenshots/flag-maintenance-banner.png)

### Application status flag (admin)
Every policy carries an **`ApplicationStatus`** of `Pending`, `Approved`, or `Rejected` (defaults to `Pending`). Admins change it via the inline dropdown, which calls `PATCH /api/insurance/:id/status`. With the sample data, **INS005 is Approved** and **INS008 is Rejected** — so the dropdown shows all three states at once.

![Application status dropdown](screenshots/flag-application-status.png)

**What the status actually does:** the active-policy check ignores `Rejected` policies. So `Pending` and `Approved` both **block** a re-application while coverage is live; `Rejected` is the escape hatch that **lets the farmer re-apply** even before the coverage dates pass.

### Delete confirmation (cascade)
Deleting a row opens a confirmation modal that warns the delete also removes all related rows in other tables and **can't be undone** — the operation runs as a transactional cascade.

![Delete confirmation](screenshots/flag-delete-confirmation.png)

---

## 4. Admin — browse every table

The sidebar lists all seven database tables; selecting one loads its rows via `GET /api/tables/:name`, with XSS-safe rendering. Horizontal scroll reveals every column.

### Insurance
![Admin — Insurance table](screenshots/flag-admin-insurance-table.png)

### Proposer
Shows the **IP flag** and **Tribe** (Igorot, Mangyan, T'boli), plus civil status and sex for all 8 farmers.

![Admin — Proposer table](screenshots/admin-proposer-table.png)

### Farm
![Admin — Farm table](screenshots/admin-farm-table.png)

### Variety
![Admin — Variety table](screenshots/admin-variety-table.png)

### CPI (schedule)
![Admin — CPI table](screenshots/admin-cpi-table.png)

### CPI Material
![Admin — CPI Material table](screenshots/admin-cpi-material-table.png)

### CPI Labor
![Admin — CPI Labor table](screenshots/admin-cpi-labor-table.png)

---

## 5. Features

### Indigenous People (IP) profile toggle
Flipping the toggle reveals the **Tribe name** field — so the IP question only asks for a tribe when it's relevant.

![IP toggle](screenshots/feature-ip-toggle.png)

### Add a second crop variety
An optional second variety block (with its own tree-count and yield inputs) expands on Step 4 for farmers planting more than one variety.

![Second variety](screenshots/feature-second-variety.png)

### Dark mode
A theme toggle in the header switches the whole app between light and dark. The choice is saved to `localStorage` and applied before first paint, so dark-mode users never see a flash of the light UI on reload.

![Dark mode](screenshots/feature-dark-mode.png)

### Admin table search
A search box in the admin topbar filters the current table across all columns as you type. The filter **persists when you switch tables**, so the same term applies to whichever table you open next. Booleans show as Yes/No, and searching matches that displayed text.

![Table search filtering rows](screenshots/feature-table-search.png)

When nothing matches, the table keeps its headers and shows a clear "No rows match" message instead of going blank.

![Search with no results](screenshots/feature-search-no-results.png)

### Responsive / mobile layout
The form and landing page reflow for narrow screens — fields stack, the step pills wrap, and the header compresses.

| Landing (mobile) | Form (mobile) |
|---|---|
| ![Mobile landing](screenshots/feature-mobile-landing.png) | ![Mobile form](screenshots/feature-mobile-form.png) |

### Also worth a try
- **Draft auto-save** — the form saves every change to `localStorage`; the header chip reads "Draft auto-saved" / "Draft saved" / "Draft restored".
- **Currency formatting** — peso fields format to `₱350,000.00` on blur and un-format on focus.

---

*Screenshots live in [`docs/screenshots/`](screenshots/). To regenerate them, run the app (see the [README](../README.md) and the `start-app` skill), load [`pcic-backend/seed.sql`](../pcic-backend/seed.sql) for the sample data, and recapture the screens above.*
