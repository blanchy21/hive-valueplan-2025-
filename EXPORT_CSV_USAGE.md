# Export Transactions to CSV

## Quick Usage

### Export and Download CSV (Browser)

Open this URL in your browser (after starting your dev server):

```
http://localhost:3000/api/export-transactions-csv?account=valueplan&year=2025
```

This will automatically download `valueplan_transactions_2025.csv` to your Downloads folder.

### Export and Save to Project Directory

To save the CSV file directly in your project directory:

```
http://localhost:3000/api/export-transactions-csv?account=valueplan&year=2025&saveFile=true
```

This will create `valueplan_transactions_2025.csv` in your project root.

### Using cURL (Command Line)

**Download CSV:**
```bash
curl "http://localhost:3000/api/export-transactions-csv?account=valueplan&year=2025" -o valueplan_transactions_2025.csv
```

**Save to project directory:**
```bash
curl "http://localhost:3000/api/export-transactions-csv?account=valueplan&year=2025&saveFile=true"
```

## API Parameters

- `account` (optional, default: `valueplan`) - Hive account name
- `year` (optional, default: `2025`) - Year to export (2020-2030)
- `saveFile` (optional, default: `false`) - If `true`, saves file to project directory instead of downloading

## CSV Format

The exported CSV includes the following columns:

1. **Transaction ID** - Unique transaction ID on the blockchain
2. **Block Number** - Block number where the transaction was included
3. **Timestamp** - Date and time of the transaction (ISO format)
4. **From Account** - Account that sent the funds
5. **To Account** - Account that received the funds
6. **Amount** - Amount with currency (e.g., "100.000 HBD")
7. **Currency** - Currency type (HIVE or HBD)
8. **Amount Value** - Numeric amount value
9. **Memo** - Transaction memo (if any)

## Example CSV Output

```csv
Transaction ID,Block Number,Timestamp,From Account,To Account,Amount,Currency,Amount Value,Memo
abc123...,75000000,2025-01-15T10:30:00.000Z,valueplan,recipient1,100.000 HBD,HBD,100.000,Payment for project
def456...,75000001,2025-01-15T11:00:00.000Z,valueplan,recipient2,50.000 HIVE,HIVE,50.000,Event funding
```

## Notes

- **Uses HiveSQL** - Much faster than pagination API (seconds vs minutes)
- **Sorted chronologically** - Oldest transactions first
- **Includes all transfers** - Both incoming and outgoing
- **Requires HiveSQL setup** - Make sure `.env.local` has `HIVESQL_PASSWORD` set (see `HIVESQL_SETUP.md`)

## Troubleshooting

**Error: "HIVESQL_PASSWORD environment variable not set"**
- Make sure you've created `.env.local` with your HiveSQL password
- See `HIVESQL_SETUP.md` for detailed instructions

**No data returned**
- Verify the account name is correct
- Check that transactions exist for the specified year
- Review server logs for detailed error messages

**CSV file is empty**
- Check that there are actually transactions for the specified account and year
- Verify the date range is correct

