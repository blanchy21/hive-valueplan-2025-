import { HiveTransaction, HiveTransfer, HiveAccountHistory } from '@/lib/types';

// Hive API endpoints (public nodes)
const HIVE_API_ENDPOINTS = [
  'https://api.hive.blog',
  'https://anyx.io',
  'https://hive-api.arcange.eu',
];

// Parse Hive amount string (e.g., "100.000 HIVE" or "50.500 HBD")
export function parseHiveAmount(amountStr: string): { value: number; currency: 'HIVE' | 'HBD' } {
  const parts = amountStr.trim().split(' ');
  const value = parseFloat(parts[0] || '0');
  const currency = (parts[1] || '').toUpperCase() as 'HIVE' | 'HBD';
  return { value, currency: currency === 'HBD' ? 'HBD' : 'HIVE' };
}

// Call Hive API with fallback to multiple endpoints
async function callHiveAPI(method: string, params: any): Promise<any> {
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

  return result;
}

// Extract transfer operations from account history
export function extractTransfers(history: HiveAccountHistory, account: string): HiveTransfer[] {
  const accountName = account.replace('@', '').toLowerCase();
  const transfers: HiveTransfer[] = [];

  if (!history || !history.history) {
    return transfers;
  }

  for (const [index, transaction] of history.history) {
    const op = transaction.op;
    
    // Only process transfer operations
    if (op.type === 'transfer') {
      const value = op.value;
      const from = (value.from || '').toLowerCase();
      const to = (value.to || '').toLowerCase();
      const amount = value.amount || '0 HIVE';
      const memo = value.memo || '';

      // Include transfers where account is sender or receiver
      if (from === accountName || to === accountName) {
        const { value: amountValue, currency } = parseHiveAmount(amount);
        
        transfers.push({
          trx_id: transaction.trx_id,
          block: transaction.block,
          timestamp: transaction.timestamp,
          from: value.from || '',
          to: value.to || '',
          amount,
          amountValue,
          currency,
          memo,
        });
      }
    }
  }

  return transfers;
}

// Get all transfers for an account
export async function getAccountTransfers(
  account: string,
  limit: number = 1000
): Promise<HiveTransfer[]> {
  const history = await getAccountHistory(account, -1, limit);
  return extractTransfers(history, account);
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
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - toleranceDays);
  
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + toleranceDays);

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

    // Check date range
    const transferDate = new Date(transfer.timestamp);
    return transferDate >= startDate && transferDate <= endDate;
  });
}

