# 06 - DAILY DATA WORKFLOW & APPROVAL LIFECYCLE

## 1. Workflow State Machine

The operational flow from daily field data entry to monthly cloud archiving follows a deterministic state machine:

```text
              ┌───────────────┐
              │     DRAFT     │◄───────────────────┐
              └───────┬───────┘                    │
                      │ (CSR submits)              │
                      ▼                            │
              ┌───────────────┐                    │
   ┌──────────┤   SUBMITTED   │                    │
   │ (TSO     └───────┬───────┘                    │
   │  rejects)        │ (TSO approves)             │
   │                  ▼                            │
   │          ┌───────────────┐                    │
   │ ┌────────┤ TSO_APPROVED  │                    │
   │ │(RSO    └───────┬───────┘                    │
   │ │rejects)        │ (RSO approves)             │
   │ │                ▼                            │
   │ │        ┌───────────────┐                    │
   │ │        │ RSO_APPROVED  │                    │
   │ │        └───────┬───────┘                    │
   │ │                │ (Super Admin finalizes)    │
   │ │                ▼                            │
   │ │        ┌───────────────┐                    │
   │ │        │   FINALIZED   │ (Locked)           │
   │ │        └───────┬───────┘                    │
   │ │                │ (Super Admin unlocks       │
   │ │                │  with reason)              │
   │ │                ▼                            │
   │ │        ┌───────────────┐                    │
   │ │        │    UNLOCKED   │────────────────────┘
   │ │        └───────────────┘
   ▼ ▼
┌───────────────┐
│   REJECTED    │──────────────────────────────────┘
└───────────────┘ (CSR edits & resubmits)
```

---

## 2. Transition Rules Matrix

| From Status | To Status | Triggered By | Required Permission | Conditions / Prerequisites |
| :--- | :--- | :--- | :--- | :--- |
| *(None)* | `DRAFT` | CSR / TSO | `sales.create` | Must match user's assigned territory. |
| `DRAFT` | `SUBMITTED` | CSR / TSO | `sales.submit` | All required brand sales and stock inputs filled. |
| `SUBMITTED` | `TSO_APPROVED` | TSO | `sales.approve.tso` | TSO verifies all routes in assigned territory. |
| `SUBMITTED` | `REJECTED` | TSO | `sales.reject.tso` | Mandatory comment detailing rejection reason. |
| `TSO_APPROVED` | `RSO_APPROVED` | RSO | `sales.approve.rso` | RSO verifies regional aggregations. |
| `TSO_APPROVED` | `REJECTED` | RSO | `sales.reject.rso` | Mandatory comment detailing rejection reason. |
| `RSO_APPROVED` | `FINALIZED` | SUPER_ADMIN | `sales.finalize` | Period complete; locks records (`is_locked = TRUE`). |
| `FINALIZED` | `UNLOCKED` | SUPER_ADMIN | `sales.unlock` | Mandatory `unlock_reason` logged in audit table. |
| `REJECTED` | `DRAFT` | CSR | `sales.update.draft`| Record unlocked for corrections by field CSR. |

---

## 3. Step-by-Step Operations

### Step 1: CSR Daily Field Entry
1. Field CSR logs into the mobile or desktop portal using Google OAuth.
2. Form defaults to current reporting date and assigned territory.
3. CSR inputs:
   - Cigarette Sales per Brand (Wilson, Shahara, Express, Nexus, SB, SM).
   - Cigarette Closing Stock per Brand.
   - Zarda Sales Quantities (SLB, 22/25, 99/14, 33/15).
   - Zarda Closing Stock Quantities.
   - Express Empty Packet collection count.
   - Route and market remarks.
4. Calculation engine previews `TOTAL SALES`, `TOTAL Stock`, `Zarda Sales Value`, and `Zarda Stock Value` in real time.
5. CSR clicks **"Save Draft"** or **"Submit for Review"**.

### Step 2: TSO Verification & Review
1. TSO logs in and navigates to the **Territory Verification Dashboard**.
2. TSO sees a list of submitted routes/outlets for that day.
3. TSO validates:
   - Physical sales consistency against previous day closing stock.
   - Empty packet return reasonableness.
4. If discrepancies exist, TSO enters remarks and clicks **"Reject"** (notifying CSR).
5. If valid, TSO clicks **"Approve Territory Data"**, transitioning status to `TSO_APPROVED`.

### Step 3: RSO Regional Verification
1. RSO navigates to the **Regional Operations Dashboard**.
2. RSO views territory comparison tables (Satkania, Kerani Hat, Bandarban, Rajasthali, Dohazari).
3. System highlights variance against target pacing and previous day numbers.
4. RSO performs regional sign-off by clicking **"Approve Regional Data"**, setting status to `RSO_APPROVED`.

### Step 4: Finalization & Archival
1. At month-end (or daily cut-off), Super Admin reviews regional status.
2. Super Admin clicks **"Finalize Period"**.
3. System:
   - Sets `status = 'FINALIZED'` and `is_locked = TRUE`.
   - Generates the authoritative 34-sheet Excel report.
   - Evaluates pre-export validation rules.
   - Stores file hash and uploads to Google Drive under `Afaz_Tobacco_Reports/YYYY/MM_Month/YYYY-MM-DD/`.
   - Emits audit log entry.
