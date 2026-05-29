# 🌱 PCIC High Value Crop Insurance System

A full-stack web application designed to digitize and streamline the application process for the Philippine Crop Insurance Corporation (PCIC). Built with a focus on data integrity, this system features a strictly normalized 3NF MySQL database, dynamic cost calculation, and transaction-safe backend routing.

## 🚀 Current Status
**Phase 1 & 2 (Core Pipeline) — COMPLETE**
- [x] Design 3NF MySQL relational database schema.
- [x] Build secure Node.js/Express REST API.
- [x] Implement SQL Transactions (Commit/Rollback) to prevent orphaned data.
- [x] Create sequential, dynamic ID generation (e.g., `INS001`, `P004`).
- [x] Build responsive, step-by-step frontend using Tailwind CSS.
- [x] Connect frontend to backend and handle edge cases (e.g., future date logic).

---

## 📋 Development Roadmap (Next Steps)

### Phase 3: Bulletproof Validation (Data Integrity)
- [ ] **Backend Number Validation:** Ensure numbers (like `farmArea` or `desiredAmountCover`) cannot be negative or zero on the backend.
- [ ] **Contact Number Regex:** Validate that `contactNo` strictly follows the Philippine mobile format (starts with `09` and is exactly 11 digits).
- [ ] **Input Sanitization:** Add backend logic to trim leading/trailing white spaces from all text inputs before saving to MySQL.

### Phase 4: User Experience (UX) Polish
- [ ] **Prevent Double Submissions:** Disable the "Submit" button instantly upon click to prevent duplicate database entries on laggy connections.
- [ ] **Graceful Error Handling:** Catch database connection timeouts and display a user-friendly "System Maintenance" UI alert instead of a raw error object.
- [ ] **Currency Formatting:** Dynamically format large integer inputs (e.g., `300000`) into readable currency strings (e.g., `₱300,000.00`) on the frontend.

### Phase 5: Admin & Presentation Prep
- [ ] **Admin Dashboard:** Build `/admin.html` with a data table fetching all submitted applications via a new `GET` route.
- [ ] **Status Tracking:** Add an `ApplicationStatus` column (Pending, Approved, Rejected) to the database and allow the admin to update it.

## 🛠️ Tech Stack
* **Frontend:** HTML5, JavaScript (Vanilla), Tailwind CSS
* **Backend:** Node.js, Express.js
* **Database:** MySQL (3NF Normalized Schema)
* **API Testing:** Thunder Client / Postman

## 💻 Local Setup Instructions
1. Clone the repository and open the `pcic-backend` folder.
2. Run `npm install` to download dependencies (Express, MySQL2, CORS, Dotenv).
3. Create a `.env` file in the root directory and add your MySQL credentials:
   ```env
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=pcic_insurance