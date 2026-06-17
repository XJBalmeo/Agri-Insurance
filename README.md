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

## 💻 Beginner's Local Setup Tutorial

### 1. Install the required programs

Before opening the project, install:

- [Git](https://git-scm.com/downloads) to clone the repository.
- [Node.js](https://nodejs.org/) (the LTS release is recommended). It includes `npm`.
- [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) and, optionally, MySQL Workbench.
- [Visual Studio Code](https://code.visualstudio.com/) with the **Live Server** extension for serving the frontend.

Open a new terminal after installing them and check that each command works:

```bash
git --version
node --version
npm --version
mysql --version
```

If only `mysql` is not recognized on Windows, see [MySQL is not recognized](#mysql-is-not-recognized-on-windows) below.

### 2. Clone and open the correct folder

```bash
git clone https://github.com/XJBalmeo/Agri-Insurance.git
cd Agri-Insurance
```

All commands in this tutorial are run from the **repository root**: the folder containing `package.json`, `index.html`, and `pcic-backend`. In VS Code, the terminal prompt should end in `Agri-Insurance`, not `pcic-backend`.

If the project was downloaded as a ZIP instead, extract it, open the extracted folder in VS Code, and choose **Terminal → New Terminal**.

### 3. Install the Node.js dependencies

```bash
npm install
```

This creates the local `node_modules` folder and installs Express, MySQL2, CORS, and Dotenv. The folder is intentionally not stored in Git.

### 4. Create the MySQL database and tables

Make sure the MySQL service is running first. The command asks for the MySQL `root` password selected during installation; no characters appear while typing the password, which is normal.

**Windows PowerShell** (including VS Code's default Windows terminal):

```powershell
cmd /c "mysql -u root -p < pcic-backend\schema.sql"
```

PowerShell itself does not support the `<` input syntax, so `cmd /c` runs this one command through Command Prompt.

**Windows Command Prompt, Git Bash, macOS, or Linux:**

```bash
mysql -u root -p < pcic-backend/schema.sql
```

If the terminal is already inside `pcic-backend`, either return to the root with `cd ..` or use `schema.sql` instead of `pcic-backend/schema.sql`.

> ⚠️ `schema.sql` is re-runnable, but it drops and recreates the project's tables. Running it again deletes data already stored in those tables.

Verify that the import worked:

```bash
mysql -u root -p -e "USE pcic_insurance; SHOW TABLES;"
```

The result should list seven tables, including `ProposerTable`, `FarmTable`, and `InsuranceTable`.

#### MySQL Workbench alternative

If command-line import is unfamiliar:

1. Open MySQL Workbench and connect to the local MySQL server.
2. Choose **File → Open SQL Script**.
3. Select `pcic-backend/schema.sql` from this project.
4. Click the lightning-bolt **Execute** button.
5. Refresh the **Schemas** panel. `pcic_insurance` should appear.

### 5. Configure the backend

In VS Code's Explorer, right-click the `pcic-backend` folder, select **New File**, and name it `.env`. Paste the following values:

```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_mysql_root_password
DB_NAME=pcic_insurance
ADMIN_PASSWORD=choose_an_admin_dashboard_password
```

Replace both placeholder passwords. `DB_PASSWORD` must match the MySQL root password used in the previous step. Do not add quotes or spaces around the values.

### 6. Optionally load demonstration data

The application works with an empty database. To add eight sample policies and populate the admin screens, run one of these commands from the repository root.

**Windows PowerShell:**

```powershell
cmd /c "mysql -u root -p pcic_insurance < pcic-backend\seed.sql"
```

**Windows Command Prompt, Git Bash, macOS, or Linux:**

```bash
mysql -u root -p pcic_insurance < pcic-backend/seed.sql
```

> ⚠️ The seed script deletes all existing rows before inserting the samples. Use it only for local development or demonstrations.

### 7. Start the backend

From the repository root, run:

```bash
npm start
```

A successful start prints `Server is running on port 3000`. Keep this terminal open while using the application. Stop the server later with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

### 8. Start the frontend

1. Install the **Live Server** extension in VS Code if necessary.
2. Right-click `landing.html` and select **Open with Live Server**.
3. The browser normally opens at `http://127.0.0.1:5500/landing.html` or a similar local address.

Both servers must remain running: Live Server serves the pages, while the Node.js backend handles API requests on port 3000.

## 🩹 Setup Troubleshooting

### `mysql` is not recognized on Windows

MySQL may be installed without its command-line folder being in `PATH`. The usual folder is:

```text
C:\Program Files\MySQL\MySQL Server 8.0\bin
```

Confirm that this folder contains `mysql.exe`. To enable it for the current PowerShell terminal only, run:

```powershell
$env:Path += ";C:\Program Files\MySQL\MySQL Server 8.0\bin"
mysql --version
```

If the installed folder has a different version number, use that folder instead. To make the change permanent, search Windows for **Edit the system environment variables**, open **Environment Variables**, edit the user `Path`, add the MySQL `bin` folder, and restart VS Code.

If there is no MySQL Server folder, install MySQL Community Server first; cloning this repository does not install the database software.

### `RedirectionNotSupported` in PowerShell

PowerShell does not accept commands such as `mysql ... < schema.sql`. Prefix the import with `cmd /c`:

```powershell
cmd /c "mysql -u root -p < pcic-backend\schema.sql"
```

### `Access denied for user 'root'@'localhost'`

The MySQL password is incorrect. Use the password selected during MySQL installation, then put that same password in `pcic-backend/.env`. This is a MySQL account password, not a Windows or GitHub password.

### `Can't connect to MySQL server`

The MySQL service is probably stopped. On Windows, open the **Services** application, find a service such as `MySQL80`, and start it. On macOS, start MySQL from System Settings or with the package manager used to install it.

### Schema file not found

Check the current folder with `pwd` in Git Bash/macOS/Linux or `Get-Location` in PowerShell. From the repository root, the file is `pcic-backend/schema.sql`; from inside `pcic-backend`, it is simply `schema.sql`.

### `Error: Cannot find module 'express'`

Run `npm install` from the repository root, then try `npm start` again.

### The backend reports a database error

Check that MySQL is running and that `pcic-backend/.env` exists. Confirm that `DB_PASSWORD` matches the MySQL account and that `DB_NAME` is exactly `pcic_insurance`, then restart the backend.

## 🌱 Loading / Resetting the Sample Data

`pcic-backend/seed.sql` is a **reset-and-reload** script: it `TRUNCATE`s every table, then inserts 8 sample policies (`INS001`–`INS008`). Run it any time you want a clean, known database — e.g. right before a demo, or after testing left messy data behind:

```bash
mysql -u root -p pcic_insurance < pcic-backend/seed.sql
```

- The `pcic_insurance` argument is **required** — unlike `schema.sql`, the seed file has no `USE` line, so you must tell MySQL which database to load into. Without it you'll get `ERROR 1046 (3D000): No database selected`.
- Run `schema.sql` **first** if the tables don't exist yet (the seed only inserts rows; it doesn't create tables).
- ⚠️ **Destructive** — it wipes all existing data every time. Only run it on your local/demo database.
- The sample data is designed to show off the UI: it includes an active-coverage policy (triggers the re-application warning), one `Approved`, and one `Rejected` policy so every admin status state is visible.

## 🔄 Pulling Future Updates

`node_modules/` is intentionally **gitignored** — it is regenerated locally from `package.json` instead of being committed. So:

- **After cloning** the repo, run `npm install` once before starting the server.
- **After every `git pull`** that changes `package.json` (i.e. someone added a dependency), run `npm install` again.

If you skip this you'll see `Error: Cannot find module 'express'` — it means the libraries haven't been installed yet, **not** that `server.js` is broken. The fix is always `npm install` from the repo root.
