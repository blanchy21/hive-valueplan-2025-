import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { Transaction, HiveTransfer } from '@/lib/types';
import { parseNumber, parseDate, calculateTotalSpend, detectTransactionType } from '@/lib/utils/data';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import { getAccountTransfersViaSQL } from '@/lib/utils/hive';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);
const DEFAULT_ACCOUNT = 'valueplan';
const AMOUNT_TOLERANCE = 0.001; // For matching amounts (handles floating point precision)
const DATE_TOLERANCE_DAYS = 7; // Days tolerance for matching dates

/**
 * Matches a transaction from Google Sheets with a HiveSQL transfer
 * Matches by: date (within tolerance), amount, currency, and wallet (to account)
 */
function matchTransactionToTransfer(
  transaction: Transaction,
  transfers: HiveTransfer[],
  sourceAccount: string = DEFAULT_ACCOUNT
): HiveTransfer | null {
  const txDate = parseDate(transaction.date);
  const targetWallet = transaction.wallet.replace('@', '').toLowerCase().trim();
  
  // Find transfers from valueplan to the target wallet
  const relevantTransfers = transfers.filter(transfer => 
    transfer.from.toLowerCase() === sourceAccount.toLowerCase() &&
    transfer.to.toLowerCase() === targetWallet
  );
  
  if (relevantTransfers.length === 0) {
    return null;
  }
  
  // Try to match by amount and date
  for (const transfer of relevantTransfers) {
    const transferDate = new Date(transfer.timestamp);
    const dateDiff = Math.abs(transferDate.getTime() - txDate.getTime());
    const maxDateDiff = DATE_TOLERANCE_DAYS * 24 * 60 * 60 * 1000;
    
    // Check if date is within tolerance
    if (dateDiff > maxDateDiff) {
      continue;
    }
    
    // Match HBD amount
    if (transaction.hbd > 0 && transfer.currency === 'HBD') {
      const amountDiff = Math.abs(transfer.amountValue - transaction.hbd);
      if (amountDiff <= AMOUNT_TOLERANCE) {
        return transfer;
      }
    }
    
    // Match HIVE amount
    if (transaction.hive > 0 && transfer.currency === 'HIVE') {
      const amountDiff = Math.abs(transfer.amountValue - transaction.hive);
      if (amountDiff <= AMOUNT_TOLERANCE) {
        return transfer;
      }
    }
  }
  
  return null;
}

