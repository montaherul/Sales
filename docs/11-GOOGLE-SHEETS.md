# 11 - GOOGLE SHEETS SYNCHRONIZATION SPECIFICATION

## 1. Architectural Role & Boundary

> **PostgreSQL is the PRIMARY source of truth.**  
> Google Sheets is strictly a read-only reporting and synchronization layer.

Under no circumstances may Google Sheets be used as a transactional database or primary operational datastore.

```text
[Supabase PostgreSQL] ────► [Sync Engine] ────► [Google Sheets API v4] ────► [Executive Sheets]
        ▲
        │
   (Direct writes from Google Sheets back into PostgreSQL are STRICTLY FORBIDDEN.
    All data ingests must pass through the verified XLSX Import Pipeline.)
```

---

## 2. Synchronization Mechanics

### 2.1 Sync Triggers
1. **Manual On-Demand Sync:** Initiated by `SUPER_ADMIN` from the admin control panel.
2. **Post-Finalization Hook:** Automatically triggered when a daily or monthly period is marked `FINALIZED`.

### 2.2 API & Quota Management
- **API Version:** Google Sheets API v4 (`sheets.googleapis.com/v4`).
- **Batching Strategy:** Use `spreadsheets.values.batchUpdate` to write entire ranges in a single HTTP request rather than cell-by-cell calls.
- **Rate Limit Safeguards:** Google Sheets API limits requests to 300 per minute per project (60 per minute per user). Sync jobs must buffer and rate-limit calls.

---

## 3. Data Mapping & Sheet Layout

When syncing a month's report to Google Sheets:
- Sheets are titled `1` through `31`, `STD & ADS`, `Target.`, and `Analysis`.
- Raw inputs are synchronized from PostgreSQL.
- Formulas matching the authoritative template are written to calculated cells.
- Conditional formatting and styling are synchronized once during sheet initialization.

---

## 4. Sync Tracking Schema (`google_sheet_syncs`)

```sql
CREATE TABLE google_sheet_syncs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id VARCHAR(255) NOT NULL,
    spreadsheet_url TEXT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    report_date DATE,
    sync_status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED', 'IN_PROGRESS'
    synced_by UUID REFERENCES user_profiles(id) NOT NULL,
    records_synced INT DEFAULT 0,
    error_message TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Security & Isolation

- Google Service Account requires `https://www.googleapis.com/auth/spreadsheets` scope.
- Service Account email must be granted Editor access only on dedicated enterprise reporting folders.
- Field users (CSR, TSO, RSO) have no access to alter sync configurations.
