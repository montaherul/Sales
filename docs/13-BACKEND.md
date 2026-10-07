# 13 - BACKEND API & SERVICE ARCHITECTURE

## 1. Backend Service Layer Pattern

The backend is structured into clean, decoupled layers using Next.js Route Handlers and Server Actions:

```text
HTTP Request
     │
     ▼
Route Handler / Server Action
     │
     ▼
Authentication & Scoped Authorization Middleware
     │
     ▼
Zod Input Validation (Fail Fast)
     │
     ▼
Domain Service Layer (Business Logic & Transactions)
     │
     ▼
Repository Layer (Database Queries & Supabase Client)
     │
     ▼
PostgreSQL Database
```

---

## 2. API Endpoints Catalog

### 2.1 Daily Submissions & Operational Data
- `GET /api/daily-submissions`: List submissions filtered by date, month, region, territory, or status.
- `POST /api/daily-submissions`: Create a new daily draft (`sales.create`).
- `GET /api/daily-submissions/:id`: Retrieve single submission with brand-level breakdown.
- `PATCH /api/daily-submissions/:id`: Update draft or permitted values.
- `POST /api/daily-submissions/:id/submit`: Submit draft to TSO queue (`sales.submit`).
- `POST /api/daily-submissions/:id/approve`: Approve submission (`sales.approve.tso` or `sales.approve.rso`).
- `POST /api/daily-submissions/:id/reject`: Reject submission with mandatory feedback (`sales.reject.tso` or `sales.reject.rso`).
- `POST /api/daily-submissions/:id/finalize`: Finalize and lock period (`sales.finalize`).
- `POST /api/daily-submissions/:id/unlock`: Super Admin unlock with mandatory reason (`sales.unlock`).

### 2.2 Excel Import & Export
- `POST /api/imports/xlsx/validate`: Upload workbook, perform pre-flight checks, return preview & error list.
- `POST /api/imports/xlsx/commit`: Execute atomic database transaction to import validated records.
- `GET /api/exports/xlsx`: Generate and stream the authoritative 34-sheet monthly Excel workbook.

### 2.3 Cloud Integrations & System Administration
- `POST /api/google-drive/upload`: Trigger Super Admin cloud upload to structured drive folder.
- `GET /api/google-drive/status`: Check Drive archive status and file links.
- `POST /api/google-sheets/sync`: Synchronize database records to Google Sheets.
- `GET /api/audit-logs`: Query immutable event history (`audit.view`).
- `GET /api/master/targets`: Query territory sales quotas.
- `POST /api/master/targets`: Create or update monthly quotas (`master.targets.manage`).

---

## 3. Standardized Error Response Format

All API errors adhere to a uniform JSON envelope:

```typescript
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  operationId: string;
  timestamp: string;
  validationErrors?: Array<{
    field: string;
    message: string;
    sheet?: string;
    row?: number;
    col?: string;
  }>;
}
```

### Concrete Example:
```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "ERR_DATE_MISMATCH",
  "message": "Filename date does not match selected application reporting date.",
  "operationId": "op_9f82d1c7a4b",
  "timestamp": "2026-10-07T14:10:00Z",
  "validationErrors": [
    {
      "field": "reportDate",
      "message": "Filename specified 2026-10-05, but UI selected 2026-10-06."
    }
  ]
}
```

---

## 4. Input Validation with Zod

Every incoming payload is validated with strict Zod schemas before hitting business services:

```typescript
import { z } from 'zod';

export const BrandEntrySchema = z.object({
  brandId: z.string().uuid(),
  salesQuantity: z.number().min(0, "Sales quantity cannot be negative"),
  closingStock: z.number().min(0, "Closing stock cannot be negative"),
});

export const SubmitDailyLogSchema = z.object({
  territoryId: z.string().uuid(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  cigaretteEntries: z.array(BrandEntrySchema).min(1),
  zardaEntries: z.array(z.object({
    brandId: z.string().uuid(),
    salesQuantity: z.number().min(0),
    closingStock: z.number().min(0),
  })),
  emptyPackets: z.number().int().min(0),
  remarks: z.string().max(500).optional(),
});
```
