# 🌱 PCIC High Value Crop Insurance System

A full-stack web application designed to digitize and streamline the application process for the Philippine Crop Insurance Corporation (PCIC). Built with a focus on data integrity, this system features a strictly normalized 3NF MySQL database, dynamic cost calculation, and transaction-safe backend routing.

## 🚀 Current Status
**Phases 1–4 (Core Pipeline + Validation + UX Polish) — COMPLETE**
- [x] Design 3NF MySQL relational database schema.
- [x] Build secure Node.js/Express REST API.
- [x] Implement SQL Transactions (Commit/Rollback) to prevent orphaned data — including cascade deletes (`DELETE /api/insurance/:id`, `DELETE /api/cpi/:id`).
- [x] Create sequential, dynamic ID generation (e.g., `INS001`, `P004`).
- [x] Build responsive, step-by-step frontend using Tailwind CSS.
- [x] Connect frontend to backend and handle edge cases (e.g., future date logic).
- [x] Bulletproof backend validation: positive-number checks, contact-number regex, peril/date/variety rules, and input sanitization (`pcic-backend/validators.js`, tested via `npm test`).
- [x] Admin dashboard (`admin.html`): browse all tables, transactional cascade delete, XSS-safe rendering.

---

## 📋 Development Roadmap (Next Steps)

### Phase 3: Bulletproof Validation (Data Integrity) — ✅ COMPLETE
- [x] **Backend Number Validation:** Ensure numbers (like `farmArea` or `desiredAmountCover`) cannot be negative or zero on the backend. *(Also covers `plantationSize`, per-variety and CPI amounts; `soilPH` range-checked.)*
- [x] **Contact Number Regex:** Validate that `contactNo` is a valid Philippine number — mobile (starts with `09`, exactly 11 digits) or landline (10 digits starting with `0`, e.g. `0287654321`).
- [x] **Input Sanitization:** Add backend logic to trim leading/trailing white spaces from all text inputs before saving to MySQL.

> Validation logic lives in `pcic-backend/validators.js`, run before the SQL transaction in `pcic-backend/server.js`. Invalid input returns `400` with all errors collected; clean data is trimmed and saved.

### Phase 4: User Experience (UX) Polish — ✅ COMPLETE
- [x] **Prevent Double Submissions:** Submit button is disabled while the request is in flight.
- [x] **Show Validation Details:** A rejected submission now lists every failing field in the toast, not just "Validation failed".
- [x] **Graceful Error Handling:** Backend answers `503` quickly when MySQL is unreachable; the form shows a persistent "System under maintenance" banner (and the admin a retry row) on timeouts/5xx instead of a raw error. Validation errors (400) keep their detailed toast.
- [x] **Currency Formatting:** Peso fields (`desiredCover`, CPI costs) format to `₱300,000.00`-style on blur and un-format on focus; submission strips the formatting before sending numbers to the backend.
- [x] **Second Variety Inputs:** `varietyBlock2` now includes `treesNum2`/`avgYield2`, wired into validation and the submission payload.

### Phase 5: Admin & Presentation Prep
- [x] **Admin Dashboard:** `/admin.html` browses every table via `GET /api/tables/:name` and deletes policies/CPI blocks through transactional cascade routes.
- [x] **Status Tracking:** `InsuranceTable.ApplicationStatus` ENUM (Pending/Approved/Rejected, defaults to Pending); admin updates it via an inline dropdown that calls `PATCH /api/insurance/:id/status`. Existing DBs: run `pcic-backend/migrations/2026-06-12-add-application-status.sql`.
- [x] **Authentication:** Admin login (`POST /api/login`, password from `ADMIN_PASSWORD` in `.env`) issues an 8-hour in-memory session token; all admin routes (table reads, deletes, status updates, cost) require `Authorization: Bearer <token>` via middleware in `pcic-backend/auth.js`. The public submission route stays open. *Local-grade auth — a real deployment still needs HTTPS, hashed multi-user credentials, and persistent sessions.*

