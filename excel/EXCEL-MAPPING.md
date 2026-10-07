# EXCEL TEMPLATE CELL & SHEET MAPPING SPECIFICATION

## 1. Authoritative Reference Workbook

- **Template Path:** `excel/TEMPLATE.xlsx`
- **Total Worksheets:** 34
- **Sheet Names:** `'1'`, `'2'`, `'3'`, ..., `'31'`, `'STD & ADS'`, `'Target.'`, `'Analysis'`

---

## 2. Daily Sheets (Sheets '1' through '31') Grid Architecture

### 2.1 Header Blocks (Rows 1–5)

| Cell Range | Field Content / Purpose | Merged Range | Formatting & Style |
| :--- | :--- | :--- | :--- |
| **A1:AF1** | `Afaz Tobacco  Company .` | `A1:AF1` | Centered, Bold, Title Font |
| **A2:AF2** | `Marketing Department` | `A2:AF2` | Centered, Bold, Subtitle |
| **A3:AF3** | `Month:{Month}-{Year}` (e.g., `Month:October-2026`) | `A3:AF3` | Centered, Bold |
| **A4:AF4** | `Daily Sales & Closing Stock Information.` | `A4:AF4` | Centered, Bold |
| **B5:C5** | `Date:{DD.MM.YYYY}` (e.g., `Date:01.10.2026`) | None / Left | Left Aligned, Bold |
| **G5:I5** | `Division: Ctg South` | `G5:I5` | Centered, Bold |
| **U5:W5** | `Wing: Chittagong` | `U5:W5` | Left Aligned, Bold |

---

### 2.2 Table Column Structure (Rows 6–7)

| Col | Row 6 (Group Header) | Row 7 (Brand / Item Sub-header) | Data Type | Notes / Calculations |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `SL. NO` | *(Merged with A6)* | Integer / Label | Row Serial No. or Region Total |
| **B** | `Name of Region` | *(Merged with B6)* | Text | e.g., Satkania |
| **C** | `Name of Territory` | *(Merged with C6)* | Text | e.g., Kerani hat, Bandarban |
| **D** | `Brand wise Sales (BITCL)` | `Wilson` | Decimal (Mio) | Raw Input (Cigarette Sales) |
| **E** | *(Sales)* | `Shahara` | Decimal (Mio) | Raw Input (Cigarette Sales) |
| **F** | *(Sales)* | `Express ` | Decimal (Mio) | Raw Input (Cigarette Sales) |
| **G** | *(Sales)* | `Nexus ` | Decimal (Mio) | Raw Input (Cigarette Sales) |
| **H** | *(Sales)* | `SB` | Decimal (Mio) | Raw Input (Cigarette Sales) |
| **I** | *(Sales)* | `SM` | Decimal (Mio) | Raw Input (Cigarette Sales) |
| **J** | `TOTAL SALES` | *(Merged with J6)* | Decimal (Mio) | **Formula:** `=SUM(D{r}:I{r})` |
| **K** | `Brand Wise Closing Stock` | `Wilson` | Decimal (Mio) | Raw Input (Closing Stock) |
| **L** | *(Stock)* | `Shahara` | Decimal (Mio) | Raw Input (Closing Stock) |
| **M** | *(Stock)* | `Express ` | Decimal (Mio) | Raw Input (Closing Stock) |
| **N** | *(Stock)* | `Nexus ` | Decimal (Mio) | Raw Input (Closing Stock) |
| **O** | *(Stock)* | `SB` | Decimal (Mio) | Raw Input (Closing Stock) |
| **P** | *(Stock)* | `SM` | Decimal (Mio) | Raw Input (Closing Stock) |
| **Q** | `TOTAL Stock` | *(Merged with Q6)* | Decimal (Mio) | **Formula:** `=SUM(K{r}:P{r})` |
| **R** | `Brand wise Sales [Zarda]` | `SLB` | Decimal / Qty | Raw Input (Zarda Sales) |
| **S** | *(Zarda Sales)* | `22/25` | Integer / Qty | Raw Input (Zarda Sales, Price=15) |
| **T** | *(Zarda Sales)* | `99/14` | Integer / Qty | Raw Input (Zarda Sales, Price=6) |
| **U** | *(Zarda Sales)* | `33/15` | Integer / Qty | Raw Input (Zarda Sales, Price=8) |
| **V** | *(Zarda Sales)* | *(Blank)* | Numeric | Reserved |
| **W** | `Total Zarda Sales Value` | *(Merged with W6)* | Currency (BDT) | **Formula:** `=S{r}*15+T{r}*6+U{r}*8` |
| **X** | `Brand Wise Closing Stock [Zarda]` | `SLB` | Decimal / Qty | Raw Input (Zarda Stock) |
| **Y** | *(Zarda Stock)* | `22/25` | Integer / Qty | Raw Input (Zarda Stock, Price=15) |
| **Z** | *(Zarda Stock)* | `99/14` | Integer / Qty | Raw Input (Zarda Stock, Price=6) |
| **AA**| *(Zarda Stock)* | `33/15` | Integer / Qty | Raw Input (Zarda Stock, Price=8) |
| **AB**| *(Zarda Stock)* | *(Blank)* | Numeric | Reserved |
| **AC**| `Total Zarda C.Stock Value` | *(Merged with AC6)*| Currency (BDT) | **Formula:** `=Y{r}*15+Z{r}*6+AA{r}*8` |
| **AD**| `Express Empty Packet` | *(Merged with AD6)*| Integer (Count) | Raw Input (Empty Packets) |
| **AE**| `Remark` | *(Merged with AE6)*| Text | Operational field remarks |

