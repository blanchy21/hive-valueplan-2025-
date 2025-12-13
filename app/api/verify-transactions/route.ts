import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { Transaction, BatchVerificationSummary } from '@/lib/types';
import { parseNumber, parseDate, detectTransactionType } from '@/lib/utils/data';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import { verifyTransactionsBatch } from '@/lib/utils/verification';
import { writeFile, appendFile } from 'fs/promises';
import { join } from 'path';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);

// File-based logging for debugging
const LOG_FILE = join(process.cwd(), 'verification.log');

async function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    await appendFile(LOG_FILE, logMessage);
  } catch {
    // Ignore file write errors
  }
  // Also log to console
  console.log(message);
  process.stdout.write(message + '\n');
}

// Helper function to parse transactions from CSV (similar to transactions route)
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

// Increase timeout for long-running verification (Next.js default is 10s, we need more)
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  
  // Initialize log file
  try {
    await writeFile(LOG_FILE, `\n${'='.repeat(80)}\nVERIFICATION STARTED at ${new Date().toISOString()}\n${'='.repeat(80)}\n`);
  } catch {
    // Ignore if can't write
  }
  
  // IMMEDIATE logging to ensure we see something
  await logToFile('\n' + '='.repeat(80));
  await logToFile(`🚀 VERIFICATION REQUEST RECEIVED at ${new Date().toISOString()}`);
  await logToFile('='.repeat(80));
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : 2025;
    const toleranceDays = parseInt(searchParams.get('toleranceDays') || '1', 10);
    const hiveAccount = searchParams.get('account') || 'valueplan';
    
    await logToFile(`📋 Parameters: year=${year}, account=${hiveAccount}, tolerance=${toleranceDays} days`);
    
    if (isNaN(year) || year < 2020 || year > 2030) {
      await logToFile(`❌ Invalid year: ${year}`);
      return NextResponse.json(
        { error: 'Invalid year parameter. Must be between 2020 and 2030.' },
        { status: 400 }
      );
    }

    await logToFile(`\n🚀 [${new Date().toISOString()}] Starting verification for year ${year}...`);
    await logToFile(`📊 Account: ${hiveAccount}, Tolerance: ${toleranceDays} days`);
    
    // Fetch all transactions from Google Sheets
    await logToFile(`📥 [${Date.now() - startTime}ms] Fetching transactions from Google Sheets...`);
    const allTransactions = await fetchTransactionsFromSheets();
    await logToFile(`✅ [${Date.now() - startTime}ms] Fetched ${allTransactions.length} total transactions from Google Sheets`);
    
    // Filter transactions by year
    await logToFile(`🔍 [${Date.now() - startTime}ms] Filtering transactions for year ${year}...`);
    const transactionsForYear = allTransactions.filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === year;
      } catch {
        return false;
      }
    });
    
    await logToFile(`✅ [${Date.now() - startTime}ms] Filtered to ${transactionsForYear.length} transactions for year ${year}`);
    
    if (transactionsForYear.length === 0) {
      return NextResponse.json({
        year,
        totalTransactions: 0,
        verified: 0,
        unverified: 0,
        discrepancies: 0,
        notFound: 0,
        results: [],
        summary: {
          totalHbdVerified: 0,
          totalHiveVerified: 0,
          totalHbdDiscrepancies: 0,
          totalHiveDiscrepancies: 0,
        },
      } as BatchVerificationSummary);
    }
    
    // Verify transactions in batch
    await logToFile(`🔄 [${Date.now() - startTime}ms] Starting batch verification of ${transactionsForYear.length} transactions...`);
    await logToFile(`⏳ This may take several minutes. Progress will be logged every 10 transactions...`);
    const verificationResults = await verifyTransactionsBatch(
      transactionsForYear,
      hiveAccount,
      toleranceDays,
      async (current, total) => {
        const elapsed = Date.now() - startTime;
        const percent = Math.round((current / total) * 100);
        const rate = current / (elapsed / 1000); // transactions per second
        const remaining = total - current;
        const eta = remaining / rate; // seconds remaining
        
        if (current % 10 === 0 || current === total || current === 1) {
          await logToFile(`📈 [${elapsed}ms] Progress: ${current}/${total} (${percent}%) | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(eta)}s`);
        }
      }
    );
    await logToFile(`✅ [${Date.now() - startTime}ms] Batch verification completed!`);
    
    // Calculate summary statistics
    let verified = 0;
    let unverified = 0;
    let discrepancies = 0;
    let notFound = 0;
    let totalHbdVerified = 0;
    let totalHiveVerified = 0;
    let totalHbdDiscrepancies = 0;
    let totalHiveDiscrepancies = 0;
    
    verificationResults.forEach(({ transaction, verification }) => {
      // Update transaction with verification status
      transaction.verified = verification.verified;
      transaction.verificationStatus = verification.status;
      transaction.hiveTransactionId = verification.hiveTransaction?.trx_id;
      transaction.verificationDate = verification.verificationDate;
      
      if (verification.status === 'verified') {
        verified++;
        totalHbdVerified += transaction.hbd || 0;
        totalHiveVerified += transaction.hive || 0;
      } else if (verification.status === 'discrepancy') {
        discrepancies++;
        totalHbdDiscrepancies += transaction.hbd || 0;
        totalHiveDiscrepancies += transaction.hive || 0;
      } else if (verification.status === 'not_found') {
        notFound++;
      } else {
        unverified++;
      }
    });
    
    const summary: BatchVerificationSummary = {
      year,
      totalTransactions: transactionsForYear.length,
      verified,
      unverified,
      discrepancies,
      notFound,
      results: verificationResults,
      summary: {
        totalHbdVerified,
        totalHiveVerified,
        totalHbdDiscrepancies,
        totalHiveDiscrepancies,
      },
    };
    
    await logToFile(`\n=== Verification Summary for ${year} ===`);
    await logToFile(`Total Transactions: ${summary.totalTransactions}`);
    await logToFile(`Verified: ${summary.verified} (${Math.round((summary.verified / summary.totalTransactions) * 100)}%)`);
    await logToFile(`Discrepancies: ${summary.discrepancies}`);
    await logToFile(`Not Found: ${summary.notFound}`);
    await logToFile(`Unverified: ${summary.unverified}`);
    await logToFile(`Total HBD Verified: ${summary.summary.totalHbdVerified.toFixed(2)} HBD`);
    await logToFile(`Total HIVE Verified: ${summary.summary.totalHiveVerified.toFixed(2)} HIVE`);
    await logToFile(`========================================\n`);
    await logToFile(`✅ Verification completed successfully at ${new Date().toISOString()}\n`);
    
    return NextResponse.json({
      ...summary,
      logFile: 'Check verification.log in project root for detailed logs',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logToFile(`❌ ERROR in verification endpoint: ${errorMsg}`);
    if (error instanceof Error) {
      await logToFile(`Stack trace: ${error.stack}`);
    }
    console.error('Error in verification endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify transactions',
        details: errorMsg,
        logFile: 'Check verification.log in project root for detailed logs',
      },
      { status: 500 }
    );
  }
}

