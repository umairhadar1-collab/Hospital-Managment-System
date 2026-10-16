<<<<<<< HEAD
# Hospital Front Desk (Node.js + Express + MongoDB)

Flow: front desk officer logs in -> fills patient registration form -> system saves the patient and shows a print slip -> patient takes the slip to the doctor's room.

## Run it

1. Install Node.js 18+ and MongoDB (local, or a free MongoDB Atlas cluster).
2. In this folder:
   ```bash
   npm install
   cp .env.example .env      # then edit .env: set SESSION_SECRET and MONGO_URI
   npm run create-user -- frontdesk1 "StrongPass#123" "Ali Raza" frontdesk
   npm run create-user -- admin1 "AdminPass#123" "Admin" admin
   npm run seed-tests        # adds a starter list of lab tests (example prices)
   npm start
   ```
3. Open http://localhost:3000 and log in.

## Pages

| URL | What it does |
|---|---|
| `/login` | Front desk login |
| `/patients/new` | Patient registration form |
| `/patients/:id/slip` | Print slip (80mm thermal-size, prints only the slip) |
| `/patients` | Last 50 patients, with Reprint and Lab links. Use the search box (name, MR number or phone) to find older patients |
| `/patients/:id/edit` | **Admin only.** Edit patient details (MR number cannot change) |
| `/lab/new` | Find a patient by MR number, then choose lab tests |
| `/lab/orders/:id/slip` | Lab slip with test names, prices and total |
| `/lab` | Last 50 lab orders, with a Reprint link |
| `/lab/orders/:id/edit` | **Admin only.** Change the tests in a lab order |
| `/admin/audit` | **Admin only.** Last 100 edits and deletes, with before/after values |
| `/lab/tests` | Test catalog. Everyone can view; only `admin` can add tests and change prices |

## Files

- `server.js` - app setup, sessions (stored in MongoDB), CSRF check
- `models/` - `User`, `Patient`, `LabTest`, `LabOrder`, `AuditLog`, `Counter` (gives MR-000001, LAB-000001, ...)
- `routes/` - `auth.js` (login/logout), `patients.js` (register, search, slip, admin edit/delete), `lab.js` (lab orders, test catalog, admin edit/delete), `admin.js` (audit log page)
- `lib/audit.js` - saves one audit line for every admin edit or delete
- `views/` - EJS pages
- `scripts/createUser.js` - creates login users (there is no public sign-up on purpose)
- `scripts/seedTests.js` - adds starter lab tests (safe to run again)

## Edit and delete (admin only)

- Only users with the `admin` role see **Edit** and **Delete**. Front desk users cannot open those pages, even by typing the address.
- **Patient:** admin can edit name, age, gender, phone, CNIC, address, department and doctor. The MR number never changes.
- **Delete patient:** a patient who still has lab orders is not deleted. Delete the lab orders first, then the patient. This avoids losing billing records by mistake.
- **Lab order:** admin can add or remove tests. Tests that were already in the order keep their saved price; newly added tests use today's catalog price. Admin can also delete a whole order.
- **Lab tests:** admin can change a price, switch a test off, or delete it. Old orders keep their own copy of the test name and price.
- Every edit and delete is written to the **Audit Log** (who, when, before and after). A deleted record is kept there.

To make an admin user: `npm run create-user -- admin1 "AdminPass#123" "Admin" admin`
(The last word, `admin`, is the role. If you leave it out, the user becomes `frontdesk`.)

**Edit/Delete not showing?** Look at the top bar: it shows your name and role, for example `Umair (admin)`, and an **Audit Log** link appears for admins. If it says `frontdesk`, run:
```bash
npm run set-role                       # shows all users and their roles
npm run set-role -- umair admin        # makes user "umair" an admin
```
Then log out and log in again. If you just updated the code, also stop the server (Ctrl+C) and run `npm start` again.

## Notes

- Lab prices in the seed list are examples only. Change them on the Lab Tests page (admin login) before real use.
- Each lab order saves the test names and prices at the time of ordering, so changing a price later does not change old orders.
- There is no sign-up page. Only an admin should create front desk users, with the script above.
- Slip size is 80mm wide. For A5/A4 paper, change `@page { size: ... }` in `public/style.css`.
- Before using this for real patients: run it behind HTTPS, add login rate limiting, and add audit logs. Patient data is sensitive.
=======
# Hospital-Managment-System
This project is for front desk officers.
>>>>>>> 413665d3b6aa2e881f1e60dd91e1cb2c84c9a857
