import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { Transaction } from '@/lib/types';
import { parseNumber, parseDate } from '@/lib/utils/data';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import { readFile } from 'fs/promises';
import { join } from 'path';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);
const DEFAULT_ACCOUNT = 'valueplan';

/**
 * Compare HiveSQL blockchain data with Google Sheets data for 2025
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    const yearNum = parseInt(year, 10);

    // Parse the HiveSQL CSV file
    const csvFilePath = join(process.cwd(), `${DEFAULT_ACCOUNT}_transactions_${year}.csv`);
    let hiveSQLTransfers: Array<{
      trx_id: string;
      timestamp: string;
      from: string;
      to: string;
      amount: string;
      currency: string;
      amountValue: number;
      memo: string;
    }> = [];

    try {
      const csvContent = await readFile(csvFilePath, 'utf-8');
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
      });
      
      hiveSQLTransfers = (parsed.data as Record<string, string>[]).map((row) => ({
        trx_id: row['Transaction ID'] || '',
        timestamp: row['Timestamp'] || '',
        from: row['From Account'] || '',
        to: row['To Account'] || '',
        amount: row['Amount'] || '',
        currency: row['Currency'] || '',
        amountValue: parseFloat(row['Amount Value'] || '0'),
        memo: row['Memo'] || '',
      }));
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to read HiveSQL CSV file',
          details: error instanceof Error ? error.message : 'Unknown error',
          suggestion: `Make sure ${DEFAULT_ACCOUNT}_transactions_${year}.csv exists. Run the export endpoint first.`,
        },
        { status: 404 }
      );
    }

    // Fetch Google Sheets data
    const sheetsResponse = await fetch(SHEETS_CSV_URL, {
      next: { revalidate: 3600 },
    });

    if (!sheetsResponse.ok) {
      throw new Error(`Failed to fetch Google Sheets: ${sheetsResponse.status} ${sheetsResponse.statusText}`);
    }

    const csvText = await sheetsResponse.text();
    
    // Parse Google Sheets CSV
    const sheetsTransactions = await new Promise<Transaction[]>((resolve, reject) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rows: string[][] = results.data as string[][];
            
            // Find header row
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
              return reject(new Error('Could not find header row in Google Sheets CSV'));
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

            const transactions: Transaction[] = [];
            
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              const wallet = String(row[headerMap['wallet']] || '').trim();
              const date = String(row[headerMap['date']] || '').trim();
              
              if (!wallet || !date) continue;

              // Parse date
              let parsedDate: Date | null = null;
              try {
                parsedDate = parseDate(date);
                const year = parsedDate.getFullYear();
                if (year < 2020 || year > 2030) continue;
              } catch {
                continue;
              }

              // Filter by year
              if (parsedDate && parsedDate.getFullYear() !== yearNum) {
                continue;
              }

              const hbd = parseNumber(row[headerMap['hbd']] || 0);
              const hive = parseNumber(row[headerMap['hive']] || 0);

              if (hbd === 0 && hive === 0) continue;

              transactions.push({
                wallet,
                date,
                hbd,
                hive,
                eventProject: '',
                country: '',
                theme: '',
                eventType: '',
                category: '',
              });
            }

            resolve(transactions);
          } catch (error) {
            reject(error);
          }
        },
        error: (error: Error) => reject(error),
      });
    });

    // Calculate totals from Google Sheets
    const sheets2025 = sheetsTransactions.filter(t => {
      try {
        const date = parseDate(t.date);
        return date.getFullYear() === yearNum;
      } catch {
        return false;
      }
    });

    const sheetsHBD = sheets2025.reduce((sum, t) => sum + t.hbd, 0);
    const sheetsHIVE = sheets2025.reduce((sum, t) => sum + t.hive, 0);
    const sheetsCount = sheets2025.length;

    // Calculate totals from HiveSQL
    const hiveSQLHBD = hiveSQLTransfers
      .filter(t => t.currency === 'HBD')
      .reduce((sum, t) => sum + t.amountValue, 0);
    
    const hiveSQLHIVE = hiveSQLTransfers
      .filter(t => t.currency === 'HIVE')
      .reduce((sum, t) => sum + t.amountValue, 0);
    
    const hiveSQLCount = hiveSQLTransfers.length;

    // Calculate discrepancies
    const hbdDiff = sheetsHBD - hiveSQLHBD;
    const hiveDiff = sheetsHIVE - hiveSQLHIVE;
    const countDiff = sheetsCount - hiveSQLCount;

    // Find transactions in Sheets but not in HiveSQL (by amount and approximate date)
    const missingInHiveSQL: Transaction[] = [];
    const matchedTransactions: string[] = [];

    for (const sheetTx of sheets2025) {
      const txDate = parseDate(sheetTx.date);
      const dayStart = new Date(txDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(txDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Look for matching transaction in HiveSQL
      const found = hiveSQLTransfers.find(hiveTx => {
        const hiveDate = new Date(hiveTx.timestamp);
        const amount = sheetTx.hbd > 0 ? sheetTx.hbd : sheetTx.hive;
        const currency = sheetTx.hbd > 0 ? 'HBD' : 'HIVE';
        
        return (
          hiveDate >= dayStart &&
          hiveDate <= dayEnd &&
          Math.abs(hiveTx.amountValue - amount) < 0.01 &&
          hiveTx.currency === currency
        );
      });

      if (!found) {
        missingInHiveSQL.push(sheetTx);
      } else {
        matchedTransactions.push(found.trx_id);
      }
    }

    // Find transactions in HiveSQL but not in Sheets
    const missingInSheets = hiveSQLTransfers.filter(hiveTx => {
      return !matchedTransactions.includes(hiveTx.trx_id);
    });

    return NextResponse.json({
      year: yearNum,
      comparison: {
        googleSheets: {
          totalHBD: sheetsHBD,
          totalHIVE: sheetsHIVE,
          transactionCount: sheetsCount,
        },
        hiveSQL: {
          totalHBD: hiveSQLHBD,
          totalHIVE: hiveSQLHIVE,
          transactionCount: hiveSQLCount,
        },
        discrepancies: {
          hbdDifference: hbdDiff,
          hbdDifferencePercent: ((hbdDiff / Math.max(sheetsHBD, 1)) * 100).toFixed(2) + '%',
          hiveDifference: hiveDiff,
          hiveDifferencePercent: ((hiveDiff / Math.max(sheetsHIVE, 1)) * 100).toFixed(2) + '%',
          countDifference: countDiff,
        },
      },
      missingInHiveSQL: {
        count: missingInHiveSQL.length,
        transactions: missingInHiveSQL.slice(0, 50), // Limit to first 50
        totalHBD: missingInHiveSQL.reduce((sum, t) => sum + t.hbd, 0),
        totalHIVE: missingInHiveSQL.reduce((sum, t) => sum + t.hive, 0),
      },
      missingInSheets: {
        count: missingInSheets.length,
        transactions: missingInSheets.slice(0, 50), // Limit to first 50
        totalHBD: missingInSheets.filter(t => t.currency === 'HBD').reduce((sum, t) => sum + t.amountValue, 0),
        totalHIVE: missingInSheets.filter(t => t.currency === 'HIVE').reduce((sum, t) => sum + t.amountValue, 0),
      },
      summary: {
        sheetsHasMore: sheetsCount > hiveSQLCount,
        hbdMatches: Math.abs(hbdDiff) < 1,
        hiveMatches: Math.abs(hiveDiff) < 1,
        countsMatch: countDiff === 0,
      },
    });
  } catch (error) {
    console.error('Error comparing data sources:', error);
    return NextResponse.json(
      {
        error: 'Failed to compare data sources',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

