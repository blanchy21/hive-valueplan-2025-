import { NextResponse } from 'next/server';
import { getAccountTransfersViaSQL } from '@/lib/utils/hive';

const DEFAULT_ACCOUNT = 'valueplan';

/**
 * Optimized endpoint specifically for 2025 transactions
 * Uses HiveSQL for efficient date-range queries
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const account = searchParams.get('account') || DEFAULT_ACCOUNT;
    
    // Hardcode 2025 date range for optimization
    const startDate = new Date('2025-01-01T00:00:00.000Z');
    const endDate = new Date('2025-12-31T23:59:59.999Z');
    
    // Fetch 2025 transfers using HiveSQL (much faster than pagination)
    let transfers;
    try {
      transfers = await getAccountTransfersViaSQL(account, startDate, endDate);
      console.log(`✅ Fetched ${transfers.length} transfers for ${account} in 2025 via HiveSQL`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          error: 'Failed to fetch 2025 transactions via HiveSQL',
          details: errorMessage,
          suggestion: 'Make sure HIVESQL_PASSWORD is set in your environment variables. See HIVE_ECOSYSTEM_ANALYSIS.md for setup instructions.',
        },
        { status: 500 }
      );
    }

    // Sort by timestamp (newest first)
    transfers.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Calculate summary statistics for 2025
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
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };

    return NextResponse.json({
      account,
      year: 2025,
      transfers,
      summary,
      method: 'sql',
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching 2025 Hive transactions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch 2025 Hive transactions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

