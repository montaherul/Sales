# 16 - REPORTING & ANALYTICS SPECIFICATION

## 1. Overview & Reporting Goals

The platform provides role-tailored real-time dashboards and reports that bridge high-level executive decision-making and granular field route execution.

---

## 2. Executive Analytics Dashboard (Super Admin & RSO)

### 2.1 Core Key Performance Indicators (KPIs)
- **Month-to-Date (MTD) Total Sales:** Total cigarette volume across all regions in Millions (Mio).
- **Target Achievement Rate:** Cumulative STD compared against configured monthly quota ($(\text{STD} / \text{Target}) \times 100$).
- **Average Daily Sales (ADS):** Actual daily run rate vs. required Target ADS ($Target / 26$).
- **Projected Month-End Volume:** Forecasted sales run rate ($\text{Period ADS} \times 26$).
- **Total Zarda Revenue:** Combined BDT revenue from 22/25, 99/14, 33/15, and SLB.
- **Packet Collection Total:** Total Express empty packets recovered.

### 2.2 Visual Charts (Recharts)
- **Daily Sales Pacing (Line Chart):** Actual daily sales vs. Target ADS baseline across Days 1 to 31.
- **Brand Share Breakdown (Donut Chart):** Volume percentage per brand (Wilson, Shahara, Express, Nexus, SB, SM).
- **Territory Leaderboard (Bar Chart):** Achievement percentage ranking by territory (Kerani Hat, Satkania, Bandarban, Rajasthali, Dohazari).
- **Stock Coverage Alert (Heatmap):** Flags territories where closing stock is less than 2 days of Average Daily Sales (OOS risk).

---

## 3. Territory Operational Dashboard (TSO)

- **Route Performance Grid:** Compares active routes in the territory against their expected targets.
- **Inventory Reconciliation:** Validates Closing Stock = Previous Closing Stock + Inbound Supply - Sales.
- **Empty Packet Tracker:** Monitors retail return rate of Express packaging.

---

## 4. Field Performance View (CSR)

- **Daily Log Status:** Shows today's entry status (`DRAFT`, `SUBMITTED`, `APPROVED`, or `REJECTED`).
- **Submission Timeline:** Chronological feed of past entries and reviewer remarks.
- **Personal Route Sales Total:** Real-time feedback on daily sticks sold.
