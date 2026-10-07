# 09 - EXCEL FORMULAS & CALCULATION ENGINE SPECIFICATION

## 1. Overview & Formula Design Rules

To ensure 100% fidelity with the company's reporting workbook, this specification documents:
1. Every formula embedded into the 34-sheet exported workbook.
2. The TypeScript calculation engine logic powering the web application.

---

## 2. Daily Sheets (Sheets 1 through 31)

### 2.1 Territory Row Formulas (e.g., Rows 8–12)

| Col | Field Description | Excel Formula (Row $r$) | Calculation Engine (TypeScript) |
| :---: | :--- | :--- | :--- |
| **J** | Total Cigarette Sales | `=SUM(D{r}:I{r})` | `brands.sales.reduce((a, b) => a + b, 0)` |
| **Q** | Total Cigarette Closing Stock | `=SUM(K{r}:P{r})` | `brands.stock.reduce((a, b) => a + b, 0)` |
| **W** | Total Zarda Sales Value | `=S{r}*15+T{r}*6+U{r}*8` | `(qty_22_25 * 15) + (qty_99_14 * 6) + (qty_33_15 * 8)` |
| **AC**| Total Zarda Closing Stock Value | `=Y{r}*15+Z{r}*6+AA{r}*8`| `(stk_22_25 * 15) + (stk_99_14 * 6) + (stk_33_15 * 8)` |

*(Note: In row 8, $r=8$; in row 12, $r=12$.)*

---

### 2.2 Regional Total Row Formulas (e.g., Row 13 - Satkania Region Total)

For a region spanning territories in rows $r_{\text{start}}$ to $r_{\text{end}}$ (e.g., rows 8 through 12):

| Col | Field Description | Excel Formula | Calculation Engine (TypeScript) |
| :---: | :--- | :--- | :--- |
| **D** | Wilson Sales Total | `=SUM(D8:D12)` | `territories.map(t => t.wilson_sales).sum()` |
| **E** | Shahara Sales Total | `=SUM(E8:E12)` | `territories.map(t => t.shahara_sales).sum()` |
| **F** | Express Sales Total | `=SUM(F8:F12)` | `territories.map(t => t.express_sales).sum()` |
| **G** | Nexus Sales Total | `=SUM(G8:G12)` | `territories.map(t => t.nexus_sales).sum()` |
| **H** | SB Sales Total | `=SUM(H8:H12)` | `territories.map(t => t.sb_sales).sum()` |
| **I** | SM Sales Total | `=SUM(I8:I12)` | `territories.map(t => t.sm_sales).sum()` |
| **J** | Total Sales Grand Total | `=SUM(J8:J12)` | Sum of all territory total sales |
| **K** | Wilson Closing Stock Total | `=SUM(K8:K12)` | Sum of Wilson closing stocks |
| **Q** | Total Closing Stock Total | `=SUM(Q8:Q12)` | Sum of all territory total closing stock |
| **R** | Zarda SLB Sales Total | `=SUM(R8:R12)` | Sum of SLB sales quantities |
| **S** | Zarda 22/25 Sales Total | `=SUM(S8:S12)` | Sum of 22/25 sales quantities |
| **T** | Zarda 99/14 Sales Total | `=SUM(T8:T12)` | Sum of 99/14 sales quantities |
| **U** | Zarda 33/15 Sales Total | `=SUM(U8:U12)` | Sum of 33/15 sales quantities |
| **W** | Total Zarda Sales Value Total| `=SUM(W8:W12)` | Sum of territory Zarda sales values |
| **X** | Zarda SLB Stock Total | `=SUM(X8:X12)` | Sum of SLB stock quantities |
| **Y** | Zarda 22/25 Stock Total | `=SUM(Y8:Y12)` | Sum of 22/25 stock quantities |
| **Z** | Zarda 99/14 Stock Total | `=SUM(Z8:Z12)` | Sum of 99/14 stock quantities |
| **AA**| Zarda 33/15 Stock Total | `=SUM(AA8:AA12)`| Sum of 33/15 stock quantities |
| **AC**| Total Zarda Stock Value Total| `=SUM(AC8:AC12)`| Sum of territory Zarda stock values |
| **AD**| Empty Packet Total | `=SUM(AD8:AD12)`| Sum of Express empty packet returns |

---

## 3. Sheet 32: 'STD & ADS' (Sales-To-Date & Average Daily Sales)

