# 🌱 PCIC High Value Crop Insurance System

A full-stack web application designed to digitize and streamline the application process for the Philippine Crop Insurance Corporation (PCIC). Built with a focus on data integrity, this system features a strictly normalized 3NF MySQL database, dynamic cost calculation, and transaction-safe backend routing.

## 🚀 Current Status
**Phases 1–3 (Core Pipeline + Validation) — COMPLETE**
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
- [x] **Contact Number Regex:** Validate that `contactNo` strictly follows the Philippine mobile format (starts with `09` and is exactly 11 digits).
- [x] **Input Sanitization:** Add backend logic to trim leading/trailing white spaces from all text inputs before saving to MySQL.

> Validation logic lives in `pcic-backend/validators.js`, run before the SQL transaction in `pcic-backend/server.js`. Invalid input returns `400` with all errors collected; clean data is trimmed and saved.

### Phase 4: User Experience (UX) Polish
- [x] **Prevent Double Submissions:** Submit button is disabled while the request is in flight.
- [x] **Show Validation Details:** A rejected submission now lists every failing field in the toast, not just "Validation failed".
- [ ] **Graceful Error Handling:** Catch database connection timeouts and display a user-friendly "System Maintenance" UI alert instead of a raw error object.
- [ ] **Currency Formatting:** Dynamically format large integer inputs (e.g., `300000`) into readable currency strings (e.g., `₱300,000.00`) on the frontend.
- [ ] **Second Variety Inputs:** `varietyBlock2` in `index.html` is missing `treesNum2`/`avgYield2` fields, so a second variety currently fails backend validation (yield defaults to 0).

### Phase 5: Admin & Presentation Prep
- [x] **Admin Dashboard:** `/admin.html` browses every table via `GET /api/tables/:name` and deletes policies/CPI blocks through transactional cascade routes.
- [ ] **Status Tracking:** Add an `ApplicationStatus` column (Pending, Approved, Rejected) to the database and allow the admin to update it.
- [ ] **Authentication:** The API (including admin delete routes) is currently unauthenticated — required before any real deployment.

## 🛠️ Tech Stack
* **Frontend:** HTML5, JavaScript (Vanilla), Tailwind CSS
* **Backend:** Node.js, Express.js
* **Database:** MySQL (3NF Normalized Schema)
* **API Testing:** Thunder Client / Postman

## 💻 Local Setup Instructions
1. Clone the repository and open the `pcic-backend` folder.
2. Run `npm install` to download dependencies (Express, MySQL2, CORS, Dotenv).
3. Create the database and tables by loading the schema:
   ```bash
   mysql -u root -p < schema.sql
   ```
4. Create a `.env` file in the `pcic-backend` folder and add your MySQL credentials:
   ```env
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=pcic_insurance
   ```
5. Start the backend server with `node server.js` (runs on port 3000).