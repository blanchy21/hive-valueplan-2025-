import { NextResponse } from 'next/server';
import { getLoansAsTransactions } from '@/lib/data/loans';
import { getLoanRefundsAsTransactions } from '@/lib/data/loan-refunds';
import { getEventRefundsAsTransactions } from '@/lib/data/event-refunds';
import { readFile } from 'fs/promises';
import { join } from 'path';
import Papa from 'papaparse';
import { parseDate } from '@/lib/utils/data';

/**
 * Check if missing HiveSQL transactions are in loans/refunds data
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    const yearNum = parseInt(year, 10);

    // Get loans and refunds data
    const loans = getLoansAsTransactions();
    const loanRefunds = getLoanRefundsAsTransactions();
    const eventRefunds = getEventRefundsAsTransactions();

    // Filter to 2025
    const loans2025 = loans.filter(t => {
      try {
        const date = parseDate(t.date);
        return date.getFullYear() === yearNum;
      } catch {
        return false;
      }
    });

    const loanRefunds2025 = loanRefunds.filter(t => {
      try {
        const date = parseDate(t.date);
        return date.getFullYear() === yearNum;
      } catch {
        return false;
      }
    });

    const eventRefunds2025 = eventRefunds.filter(t => {
      try {
        const date = parseDate(t.date);
        return date.getFullYear() === yearNum;
      } catch {
        return false;
      }
    });

    // Read the HiveSQL CSV to get missing transactions
    const csvFilePath = join(process.cwd(), `valueplan_transactions_${year}.csv`);
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
      
      hiveSQLTransfers = parsed.data.map((row: Record<string, string>) => ({
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

    // Focus on incoming transfers (loans) - where valueplan is the recipient
    const incomingTransfers = hiveSQLTransfers.filter(t => 
      t.to.toLowerCase() === 'valueplan'
    );

    // Check which incoming transfers match loans
    const matchingLoans: Array<{
      hiveSQL: typeof hiveSQLTransfers[0];
      loan?: typeof loans2025[0];
      matchReason: string;
    }> = [];

    const unmatchedIncoming: typeof hiveSQLTransfers = [];

    for (const transfer of incomingTransfers) {
      const transferDate = new Date(transfer.timestamp);
      const dayStart = new Date(transferDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(transferDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Check if it matches a loan
      let matched = false;
      for (const loan of loans2025) {
        try {
          const loanDate = parseDate(loan.date);
          const amount = transfer.currency === 'HBD' ? transfer.amountValue : 0;
          
          // Check date match (same day)
          if (
            loanDate >= dayStart &&
            loanDate <= dayEnd &&
            Math.abs(loan.hbd - amount) < 0.01 &&
            transfer.currency === 'HBD'
          ) {
            matchingLoans.push({
              hiveSQL: transfer,
              loan,
              matchReason: 'Amount and date match',
            });
            matched = true;
            break;
          }
        } catch {
          // Skip if date parsing fails
        }
      }

      if (!matched) {
        // Check if memo contains "loan"
        if (transfer.memo.toLowerCase().includes('loan')) {
          unmatchedIncoming.push(transfer);
        }
      }
    }

    // Check outgoing transfers for refunds
    const outgoingTransfers = hiveSQLTransfers.filter(t => 
      t.from.toLowerCase() === 'valueplan'
    );

    // Check refunds
    const allRefunds = [...loanRefunds2025, ...eventRefunds2025];
    const matchingRefunds: Array<{
      hiveSQL: typeof hiveSQLTransfers[0];
      refund?: typeof allRefunds[0];
      matchReason: string;
    }> = [];

    const unmatchedRefunds: typeof hiveSQLTransfers = [];

    for (const transfer of outgoingTransfers) {
      const transferDate = new Date(transfer.timestamp);
      const dayStart = new Date(transferDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(transferDate);
      dayEnd.setHours(23, 59, 59, 999);

      let matched = false;
      for (const refund of allRefunds) {
        try {
          const refundDate = parseDate(refund.date);
          const amount = transfer.currency === 'HBD' ? transfer.amountValue : 0;
          
          if (
            refundDate >= dayStart &&
            refundDate <= dayEnd &&
            Math.abs(refund.hbd - amount) < 0.01 &&
            transfer.currency === 'HBD'
          ) {
            matchingRefunds.push({
              hiveSQL: transfer,
              refund,
              matchReason: 'Amount and date match',
            });
            matched = true;
            break;
          }
        } catch {
          // Skip if date parsing fails
        }
      }

      if (!matched && (
        transfer.memo.toLowerCase().includes('refund') ||
        transfer.memo.toLowerCase().includes('return')
      )) {
        unmatchedRefunds.push(transfer);
      }
    }

    // Calculate totals
    const loansTotalHBD = loans2025.reduce((sum, t) => sum + t.hbd, 0);
    const loanRefundsTotalHBD = loanRefunds2025.reduce((sum, t) => sum + t.hbd, 0);
    const eventRefundsTotalHBD = eventRefunds2025.reduce((sum, t) => sum + t.hbd, 0);

    const incomingTotalHBD = incomingTransfers
      .filter(t => t.currency === 'HBD')
      .reduce((sum, t) => sum + t.amountValue, 0);

    const unmatchedIncomingTotalHBD = unmatchedIncoming
      .filter(t => t.currency === 'HBD')
      .reduce((sum, t) => sum + t.amountValue, 0);

    return NextResponse.json({
      year: yearNum,
      summary: {
        loansInData: {
          count: loans2025.length,
          totalHBD: loansTotalHBD,
        },
        loanRefundsInData: {
          count: loanRefunds2025.length,
          totalHBD: loanRefundsTotalHBD,
        },
        eventRefundsInData: {
          count: eventRefunds2025.length,
          totalHBD: eventRefundsTotalHBD,
        },
        incomingTransfersInHiveSQL: {
          count: incomingTransfers.length,
          totalHBD: incomingTotalHBD,
        },
        matchedLoans: {
          count: matchingLoans.length,
          totalHBD: matchingLoans.reduce((sum, m) => sum + m.hiveSQL.amountValue, 0),
        },
        unmatchedIncomingWithLoanMemo: {
          count: unmatchedIncoming.length,
          totalHBD: unmatchedIncomingTotalHBD,
          transactions: unmatchedIncoming.slice(0, 20), // Limit to first 20
        },
        matchedRefunds: {
          count: matchingRefunds.length,
          totalHBD: matchingRefunds.reduce((sum, m) => sum + m.hiveSQL.amountValue, 0),
        },
        unmatchedRefunds: {
          count: unmatchedRefunds.length,
          totalHBD: unmatchedRefunds
            .filter(t => t.currency === 'HBD')
            .reduce((sum, t) => sum + t.amountValue, 0),
          transactions: unmatchedRefunds.slice(0, 20), // Limit to first 20
        },
      },
      matchingLoans: matchingLoans.slice(0, 10), // Sample
      matchingRefunds: matchingRefunds.slice(0, 10), // Sample
    });
  } catch (error) {
    console.error('Error checking missing transactions:', error);
    return NextResponse.json(
      {
        error: 'Failed to check missing transactions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

