import { NextResponse } from 'next/server';
import { getAccountTransfersViaSQL } from '@/lib/utils/hive';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const DEFAULT_ACCOUNT = 'valueplan';

/**
 * Export transactions to CSV
 * Fetches all 2025 transactions for valueplan using HiveSQL and exports to CSV
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const account = searchParams.get('account') || DEFAULT_ACCOUNT;
    const year = searchParams.get('year') || '2025';
    const saveFile = searchParams.get('saveFile') === 'true'; // Optional: save to file
    
    // Parse year and set date range
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return NextResponse.json(
        { error: 'Invalid year. Must be between 2020 and 2030.' },
        { status: 400 }
      );
    }
    
    const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${yearNum}-12-31T23:59:59.999Z`);
    
    console.log(`📥 Fetching ${year} transactions for ${account} via HiveSQL...`);
    
    // Fetch transactions using HiveSQL
    let transfers;
    try {
      transfers = await getAccountTransfersViaSQL(account, startDate, endDate);
      console.log(`✅ Fetched ${transfers.length} transfers for ${account} in ${year}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          error: `Failed to fetch ${year} transactions via HiveSQL`,
          details: errorMessage,
          suggestion: 'Make sure HIVESQL_PASSWORD is set in your .env.local file. See HIVESQL_SETUP.md for instructions.',
        },
        { status: 500 }
      );
    }

    // Sort by timestamp (oldest first for CSV - makes more sense chronologically)
    transfers.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    // Convert to CSV format
    const csvHeaders = [
      'Transaction ID',
      'Block Number',
      'Timestamp',
      'From Account',
      'To Account',
      'Amount',
      'Currency',
      'Amount Value',
      'Memo',
    ];

    const csvRows = transfers.map(transfer => [
      transfer.trx_id,
      transfer.block.toString(),
      transfer.timestamp,
      transfer.from,
      transfer.to,
      transfer.amount,
      transfer.currency,
      transfer.amountValue.toFixed(3),
      transfer.memo || '',
    ]);

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCsvValue = (value: string | number): string => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content
    const csvLines = [
      csvHeaders.map(escapeCsvValue).join(','),
      ...csvRows.map(row => row.map(escapeCsvValue).join(','))
    ];

    const csvContent = csvLines.join('\n');

    // Optionally save to file
    if (saveFile) {
      const filename = `${account}_transactions_${year}.csv`;
      const filePath = join(process.cwd(), filename);
      await writeFile(filePath, csvContent, 'utf-8');
      console.log(`💾 Saved CSV to: ${filePath}`);
      
      return NextResponse.json({
        success: true,
        account,
        year,
        totalTransactions: transfers.length,
        filePath,
        filename,
        summary: {
          totalHBD: transfers.filter(t => t.currency === 'HBD').reduce((sum, t) => sum + t.amountValue, 0),
          totalHIVE: transfers.filter(t => t.currency === 'HIVE').reduce((sum, t) => sum + t.amountValue, 0),
          incoming: transfers.filter(t => t.to.toLowerCase() === account.replace('@', '').toLowerCase()).length,
          outgoing: transfers.filter(t => t.from.toLowerCase() === account.replace('@', '').toLowerCase()).length,
        },
        message: `CSV file saved to ${filename}`,
      });
    }

    // Return CSV as downloadable response
    const filename = `${account}_transactions_${year}.csv`;
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error exporting transactions to CSV:', error);
    return NextResponse.json(
      {
        error: 'Failed to export transactions to CSV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

