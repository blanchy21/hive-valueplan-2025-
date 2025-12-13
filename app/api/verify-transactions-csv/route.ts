import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { Transaction, BatchVerificationSummary } from '@/lib/types';
import { parseNumber, parseDate, detectTransactionType } from '@/lib/utils/data';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import { verifyTransactionsBatch } from '@/lib/utils/verification';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);

// Helper function to parse transactions from CSV (same as verify-transactions route)
async function fetchTransactionsFromSheets(): Promise<Transaction[]> {
  const response = await fetch(SHEETS_CSV_URL, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheets data: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  
  return new Promise<Transaction[]>((resolve, reject) => {
    Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows: string[][] = results.data as string[][];
          
          // Find the header row
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(10, rows.length); i++) {
            const row = rows[i];
            if (row && row.length > 0) {
              const firstCell = String(row[0] || '').toLowerCase().trim();
              if (firstCell === 'wallet' || firstCell.includes('wallet')) {
                headerRowIndex = i;
                break;
              }
            }
          }

          if (headerRowIndex === -1) {
            for (let i = 0; i < Math.min(10, rows.length); i++) {
              const row = rows[i];
              if (row && row.some(cell => String(cell || '').toLowerCase().trim() === 'date')) {
                headerRowIndex = i;
                break;
              }
            }
          }

          if (headerRowIndex === -1) {
            return reject(new Error('Could not find header row in CSV'));
          }

          const headerRow = rows[headerRowIndex];
          const headerMap: Record<string, number> = {};
          
          headerRow.forEach((header, index) => {
            const headerLower = String(header || '').toLowerCase().trim();
            if (headerLower === 'wallet' || headerLower.includes('wallet')) {
              if (!headerMap['wallet']) headerMap['wallet'] = index;
            } else if (headerLower === 'date' || headerLower.includes('date')) {
              if (!headerMap['date']) headerMap['date'] = index;
            } else if (headerLower === 'hbd' || (headerLower.includes('hbd') && !headerLower.includes('total'))) {
              if (!headerMap['hbd']) headerMap['hbd'] = index;
            } else if (headerLower === 'hive' || (headerLower.includes('hive') && !headerLower.includes('total'))) {
              if (!headerMap['hive']) headerMap['hive'] = index;
            } else if ((headerLower.includes('event') || headerLower.includes('project')) && 
                      (headerLower.includes('/') || headerLower.includes('event') && headerLower.includes('project'))) {
              if (!headerMap['eventProject']) headerMap['eventProject'] = index;
            } else if (headerLower === 'country' || headerLower.includes('country')) {
              if (!headerMap['country']) headerMap['country'] = index;
            } else if (headerLower === 'theme' || headerLower.includes('theme')) {
              if (!headerMap['theme']) headerMap['theme'] = index;
            } else if (headerLower.includes('event') && headerLower.includes('type')) {
              if (!headerMap['eventType']) headerMap['eventType'] = index;
            } else if (headerLower === 'category' || headerLower.includes('category')) {
              if (!headerMap['category']) headerMap['category'] = index;
            } else if ((headerLower.includes('hive') && headerLower.includes('to') && headerLower.includes('hbd')) ||
                       headerLower === 'hive to hbd' || headerLower.includes('hive to hbd')) {
              if (!headerMap['hiveToHbd']) headerMap['hiveToHbd'] = index;
            }
          });

          if (headerMap['wallet'] === undefined || headerMap['date'] === undefined) {
            return reject(new Error('Missing essential columns (Wallet or Date)'));
          }

          const transactions: Transaction[] = [];
          
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const wallet = String(row[headerMap['wallet']] || '').trim();
            const date = String(row[headerMap['date']] || '').trim();

            if (!wallet || !date) continue;

            // Skip summary/total rows
            const walletLower = wallet.toLowerCase();
            const dateLower = date.toLowerCase();
            if (walletLower === 'total' || 
                walletLower === 'hbd total' ||
                walletLower === 'hive total' ||
                walletLower.startsWith('total ') ||
                dateLower === 'total' ||
                (dateLower.includes('total') && !dateLower.match(/\d/))) {
              continue;
            }

            if (dateLower.includes('date') && !dateLower.match(/\d/)) {
              continue;
            }

            // Parse date
            let parsedDate: Date | null = null;
            try {
              parsedDate = parseDate(date);
              const year = parsedDate.getFullYear();
              if (year < 2020 || year > 2030) {
                continue;
              }
            } catch {
              continue;
            }

            const hbdIndex = headerMap['hbd'];
            const hiveIndex = headerMap['hive'];
            const hiveToHbdIndex = headerMap['hiveToHbd'];
            const hbd = hbdIndex !== undefined ? parseNumber(row[hbdIndex] || 0) : 0;
            const hive = hiveIndex !== undefined ? parseNumber(row[hiveIndex] || 0) : 0;
            const hiveToHbd = hiveToHbdIndex !== undefined ? parseNumber(row[hiveToHbdIndex] || 0) : undefined;

            if (hbd === 0 && hive === 0) {
              const hasOtherData = row[headerMap['eventProject']] || 
                                  row[headerMap['country']] || 
                                  row[headerMap['category']];
              if (!hasOtherData) {
                continue;
              }
            }

            const transaction: Transaction = {
              wallet,
              date,
              hbd,
              hive,
              eventProject: String(row[headerMap['eventProject']] || '').trim(),
              country: String(row[headerMap['country']] || '').trim(),
              theme: String(row[headerMap['theme']] || '').trim(),
              eventType: String(row[headerMap['eventType']] || '').trim(),
              category: String(row[headerMap['category']] || '').trim(),
              hiveToHbd,
            };

            const transactionType = detectTransactionType(transaction);
            transaction.isLoan = transactionType.isLoan;
            transaction.isRefund = transactionType.isRefund;
            transaction.isLoanRefund = transactionType.isLoanRefund;

            transactions.push(transaction);
          }

          resolve(transactions);
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}

// Increase timeout for long-running verification
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : 2025;
    const toleranceDays = parseInt(searchParams.get('toleranceDays') || '1', 10);
    const hiveAccount = searchParams.get('account') || 'valueplan';
    
    if (isNaN(year) || year < 2020 || year > 2030) {
      return NextResponse.json(
        { error: 'Invalid year parameter. Must be between 2020 and 2030.' },
        { status: 400 }
      );
    }

    console.log(`Starting verification for year ${year} with CSV export...`);
    
    // Fetch all transactions from Google Sheets
    const allTransactions = await fetchTransactionsFromSheets();
    
    // Filter transactions by year
    const transactionsForYear = allTransactions.filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === year;
      } catch {
        return false;
      }
    });
    
    if (transactionsForYear.length === 0) {
      return NextResponse.json({
        error: 'No transactions found for the specified year',
      }, { status: 404 });
    }
    
    // Verify transactions in batch
    const verificationResults = await verifyTransactionsBatch(
      transactionsForYear,
      hiveAccount,
      toleranceDays,
      (current, total) => {
        if (current % 50 === 0 || current === total) {
          console.log(`Verification progress: ${current}/${total} (${Math.round((current / total) * 100)}%)`);
        }
      }
    );
    
    // Prepare CSV data
    const csvRows: any[] = [];
    
    // Header row
    csvRows.push([
      'Wallet',
      'Date',
      'HBD',
      'HIVE',
      'Event/Project',
      'Country',
      'Category',
      'Verified',
      'Verification Status',
      'Hive Transaction ID',
      'Hive Date',
      'Hive Amount',
      'Hive Currency',
      'Amount Match',
      'Date Match',
      'Currency Match',
      'Date Difference (days)',
      'Amount Difference',
      'Verification Notes'
    ]);
    
    // Data rows
    verificationResults.forEach(({ transaction, verification }) => {
      const hiveTx = verification.hiveTransaction;
      const discrepancies = verification.discrepancies || {};
      
      // Calculate differences
      let dateDiff = '';
      let amountDiff = '';
      let amountMatch = '';
      let dateMatch = '';
      let currencyMatch = '';
      
      if (hiveTx) {
        const txDate = parseDate(transaction.date);
        const hiveDate = new Date(hiveTx.timestamp);
        const daysDiff = Math.round((hiveDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        dateDiff = daysDiff.toString();
        
        if (transaction.hbd > 0) {
          const diff = Math.abs(hiveTx.amountValue - transaction.hbd);
          amountDiff = diff.toFixed(3);
          amountMatch = diff <= 0.001 ? 'Yes' : 'No';
        } else if (transaction.hive > 0) {
          const diff = Math.abs(hiveTx.amountValue - transaction.hive);
          amountDiff = diff.toFixed(3);
          amountMatch = diff <= 0.001 ? 'Yes' : 'No';
        }
        
        dateMatch = discrepancies.date ? 'No' : 'Yes';
        currencyMatch = discrepancies.currency ? 'No' : 'Yes';
      }
      
      csvRows.push([
        transaction.wallet,
        transaction.date,
        transaction.hbd || '',
        transaction.hive || '',
        transaction.eventProject || '',
        transaction.country || '',
        transaction.category || '',
        verification.verified ? 'Yes' : 'No',
        verification.status,
        hiveTx?.trx_id || '',
        hiveTx?.timestamp ? new Date(hiveTx.timestamp).toISOString().split('T')[0] : '',
        hiveTx?.amountValue || '',
        hiveTx?.currency || '',
        amountMatch || '',
        dateMatch || '',
        currencyMatch || '',
        dateDiff || '',
        amountDiff || '',
        verification.status === 'not_found' ? 'No matching transfer found on blockchain' : 
        verification.status === 'discrepancy' ? `Discrepancies: ${JSON.stringify(discrepancies)}` : ''
      ]);
    });
    
    // Convert to CSV
    const csv = Papa.unparse(csvRows);
    
    // Save to file
    const csvFilePath = join(process.cwd(), `verification-results-${year}-${Date.now()}.csv`);
    await writeFile(csvFilePath, csv, 'utf-8');
    
    // Also return as downloadable CSV
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="verification-results-${year}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error in verification CSV export:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify transactions and export CSV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