export async function GET(): Promise<NextResponse> {
  try {
    const response = await fetch(SHEETS_CSV_URL, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheets data: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    
    return new Promise<NextResponse>(async (resolve, reject) => {
      Papa.parse(csvText, {
        header: false, // Parse without headers first to find the actual header row
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rows: string[][] = results.data as string[][];
            
            // Find the header row - look for "Wallet" or "Date" in the first few rows
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
              // Try to find by looking for "Date" column
              for (let i = 0; i < Math.min(10, rows.length); i++) {
                const row = rows[i];
                if (row && row.some(cell => String(cell || '').toLowerCase().trim() === 'date')) {
                  headerRowIndex = i;
                  break;
                }
              }
            }

            if (headerRowIndex === -1) {
              console.error('Could not find header row. First few rows:', rows.slice(0, 5));
              return reject(NextResponse.json({ 
                error: 'Could not find header row in CSV',
                debug: { firstRows: rows.slice(0, 5) }
              }, { status: 500 }));
            }

            const headerRow = rows[headerRowIndex];
            const headerMap: Record<string, number> = {};
            
            // Map header names to column indices
            headerRow.forEach((header, index) => {
              const headerLower = String(header || '').toLowerCase().trim();
              // Use more specific matching to avoid conflicts
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
              } else if (headerLower === 'memo' || headerLower.includes('memo') || 
                         headerLower === 'comment' || headerLower.includes('comment') ||
                         headerLower === 'notes' || headerLower.includes('notes')) {
                if (!headerMap['memo']) headerMap['memo'] = index;
              }
            });

            // Log header mapping for debugging
            console.log('Header row:', headerRow);
            console.log('Header map:', headerMap);

            // Check if we found essential columns
            if (headerMap['wallet'] === undefined || headerMap['date'] === undefined) {
              console.error('Missing essential columns. Header row:', headerRow);
              console.error('Header map:', headerMap);
              return reject(NextResponse.json({ 
                error: 'Missing essential columns (Wallet or Date)',
                debug: { headerRow, headerMap }
              }, { status: 500 }));
            }

            // Parse data rows (skip header row and any summary rows)
            const transactions: Transaction[] = [];
            const skippedRows = {
              empty: 0,
              noWallet: 0,
              noDate: 0,
              totalRow: 0,
              invalidDate: 0,
              zeroAmount: 0,
              dateHeader: 0
            };
            
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) {
                skippedRows.empty++;
                continue;
              }

              const wallet = String(row[headerMap['wallet']] || '').trim();
              const date = String(row[headerMap['date']] || '').trim();

              // Skip rows without wallet or date
              if (!wallet) {
                skippedRows.noWallet++;
                continue;
              }
              if (!date) {
                skippedRows.noDate++;
                continue;
              }

              // Skip summary/total rows (but be more specific)
              const walletLower = wallet.toLowerCase();
              const dateLower = date.toLowerCase();
              if (walletLower === 'total' || 
                  walletLower === 'hbd total' ||
                  walletLower === 'hive total' ||
                  walletLower.startsWith('total ') ||
                  dateLower === 'total' ||
                  (dateLower.includes('total') && !dateLower.match(/\d/))) {
                skippedRows.totalRow++;
                continue;
              }

              // Skip if date looks like a header (contains "Date" and no numbers)
              if (dateLower.includes('date') && !dateLower.match(/\d/)) {
                skippedRows.dateHeader++;
                continue;
              }

              // Try to parse the date - be more lenient
              let parsedDate: Date | null = null;
              try {
                parsedDate = parseDate(date);
                // Check if date is reasonable (between 2020 and 2030)
                const year = parsedDate.getFullYear();
                if (year < 2020 || year > 2030) {
                  skippedRows.invalidDate++;
                  continue;
                }
              } catch {
                skippedRows.invalidDate++;
                continue;
              }

              // Get HBD, Hive, and Hive To HBD values - handle missing columns gracefully
              const hbdIndex = headerMap['hbd'];
              const hiveIndex = headerMap['hive'];
              const hiveToHbdIndex = headerMap['hiveToHbd'];
              const hbd = hbdIndex !== undefined ? parseNumber(row[hbdIndex] || 0) : 0;
              const hive = hiveIndex !== undefined ? parseNumber(row[hiveIndex] || 0) : 0;
              const hiveToHbd = hiveToHbdIndex !== undefined ? parseNumber(row[hiveToHbdIndex] || 0) : undefined;
              
              // Debug first few rows
              if (transactions.length < 3) {
                console.log(`Row ${i}: wallet=${wallet}, date=${date}, hbdIndex=${hbdIndex}, hiveIndex=${hiveIndex}, hbd=${hbd}, hive=${hive}, row[hbdIndex]=${row[hbdIndex]}, row[hiveIndex]=${row[hiveIndex]}`);
              }

              // Be more lenient - include rows even if amounts are zero (might be placeholder rows)
              // But log them for debugging
              if (hbd === 0 && hive === 0) {
                skippedRows.zeroAmount++;
                // Still include if there's other data (event/project, etc.)
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
                memo: headerMap['memo'] !== undefined ? String(row[headerMap['memo']] || '').trim() : undefined,
                hiveToHbd, // Use actual Hive To HBD value from spreadsheet
              };

              // Detect transaction type (loan, refund, loan refund)
              const transactionType = detectTransactionType(transaction);
              transaction.isLoan = transactionType.isLoan;
              transaction.isRefund = transactionType.isRefund;
              transaction.isLoanRefund = transactionType.isLoanRefund;

              transaction.totalSpend = calculateTotalSpend(transaction);
              transactions.push(transaction);
            }

            console.log(`Parsed ${transactions.length} transactions from CSV`);
            console.log('Skipped rows breakdown:', skippedRows);
            console.log(`Total rows processed: ${rows.length - headerRowIndex - 1}`);
            
            // Fetch memos from HiveSQL for transactions
            // Determine date range from transactions
            let minDate: Date | undefined;
            let maxDate: Date | undefined;
            
            transactions.forEach(tx => {
              try {
                const txDate = parseDate(tx.date);
                if (!minDate || txDate < minDate) minDate = txDate;
                if (!maxDate || txDate > maxDate) maxDate = txDate;
              } catch {
                // Skip invalid dates
              }
            });
            
            // Add buffer for date tolerance
            if (minDate) {
              minDate = new Date(minDate);
              minDate.setDate(minDate.getDate() - DATE_TOLERANCE_DAYS);
            }
            if (maxDate) {
              maxDate = new Date(maxDate);
              maxDate.setDate(maxDate.getDate() + DATE_TOLERANCE_DAYS);
              maxDate.setHours(23, 59, 59, 999);
            }
            
            // Fetch HiveSQL transfers if we have valid dates
            let hivesqlTransfers: HiveTransfer[] = [];
            if (minDate && maxDate) {
              try {
                console.log(`Fetching HiveSQL transfers from ${DEFAULT_ACCOUNT} for date range ${minDate.toISOString()} to ${maxDate.toISOString()}`);
                hivesqlTransfers = await getAccountTransfersViaSQL(DEFAULT_ACCOUNT, minDate, maxDate);
                console.log(`✅ Fetched ${hivesqlTransfers.length} transfers from HiveSQL`);
              } catch (error) {
                console.error('Failed to fetch HiveSQL transfers for memos:', error);
                // Continue without memos if HiveSQL fails
              }
            }
            
            // Match transactions with HiveSQL transfers to populate memos
            let matchedCount = 0;
            transactions.forEach(transaction => {
              // Skip if memo already exists from Google Sheets
              if (transaction.memo) {
                return;
              }
              
              const matchedTransfer = matchTransactionToTransfer(transaction, hivesqlTransfers, DEFAULT_ACCOUNT);
              if (matchedTransfer && matchedTransfer.memo) {
                transaction.memo = matchedTransfer.memo;
                matchedCount++;
              }
            });
            
            console.log(`✅ Matched ${matchedCount} transactions with HiveSQL memos`);
            resolve(NextResponse.json(transactions));
          } catch (error) {
            console.error('Error processing transactions:', error);
            reject(NextResponse.json({ 
              error: 'Failed to process transactions',
              details: error instanceof Error ? error.message : 'Unknown error'
            }, { status: 500 }));
          }
        },
        error: (error: Error) => {
          console.error('CSV parsing error:', error);
          reject(NextResponse.json({ 
            error: 'Failed to parse CSV', 
            details: error.message 
          }, { status: 500 }));
        },
      });
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