---

### 2.3 Row-by-Row Layout (Satkania Region Example)

| Row Index | Column A | Column B | Column C | Key Formulas Generated |
| :---: | :--- | :--- | :--- | :--- |
| **Row 8** | `1` | `Satkania` | `Kerani hat` | `J8=SUM(D8:I8)`, `Q8=SUM(K8:P8)`, `W8=S8*15+T8*6+U8*8`, `AC8=Y8*15+Z8*6+AA8*8` |
| **Row 9** | `2` | *(Blank)* | `Satkania` | `J9=SUM(D9:I9)`, `Q9=SUM(K9:P9)`, `W9=S9*15+T9*6+U9*8`, `AC9=Y9*15+Z9*6+AA9*8` |
| **Row 10**| `3` | *(Blank)* | `Bandarban` | `J10=SUM(D10:I10)`, `Q10=SUM(K10:P10)`, `W10=S10*15+T10*6+U10*8`, `AC10=Y10*15+Z10*6+AA10*8` |
| **Row 11**| `4` | *(Blank)* | `Rajasthali`| `J11=SUM(D11:I11)`, `Q11=SUM(K11:P11)`, `W11=S11*15+T11*6+U11*8`, `AC11=Y11*15+Z11*6+AA11*8` |
| **Row 12**| `5` | *(Blank)* | `Dohazari` | `J12=SUM(D12:I12)`, `Q12=SUM(K12:P12)`, `W12=S12*15+T12*6+U12*8`, `AC12=Y12*15+Z12*6+AA12*8` |
| **Row 13**| `Satkania Region Total` | *(Blank)* | *(Blank)* | Regional Sums across Rows 8–12: `D13=SUM(D8:D12)`, `J13=SUM(J8:J12)`, `Q13=SUM(Q8:Q12)`, `W13=SUM(W8:W12)`, `AC13=SUM(AC8:AC12)`, `AD13=SUM(AD8:AD12)` |

---

## 3. Sheet 32 ('STD & ADS') Mapping

- **Header Rows 1–5:** Same structure as Daily Sheets.
- **Row 6–7:** Columns match Daily Sheet brand headers.
- **Sales Columns (D–I, R–U):** Contain 31-day summation formula referencing daily sheets:
  $$=\text{'1'!D8}+\text{'2'!D8}+\dots+\text{'31'!D8}$$
- **Closing Stock Columns (K–P, X–AA):** Latest recorded closing stock value.
- **ADS Column:** Cumulative sales divided by working days ($=D8/26$).

---

## 4. Sheet 33 ('Target.') Mapping

- **Headers (Rows 1–4):** Dynamically referenced from Sheet 1: `='1'!A1`, `='1'!A2`, etc.
- **Row 5:** Header text: `Date: Target of October 2026`.
- **Column Structure:**
  - Col A: `SL. NO`
  - Col B: `Name of Region`
  - Col C: `Name of Territory`
  - Col D–I: Brand Target Quantities (Wilson, Shahara, Express, Nexus, SB, SM)
  - Col J: `TOTAL TARGET` (`=SUM(D8:I8)`)
  - Col K: `TARGET ADS` (`=J8/26`)
  - Col L: `No of Route` (Integer count of routes)
  - Col M: `No of Outlet` (Integer count of retail outlets)

---

## 5. Sheet 34 ('Analysis') Mapping

- **Headers:** References `='1'!A1`, `='1'!A2`, `='1'!A3`, `='1'!A4`.
- **Row 5:** `Daily Analysis`.
- **Row 7:** Metrics Header:
  - Col A: `SL. NO`
  - Col B: `Name of Region`
  - Col C: `Name of Territory`
  - Col D: `LMS ` (Last Month Sales)
  - Col E: `LM ADS` (`=D8/26`)
  - Col F: `TARGET` (`=Target.!J8`)
  - Col G: `TADS` (`='STD & ADS'!Q8` or Target ADS)
  - Col H: `STD` (`='STD & ADS'!J8`)
  - Col I: `Period ADS`
  - Col J: `Remaining ADS`
  - Col K: `Achievement %` (`=(H8/F8)*100`)
  - Col L: `Projection` (`=I8*26`)
  - Col M: `Growth %` (`=((L8-D8)/D8)*100`)
