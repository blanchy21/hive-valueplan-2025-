import { HiveTransfer, HiveAccountHistory } from '@/lib/types';
import { appendFile } from 'fs/promises';
import { join } from 'path';
import sql from 'mssql';

// Hive API endpoints (public nodes)
const HIVE_API_ENDPOINTS = [
  'https://api.hive.blog',
  'https://anyx.io',
  'https://hive-api.arcange.eu',
];

const LOG_FILE = join(process.cwd(), 'verification.log');

// Helper to log to file
async function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    await appendFile(LOG_FILE, logMessage);
  } catch {
    // Ignore file write errors
  }
  console.log(message);
}

// HiveSQL connection configuration
// Note: HiveSQL uses Microsoft SQL Server, so we need T-SQL syntax
const HIVESQL_SERVER = 'vip.hivesql.io';
const HIVESQL_DATABASE = 'DBHive';
const HIVESQL_LOGIN = process.env.HIVESQL_LOGIN || 'Hive-blanchy'; // Login format: Hive-{username}
const HIVESQL_PASSWORD = process.env.HIVESQL_PASSWORD; // Must be set in environment variables

// Parse Hive amount string (e.g., "100.000 HIVE" or "50.500 HBD")
export function parseHiveAmount(amountStr: string): { value: number; currency: 'HIVE' | 'HBD' } {
  const parts = amountStr.trim().split(' ');
  const value = parseFloat(parts[0] || '0');
  const currency = (parts[1] || '').toUpperCase() as 'HIVE' | 'HBD';
  return { value, currency: currency === 'HBD' ? 'HBD' : 'HIVE' };
}