### Phase 6: Returning Farmers — ✅ COMPLETE
- [x] **One Active Policy per Farmer:** submission is rejected while the farmer (matched by exact name + birthday) has a policy whose coverage hasn't ended — except applications the admin marked `Rejected`, which never block re-applying. A returning farmer's proposer row is reused, never duplicated; a same-name farmer with a different birthday is a new person.
- [x] **Early Active-Policy Warning:** once name and birthday are entered on step 1, `POST /api/proposer/active-policy` warns immediately about an active policy instead of failing after all six steps. The endpoint returns only the policy ID and end date — no personal data.

## 🗂️ Data Dictionary Alignment

The MySQL schema (`pcic-backend/schema.sql`) follows the project **Data Dictionary**: every `VARCHAR`/`CHAR` size matches, allowable values are enforced (`CivilStatus ∈ {S,M,W,SE}`, `Sex ∈ {M,F}`), and the numeric *size* column is read as total digits (`float 10 → DECIMAL(10,2)`, `float 5 → DECIMAL(5,2)`, `integer 5 → max 99999`). These limits are enforced in three places — the form (`maxlength`/`max`), the API (`pcic-backend/validators.js`), and the database — so a value can never reach a column it doesn't fit.

**Intentional deviations from the Data Dictionary** (kept on purpose, documented for the defense):
- `CPIID` / `MaterialID` / `LaborID` are `INT AUTO_INCREMENT` (dictionary: varchar) so the backend can read `result.insertId`. `VarietyTable` has no surrogate key (matching the dictionary); its rows are reached through their parent `InsuranceID`.
- Money/area columns use `DECIMAL` (dictionary: float) to avoid floating-point rounding on peso amounts.
- `Birthday`, `CivilStatus`, and `Sex` are `NOT NULL` (dictionary leaves them blank) — `Birthday` is half the proposer identity key, and the form requires all three.
- `ApplicationStatus` (ENUM) is a post-dictionary status-tracking feature.

Existing databases: run `pcic-backend/migrations/2026-06-13-align-to-data-dictionary.sql` to resize columns in place (see the file header — shrinking fails on rows that already exceed the new size).

## 🛠️ Tech Stack
* **Frontend:** HTML5, JavaScript (Vanilla), Tailwind CSS
* **Backend:** Node.js, Express.js
* **Database:** MySQL (3NF Normalized Schema)
* **API Testing:** Thunder Client / Postman

## 💻 Local Setup Instructions

> **Run these from the repository root** (the folder that contains `package.json`), **not** from inside `pcic-backend/`. The dependencies and the `npm start` script live at the root.

1. Clone the repository and open the **project root** folder in your terminal.
2. Run `npm install` to download dependencies (Express, MySQL2, CORS, Dotenv) into `node_modules/`.
   > `node_modules/` is **not** committed to git, so this step is required after every fresh clone. (See "First-time setup & pulling updates" below.)
3. Create the database and tables by loading the schema:
   ```bash
   mysql -u root -p < pcic-backend/schema.sql
   ```
4. Create a `.env` file **inside the `pcic-backend` folder** and add your MySQL credentials:
   ```env
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=pcic_insurance
   ADMIN_PASSWORD=your_admin_dashboard_password
   ```
5. Start the backend server from the root with `npm start` (or `node pcic-backend/server.js`). It runs on port 3000.
6. Serve the frontend separately (e.g. VS Code Live Server on port 5501) and open `index.html`.

### 🔄 First-time setup & pulling updates

`node_modules/` is intentionally **gitignored** — it is regenerated locally from `package.json` instead of being committed. So:

- **After cloning** the repo, run `npm install` once before starting the server.
- **After every `git pull`** that changes `package.json` (i.e. someone added a dependency), run `npm install` again.

If you skip this you'll see `Error: Cannot find module 'express'` — it means the libraries haven't been installed yet, **not** that `server.js` is broken. The fix is always `npm install` from the repo root.