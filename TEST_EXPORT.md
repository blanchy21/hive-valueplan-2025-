# Testing CSV Export - Quick Guide

## Current Status

✅ **Endpoint is ready and working**
✅ **Server is running on localhost:3000**
❌ **Need to set up HiveSQL password**

## Step 1: Get Your HiveSQL Password

You signed up with username **blanchy**. You need to get your password from the encrypted memo sent by @hivesql.

### Option A: Using peakd.com (Easiest)

1. Go to: https://peakd.com/@blanchy/transfers
2. Look for a transfer/transaction **FROM @hivesql**
3. Click the small **🔒 green lock icon** next to the memo
4. The memo will show:
   - Server: `vip.hivesql.io`
   - Database: `DBHive`
   - Login: `Hive-blanchy`
   - **Password: `xxxxx`** ← **Copy this!**

### Option B: Using Keychain

1. Open your Keychain browser extension
2. Click the "History" button
3. Find the transaction from @hivesql
4. View the decrypted memo to get your password

## Step 2: Create .env.local File

In your project root directory (`/Users/paulblanche/Desktop/valueplan/`), create a file called `.env.local`:

```bash
# Create the file
touch .env.local

# Or use your editor to create it with these contents:
```

Then add this content to `.env.local`:

```env
HIVESQL_USERNAME=blanchy
HIVESQL_PASSWORD=your_actual_password_here
```

**Replace `your_actual_password_here` with the password from the memo!**

## Step 3: Restart Server

After creating `.env.local`, restart your dev server:

```bash
# Stop the current server (Ctrl+C or kill the process)
# Then restart:
npm run dev
```

## Step 4: Test the Export

Once the server restarts with the password set, test the export:

### Test 1: Save to File (Recommended first test)

```bash
curl "http://localhost:3000/api/export-transactions-csv?account=valueplan&year=2025&saveFile=true"
```

This should return JSON with success message and create `valueplan_transactions_2025.csv` in your project directory.

### Test 2: Download CSV

Open in browser:
```
http://localhost:3000/api/export-transactions-csv?account=valueplan&year=2025
```

Or use curl:
```bash
curl "http://localhost:3000/api/export-transactions-csv?account=valueplan&year=2025" -o valueplan_transactions_2025.csv
```

## Expected Results

### Successful Response (saveFile=true):

```json
{
  "success": true,
  "account": "valueplan",
  "year": "2025",
  "totalTransactions": 1234,
  "filePath": "/Users/paulblanche/Desktop/valueplan/valueplan_transactions_2025.csv",
  "filename": "valueplan_transactions_2025.csv",
  "summary": {
    "totalHBD": 123456.789,
    "totalHIVE": 98765.432,
    "incoming": 500,
    "outgoing": 734
  },
  "message": "CSV file saved to valueplan_transactions_2025.csv"
}
```

### CSV File Format:

The CSV will have these columns:
- Transaction ID
- Block Number
- Timestamp
- From Account
- To Account
- Amount
- Currency
- Amount Value
- Memo

## Troubleshooting

**Still getting "HIVESQL_PASSWORD not set" error?**
- Make sure `.env.local` is in the project root (same directory as `package.json`)
- Make sure there are no typos in the variable names
- Restart the dev server after creating/editing `.env.local`
- Check that the password doesn't have extra spaces

**Getting authentication error?**
- Verify the password is correct (from the memo)
- Check for typos or extra characters
- The username is automatically set to `blanchy` (login will be `Hive-blanchy`)

**Need help finding the memo?**
- Check your Hive account on https://peakd.com/@blanchy
- Look in your wallet transfers/history
- The memo was sent shortly after you signed up for HiveSQL

## Quick Test Command

Once you've set up `.env.local`, run this to test:

```bash
# Save to file
curl -s "http://localhost:3000/api/export-transactions-csv?account=valueplan&year=2025&saveFile=true" | jq .

# Check if file was created
ls -lh valueplan_transactions_2025.csv
```