// Call Hive API with fallback to multiple endpoints
async function callHiveAPI(method: string, params: Record<string, unknown>): Promise<unknown> {
  const payload = {
    jsonrpc: '2.0',
    method,
    params,
    id: 1,
  };

  let lastError: Error | null = null;

  for (const endpoint of HIVE_API_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Hive API error');
      }

      return data.result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Failed to call ${endpoint}:`, lastError.message);
      // Continue to next endpoint
    }
  }

  throw new Error(`All Hive API endpoints failed. Last error: ${lastError?.message}`);
}

// Get account history from Hive blockchain
export async function getAccountHistory(
  account: string,
  start: number = -1,
  limit: number = 1000
): Promise<HiveAccountHistory> {
  const result = await callHiveAPI('account_history_api.get_account_history', {
    account: account.replace('@', ''), // Remove @ if present
    start,
    limit,
    include_reversible: true,
  });

  return result as HiveAccountHistory;
}

// Extract transfer operations from account history
export function extractTransfers(history: HiveAccountHistory, account: string): HiveTransfer[] {
  const accountName = account.replace('@', '').toLowerCase();
  const transfers: HiveTransfer[] = [];

  if (!history || !history.history) {
    return transfers;
  }

  for (const [, transaction] of history.history) {
    const op = transaction.op;
    
    // Only process transfer operations
    if (op.type === 'transfer' || op.type === 'transfer_operation') {
      const value = op.value;
      const from = (value.from || '').toLowerCase();
      const to = (value.to || '').toLowerCase();
      
      // Handle different amount formats
      let amountStr = '0 HIVE';
      let amountValue = 0;
      let currency: 'HIVE' | 'HBD' = 'HIVE';
      
      if (typeof value.amount === 'string') {
        // Old format: "100.000 HBD" or "50.000 HIVE"
        amountStr = value.amount;
        const parsed = parseHiveAmount(amountStr);
        amountValue = parsed.value;
        currency = parsed.currency;
      } else if (value.amount && typeof value.amount === 'object') {
        // New format: { amount: "26051813", nai: "@@000000021", precision: 3 }
        const amountObj = value.amount as { amount?: string; nai?: string; precision?: number };
        const rawAmount = amountObj.amount || '0';
        const precision = amountObj.precision || 3;
        amountValue = parseFloat(rawAmount) / Math.pow(10, precision);
        
        // Determine currency from NAI (Network Asset Identifier)
        // @@000000021 = HBD, @@000000013 = HIVE
        const nai = amountObj.nai || '';
        if (nai === '@@000000021') {
          currency = 'HBD';
        } else if (nai === '@@000000013') {
          currency = 'HIVE';
        }
        
        amountStr = `${amountValue.toFixed(3)} ${currency}`;
      }
      
      const memo = value.memo || '';

      // Include transfers where account is involved
      // For verification, we typically want outgoing transfers (from account)
      if (from === accountName || to === accountName) {
        transfers.push({
          trx_id: transaction.trx_id,
          block: transaction.block,
          timestamp: transaction.timestamp,
          from: value.from || '',
          to: value.to || '',
          amount: amountStr,
          amountValue,
          currency,
          memo,
        });
      }
    }
  }

  return transfers;
}

// Get transfers using HiveSQL (more reliable for historical data)
// HiveSQL uses Microsoft SQL Server (T-SQL syntax)
// Login format: Hive-{username} (e.g., Hive-blanchy)
export async function getAccountTransfersViaSQL(
  account: string,
  startDate?: Date,
  endDate?: Date
): Promise<HiveTransfer[]> {
  // Check if credentials are available
  if (!HIVESQL_PASSWORD) {
    throw new Error('HIVESQL_PASSWORD environment variable not set. Please add it to your .env.local file.');
  }

  const accountName = account.replace('@', '').toLowerCase().replace(/[^a-z0-9-]/g, ''); // Sanitize account name
  
  // Build SQL query with T-SQL syntax (SQL Server uses TOP instead of LIMIT)
  // Query both incoming and outgoing transfers
  // Use parameterized query to prevent SQL injection
  // Actual columns: ID, tx_id, type, from, to, amount, amount_symbol, memo, request_id, timestamp
  let query = `
    SELECT TOP 10000
      tx_id,
      [from],
      [to],
      amount,
      amount_symbol,
      memo,
      timestamp
    FROM TxTransfers
    WHERE ([from] = @accountName OR [to] = @accountName)
  `;
  
  if (startDate || endDate) {
    if (startDate) {
      query += ` AND timestamp >= @startDate`;
    }
    if (endDate) {
      query += ` AND timestamp <= @endDate`;
    }
  }
  
  query += ` ORDER BY timestamp DESC`;
  
  try {
    await logToFile(`🔍 Connecting to HiveSQL for account: ${accountName}, date range: ${startDate?.toISOString() || 'none'} to ${endDate?.toISOString() || 'none'}`);
    
    // Configure SQL Server connection
    // HiveSQL uses SQL Server
    // Port is specified separately if needed (default is 1433)
    const config: sql.config = {
      server: HIVESQL_SERVER,
      port: 1433, // SQL Server default port
      database: HIVESQL_DATABASE,
      user: HIVESQL_LOGIN,
      password: HIVESQL_PASSWORD,
      options: {
        encrypt: false, // Try without encryption first
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 30000, // 30 seconds
      requestTimeout: 60000, // 60 seconds
      pool: {
        max: 1,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
    
    await logToFile(`🔌 Attempting connection to ${HIVESQL_SERVER} as ${HIVESQL_LOGIN}`);

    // Create connection pool
    const pool = await sql.connect(config);
    await logToFile(`✅ Connected to HiveSQL successfully`);

    // Create request with parameters
    const request = pool.request();
    request.input('accountName', sql.NVarChar, accountName);
    
    if (startDate) {
      request.input('startDate', sql.DateTime2, startDate);
    }
    if (endDate) {
      // Set end date to end of day
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      request.input('endDate', sql.DateTime2, endDateTime);
    }

    // First, try to get column names from the table
    const columnQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'TxTransfers'
      ORDER BY ORDINAL_POSITION
    `;
    
    try {
      const columnResult = await pool.request().query(columnQuery);
      const columnNames = columnResult.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
      await logToFile(`📋 TxTransfers columns: ${columnNames.join(', ')}`);
    } catch (colError) {
      await logToFile(`⚠️  Could not fetch column names: ${colError instanceof Error ? colError.message : 'Unknown'}`);
    }

    // Execute query
    const result = await request.query(query);
    await logToFile(`✅ HiveSQL query returned ${result.recordset.length} results`);
    
    // Close connection pool
    await pool.close();
    
    // Convert SQL results to HiveTransfer format
    // Columns: tx_id, from, to, amount, amount_symbol, memo, timestamp
    const transfers: HiveTransfer[] = result.recordset.map((row: {
      tx_id?: string;
      timestamp?: string | Date;
      from?: string;
      to?: string;
      amount?: string | number;
      amount_symbol?: string;
      memo?: string;
    }) => {
      // Handle amount - SQL Server returns as number or string
      let amountValue = 0;
      if (typeof row.amount === 'string') {
        amountValue = parseFloat(row.amount);
      } else if (typeof row.amount === 'number') {
        amountValue = row.amount;
      }

      // Determine currency from symbol field
      const currency = (row.amount_symbol || 'HIVE').toUpperCase() as 'HIVE' | 'HBD';
      
      // Format timestamp
      let timestampStr = '';
      if (row.timestamp) {
        if (row.timestamp instanceof Date) {
          timestampStr = row.timestamp.toISOString();
        } else {
          timestampStr = String(row.timestamp);
        }
      }
      
      return {
        trx_id: row.tx_id || '',
        block: 0, // Block number not available in HiveSQL TxTransfers table
        timestamp: timestampStr,
        from: row.from || '',
        to: row.to || '',
        amount: `${amountValue.toFixed(3)} ${currency}`,
        amountValue,
        currency: currency === 'HBD' ? 'HBD' : 'HIVE',
        memo: row.memo || '',
      };
    });

    return transfers;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logToFile(`❌ HiveSQL query failed: ${errorMessage}`);
    console.error('HiveSQL query failed:', error);
    
    // Note: Connection pools are automatically closed when the process ends
    
    throw error;
  }
}

