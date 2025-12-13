# Data Comparison Report: HiveSQL vs Google Sheets (2025)

## Summary

This report compares the blockchain data from HiveSQL with the manual entries in Google Sheets for the valueplan wallet in 2025.

---

## Overall Comparison

| Metric | Google Sheets | HiveSQL | Difference | Difference % |
|--------|---------------|---------|------------|--------------|
| **Total HBD** | 906,483.38 | 936,953.02 | **-30,469.64** | **-3.36%** |
| **Total HIVE** | 789,881.26 | 882,208.25 | **-92,326.98** | **-11.69%** |
| **Transaction Count** | 339 | 367 | **-28** | **-8.26%** |

### Key Findings:

1. **HiveSQL has MORE transactions** - 28 additional transactions (367 vs 339)
2. **HiveSQL shows HIGHER totals** - Missing 30,469.64 HBD and 92,326.98 HIVE in Google Sheets
3. **HiveSQL is the authoritative source** - It's the actual blockchain data

---

## Missing in Google Sheets (in HiveSQL but not recorded)

**35 transactions found in HiveSQL but missing from Google Sheets:**

Total missing amounts:
- **HBD:** ~65,000+ (from sample)
- **HIVE:** ~92,326.98

**Sample of missing transactions:**
- Loans received (from alpha, blocktrades, blackheart1, etc.)
- Various transfers not recorded in the manual spreadsheet

**Possible reasons:**
- Loans might be tracked separately
- Some transactions may not have been manually entered
- Transfers might have been missed during manual entry
- Incoming transfers (loans) may be excluded from the main spreadsheet

---

## Missing in HiveSQL (in Google Sheets but not in blockchain)

**4 transactions found in Google Sheets but NOT in HiveSQL:**

| Date | Wallet | Amount (HBD) |
|------|--------|--------------|
| 01/08/2025 | mazergaming | 5,000 |
| 1/08/2025 | finfarm | 3,000 |
| 11/10/2025 | bigfluffyclouds | 180 |
| 18/10/2025 | king13wallet | 5,500 |

**Total Missing:** 13,680 HBD

**Possible reasons:**
- Future-dated transactions (dates in 2025 but not yet executed)
- Planned transactions not yet executed on blockchain
- Date formatting issues (might be in 2024 or other year)
- Transactions might be on different blockchain/wallet
- Errors in manual entry

---

## Recommendations

### 1. **Verify the 4 Missing Transactions**
   - Check if these are future-dated or if dates are incorrect
   - Verify wallet addresses are correct
   - Confirm these transactions actually occurred on the Hive blockchain

### 2. **Review Missing HiveSQL Transactions**
   - Many appear to be loans (memos contain "loan")
   - Determine if loans should be tracked separately
   - Consider if incoming transfers should be included in main spreadsheet

### 3. **Data Source Decision**
   - **Use HiveSQL as the primary source** for accuracy
   - Google Sheets can be used for additional metadata (event/project info, categories, etc.)
   - Consider syncing Google Sheets with HiveSQL data

### 4. **Reconciliation Strategy**
   - Export full list of missing transactions from HiveSQL
   - Review each missing transaction in Google Sheets
   - Add metadata (event, project, country, etc.) to HiveSQL transactions
   - Remove or correct the 4 transactions that don't exist in blockchain

---

## Next Steps

1. ✅ Export HiveSQL data to CSV - **DONE**
2. ✅ Compare with Google Sheets - **DONE**
3. ⏭️ Export detailed list of all missing transactions
4. ⏭️ Create reconciliation tool to merge data sources
5. ⏭️ Update Google Sheets with missing blockchain transactions

---

## Detailed Reports Available

Run this endpoint to get the full comparison:
```
GET /api/compare-data-sources?year=2025
```

Or check the JSON file: `comparison_report.json`

