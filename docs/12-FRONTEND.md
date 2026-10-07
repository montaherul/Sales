# 12 - FRONTEND UI/UX ARCHITECTURE & GUIDELINES

## 1. Design System & Tech Stack

The user interface must be modern, fast, accessible, and enterprise-grade.

### Core Stack
- **Framework:** Next.js (App Router) with React 19 & TypeScript.
- **Styling:** Tailwind CSS with CSS custom properties (tokens).
- **Component Library:** shadcn/ui built on accessible Radix UI primitives.
- **Data Grids:** TanStack Table v8 for high-performance multi-brand sales sheets.
- **Server Cache & State:** TanStack Query v5 for optimistic updates and caching.
- **Data Visualization:** Recharts for sales trends, pacing charts, and regional comparisons.
- **Icons:** Lucide React.

---

## 2. Core UI Components

### 2.1 Daily Operational Data Entry Grid (`DailySalesGrid.tsx`)
- Tabular data entry layout matching field operational habits.
- Numeric inputs with automatic tab navigation between brand columns.
- Sticky headers for Brand columns (`Wilson`, `Shahara`, `Express`, `Nexus`, `SB`, `SM`, `SLB`, `22/25`, `99/14`, `33/15`).
- Automatic real-time totals row updating via client calculation engine (never waiting for server roundtrip).
- Distinct visual styling for formula summary cells (shaded background, lock icon) to show they are non-editable calculations.

### 2.2 Territory & Regional Approval Center (`ApprovalHub.tsx`)
- Filterable queue sorted by date, region, territory, and status.
- Color-coded status badges:
  - `DRAFT`: Gray
  - `SUBMITTED`: Blue
  - `TSO_APPROVED`: Amber
  - `RSO_APPROVED`: Purple
  - `FINALIZED`: Emerald
  - `REJECTED`: Rose
- One-click action dialogs:
  - **Approve Dialog:** Displays submission summary with confirmation button.
  - **Reject Dialog:** Requires a mandatory text input explaining the discrepancy.

### 2.3 XLSX Import Drawer & Date Safety Inspector (`ImportModal.tsx`)
- Drag-and-drop file upload zone.
- Real-time pre-flight verification card displaying:
  - Detected Month, Year, and Day.
  - Filename Date vs. Selected Application Date vs. Workbook Header Date.
  - Visual status pill (Green = Matches; Red = Mismatch with Import Blocked banner).
- 34-Sheet structure verification checklist.
- Validation Errors Accordion listing exact Sheet, Row, Column, and Reason.
- Data Preview Table before final commit.

### 2.4 Google Drive Cloud Archival Panel (`DriveUploadWidget.tsx`)
- Visible exclusively to users with `SUPER_ADMIN` role.
- Displays target folder path (`Afaz_Tobacco_Reports/YYYY/MM_Month/YYYY-MM-DD/`).
- Shows file SHA-256 hash and file size.
- Pre-upload validation status indicator.
- Upload progress bar and direct link to view file in Google Drive.

---

## 3. Frontend Architecture Rules

1. **No Math in Presentational Components:** All sums, valuations, ADS, STD, and achievement percentages must be calculated by the central `@/lib/calculations` engine or provided by API responses.
2. **Centralized Query Hooks:** API interactions must use strongly typed custom hooks (e.g., `useDailySubmissions`, `useApproveSubmission`, `useImportXLSX`).
3. **Permission-Driven UI:** Navigation menus and interactive controls must check user permissions and scopes via `useAuth()` and `usePermission()` hooks.
4. **Defense in Depth:** Hiding a button in the UI is a UX convenience, NOT a security control. All actions are authenticated and authorized on the server and database.
5. **Mobile Responsiveness:** Daily data entry forms must be touch-friendly and fully responsive on mobile screens (viewport $\ge 375\text{px}$) for field CSRs.