### 3.1 Cumulative Sales (Days 1 to 31)
For each territory row $r$ and brand column $C$:
```text
='1'!C{r}+'2'!C{r}+'3'!C{r}+'4'!C{r}+'5'!C{r}+'6'!C{r}+'7'!C{r}+'8'!C{r}+'9'!C{r}+'10'!C{r}+
 '11'!C{r}+'12'!C{r}+'13'!C{r}+'14'!C{r}+'15'!C{r}+'16'!C{r}+'17'!C{r}+'18'!C{r}+'19'!C{r}+'20'!C{r}+
 '21'!C{r}+'22'!C{r}+'23'!C{r}+'24'!C{r}+'25'!C{r}+'26'!C{r}+'27'!C{r}+'28'!C{r}+'29'!C{r}+'30'!C{r}+'31'!C{r}
```
*(TypeScript Calculation Engine: Sum across array of loaded daily submissions for the month).*

### 3.2 Total STD & Average Daily Sales (ADS)
- **Total STD (Col J):** `=SUM(D{r}:I{r})`
- **Total Stock (Col Q):** Latest non-zero closing stock from active daily sheet.
- **Period ADS:** `STD / ConfiguredWorkingDays` (default 26).

---

## 4. Sheet 33: 'Target.'

- **Headers (Rows 1–4):** Linked dynamically to Sheet 1: `='1'!A1`, `='1'!A2`, `='1'!A3`, `='1'!A4`.
- **Total Target (Col J):** `=SUM(D{r}:I{r})`
- **Target ADS (Col K):** `=J{r}/26` *(or configured working days)*
- **Routes (Col L):** Count of active routes in territory.
- **Outlets (Col M):** Count of active retail outlets in territory.

---

## 5. Sheet 34: 'Analysis'

| Col | Metric | Excel Formula | Calculation Logic |
| :---: | :--- | :--- | :--- |
| **D** | LMS (Last Month Sales) | Database query value | Historical sales from preceding month |
| **E** | LM ADS (Last Month ADS) | `=D{r}/26` | LMS divided by working days |
| **F** | Target | `=Target.!J{r}` | Monthly sales quota from Target sheet |
| **G** | Target ADS (TADS) | `=F{r}/26` | Target divided by working days |
| **H** | STD (Sales-To-Date) | `='STD & ADS'!J{r}` | Total sales to date from STD sheet |
| **I** | Period ADS | `=H{r}/ActiveDays` | STD divided by working days elapsed |
| **J** | Required Remaining ADS | `=(F{r}-H{r})/(26-ActiveDays)` | Remaining target divided by remaining days |
| **K** | Achievement % | `=(H{r}/F{r})*100` | Percentage of target achieved |
| **L** | Projected Total Sales | `=I{r}*26` | Projected full month volume |
| **M** | Growth Variance vs. LMS | `=((L{r}-D{r})/D{r})*100` | Projected percentage growth over last month |

---

## 6. TypeScript Calculation Engine Reference Implementation

```typescript
export interface BrandData {
  wilson: number;
  shahara: number;
  express: number;
  nexus: number;
  sb: number;
  sm: number;
}

export interface ZardaData {
  slb: number;
  qty_22_25: number;
  qty_99_14: number;
  qty_33_15: number;
}

export const ZARDA_PRICES = {
  price_22_25: 15,
  price_99_14: 6,
  price_33_15: 8,
} as const;

export function calculateTotalSales(brands: BrandData): number {
  return (
    brands.wilson +
    brands.shahara +
    brands.express +
    brands.nexus +
    brands.sb +
    brands.sm
  );
}

export function calculateTotalStock(stocks: BrandData): number {
  return (
    stocks.wilson +
    stocks.shahara +
    stocks.express +
    stocks.nexus +
    stocks.sb +
    stocks.sm
  );
}

export function calculateZardaValue(zarda: ZardaData): number {
  return (
    zarda.qty_22_25 * ZARDA_PRICES.price_22_25 +
    zarda.qty_99_14 * ZARDA_PRICES.price_99_14 +
    zarda.qty_33_15 * ZARDA_PRICES.price_33_15
  );
}

export function calculateADS(std: number, workingDays: number = 26): number {
  if (workingDays <= 0) return 0;
  return std / workingDays;
}

export function calculateAchievement(std: number, target: number): number {
  if (target <= 0) return 0;
  return (std / target) * 100;
}
```
