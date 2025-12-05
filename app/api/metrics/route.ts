import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/types';
import Papa from 'papaparse';
import { parseNumber, calculateTotalSpend, parseDate, calculateMetrics, detectTransactionType, convertHiveToHbd, calculateWalletTotals } from '@/lib/utils/data';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import { getEventRefundsAsTransactions } from '@/lib/data/event-refunds';
import { getLoansAsTransactions } from '@/lib/data/loans';
import { getLoanRefundsAsTransactions } from '@/lib/data/loan-refunds';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);

export async function GET(): Promise<NextResponse> {
  try {
    const response = await fetch(SHEETS_CSV_URL, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheets data: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    
    return new Promise<NextResponse>((resolve, reject) => {
      Papa.parse(csvText, {
        header: false, // Parse without headers first to find the actual header row
        skipEmptyLines: true,
        complete: (results) => {
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
              }
            });

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
            
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              const wallet = String(row[headerMap['wallet']] || '').trim();
              const date = String(row[headerMap['date']] || '').trim();

              // Skip rows without wallet or date
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

              // Skip if date looks like a header (contains "Date" and no numbers)
              if (dateLower.includes('date') && !dateLower.match(/\d/)) {
                continue;
              }

              // Try to parse the date - be more lenient
              let parsedDate: Date | null = null;
              try {
                parsedDate = parseDate(date);
                // Check if date is reasonable (between 2020 and 2030)
                const year = parsedDate.getFullYear();
                if (year < 2020 || year > 2030) {
                  continue;
                }
              } catch {
                continue;
              }

              // Get HBD, Hive, and Hive To HBD values - handle missing columns gracefully
              const hbdIndex = headerMap['hbd'];
              const hiveIndex = headerMap['hive'];
              const hiveToHbdIndex = headerMap['hiveToHbd'];
              const hbd = hbdIndex !== undefined ? parseNumber(row[hbdIndex] || 0) : 0;
              const hive = hiveIndex !== undefined ? parseNumber(row[hiveIndex] || 0) : 0;
              const hiveToHbd = hiveToHbdIndex !== undefined ? parseNumber(row[hiveToHbdIndex] || 0) : undefined;

              // Include rows with data even if amounts are zero (might have other info)
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

            console.log(`Metrics: Parsed ${transactions.length} transactions from CSV`);
            
            // Add loans to transactions (money given out)
            const loans = getLoansAsTransactions();
            console.log(`Metrics: Adding ${loans.length} loans`);
            const totalLoansAmount = loans.reduce((sum, l) => sum + (l.hbd || 0) + (l.hive || 0) * 0.24, 0);
            console.log(`Metrics: Total loans amount: ${totalLoansAmount.toFixed(2)} HBD equivalent`);
            transactions.push(...loans);
            
            // Add loan refunds to transactions (repayments received)
            const loanRefunds = getLoanRefundsAsTransactions();
            console.log(`Metrics: Adding ${loanRefunds.length} loan refunds`);
            const totalLoanRefundsAmount = loanRefunds.reduce((sum, r) => sum + (r.hbd || 0) + (r.hive || 0) * 0.24, 0);
            console.log(`Metrics: Total loan refunds amount: ${totalLoanRefundsAmount.toFixed(2)} HBD equivalent`);
            transactions.push(...loanRefunds);
            
            // Add event refunds to transactions
            const eventRefunds = getEventRefundsAsTransactions();
            console.log(`Metrics: Adding ${eventRefunds.length} event refunds`);
            const totalEventRefundsAmount = eventRefunds.reduce((sum, r) => sum + (r.hbd || 0), 0);
            console.log(`Metrics: Total event refunds amount: ${totalEventRefundsAmount.toFixed(2)} HBD`);
            transactions.push(...eventRefunds);
            console.log(`Metrics: Total transactions after adding loans, loan refunds, and event refunds: ${transactions.length}`);
            
            // Debug: Verify ssekulji transactions for 2025 (rally car account)
            const ssekuljiTotals = calculateWalletTotals(transactions, 'ssekulji', { year: 2025 });
            
            if (ssekuljiTotals.transactionCount > 0) {
              console.log(`\n=== SSEKULJI (Rally Car) Transactions for 2025 ===`);
              console.log(`Found ${ssekuljiTotals.transactionCount} transactions:`);
              
              ssekuljiTotals.transactions.forEach(tx => {
                const hbd = tx.hbd || 0;
                const hive = tx.hive || 0;
                const hiveInHbd = tx.hiveToHbd !== undefined ? tx.hiveToHbd : (hive ? convertHiveToHbd(hive) : 0);
                const total = calculateTotalSpend(tx);
                
                console.log(`  - ${tx.date}: ${tx.eventProject || 'N/A'} | ${tx.category || 'N/A'} | ${hbd.toFixed(2)} HBD + ${hive.toFixed(2)} HIVE (${hiveInHbd.toFixed(2)} HBD equiv) | Total: ${total.toFixed(2)} HBD`);
              });
              
              console.log(`\nSummary:`);
              console.log(`  Total HBD: ${ssekuljiTotals.totalHbd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HBD`);
              console.log(`  Total HIVE: ${ssekuljiTotals.totalHive.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HIVE`);
              console.log(`  HIVE in HBD equivalent: ${ssekuljiTotals.totalHiveInHbd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HBD`);
              console.log(`  GRAND TOTAL: ${ssekuljiTotals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HBD`);
              console.log(`  Expected: 392,637.58 HBD`);
              console.log(`  Difference: ${(ssekuljiTotals.grandTotal - 392637.58).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HBD`);
              console.log(`================================================\n`);
            } else {
              console.log('No ssekulji transactions found for 2025. Searching for variations...');
              // Try to find transactions that might be ssekulji with different casing or format
              const possibleSsekulji = transactions.filter(tx => {
                const walletLower = tx.wallet.toLowerCase().replace('@', '').trim();
                return walletLower.includes('ssekulji') || walletLower.includes('sekulji');
              });
              if (possibleSsekulji.length > 0) {
                console.log(`Found ${possibleSsekulji.length} possible ssekulji transactions (checking all years):`);
                possibleSsekulji.slice(0, 5).forEach(tx => {
                  console.log(`  - ${tx.date}: ${tx.wallet} | ${tx.hbd || 0} HBD + ${tx.hive || 0} HIVE`);
                });
              }
            }
            
            // Debug: Find rally car related transactions
            const rallyCarTransactions = transactions.filter(tx => {
              const searchText = `${tx.wallet} ${tx.eventProject} ${tx.category} ${tx.eventType}`.toLowerCase();
              return searchText.includes('rally');
            });
            
            if (rallyCarTransactions.length > 0) {
              console.log(`Found ${rallyCarTransactions.length} rally car related transactions:`);
              rallyCarTransactions.forEach(tx => {
                console.log(`  - ${tx.date}: ${tx.eventProject || 'N/A'} | Category: ${tx.category || 'N/A'} | Amount: ${tx.hbd || 0} HBD + ${tx.hive || 0} HIVE (${tx.hiveToHbd || 0} HBD equiv) | Total: ${calculateTotalSpend(tx)} HBD`);
              });
              const rallyCarTotal = rallyCarTransactions.reduce((sum, tx) => sum + calculateTotalSpend(tx), 0);
              console.log(`Total rally car spending: ${rallyCarTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HBD`);
            } else {
              console.log('No rally car related transactions found. Searching for variations...');
              // Try to find transactions that might be rally car related
              const possibleRally = transactions.filter(tx => {
                const searchText = `${tx.wallet} ${tx.eventProject} ${tx.category}`.toLowerCase();
                return searchText.includes('wrc') || searchText.includes('race') || searchText.includes('car');
              });
              if (possibleRally.length > 0) {
                console.log(`Found ${possibleRally.length} possible rally/racing related transactions`);
              }
            }
            
            // Calculate metrics for 2025 to match verticals and executive summary
            const metrics = calculateMetrics(transactions, 2025);
            
            console.log(`\n=== METRICS (2025) ===`);
            console.log(`Total HBD: ${metrics.totalHbd.toFixed(2)} HBD`);
            console.log(`Total Hive: ${metrics.totalHive.toFixed(2)} HIVE`);
            console.log(`Combined Total (HBD equivalent): ${metrics.combinedTotalHbd.toFixed(2)} HBD`);
            console.log(`=====================\n`);
            
            resolve(NextResponse.json(metrics));
          } catch (error) {
            console.error('Error processing transactions for metrics:', error);
            reject(NextResponse.json({ 
              error: 'Failed to process transactions',
              details: error instanceof Error ? error.message : 'Unknown error'
            }, { status: 500 }));
          }
        },
        error: (error: Error) => {
          console.error('CSV parsing error in metrics:', error);
          reject(NextResponse.json({ 
            error: 'Failed to parse CSV', 
            details: error.message 
          }, { status: 500 }));
        },
      });
    });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate metrics', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
