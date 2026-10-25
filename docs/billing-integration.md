# Billing (POS) integration

Counter billing for **Canteen Admin** and **Sub Admin** inside the existing TuckZone app. One app, one
backend, one database, one login. Source reference: `vanshforwork-hue/restaurant_billing_app`
(Flutter, offline-first, SQLite + Node/Postgres sync backend) at commit `9cf1405`.

## Isolation guarantees (why Student/Parent/Teacher cannot regress)

- **New tables only** (`V22__billing_pos.sql`, all prefixed `pos_`). No existing table, column, entity,
  repository, service, controller or DTO was modified.
- **New code only**, in `com.school.canteen.billing` (backend), `mobile/src/screens/billing`,
  `mobile/src/api/billing.ts`, `mobile/src/navigation/BillingNavigator.tsx`, `mobile/src/utils/receipt.ts`.
- **Shared files touched (3 + types):** `SecurityConfig` (+1 matcher scoped to `/api/admin/billing/**`),
  `AdminTabs.tsx` and `SubAdminTabs.tsx` (+1 tab each), `navigation/types.ts` (+ param lists).
  `CustomerTabs`/`CustomerNavigator` and every customer screen are untouched.
- Billing endpoints are under `/api/admin/billing/**` and denied to every role except
  `CANTEEN_ADMIN`/`SUB_ADMIN` at two layers (URL rule + per-method `@PreAuthorize`).

## Feature map

| Reference feature | Reference source | TuckZone destination | Schema | Who |
|---|---|---|---|---|
| Item grid, search, category chips | `billing/presentation/*`, `menu_providers` | `PosScreen.tsx`, `GET /catalog` | `pos_categories`, `pos_items` | Admin, Sub |
| Cart +/- /remove, qty entry | `cart_providers.dart` | `PosScreen.tsx` (`QuantityStepper`) | – | Admin, Sub |
| Subtotal, GST toggle, total | `cart_providers.dart`, `AppSettings` | `PosBillService.computeGst` (server authoritative), `previewTotals` (UI preview) | `pos_settings.gst_*` | Admin, Sub |
| Save bill (txn, daily number) | `bill_repository.saveBill` | `PosBillService.create` | `pos_bills`, `pos_bill_items`, `pos_bill_counters` | Admin, Sub |
| Hold / resume held bill | `held_bills_screen`, `getHeldBills` | `POST/GET /held`, `/held/{id}/resume`, `DELETE /held/{id}` | `pos_held_carts` | own carts only |
| Duplicate last bill | `loadFromBill` | "Repeat last" in `PosScreen` | – | Admin, Sub |
| Menu / category CRUD, availability, favourite, sort | `menu_management`, `category_management` | `BillingCatalogScreen`, `/categories`, `/items` | `pos_categories`, `pos_items` | CRUD: Admin; availability switch: Sub too |
| Settings (name, address, phone, GSTIN, footer, currency, GST %) | `settings_screen`, `restaurant_settings` | `BillingSettingsScreen`, `/settings` | `pos_settings` (singleton) | read: both; write: Admin |
| Receipt + reprint | `receipt_builder.dart`, printer | `utils/receipt.ts`, `BillDetailScreen` | header snapshot columns on `pos_bills` | Admin, Sub |
| Sales records | `sales_records_screen` | `BillingHistoryScreen`, `GET /bills` | `idx_pos_bill_*` | Admin: all; Sub: own |
| Delete sale (emailed OTP) | `routes/sales.js` OTP flow | **Void** with mandatory reason, `POST /bills/{id}/void` | `status`, `void_*` | Admin |
| Sales report + xlsx export | `sales_export_service.dart` | `BillingReportsScreen`, `/reports/summary`, `/reports/export` (Summary + Item Details sheets) | – | Admin |

## Deliberately not ported

| Reference feature | Why |
|---|---|
| Separate login, restaurant/tenant tables, password reset, JWT | TuckZone auth is used; no second login. |
| Offline-first SQLite + sync engine, device codes, tombstones | Billing is server-side in the one TuckZone database; nothing to sync. |
| Bluetooth/USB thermal printing (`printer_screen`, ESC/POS) | Needs native modules; not usable from the web build and would force a new native build for every role. Replaced by browser print (web) / system share sheet (native). |
| Backup/restore, WorkManager jobs, update-safety | Device-local concerns of the standalone app; the server DB is backed up with TuckZone's. |
| Emailed daily sales report, deletion-OTP email | Needs mail policy decisions; void-with-reason covers correction. |
| Logo image on receipt | Device-local file path in the reference. |

## Not in the reference (added minimally, flagged)

- **Payment method** (`CASH/UPI/CARD/OTHER`): the reference records none. The brief's checkout flow asks
  to "record payment details", so it is an optional manual field. Every bill carries
  `paymentStatus = MANUAL_UNVERIFIED`; no gateway, no verification, no change to TuckZone payments.
  Reports label it "as recorded".
- **Discounts, per-item tax, refunds**: *not present in the reference*, therefore not built.
  Void is the only correction. Add them later only with explicit rules.

## Rules

- Money: `numeric(12,2)`; tax exclusive on subtotal, `HALF_UP` to 2 dp, computed server-side from
  **server-side prices** (client sends only item ids + quantities). `total = subtotal + gst` is also a DB `CHECK`.
- Invoice number `INV-yyyyMMdd-NNNN`, per-day counter row-locked by upsert; `UNIQUE(invoice_number)`.
- Idempotency: `UNIQUE(created_by, idempotency_key)`; replays return the original bill; concurrent
  duplicates lose on the constraint and are resolved to the winner. The UI rotates the key on any cart edit.
- History: lines snapshot name/price/emoji; the receipt header (name, address, phone, GSTIN, footer,
  currency, GST %) is snapshotted on the bill. Reprint is a read.
- Archive instead of delete for categories/items; a category with live items cannot be archived.
- Void: Admin only, reason required, row stays, excluded from sales totals, shown separately in reports.
- Limits: 100 lines/bill, 999 qty/line, report/search range ≤ 366 days.

## Permissions

| Capability | Admin | Sub Admin | Student/Parent/Teacher |
|---|---|---|---|
| Read catalog, settings | ✔ | ✔ | 403 |
| Create bill, hold/resume/discard own carts | ✔ | ✔ | 403 |
| Read bills / receipts | all | **own only** (others → 404) | 403 |
| Toggle item availability | ✔ | ✔ | 403 |
| Category/item CRUD, settings update | ✔ | 403 | 403 |
| Void | ✔ | 403 | 403 |
| Reports + export | ✔ | 403 | 403 |

Existing Sub Admin permissions elsewhere are unchanged. The canteen is single-tenant in TuckZone, so the
scope boundary is *creator* (Sub Admin) vs *all* (Admin).

## Migration / rollback

`V22__billing_pos.sql` is additive. Rollback (no other table references these):
`drop table pos_bill_items, pos_bills, pos_held_carts, pos_bill_counters, pos_settings, pos_items, pos_categories;`

## Deploy steps

1. Deploy backend (Flyway applies V22 on start). Take a DB backup first as usual.
2. Ship the mobile/web build. Sign in as Admin → Billing tab → open **Settings** (business name, GST %,
   GSTIN) and **Catalog** (categories + items) before first sale.
3. Sub Admins get the Billing tab automatically; no new accounts or permissions to configure.