// Get all transfers for an account with pagination support
// Stops when reaching the target year start date (e.g., Jan 1, 2025)
// Optimized to check ALL operations (not just transfers) to stop earlier
export async function getAccountTransfers(
  account: string,
  limit: number = 1000,
  maxOperations: number = 2000000,
  stopAtDate?: Date // Stop fetching when we reach this date (e.g., Jan 1, 2025)
): Promise<HiveTransfer[]> {
  const allTransfers: HiveTransfer[] = [];
  let start = -1;
  let totalFetched = 0;
  const batchSize = Math.min(limit, 1000); // Hive API typically limits to 1000 per request
  
  // Fetch in batches until we get enough transfers, hit max operations, or reach stop date
  // Note: We must fetch ALL operations (votes, comments, transfers, etc.) but only extract transfers
  let transferCount = 0;
  const fetchStartTime = Date.now();
  await logToFile(`🔄 Starting to fetch transfers for account: ${account}...`);
  
  while (totalFetched < maxOperations) {
    const batchLimit = Math.min(batchSize, maxOperations - totalFetched);
    const batchStartTime = Date.now();
    
    await logToFile(`📥 Fetching batch: ${totalFetched} to ${totalFetched + batchLimit} operations...`);
    const history = await getAccountHistory(account, start, batchLimit);
    const batchTime = Date.now() - batchStartTime;
    
    if (!history || !history.history || history.history.length === 0) {
      await logToFile(`⚠️  No more history available`);
      break; // No more history
    }
    
    // Extract ONLY transfer operations (ignore votes, comments, etc.)
    const batchTransfers = extractTransfers(history, account);
    transferCount += batchTransfers.length;
    
    // Log progress more frequently
    const elapsed = Date.now() - fetchStartTime;
    const rate = totalFetched / (elapsed / 1000); // operations per second
    
    // Get date info for logging
    let dateInfo = '';
    if (stopAtDate && history.history.length > 0) {
      const oldestOp = history.history[history.history.length - 1];
      const oldestOpDate = new Date(oldestOp[1].timestamp);
      dateInfo = ` | Date: ${oldestOpDate.toISOString().split('T')[0]}`;
      
      // Log detailed date progress every 50,000 operations
      if (totalFetched % 50000 === 0) {
        const daysUntilTarget = Math.floor((oldestOpDate.getTime() - stopAtDate.getTime()) / (1000 * 60 * 60 * 24));
        await logToFile(`📅 Current date in history: ${oldestOpDate.toISOString().split('T')[0]} | Target: ${stopAtDate.toISOString().split('T')[0]} | ${daysUntilTarget > 0 ? `${daysUntilTarget} days before target` : 'Reached target!'}`);
      }
    }
    
    if (totalFetched % 5000 === 0 || totalFetched < 5000) {
      await logToFile(`📊 [${elapsed}ms] Fetched ${totalFetched} operations (${batchTime}ms for this batch), found ${transferCount} transfers | Rate: ${rate.toFixed(0)} ops/s${dateInfo}`);
    }
    
    // OPTIMIZATION: Check ALL operations (not just transfers) to stop earlier
    // This way we can stop as soon as we see operations before the stop date
    if (stopAtDate && history.history.length > 0) {
      // Check the oldest operation timestamp in this batch (any operation type)
      const oldestOp = history.history[history.history.length - 1];
      const oldestOpDate = new Date(oldestOp[1].timestamp);
      
      if (oldestOpDate < stopAtDate) {
        // We've gone past the stop date, only include transfers from stop date onwards
        const filteredBatch = batchTransfers.filter(t => {
          const transferDate = new Date(t.timestamp);
          return transferDate >= stopAtDate;
        });
        allTransfers.push(...filteredBatch);
        const elapsed = Date.now() - fetchStartTime;
        await logToFile(`✅ [${elapsed}ms] Reached stop date ${stopAtDate.toISOString()}, stopping fetch.`);
        await logToFile(`📊 Total: ${totalFetched} operations processed, ${transferCount} transfers found, ${filteredBatch.length} transfers after date filter`);
        break;
      }
    }
    
    allTransfers.push(...batchTransfers);
    
    totalFetched += history.history.length;
    
    // Get the last operation index for next batch
    if (history.history.length > 0) {
      const lastOp = history.history[history.history.length - 1];
      start = lastOp[0] - 1; // Use the index from the last operation
    } else {
      break;
    }
    
    // If we got fewer operations than requested, we've reached the end
    if (history.history.length < batchLimit) {
      break;
    }
    
    // Reduced delay for faster fetching
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const elapsed = Date.now() - fetchStartTime;
  await logToFile(`✅ [${elapsed}ms] Finished fetching: ${totalFetched} total operations processed, ${transferCount} transfers extracted`);
  await logToFile(`📊 Average rate: ${(totalFetched / (elapsed / 1000)).toFixed(0)} operations/second`);
  return allTransfers;
}

// Filter transfers by date range
export function filterTransfersByDate(
  transfers: HiveTransfer[],
  startDate?: Date,
  endDate?: Date
): HiveTransfer[] {
  if (!startDate && !endDate) {
    return transfers;
  }

  return transfers.filter(transfer => {
    const transferDate = new Date(transfer.timestamp);
    
    if (startDate && transferDate < startDate) {
      return false;
    }
    
    if (endDate && transferDate > endDate) {
      return false;
    }
    
    return true;
  });
}

// Find a specific transaction by ID
export function findTransactionById(
  transfers: HiveTransfer[],
  trxId: string
): HiveTransfer | undefined {
  return transfers.find(t => t.trx_id === trxId);
}

// Find transactions matching amount and date (for verification)
export function findMatchingTransactions(
  transfers: HiveTransfer[],
  amount: number,
  currency: 'HIVE' | 'HBD',
  date: Date,
  toleranceDays: number = 1
): HiveTransfer[] {
  // Normalize the target date to start of day for comparison
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  // Calculate date range (start and end of day, with tolerance)
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - toleranceDays);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + toleranceDays);
  endDate.setHours(23, 59, 59, 999); // End of day

  return transfers.filter(transfer => {
    // Check currency match
    if (transfer.currency !== currency) {
      return false;
    }

    // Check amount match (with small tolerance for floating point)
    const amountDiff = Math.abs(transfer.amountValue - amount);
    if (amountDiff > 0.001) {
      return false;
    }

    // Check date range - normalize transfer date to start of day for comparison
    const transferDate = new Date(transfer.timestamp);
    const transferDateNormalized = new Date(transferDate);
    transferDateNormalized.setHours(0, 0, 0, 0);
    
    // Compare: transfer date should be within the tolerance range
    // We compare the full timestamp to handle same-day transfers at different times
    return transferDate >= startDate && transferDate <= endDate;
  });
}

