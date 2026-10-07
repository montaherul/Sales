# 15 - AUDIT LOGGING & VERSION CONTROL SPECIFICATION

## 1. Audit Principles

> **Every business operation must produce a permanent, auditable footprint.**  
> Silent mutations, untracked deletions, and unverified overrides are strictly prohibited.

---

## 2. Event Taxonomy

The system records standardized event codes in the `audit_logs` table:

| Category | Event Code | Trigger Condition | Logged Payload |
| :--- | :--- | :--- | :--- |
| **Authentication** | `AUTH_LOGIN` | User logs in successfully | User ID, IP, User Agent |
| | `AUTH_LOGOUT` | User logs out | User ID |
| | `AUTH_FAILED` | Unauthorized login attempt | Attempted email, IP |
| **Administration** | `USER_CREATE` | Admin invites a new user | Admin ID, target profile |
| | `ROLE_CHANGE` | User role modified | Old role, new role |
| | `SCOPE_ASSIGN` | User territory/region scope mapped | Target user, scope IDs |
| **Operational** | `SALES_DRAFT_SAVE`| CSR creates/updates draft | Submission ID, brand counts |
| | `SALES_SUBMIT` | CSR submits to TSO queue | Submission ID, territory |
| | `APPROVE_TSO` | TSO approves territory entry | Submission ID, TSO comments |
| | `APPROVE_RSO` | RSO verifies regional entry | Submission ID, RSO comments |
| | `REJECT` | Reviewer rejects submission | Mandatory rejection reason |
| | `PERIOD_FINALIZE`| Super Admin locks period | Month, Year, Finalizer ID |
| | `PERIOD_UNLOCK` | Super Admin unlocks record | Mandatory unlock reason |
| **Integration** | `XLSX_IMPORT` | Workbook imported | File name, record count, checksum |
| | `XLSX_EXPORT` | Workbook downloaded | Requested period, exporter ID |
| | `DRIVE_UPLOAD` | Report uploaded to Google Drive | Drive File ID, folder, SHA-256 |
| | `SHEETS_SYNC` | Database synchronized to Sheets | Spreadsheet ID, record count |
| **Master Data** | `TARGET_UPDATE` | Monthly quota adjusted | Territory, old quota, new quota |
| | `PRICE_UPDATE` | Brand price modified | Brand, old price, new price |

---

## 3. Submission Version History (`submission_versions`)

Whenever a submitted or approved record is edited (e.g., during TSO correction or Super Admin unlock):
1. A new row is inserted into `submission_versions`.
2. The `version_number` increments monotonically ($1, 2, 3, \dots$).
3. A complete JSONB snapshot of all child tables (`daily_sales`, `daily_stock`, `zarda_sales`, `zarda_stock`, `empty_packets`) is preserved.
4. The user ID and mandatory `change_reason` are captured.

### Snapshot Structure Example:
```json
{
  "submissionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "territory": "Kerani Hat",
  "reportDate": "2026-10-06",
  "cigarettes": {
    "wilson": { "sales": 0.00, "closingStock": 0.19 },
    "shahara": { "sales": 0.00, "closingStock": 0.00 },
    "express": { "sales": 0.68, "closingStock": 0.84 },
    "nexus": { "sales": 0.00, "closingStock": 0.00 },
    "sb": { "sales": 0.00, "closingStock": 0.00 },
    "sm": { "sales": 0.00, "closingStock": 0.00 }
  },
  "zarda": {
    "slb": { "sales": 0.01, "closingStock": 0.97 },
    "qty_22_25": { "sales": 5, "closingStock": 1298 },
    "qty_99_14": { "sales": 0, "closingStock": 0 },
    "qty_33_15": { "sales": 0, "closingStock": 0 }
  },
  "emptyPackets": 6660,
  "remarks": "Heavy rain affected afternoon route."
}
```
