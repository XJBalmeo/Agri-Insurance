# 🌱 PCIC High Value Crop Insurance System

A full-stack web application designed to digitize and streamline the application process for the Philippine Crop Insurance Corporation (PCIC). Built with a focus on data integrity, this system features a strictly normalized 3NF MySQL database, dynamic cost calculation, and transaction-safe backend routing.

> 📸 **See it in action:** [`docs/SCREENSHOTS.md`](docs/SCREENSHOTS.md) — a visual tour of the screens, the UI state indicators (active-policy warning, validation errors, maintenance banner, application status), and key features.

## 🚀 Current Status

**Phases 1–6 are complete** — the full application pipeline, bulletproof validation, UX polish, the admin dashboard with authentication, and the returning-farmer rules are all in place.

> ✅ **Full feature checklist:** [`CHECKLIST.md`](CHECKLIST.md) — every deliverable, grouped by phase, with the file/route that implements it.

---

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
4. *(Optional)* Load 8 sample policies for demos/testing:
   ```bash
   mysql -u root -p pcic_insurance < pcic-backend/seed.sql
   ```
   > ⚠️ **Destructive.** This script `TRUNCATE`s every table first, so it wipes any existing data before inserting the samples — run it only on a throwaway/demo database. The seed data also exercises the UI states (an active-coverage policy that triggers the re-application warning, plus one `Approved` and one `Rejected` policy). Note the database name is passed explicitly here because `seed.sql` only inserts rows — it doesn't `CREATE`/`USE` a database the way `schema.sql` does.
5. Create a `.env` file **inside the `pcic-backend` folder** and add your MySQL credentials:
   ```env
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=pcic_insurance
   ADMIN_PASSWORD=your_admin_dashboard_password
   ```
6. Start the backend server from the root with `npm start` (or `node pcic-backend/server.js`). It runs on port 3000.
7. Serve the frontend separately (e.g. VS Code Live Server on port 5501) and open `index.html`.

### 🌱 Loading / resetting the sample data

`pcic-backend/seed.sql` is a **reset-and-reload** script: it `TRUNCATE`s every table, then inserts 8 sample policies (`INS001`–`INS008`). Run it any time you want a clean, known database — e.g. right before a demo, or after testing left messy data behind:

```bash
mysql -u root -p pcic_insurance < pcic-backend/seed.sql
```

- The `pcic_insurance` argument is **required** — unlike `schema.sql`, the seed file has no `USE` line, so you must tell MySQL which database to load into. Without it you'll get `ERROR 1046 (3D000): No database selected`.
- Run `schema.sql` **first** if the tables don't exist yet (the seed only inserts rows; it doesn't create tables).
- ⚠️ **Destructive** — it wipes all existing data every time. Only run it on your local/demo database.
- The sample data is designed to show off the UI: it includes an active-coverage policy (triggers the re-application warning), one `Approved`, and one `Rejected` policy so every admin status state is visible.

### 🔄 First-time setup & pulling updates

`node_modules/` is intentionally **gitignored** — it is regenerated locally from `package.json` instead of being committed. So:

- **After cloning** the repo, run `npm install` once before starting the server.
- **After every `git pull`** that changes `package.json` (i.e. someone added a dependency), run `npm install` again.

If you skip this you'll see `Error: Cannot find module 'express'` — it means the libraries haven't been installed yet, **not** that `server.js` is broken. The fix is always `npm install` from the repo root.