# ✅ Project Checklist — PCIC High Value Crop Insurance System

This is the deliverables checklist for the project, grouped by development phase.
Every box maps to a concrete, demonstrable feature in the codebase. For the
narrative overview, the tech stack, and setup instructions, see [`README.md`](README.md).

**Status: Phases 1–6 complete.**

---

## Phase 1–2: Core Pipeline
- [x] Design a 3NF MySQL relational database schema (`pcic-backend/schema.sql`).
- [x] Build a Node.js/Express REST API (`pcic-backend/server.js`).
- [x] Implement SQL transactions (commit/rollback) to prevent orphaned data — including cascade deletes (`DELETE /api/insurance/:id`, `DELETE /api/cpi/:id`).
- [x] Create sequential, dynamic ID generation in the backend (e.g. `INS001`, `P004`).
- [x] Build a responsive, step-by-step frontend using Tailwind CSS.
- [x] Connect the frontend to the backend and handle edge cases (e.g. future-date logic).

## Phase 3: Bulletproof Validation (Data Integrity)
- [x] **Backend number validation:** numbers like `farmArea` or `desiredAmountCover` cannot be negative or zero on the backend. *(Also covers `plantationSize`, per-variety and CPI amounts; `soilPH` is range-checked.)*
- [x] **Contact-number regex:** `contactNo` must be a valid Philippine number — mobile (starts with `09`, exactly 11 digits) or landline (10 digits starting with `0`, e.g. `0287654321`).
- [x] **Input sanitization:** trim leading/trailing whitespace from all text inputs before saving to MySQL.

> Validation logic lives in `pcic-backend/validators.js`, run before the SQL transaction in `pcic-backend/server.js`. Invalid input returns `400` with all errors collected; clean data is trimmed and saved. Tested via `npm test`.

## Phase 4: User Experience (UX) Polish
- [x] **Prevent double submissions:** the submit button is disabled while the request is in flight.
- [x] **Show validation details:** a rejected submission lists every failing field in the toast, not just "Validation failed".
- [x] **Graceful error handling:** the backend answers `503` quickly when MySQL is unreachable; the form shows a persistent "System under maintenance" banner (and the admin a retry row) on timeouts/5xx instead of a raw error. Validation errors (400) keep their detailed toast.
- [x] **Currency formatting:** peso fields (`desiredCover`, CPI costs) format to `₱300,000.00`-style on blur and un-format on focus; submission strips the formatting before sending numbers to the backend.
- [x] **Second variety inputs:** `varietyBlock2` includes `treesNum2`/`avgYield2`, wired into validation and the submission payload.

## Phase 5: Admin & Presentation
- [x] **Admin dashboard (`admin.html`):** browses every table via `GET /api/tables/:name` and deletes policies/CPI blocks through transactional cascade routes; XSS-safe rendering.
- [x] **Status tracking:** `InsuranceTable.ApplicationStatus` ENUM (Pending/Approved/Rejected, defaults to Pending); admin updates it via an inline dropdown that calls `PATCH /api/insurance/:id/status`. Existing DBs: run `pcic-backend/migrations/2026-06-12-add-application-status.sql`.
- [x] **Authentication:** admin login (`POST /api/login`, password from `ADMIN_PASSWORD` in `.env`) issues an 8-hour in-memory session token; all admin routes require `Authorization: Bearer <token>` via middleware in `pcic-backend/auth.js`. The public submission route stays open. *Local-grade auth — a real deployment still needs HTTPS, hashed multi-user credentials, and persistent sessions.*

## Phase 6: Returning Farmers
- [x] **One active policy per farmer:** submission is rejected while the farmer (matched by exact name + birthday) has a policy whose coverage hasn't ended — except applications the admin marked `Rejected`, which never block re-applying. A returning farmer's proposer row is reused, never duplicated; a same-name farmer with a different birthday is a new person.
- [x] **Early active-policy warning:** once name and birthday are entered on step 1, `POST /api/proposer/active-policy` warns immediately about an active policy instead of failing after all six steps. The endpoint returns only the policy ID and end date — no personal data.
