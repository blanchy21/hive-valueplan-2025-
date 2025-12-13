import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/types';
import { getAccountTransfers } from '@/lib/utils/hive';
import { parseDate } from '@/lib/utils/data';
import { verifyTransactionsBatch } from '@/lib/utils/verification';
// Helper function to parse transactions from CSV (copied from verify-transactions route)
async function fetchTransactionsFromSheets(): Promise<Transaction[]> {
  const { getSheetsCsvUrl, SHEET_TABS } = await import('@/lib/utils/sheets');
  const { parseNumber, parseDate, detectTransactionType } = await import('@/lib/utils/data');
  const Papa = await import('papaparse');
  
  const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);
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
          
          // Find header row (simplified version)
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

            try {
              const parsedDate = parseDate(date);
              const year = parsedDate.getFullYear();
              if (year < 2020 || year > 2030) continue;
            } catch {
              continue;
            }

            const hbdIndex = headerMap['hbd'];
            const hiveIndex = headerMap['hive'];
            const hbd = hbdIndex !== undefined ? parseNumber(row[hbdIndex] || 0) : 0;
            const hive = hiveIndex !== undefined ? parseNumber(row[hiveIndex] || 0) : 0;

            if (hbd === 0 && hive === 0) continue;

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

const AMOUNT_TOLERANCE = 0.001;

// Helper to get Hive account name from wallet
function getHiveAccount(walletName: string): string {
  return walletName.toLowerCase().replace('@', '').trim();
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '2025', 10);
    const hiveAccount = searchParams.get('account') || 'valueplan';
    
    // Fetch transactions
    const allTransactions = await fetchTransactionsFromSheets();
    const transactionsForYear = allTransactions.filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === year;
      } catch {
        return false;
      }
    });
    
    // Fetch all transfers
    const stopAtDate = new Date('2025-01-01T00:00:00Z');
    const allTransfers = await getAccountTransfers(hiveAccount, 1000, 2000000, stopAtDate);
    const outgoingTransfers = allTransfers.filter(t => 
      t.from.toLowerCase() === hiveAccount.toLowerCase()
    );
    
    // Get not found transactions from last verification
    // For now, we'll check all transactions and see which ones don't have matches
    const diagnostics: Array<{
      transaction: Transaction;
      transfersToWallet: number;
      amountMatches: Array<{
        amount: string;
        date: string;
        daysDiff: number;
        currency: string;
      }>;
      closestMatch?: {
        amount: string;
        date: string;
        daysDiff: number;
        currency: string;
      };
    }> = [];
    
    // Check first 20 not-found-like transactions (early 2025 dates)
    const early2025Transactions = transactionsForYear
      .filter(tx => {
        try {
          const txDate = parseDate(tx.date);
          return txDate.getFullYear() === 2025 && txDate.getMonth() < 2; // Jan-Feb
        } catch {
          return false;
        }
      })
      .slice(0, 20);
    
    for (const transaction of early2025Transactions) {
      const targetAccount = getHiveAccount(transaction.wallet);
      const txDate = parseDate(transaction.date);
      const txDateNormalized = new Date(txDate);
      txDateNormalized.setHours(0, 0, 0, 0);
      
      // Get all transfers to this wallet (no date filter)
      const transfersToWallet = outgoingTransfers.filter(t => 
        t.to.toLowerCase() === targetAccount.toLowerCase()
      );
      
      // Check for amount matches
      const amountMatches: Array<{
        amount: string;
        date: string;
        daysDiff: number;
        currency: string;
      }> = [];
      
      if (transaction.hbd > 0) {
        transfersToWallet.forEach(transfer => {
          if (transfer.currency === 'HBD') {
            const amountDiff = Math.abs(transfer.amountValue - transaction.hbd);
            if (amountDiff <= AMOUNT_TOLERANCE) {
              const transferDate = new Date(transfer.timestamp);
              const daysDiff = Math.floor((transferDate.getTime() - txDateNormalized.getTime()) / (1000 * 60 * 60 * 24));
              amountMatches.push({
                amount: transfer.amount,
                date: transfer.timestamp,
                daysDiff,
                currency: 'HBD',
              });
            }
          }
        });
      }
      
      if (transaction.hive > 0) {
        transfersToWallet.forEach(transfer => {
          if (transfer.currency === 'HIVE') {
            const amountDiff = Math.abs(transfer.amountValue - transaction.hive);
            if (amountDiff <= AMOUNT_TOLERANCE) {
              const transferDate = new Date(transfer.timestamp);
              const daysDiff = Math.floor((transferDate.getTime() - txDateNormalized.getTime()) / (1000 * 60 * 60 * 24));
              amountMatches.push({
                amount: transfer.amount,
                date: transfer.timestamp,
                daysDiff,
                currency: 'HIVE',
              });
            }
          }
        });
      }
      
      // Sort by date difference to find closest match
      amountMatches.sort((a, b) => Math.abs(a.daysDiff) - Math.abs(b.daysDiff));
      
      diagnostics.push({
        transaction,
        transfersToWallet: transfersToWallet.length,
        amountMatches,
        closestMatch: amountMatches.length > 0 ? amountMatches[0] : undefined,
      });
    }
    
    return NextResponse.json({
      year,
      totalChecked: early2025Transactions.length,
      diagnostics,
    });
  } catch (error) {
    console.error('Error in diagnose endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to diagnose',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

