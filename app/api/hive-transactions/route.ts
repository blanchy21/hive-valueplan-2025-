import { NextResponse } from 'next/server';
import {
  getAccountTransfers,
  getAccountTransfersViaSQL,
  filterTransfersByDate,
  findTransactionById,
  findMatchingTransactions,
} from '@/lib/utils/hive';

const DEFAULT_ACCOUNT = 'valueplan';
const DEFAULT_LIMIT = 1000;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const account = searchParams.get('account') || DEFAULT_ACCOUNT;
    const limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const trxId = searchParams.get('trxId'); // Find specific transaction by ID
    const startDate = searchParams.get('startDate'); // Filter by start date
    const endDate = searchParams.get('endDate'); // Filter by end date
    
    // For verification: find transactions matching specific criteria
    const verifyAmount = searchParams.get('verifyAmount');
    const verifyCurrency = searchParams.get('verifyCurrency') as 'HIVE' | 'HBD' | null;
    const verifyDate = searchParams.get('verifyDate');
    const toleranceDays = parseInt(searchParams.get('toleranceDays') || '1', 10);

    // Determine if we should use SQL (preferred for date ranges) or pagination API
    const useSQL = !!(startDate || endDate || (verifyDate && verifyAmount && verifyCurrency));
    let transfers: Awaited<ReturnType<typeof getAccountTransfers>> = [];

    // Try SQL first if date range is provided (much more efficient)
    if (useSQL) {
      try {
        let start = startDate ? new Date(startDate) : verifyDate ? new Date(verifyDate) : undefined;
        let end = endDate ? new Date(endDate) : undefined;
        
        // For verification queries, expand date range to search window
        if (verifyDate && !startDate && !endDate) {
          const verifyDateObj = new Date(verifyDate);
          start = new Date(verifyDateObj);
          start.setDate(start.getDate() - toleranceDays);
          end = new Date(verifyDateObj);
          end.setDate(end.getDate() + toleranceDays);
        }
        
        transfers = await getAccountTransfersViaSQL(account, start, end);
        console.log(`✅ Fetched ${transfers.length} transfers via HiveSQL`);
      } catch (error) {
        console.warn('HiveSQL query failed, falling back to pagination API:', error);
        // Fall back to pagination method
        transfers = await getAccountTransfers(account, limit);
        
        // Apply date filtering if provided
        if (startDate || endDate) {
          const start = startDate ? new Date(startDate) : undefined;
          const end = endDate ? new Date(endDate) : undefined;
          transfers = filterTransfersByDate(transfers, start, end);
        }
      }
    } else {
      // No date range specified, use pagination API
      transfers = await getAccountTransfers(account, limit);
    }

    // If searching for specific transaction ID
    if (trxId) {
      const found = findTransactionById(transfers, trxId);
      if (found) {
        return NextResponse.json({
          account,
          transaction: found,
          found: true,
        });
      } else {
        return NextResponse.json({
          account,
          transaction: null,
          found: false,
          message: `Transaction ${trxId} not found in recent ${limit} transactions`,
        });
      }
    }

    // If verifying a transaction (matching amount, currency, and date)
    if (verifyAmount && verifyCurrency && verifyDate) {
      const amount = parseFloat(verifyAmount);
      const date = new Date(verifyDate);
      
      if (isNaN(amount) || isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'Invalid verifyAmount or verifyDate format' },
          { status: 400 }
        );
      }

      const matches = findMatchingTransactions(transfers, amount, verifyCurrency, date, toleranceDays);
      
      return NextResponse.json({
        account,
        verification: {
          amount,
          currency: verifyCurrency,
          date: verifyDate,
          toleranceDays,
        },
        matches,
        matchCount: matches.length,
      });
    }

    // Additional date filtering (if SQL wasn't used or for post-processing)
    // Note: If SQL was used, date filtering is already applied, but we can refine if needed
    if (!useSQL && (startDate || endDate)) {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      
      if (start && isNaN(start.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format' },
          { status: 400 }
        );
      }
      
      if (end && isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format' },
          { status: 400 }
        );
      }

      transfers = filterTransfersByDate(transfers, start, end);
    }

    // Sort by timestamp (newest first)
    transfers.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Calculate summary statistics
    const summary = {
      totalTransfers: transfers.length,
      totalHBD: transfers
        .filter(t => t.currency === 'HBD')
        .reduce((sum, t) => sum + t.amountValue, 0),
      totalHIVE: transfers
        .filter(t => t.currency === 'HIVE')
        .reduce((sum, t) => sum + t.amountValue, 0),
      incoming: {
        hbd: transfers
          .filter(t => t.to.toLowerCase() === account.replace('@', '').toLowerCase() && t.currency === 'HBD')
          .reduce((sum, t) => sum + t.amountValue, 0),
        hive: transfers
          .filter(t => t.to.toLowerCase() === account.replace('@', '').toLowerCase() && t.currency === 'HIVE')
          .reduce((sum, t) => sum + t.amountValue, 0),
      },
      outgoing: {
        hbd: transfers
          .filter(t => t.from.toLowerCase() === account.replace('@', '').toLowerCase() && t.currency === 'HBD')
          .reduce((sum, t) => sum + t.amountValue, 0),
        hive: transfers
          .filter(t => t.from.toLowerCase() === account.replace('@', '').toLowerCase() && t.currency === 'HIVE')
          .reduce((sum, t) => sum + t.amountValue, 0),
      },
    };

    return NextResponse.json({
      account,
      transfers,
      summary,
      filters: {
        limit,
        startDate: startDate || null,
        endDate: endDate || null,
        method: useSQL ? 'sql' : 'pagination',
      },
    });
  } catch (error) {
    console.error('Error fetching Hive transactions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Hive transactions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

