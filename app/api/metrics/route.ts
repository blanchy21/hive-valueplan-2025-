import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/types';
import Papa from 'papaparse';
import { parseNumber, calculateTotalSpend, parseDate, calculateMetrics, detectTransactionType } from '@/lib/utils/data';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import { getEventRefundsAsTransactions } from '@/lib/data/event-refunds';
import { getLoansAsTransactions } from '@/lib/data/loans';
import { getLoanRefundsAsTransactions } from '@/lib/data/loan-refunds';
import { getAccountTransfersViaSQL } from '@/lib/utils/hive';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);
const DEFAULT_ACCOUNT = 'valueplan';
const DEFAULT_YEAR = 2025;

/**
 * Metrics API - Uses HiveSQL as source of truth for totals
 * Google Sheets provides metadata for breakdowns (categories, countries, etc.)
 * Loans and refunds tracked separately
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(DEFAULT_YEAR), 10);

    // 1. Get accurate totals from HiveSQL (source of truth) - fetch directly from HiveSQL
    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
    
    let hiveSQLOutgoingHBD = 0;
    let hiveSQLOutgoingHIVE = 0;
    
    try {
      console.log(`Fetching HiveSQL transfers for ${year}...`);
      const hiveSQLTransfers = await getAccountTransfersViaSQL(DEFAULT_ACCOUNT, startDate, endDate);
      
      // Filter to outgoing transfers only (from valueplan)
      const outgoingTransfers = hiveSQLTransfers.filter(t => 
        t.from.toLowerCase() === DEFAULT_ACCOUNT.toLowerCase()
      );
      
      hiveSQLOutgoingHBD = outgoingTransfers
        .filter(t => t.currency === 'HBD')
        .reduce((sum, t) => sum + t.amountValue, 0);
      
      hiveSQLOutgoingHIVE = outgoingTransfers
        .filter(t => t.currency === 'HIVE')
        .reduce((sum, t) => sum + t.amountValue, 0);
      
      console.log(`✅ HiveSQL totals: HBD: ${hiveSQLOutgoingHBD.toFixed(2)}, HIVE: ${hiveSQLOutgoingHIVE.toFixed(2)}`);
    } catch (error) {
      console.warn('Could not fetch HiveSQL data, falling back to Google Sheets only:', error);
      // Continue with Google Sheets data if HiveSQL fails
    }

    // 2. Get Google Sheets data for metadata and breakdowns
    const response = await fetch(SHEETS_CSV_URL, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheets data: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    
    return new Promise<NextResponse>((resolve, reject) => {
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
              return reject(NextResponse.json({ 
                error: 'Could not find header row in CSV',
                debug: { firstRows: rows.slice(0, 5) }
              }, { status: 500 }));
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
              return reject(NextResponse.json({ 
                error: 'Missing essential columns (Wallet or Date)',
                debug: { headerRow, headerMap }
              }, { status: 500 }));
            }

            // Parse transactions from Google Sheets (for metadata/breakdowns)
            const transactions: Transaction[] = [];
            
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              const wallet = String(row[headerMap['wallet']] || '').trim();
              const date = String(row[headerMap['date']] || '').trim();

              if (!wallet || !date) continue;

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

              let parsedDate: Date | null = null;
              try {
                parsedDate = parseDate(date);
                const yearValue = parsedDate.getFullYear();
                if (yearValue < 2020 || yearValue > 2030) {
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

              transaction.totalSpend = calculateTotalSpend(transaction);
              transactions.push(transaction);
            }

            // Calculate breakdowns from Google Sheets (for categories, countries, etc.)
            const sheetsMetrics = calculateMetrics(transactions, year);
            
            // Get loans and refunds data
            const loans = getLoansAsTransactions().filter(t => {
              try {
                return parseDate(t.date).getFullYear() === year;
              } catch {
                return false;
              }
            });

            const loanRefunds = getLoanRefundsAsTransactions().filter(t => {
              try {
                return parseDate(t.date).getFullYear() === year;
              } catch {
                return false;
              }
            });

            const eventRefunds = getEventRefundsAsTransactions().filter(t => {
              try {
                return parseDate(t.date).getFullYear() === year;
              } catch {
                return false;
              }
            });

            // Calculate loan/refund totals
            const totalLoansHbd = loans.reduce((sum, l) => sum + l.hbd, 0);
            const totalLoansHive = loans.reduce((sum, l) => sum + l.hive, 0);
            const totalLoanRefundsHbd = loanRefunds.reduce((sum, r) => sum + r.hbd, 0);
            const totalLoanRefundsHive = loanRefunds.reduce((sum, r) => sum + r.hive, 0);
            const totalRefundsHbd = eventRefunds.reduce((sum, r) => sum + r.hbd, 0);
            const totalRefundsHive = eventRefunds.reduce((sum, r) => sum + r.hive, 0);

            // Calculate HIVE to HBD equivalents
            const conversionRate = 0.24; // 2025 average rate
            const totalLoansHbdEquivalent = totalLoansHbd + (totalLoansHive * conversionRate);
            const totalLoanRefundsHbdEquivalent = totalLoanRefundsHbd + (totalLoanRefundsHive * conversionRate);
            const totalRefundsHbdEquivalent = totalRefundsHbd + (totalRefundsHive * conversionRate);

            // Use HiveSQL totals as source of truth (if available), otherwise use Google Sheets
            const totalHbd = hiveSQLOutgoingHBD > 0 ? hiveSQLOutgoingHBD : sheetsMetrics.totalHbd;
            const totalHive = hiveSQLOutgoingHIVE > 0 ? hiveSQLOutgoingHIVE : sheetsMetrics.totalHive;
            
            // Calculate combined total (HIVE converted to HBD)
            const hiveInHbd = totalHive * conversionRate;
            const combinedTotalHbd = totalHbd + hiveInHbd;

            // Scale breakdowns proportionally if HiveSQL totals differ significantly from Google Sheets
            // (to account for the 3 missing transactions)
            const hbdScaleFactor = hiveSQLOutgoingHBD > 0 && sheetsMetrics.totalHbd > 0 
              ? hiveSQLOutgoingHBD / sheetsMetrics.totalHbd 
              : 1;
            // Note: We scale HBD amounts proportionally; HIVE conversion is handled separately
            // const hiveScaleFactor = hiveSQLOutgoingHIVE > 0 && sheetsMetrics.totalHive > 0
            //   ? hiveSQLOutgoingHIVE / sheetsMetrics.totalHive
            //   : 1;

            // Scale spending breakdowns to match HiveSQL totals
            const scaledSpendingByCategory: Record<string, number> = {};
            Object.entries(sheetsMetrics.spendingByCategory).forEach(([key, value]) => {
              scaledSpendingByCategory[key] = value * hbdScaleFactor;
            });

            const scaledSpendingByCountry: Record<string, number> = {};
            Object.entries(sheetsMetrics.spendingByCountry).forEach(([key, value]) => {
              scaledSpendingByCountry[key] = value * hbdScaleFactor;
            });

            const scaledSpendingByEventType: Record<string, number> = {};
            Object.entries(sheetsMetrics.spendingByEventType).forEach(([key, value]) => {
              scaledSpendingByEventType[key] = value * hbdScaleFactor;
            });

            const scaledSpendingByEventProject: Record<string, number> = {};
            Object.entries(sheetsMetrics.spendingByEventProject).forEach(([key, value]) => {
              scaledSpendingByEventProject[key] = value * hbdScaleFactor;
            });

            const scaledSpendingByWallet: Record<string, number> = {};
            Object.entries(sheetsMetrics.spendingByWallet).forEach(([key, value]) => {
              scaledSpendingByWallet[key] = value * hbdScaleFactor;
            });

            // Build final metrics response
            const metrics = {
              // Use HiveSQL totals as source of truth
              totalHbd,
              totalHive,
              combinedTotalHbd,
              remainingQ4Funds: sheetsMetrics.remainingQ4Funds, // Keep as-is
              
              // Scaled breakdowns (based on Google Sheets metadata, scaled to HiveSQL totals)
              spendingByCategory: scaledSpendingByCategory,
              spendingByCountry: scaledSpendingByCountry,
              spendingByEventType: scaledSpendingByEventType,
              spendingByEventProject: scaledSpendingByEventProject,
              spendingByWallet: scaledSpendingByWallet,
              monthlySpending: sheetsMetrics.monthlySpending, // Keep monthly trends from Google Sheets
              
              // Loans and refunds (tracked separately)
              totalLoansHbd,
              totalLoansHive,
              totalLoansHbdEquivalent,
              totalLoanRefundsHbd,
              totalLoanRefundsHive,
              totalLoanRefundsHbdEquivalent,
              totalRefundsHbd,
              totalRefundsHive,
              totalRefundsHbdEquivalent,
              
              // Metadata
              sourceOfTruth: 'HiveSQL',
              dataYear: year,
            };

            console.log(`Metrics (${year}): Using HiveSQL totals - HBD: ${totalHbd.toFixed(2)}, HIVE: ${totalHive.toFixed(2)}, Combined: ${combinedTotalHbd.toFixed(2)}`);

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
