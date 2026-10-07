# 05 - BUSINESS RULES SPECIFICATION

This document outlines the strict business rules governing the Afaz Tobacco Sales & Stock Intelligence Platform.

---

## 1. Operational Roles & Data Entry Rules

### 1.1 CSR Data Entry Restrictions
- **Drafts Only:** A CSR may only edit records when the submission status is `DRAFT`.
- **Submission Immutability:** Once a CSR submits an entry (`SUBMITTED`), it becomes read-only for that CSR.
- **Rejection Flow:** If a submission is rejected by a TSO or RSO, its status returns to `REJECTED`. The CSR may then edit and re-submit the record.
- **Scope Isolation:** A CSR can only create or view records for their assigned routes and territory.

### 1.2 TSO Verification & Review
- **Territory Boundary:** A TSO can only access submissions from territories explicitly assigned in their `user_scopes`.
- **Pre-Approval Edits:** A TSO may make permitted operational corrections to a submission before approving it. Any change made by a TSO must automatically generate a version snapshot in `submission_versions`.
- **Approval Transition:** Approving transitions the status from `SUBMITTED` to `TSO_APPROVED`.
- **Rejection Requirement:** Rejecting requires a mandatory textual reason (e.g., "Mismatched closing stock on Express brand").

### 1.3 RSO Regional Sign-Off
- **Regional Boundary:** An RSO can only access submissions from territories within their assigned `region_id`.
- **Prerequisite:** An RSO may only review and approve submissions that are already in `TSO_APPROVED` status.
- **Rejection Flow:** An RSO may reject a submission back to `REJECTED`, notifying both the TSO and CSR.

### 1.4 Finalization & Super Admin Unlock
- **Immutability:** Once a month or day is marked as `FINALIZED`, the `is_locked` flag is set to `TRUE`. All modifications by field staff are blocked at the database level.
- **Super Admin Unlock:** Only a user with the `SUPER_ADMIN` role may unlock a locked record.
- **Mandatory Unlock Reason:** An unlock mutation MUST provide a non-empty `unlock_reason`. The system records the user ID, timestamp, and reason into `audit_logs` and `daily_submissions`.

---

## 2. Calculation Rules & Mathematics

### 2.1 Cigarette Calculations
- **Total Daily Sales per Territory:**
  $$\text{Total Sales} = \sum (\text{Wilson} + \text{Shahara} + \text{Express} + \text{Nexus} + \text{SB} + \text{SM})$$
  *(Excel equivalent: `=SUM(D8:I8)`)*
- **Total Daily Closing Stock per Territory:**
  $$\text{Total Stock} = \sum (\text{Wilson} + \text{Shahara} + \text{Express} + \text{Nexus} + \text{SB} + \text{SM})$$
  *(Excel equivalent: `=SUM(K8:P8)`)*
- **Regional Total Sales / Stock:** Sum of the corresponding columns across all territories within the region. *(Excel equivalent: `=SUM(D8:D12)`)*

### 2.2 Zarda Valuation Rules
Zarda products carry brand-specific unit prices (in BDT):
- **22/25:** 15 BDT / unit
- **99/14:** 6 BDT / unit
- **33/15:** 8 BDT / unit
- **SLB:** Tracked by volume (price configured per campaign)

**Calculations:**
- **Total Zarda Sales Value:**
  $$\text{Sales Value} = (Q_{22/25} \times 15) + (Q_{99/14} \times 6) + (Q_{33/15} \times 8)$$
  *(Excel equivalent: `=S8*15+T8*6+U8*8`)*
- **Total Zarda Closing Stock Value:**
  $$\text{Stock Value} = (S_{22/25} \times 15) + (S_{99/14} \times 6) + (S_{33/15} \times 8)$$
  *(Excel equivalent: `=Y8*15+Z8*6+AA8*8`)*

### 2.3 Working Days Rule
- **Default Value:** 26 working days per calendar month.
- **Configurability:** Super Admin may override the working days count for any specific year/month via `working_days` table.
- **Never Hardcode:** All backend and calculation engine functions must query the active `working_days` configuration for the given period.

### 2.4 Sales-to-Date (STD) & Average Daily Sales (ADS)
- **STD (Sales-to-Date):** Sum of daily sales from Day 1 through Day 31:
  $$\text{STD} = \sum_{d=1}^{31} \text{Sales}_d$$
- **Target ADS:**
  $$\text{Target ADS} = \frac{\text{Monthly Target}}{\text{Configured Working Days (26)}}$$
- **Current ADS (Period ADS):**
  $$\text{Period ADS} = \frac{\text{STD}}{\text{Active Working Days Elapsed}}$$
- **Achievement Percentage:**
  $$\text{Achievement \%} = \left(\frac{\text{STD}}{\text{Monthly Target}}\right) \times 100$$
- **Projected Sales:**
  $$\text{Projected} = \text{Period ADS} \times \text{Configured Working Days}$$

---

## 3. Data Integrity & Historical Safety

### 3.1 Historical Immutability
- **No Silent Updates:** Direct updates without audit logs or versioning are prohibited.
- **Version Snapshots:** Whenever operational data is updated after submission, a JSONB snapshot is committed to `submission_versions`.
- **Soft Deletion:** Master data entities (brands, territories, routes, outlets) cannot be deleted if historical transaction records reference them. They must use `is_active = FALSE`.

### 3.2 Date Validation Rules (Anti-Tampering)
Whenever an Excel file is imported or a manual daily log is saved, four dates must match identically:
1. Application selected date
2. Filename date string (e.g., `October 6 2026`)
3. Internal workbook date header (e.g., `Date:06.10.2026`)
4. Daily sheet number (Sheet `6`)

**If any conflict is detected, the operation is IMMEDIATELY BLOCKED.** The system must never guess or auto-adjust dates.

### 3.3 Duplicate Import Policy
If an imported record matches an existing `(territory_id, report_date)`:
- Automatic overwrite is prohibited.
- The user is presented with three explicit choices:
  1. **Cancel:** Abort import completely.
  2. **Create Revision:** Save as a new version pending approval.
  3. **Request Replacement:** (Restricted to Super Admin) Overwrite with mandatory audit logging.
