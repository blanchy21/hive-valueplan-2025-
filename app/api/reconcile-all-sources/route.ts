import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { Transaction } from '@/lib/types';
import { parseNumber, parseDate } from '@/lib/utils/data';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import { getLoansAsTransactions } from '@/lib/data/loans';
import { getLoanRefundsAsTransactions } from '@/lib/data/loan-refunds';
import { getEventRefundsAsTransactions } from '@/lib/data/event-refunds';
import { readFile } from 'fs/promises';
import { join } from 'path';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);
const DEFAULT_ACCOUNT = 'valueplan';

/**
 * Complete reconciliation: HiveSQL vs Google Sheets + Loans + Refunds
 * This shows the true picture of all transactions
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    const yearNum = parseInt(year, 10);

    // 1. Read HiveSQL data
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
        },
        { status: 404 }
      );
    }

    // 2. Get Google Sheets data (outgoing spending only)
    const sheetsResponse = await fetch(SHEETS_CSV_URL, {
      next: { revalidate: 3600 },
    });
    const csvText = await sheetsResponse.text();
    
    const sheetsTransactions = await new Promise<Transaction[]>((resolve, reject) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rows: string[][] = results.data as string[][];
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
              return reject(new Error('Could not find header row'));
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

              let parsedDate: Date | null = null;
              try {
                parsedDate = parseDate(date);
                if (parsedDate.getFullYear() !== yearNum) continue;
              } catch {
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

    const sheets2025 = sheetsTransactions.filter(t => {
      try {
        return parseDate(t.date).getFullYear() === yearNum;
      } catch {
        return false;
      }
    });

    // 3. Get Loans, Loan Refunds, Event Refunds
    const loans2025 = getLoansAsTransactions().filter(t => {
      try {
        return parseDate(t.date).getFullYear() === yearNum;
      } catch {
        return false;
      }
    });

    const loanRefunds2025 = getLoanRefundsAsTransactions().filter(t => {
      try {
        return parseDate(t.date).getFullYear() === yearNum;
      } catch {
        return false;
      }
    });

    const eventRefunds2025 = getEventRefundsAsTransactions().filter(t => {
      try {
        return parseDate(t.date).getFullYear() === yearNum;
      } catch {
        return false;
      }
    });

    // 4. Calculate HiveSQL totals (split by direction)
    const outgoingHiveSQL = hiveSQLTransfers.filter(t => 
      t.from.toLowerCase() === DEFAULT_ACCOUNT
    );
    const incomingHiveSQL = hiveSQLTransfers.filter(t => 
      t.to.toLowerCase() === DEFAULT_ACCOUNT
    );

    const outgoingHBD = outgoingHiveSQL
      .filter(t => t.currency === 'HBD')
      .reduce((sum, t) => sum + t.amountValue, 0);
    const outgoingHIVE = outgoingHiveSQL
      .filter(t => t.currency === 'HIVE')
      .reduce((sum, t) => sum + t.amountValue, 0);

    const incomingHBD = incomingHiveSQL
      .filter(t => t.currency === 'HBD')
      .reduce((sum, t) => sum + t.amountValue, 0);
    const incomingHIVE = incomingHiveSQL
      .filter(t => t.currency === 'HIVE')
      .reduce((sum, t) => sum + t.amountValue, 0);

    // 5. Calculate combined totals from all sources
    const sheetsHBD = sheets2025.reduce((sum, t) => sum + t.hbd, 0);
    const sheetsHIVE = sheets2025.reduce((sum, t) => sum + t.hive, 0);

    const loansHBD = loans2025.reduce((sum, t) => sum + t.hbd, 0);
    const loansHIVE = loans2025.reduce((sum, t) => sum + t.hive, 0);

    const loanRefundsHBD = loanRefunds2025.reduce((sum, t) => sum + t.hbd, 0);
    const loanRefundsHIVE = loanRefunds2025.reduce((sum, t) => sum + t.hive, 0);

    const eventRefundsHBD = eventRefunds2025.reduce((sum, t) => sum + t.hbd, 0);
    const eventRefundsHIVE = eventRefunds2025.reduce((sum, t) => sum + t.hive, 0);

    // 6. Reconciliation
    const combinedOutgoingHBD = sheetsHBD;
    const combinedOutgoingHIVE = sheetsHIVE;
    
    const combinedIncomingHBD = loansHBD + loanRefundsHBD + eventRefundsHBD;
    const combinedIncomingHIVE = loansHIVE + loanRefundsHIVE + eventRefundsHIVE;

    const outgoingDiffHBD = outgoingHBD - combinedOutgoingHBD;
    const outgoingDiffHIVE = outgoingHIVE - combinedOutgoingHIVE;
    const incomingDiffHBD = incomingHBD - combinedIncomingHBD;
    const incomingDiffHIVE = incomingHIVE - combinedIncomingHIVE;

    // 7. Find truly unaccounted transactions
    // Outgoing transactions not in Google Sheets
    const unaccountedOutgoing: typeof hiveSQLTransfers = [];
    
    for (const transfer of outgoingHiveSQL) {
      const transferDate = new Date(transfer.timestamp);
      const dayStart = new Date(transferDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(transferDate);
      dayEnd.setHours(23, 59, 59, 999);

      let found = false;
      for (const sheetTx of sheets2025) {
        try {
          const sheetDate = parseDate(sheetTx.date);
          const amount = transfer.currency === 'HBD' ? transfer.amountValue : transfer.amountValue;
          const sheetAmount = transfer.currency === 'HBD' ? sheetTx.hbd : sheetTx.hive;
          
          if (
            sheetDate >= dayStart &&
            sheetDate <= dayEnd &&
            Math.abs(sheetAmount - amount) < 0.01 &&
            ((transfer.currency === 'HBD' && sheetTx.hbd > 0) || 
             (transfer.currency === 'HIVE' && sheetTx.hive > 0))
          ) {
            found = true;
            break;
          }
        } catch {
          // Skip if date parsing fails
        }
      }
      
      if (!found) {
        unaccountedOutgoing.push(transfer);
      }
    }

    // Incoming transactions not in loans/refunds
    const unaccountedIncoming: typeof hiveSQLTransfers = [];
    
    for (const transfer of incomingHiveSQL) {
      const transferDate = new Date(transfer.timestamp);
      const dayStart = new Date(transferDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(transferDate);
      dayEnd.setHours(23, 59, 59, 999);

      let found = false;
      
      // Check loans
      for (const loan of loans2025) {
        try {
          const loanDate = parseDate(loan.date);
          const amount = transfer.currency === 'HBD' ? transfer.amountValue : 0;
          
          if (
            loanDate >= dayStart &&
            loanDate <= dayEnd &&
            Math.abs(loan.hbd - amount) < 0.01 &&
            transfer.currency === 'HBD'
          ) {
            found = true;
            break;
          }
        } catch {
          // Skip
        }
      }
      
      if (!found) {
        // Check loan refunds
        for (const refund of [...loanRefunds2025, ...eventRefunds2025]) {
          try {
            const refundDate = parseDate(refund.date);
            const amount = transfer.currency === 'HBD' ? transfer.amountValue : transfer.amountValue;
            const refundAmount = transfer.currency === 'HBD' ? refund.hbd : refund.hive;
            
            if (
              refundDate >= dayStart &&
              refundDate <= dayEnd &&
              Math.abs(refundAmount - amount) < 0.01
            ) {
              found = true;
              break;
            }
          } catch {
            // Skip
          }
        }
      }
      
      if (!found) {
        unaccountedIncoming.push(transfer);
      }
    }

    return NextResponse.json({
      year: yearNum,
      sourceOfTruth: 'HiveSQL (Blockchain Data)',
      reconciliation: {
        outgoing: {
          hiveSQL: {
            totalHBD: outgoingHBD,
            totalHIVE: outgoingHIVE,
            count: outgoingHiveSQL.length,
          },
          googleSheets: {
            totalHBD: combinedOutgoingHBD,
            totalHIVE: combinedOutgoingHIVE,
            count: sheets2025.length,
          },
          difference: {
            hbd: outgoingDiffHBD,
            hive: outgoingDiffHIVE,
            hbdPercent: ((outgoingDiffHBD / Math.max(outgoingHBD, 1)) * 100).toFixed(2) + '%',
            hivePercent: ((outgoingDiffHIVE / Math.max(outgoingHIVE, 1)) * 100).toFixed(2) + '%',
          },
          unaccounted: {
            count: unaccountedOutgoing.length,
            totalHBD: unaccountedOutgoing.filter(t => t.currency === 'HBD').reduce((sum, t) => sum + t.amountValue, 0),
            totalHIVE: unaccountedOutgoing.filter(t => t.currency === 'HIVE').reduce((sum, t) => sum + t.amountValue, 0),
            transactions: unaccountedOutgoing.slice(0, 50),
          },
        },
        incoming: {
          hiveSQL: {
            totalHBD: incomingHBD,
            totalHIVE: incomingHIVE,
            count: incomingHiveSQL.length,
          },
          combinedSources: {
            loans: { hbd: loansHBD, hive: loansHIVE, count: loans2025.length },
            loanRefunds: { hbd: loanRefundsHBD, hive: loanRefundsHIVE, count: loanRefunds2025.length },
            eventRefunds: { hbd: eventRefundsHBD, hive: eventRefundsHIVE, count: eventRefunds2025.length },
            totalHBD: combinedIncomingHBD,
            totalHIVE: combinedIncomingHIVE,
          },
          difference: {
            hbd: incomingDiffHBD,
            hive: incomingDiffHIVE,
            hbdPercent: ((incomingDiffHBD / Math.max(incomingHBD, 1)) * 100).toFixed(2) + '%',
            hivePercent: ((incomingDiffHIVE / Math.max(incomingHIVE, 1)) * 100).toFixed(2) + '%',
          },
          unaccounted: {
            count: unaccountedIncoming.length,
            totalHBD: unaccountedIncoming.filter(t => t.currency === 'HBD').reduce((sum, t) => sum + t.amountValue, 0),
            totalHIVE: unaccountedIncoming.filter(t => t.currency === 'HIVE').reduce((sum, t) => sum + t.amountValue, 0),
            transactions: unaccountedIncoming.slice(0, 50),
          },
        },
      },
      accurateTotals: {
        totalOutgoingHBD: outgoingHBD,
        totalOutgoingHIVE: outgoingHIVE,
        totalIncomingHBD: incomingHBD,
        totalIncomingHIVE: incomingHIVE,
        netHBD: incomingHBD - outgoingHBD,
        netHIVE: incomingHIVE - outgoingHIVE,
        totalTransactions: hiveSQLTransfers.length,
      },
      breakdown: {
        outgoingByCategory: {
          regularSpending: {
            hbd: sheetsHBD,
            hive: sheetsHIVE,
            count: sheets2025.length,
          },
          unaccounted: {
            hbd: unaccountedOutgoing.filter(t => t.currency === 'HBD').reduce((sum, t) => sum + t.amountValue, 0),
            hive: unaccountedOutgoing.filter(t => t.currency === 'HIVE').reduce((sum, t) => sum + t.amountValue, 0),
            count: unaccountedOutgoing.length,
          },
        },
        incomingByCategory: {
          loans: { hbd: loansHBD, hive: loansHIVE, count: loans2025.length },
          loanRefunds: { hbd: loanRefundsHBD, hive: loanRefundsHIVE, count: loanRefunds2025.length },
          eventRefunds: { hbd: eventRefundsHBD, hive: eventRefundsHIVE, count: eventRefunds2025.length },
          unaccounted: {
            hbd: unaccountedIncoming.filter(t => t.currency === 'HBD').reduce((sum, t) => sum + t.amountValue, 0),
            hive: unaccountedIncoming.filter(t => t.currency === 'HIVE').reduce((sum, t) => sum + t.amountValue, 0),
            count: unaccountedIncoming.length,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error reconciling sources:', error);
    return NextResponse.json(
      {
        error: 'Failed to reconcile sources',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

