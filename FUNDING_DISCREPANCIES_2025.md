# Funding Discrepancies Analysis - 2025

## Comparison: promote.hive.io vs Our Application

**Date:** December 5, 2025  
**Source:** https://promote.hive.io/metrics/valueplan?year=2025

---

## Key Metrics Comparison

### Website (promote.hive.io) - 2025 Data

| Metric | Value |
|--------|-------|
| **Total Amount** | 1,123,841.2 HBD |
| **Total Refunds** | 12,914.6 HBD |
| **Total Loans** | 35,576.53 HBD |
| **Total Loan Refunds** | 57,662.07 HBD |
| **Average Hive Price** | 0.24 HBD |
| **Total Issued (HBD)** | 930,295.88 HBD |
| **Total Refunds (HBD)** | 12,914.34 HBD |
| **Total Loans (HBD)** | 15,551 HBD |
| **Total Loan Refunds (HBD)** | 43,721 HBD |
| **Total Issued (HIVE)** | 882,208.25 HIVE (193,545.32 HBD) |
| **Total Refunds (HIVE)** | 2 HIVE (0.26 HBD) |
| **Total Loans (HIVE)** | 92,325 HIVE (20,025.53 HBD) |
| **Total Loan Refunds (HIVE)** | 92,325 HIVE (13,941.07 HBD) |

### Our Application - Current State

**Issue:** Our application does NOT filter by year. It calculates metrics from ALL transactions in the CSV (likely including 2023, 2024, and 2025 data).

**Current Implementation:**
- `/api/metrics` endpoint processes ALL transactions without year filtering
- No distinction between loans and regular payments
- No tracking of refunds separately
- HIVE to HBD conversion uses hardcoded rate of 0.9 (incorrect - should use 0.24 for 2025)

---

## Critical Discrepancies

### 1. **Year Filtering Missing**
- **Problem:** Our metrics API doesn't filter transactions by year
- **Impact:** Metrics include data from multiple years (2023, 2024, 2025)
- **Expected:** Only 2025 data should be included in 2025 metrics
- **Location:** `app/api/metrics/route.ts` - no year filtering applied

### 2. **Loan Tracking Not Implemented**
- **Problem:** Our application doesn't distinguish between loans and regular payments
- **Website Shows:**
  - Total Loans: 35,576.53 HBD
  - Total Loan Refunds: 57,662.07 HBD
- **Impact:** Cannot track loan activity separately
- **Location:** Transaction type not captured in our data model

### 3. **Refund Tracking Not Separated**
- **Problem:** Refunds are not tracked separately from regular transactions
- **Website Shows:**
  - Total Refunds: 12,914.6 HBD
  - Total Refunds (HBD): 12,914.34 HBD
  - Total Refunds (HIVE): 2 HIVE (0.26 HBD)
- **Impact:** Cannot distinguish between payments and refunds
- **Location:** No refund flag/type in transaction data model

### 4. **Incorrect HIVE to HBD Conversion Rate**
- **Problem:** Hardcoded conversion rate of 0.9 in `lib/utils/data.ts`
- **Website Uses:** 0.24 HBD per HIVE (average for 2025)
- **Current Code:**
  ```typescript
  export function convertHiveToHbd(hive: number): number {
    const conversionRate = 0.9; // Placeholder - WRONG!
    return hive * conversionRate;
  }
  ```
- **Impact:** HIVE amounts converted to HBD are significantly inflated
- **Example:** 882,208.25 HIVE should be 193,545.32 HBD (at 0.24 rate), but our app calculates 794,000 HBD (at 0.9 rate) - **3.1x higher!**

### 5. **Missing Transaction Type Classification**
- **Problem:** No way to distinguish between:
  - Regular payments
  - Loans
  - Refunds
  - Loan refunds
- **Impact:** Cannot replicate the website's detailed breakdown

### 6. **Data Source Alignment**
- **Problem:** Unclear if our Google Sheets CSV includes all the same data as the website's source
- **Website Source:** Unknown (likely blockchain data or different spreadsheet)
- **Our Source:** Google Sheets (`1tqPtEbS5EsajO-kgEgNtK1-eqXdZS8IOLaZ0CRKBrN4`)
- **Impact:** May be tracking different data sources entirely

---

## Geographic Distribution Comparison

### Website Shows (2025):
- Venezuela: 227,577.46 HBD
- Global: 155,947.06 HBD
- India: 85,208.00 HBD
- Ghana: 75,106.00 HBD
- Italy: 53,780.96 HBD
- USA: 52,232.65 HBD
- ... (37 total countries/locations)

**Note:** Our application tracks country data, but without year filtering, it includes all years.

---

## Wallet Distribution Comparison

### Website Shows (2025):
- Top wallet: swc-oficial (73,330.84 HBD)
- Total entries: 93 wallets
- Total amount: 1,123,841.21 HBD

**Note:** Our application tracks wallet data, but aggregates across all years.

---

## Recommendations

### Immediate Actions Required:

1. **Add Year Filtering to Metrics API**
   - Modify `/api/metrics/route.ts` to accept a `year` query parameter
   - Filter transactions by year before calculating metrics
   - Update frontend to pass year parameter (default to 2025)

2. **Fix HIVE to HBD Conversion Rate**
   - Replace hardcoded 0.9 with actual average price (0.24 for 2025)
   - Consider fetching real-time or historical rates
   - Update `convertHiveToHbd()` function in `lib/utils/data.ts`

3. **Add Transaction Type Classification**
   - Extend Transaction interface to include `type` field (payment, loan, refund, loan_refund)
   - Update CSV parsing to identify transaction types
   - May require manual classification or pattern matching

4. **Separate Refund Tracking**
   - Add refund flag to transaction model
   - Calculate refund totals separately
   - Display refunds in metrics dashboard

5. **Add Loan Tracking**
   - Identify loan transactions in data
   - Track loan amounts separately
   - Track loan refunds separately

6. **Verify Data Source Alignment**
   - Confirm if website uses same Google Sheets source
   - If different source, identify the discrepancy
   - Ensure all transactions are captured

### Code Changes Needed:

1. **`app/api/metrics/route.ts`**
   - Add year query parameter
   - Filter transactions by year before calculation
   - Add separate calculations for loans and refunds

2. **`lib/utils/data.ts`**
   - Fix `convertHiveToHbd()` to use correct rate (0.24 for 2025)
   - Add functions to calculate loans and refunds separately

3. **`lib/types/index.ts`**
   - Add `type` field to Transaction interface
   - Add `isRefund` and `isLoan` flags if needed

4. **`app/api/transactions/route.ts`**
   - Update CSV parsing to identify transaction types
   - Classify loans and refunds

---

## Summary

The primary discrepancy is that **our application doesn't filter by year**, so it's showing aggregated data from multiple years instead of just 2025. Additionally, we're missing:

- Loan tracking (35,576.53 HBD in loans)
- Refund tracking (12,914.6 HBD in refunds)
- Correct HIVE conversion rate (using 0.9 instead of 0.24)

The most critical fix is adding year filtering and correcting the HIVE conversion rate, as these significantly impact the accuracy of all metrics.

