import { NextResponse } from 'next/server';
import { getVerticalsData } from '@/lib/data/verticals';
import { VerticalsData } from '@/lib/types/verticals';
import { aggregateByVerticalCategory, parseNumber, parseDate, detectTransactionType, calculateTotalSpend, filterSpendingTransactions, convertHiveToHbd } from '@/lib/utils/data';
import { Transaction } from '@/lib/types';
import Papa from 'papaparse';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import { getAccountTransfersViaSQL } from '@/lib/utils/hive';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);

async function fetchTransactions(): Promise<Transaction[]> {
  try {
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
            
            // Map header names to column indices
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

            // Parse data rows
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

              // Try to parse the date
              try {
                const parsedDate = parseDate(date);
                const year = parsedDate.getFullYear();
                if (year < 2020 || year > 2030) continue;
              } catch {
                continue;
              }

              const hbdIndex = headerMap['hbd'];
              const hiveIndex = headerMap['hive'];
              const hiveToHbdIndex = headerMap['hiveToHbd'];
              const hbd = hbdIndex !== undefined ? parseNumber(row[hbdIndex] || 0) : 0;
              const hive = hiveIndex !== undefined ? parseNumber(row[hiveIndex] || 0) : 0;
              const hiveToHbd = hiveToHbdIndex !== undefined ? parseNumber(row[hiveToHbdIndex] || 0) : undefined;

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
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const verticalsData = getVerticalsData();
    const year = 2025;
    const DEFAULT_ACCOUNT = 'valueplan';
    
    // 1. Fetch accurate totals from HiveSQL (source of truth)
    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
    
    let hiveSQLOutgoingHBD = 0;
    let hiveSQLOutgoingHIVE = 0;
    
    try {
      console.log(`[Verticals] Fetching HiveSQL transfers for ${year}...`);
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
      
      console.log(`[Verticals] ✅ HiveSQL totals: HBD: ${hiveSQLOutgoingHBD.toFixed(2)}, HIVE: ${hiveSQLOutgoingHIVE.toFixed(2)}`);
    } catch (error) {
      console.warn('[Verticals] Could not fetch HiveSQL data, falling back to Google Sheets only:', error);
    }
    
    // 2. Fetch transactions from Google Sheets for project matching (metadata)
    const transactions = await fetchTransactions();
    
    // Prepare vertical projects for matching
    const verticalProjects = verticalsData.projects.map(p => ({
      project: p.project,
      category: p.category
    }));
    
    // Aggregate transactions by vertical category for the current year (2025)
    // This gives us the proportions/breakdown from Google Sheets
    const verticalTotals = aggregateByVerticalCategory(transactions, year, verticalProjects);
    
    // Calculate totals from Google Sheets (for scaling)
    const spendingTransactions2025 = filterSpendingTransactions(transactions).filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === year;
      } catch {
        return false;
      }
    });
    
    const sheetsTotalHbd2025 = spendingTransactions2025.reduce((sum: number, tx: Transaction) => sum + (tx.hbd || 0), 0);
    const sheetsTotalHive2025 = spendingTransactions2025.reduce((sum: number, tx: Transaction) => sum + (tx.hive || 0), 0);
    const sheetsTotalHiveInHbd2025 = spendingTransactions2025.reduce((sum: number, tx: Transaction) => {
      if (tx.hiveToHbd !== undefined) {
        return sum + tx.hiveToHbd;
      } else if (tx.hive) {
        return sum + convertHiveToHbd(tx.hive);
      }
      return sum;
    }, 0);
    const sheetsCombinedTotalHbd2025 = sheetsTotalHbd2025 + sheetsTotalHiveInHbd2025;
    
    // Use HiveSQL totals as source of truth (if available), otherwise use Google Sheets
    const totalHbd2025 = hiveSQLOutgoingHBD > 0 ? hiveSQLOutgoingHBD : sheetsTotalHbd2025;
    const totalHive2025 = hiveSQLOutgoingHIVE > 0 ? hiveSQLOutgoingHIVE : sheetsTotalHive2025;
    
    // Calculate combined total (HIVE converted to HBD)
    const conversionRate = 0.24; // 2025 average rate
    const hiveInHbd = totalHive2025 * conversionRate;
    const combinedTotalHbd2025 = totalHbd2025 + hiveInHbd;
    
    // Calculate scale factor to match HiveSQL totals
    const scaleFactor = sheetsCombinedTotalHbd2025 > 0 && combinedTotalHbd2025 > 0
      ? combinedTotalHbd2025 / sheetsCombinedTotalHbd2025
      : 1;
    
    // Scale vertical totals to match HiveSQL totals
    const scaledVerticalTotals: Record<string, {
      totalHbd: number;
      totalHive: number;
      totalHiveInHbd: number;
      combinedTotalHbd: number;
    }> = {};
    
    Object.entries(verticalTotals).forEach(([categoryName, totals]) => {
      scaledVerticalTotals[categoryName] = {
        totalHbd: totals.totalHbd * scaleFactor,
        totalHive: totals.totalHive * scaleFactor,
        totalHiveInHbd: totals.totalHiveInHbd * scaleFactor,
        combinedTotalHbd: totals.combinedTotalHbd * scaleFactor
      };
    });
    
    // Sum scaled vertical totals
    const scaledVerticalsTotal = Object.values(scaledVerticalTotals).reduce((sum, totals) => sum + totals.combinedTotalHbd, 0);
    
    // Log validation
    console.log(`\n=== VERTICALS TOTALS VALIDATION (${year}) ===`);
    console.log(`HiveSQL Total (source of truth): ${combinedTotalHbd2025.toFixed(2)} HBD`);
    console.log(`Google Sheets Total: ${sheetsCombinedTotalHbd2025.toFixed(2)} HBD`);
    console.log(`Scale Factor: ${scaleFactor.toFixed(4)}`);
    console.log(`Scaled Verticals Total: ${scaledVerticalsTotal.toFixed(2)} HBD`);
    console.log(`Unmatched: ${(combinedTotalHbd2025 - scaledVerticalsTotal).toFixed(2)} HBD`);
    console.log(`Coverage: ${((scaledVerticalsTotal / combinedTotalHbd2025) * 100).toFixed(2)}%`);
    console.log(`==========================================\n`);
    
    // Add scaled Hive and HBD values to each category
    verticalsData.categories = verticalsData.categories.map(category => {
      const totals = scaledVerticalTotals[category.name] || {
        totalHbd: 0,
        totalHive: 0,
        totalHiveInHbd: 0,
        combinedTotalHbd: 0
      };
      
      return {
        ...category,
        totalHbd: totals.totalHbd,
        totalHive: totals.totalHive,
        totalHiveInHbd: totals.totalHiveInHbd,
        combinedTotalHbd: totals.combinedTotalHbd
      };
    });
    
    // Add summary totals to the response for validation (extend the type)
    const responseData = verticalsData as VerticalsData & { totalsSummary?: {
      totalHbd2025: number;
      totalHive2025: number;
      totalHiveInHbd2025: number;
      combinedTotalHbd2025: number;
      verticalsTotal: number;
      unmatchedAmount: number;
      sourceOfTruth: string;
      scaleFactor: number;
    }};
    responseData.totalsSummary = {
      totalHbd2025,
      totalHive2025,
      totalHiveInHbd2025: hiveInHbd,
      combinedTotalHbd2025,
      verticalsTotal: scaledVerticalsTotal,
      unmatchedAmount: combinedTotalHbd2025 - scaledVerticalsTotal,
      sourceOfTruth: hiveSQLOutgoingHBD > 0 ? 'HiveSQL' : 'Google Sheets',
      scaleFactor
    };
    
    return NextResponse.json(verticalsData);
  } catch (error) {
    console.error('Error getting verticals data:', error);
    return NextResponse.json(
      {
        error: 'Failed to get verticals data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
