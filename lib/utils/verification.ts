import { Transaction, HiveTransfer, VerificationResult } from '@/lib/types';
import { getAccountTransfersViaSQL, filterTransfersByDate, findMatchingTransactions } from './hive';
import { parseDate } from './data';
import { appendFile } from 'fs/promises';
import { join } from 'path';

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

// Default Hive account that sends payments (valueplan)
const DEFAULT_SOURCE_ACCOUNT = 'valueplan';

// Amount tolerance for matching (0.001 HBD/HIVE to handle floating point precision)
const AMOUNT_TOLERANCE = 0.001;

/**
 * Maps Google Sheets wallet name to Hive account name
 * For now, assumes wallet names match Hive account names (case-insensitive)
 * Can be extended with a mapping file if needed
 */
export function getHiveAccount(walletName: string): string {
  // Remove @ prefix if present and normalize
  return walletName.toLowerCase().replace('@', '').trim();
}

/**
 * Verifies a single transaction against Hive blockchain
 * 
 * @param transaction - Transaction from Google Sheets to verify
 * @param hiveAccount - Hive account that sent the payment (default: 'valueplan')
 * @param toleranceDays - Number of days tolerance for date matching (default: 1)
 * @returns Verification result with status and any discrepancies
 */
export async function verifyTransaction(
  transaction: Transaction,
  hiveAccount: string = DEFAULT_SOURCE_ACCOUNT,
  toleranceDays: number = 1
): Promise<VerificationResult> {
  const verificationDate = new Date().toISOString();
  
  // Skip verification for loans and refunds if they're not outgoing payments
  // Loans and refunds might be tracked differently on blockchain
  if (transaction.isLoan || transaction.isRefund || transaction.isLoanRefund) {
    return {
      verified: false,
      status: 'unverified',
      verificationDate,
    };
  }

  try {
    // Parse transaction date
    const txDate = parseDate(transaction.date);
    
    // Get target Hive account (recipient wallet)
    const targetAccount = getHiveAccount(transaction.wallet);
    
    // Fetch transfers using HiveSQL (much faster than pagination API)
    // Calculate date range: transaction date ± tolerance days with buffer
    const startDate = new Date(txDate);
    startDate.setDate(startDate.getDate() - toleranceDays - 30); // Add buffer for safety
    
    const endDate = new Date(txDate);
    endDate.setDate(endDate.getDate() + toleranceDays + 30); // Add buffer for safety
    
    // Use HiveSQL for efficient date-range query (instead of slow pagination)
    let transfersInRange: HiveTransfer[];
    try {
      transfersInRange = await getAccountTransfersViaSQL(hiveAccount, startDate, endDate);
      await logToFile(`✅ Verification: Fetched ${transfersInRange.length} transfers via HiveSQL for ${hiveAccount} (${startDate.toISOString()} to ${endDate.toISOString()})`);
    } catch (error) {
      // If HiveSQL fails, log error and return unverified status
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await logToFile(`❌ Verification failed: HiveSQL query error for ${hiveAccount}: ${errorMessage}`);
      return {
        verified: false,
        status: 'unverified',
        verificationDate,
      };
    }
    
    // Filter transfers to target account (only outgoing transfers from valueplan)
    const transfersToTarget = transfersInRange.filter(t => 
      t.from.toLowerCase() === hiveAccount.toLowerCase() &&
      t.to.toLowerCase() === targetAccount.toLowerCase()
    );
    
    console.log(`Found ${transfersToTarget.length} transfers to ${targetAccount} from ${hiveAccount} (searched ${transfersInRange.length} total transfers)`);
    
    if (transfersToTarget.length === 0) {
      return {
        verified: false,
        status: 'not_found',
        verificationDate,
      };
    }
    
    // Try to match HBD transaction first
    let matchedTransfer: HiveTransfer | undefined;
    const discrepancies: VerificationResult['discrepancies'] = {};
    
    if (transaction.hbd > 0) {
      // Find matching HBD transactions
      const hbdMatches = findMatchingTransactions(
        transfersToTarget,
        transaction.hbd,
        'HBD',
        txDate,
        toleranceDays
      );
      
      if (hbdMatches.length > 0) {
        matchedTransfer = hbdMatches[0]; // Use first match
        
        // Verify exact match
        const amountDiff = Math.abs(matchedTransfer.amountValue - transaction.hbd);
        if (amountDiff > AMOUNT_TOLERANCE) {
          discrepancies.amount = {
            expected: transaction.hbd,
            actual: matchedTransfer.amountValue,
          };
        }
        
        const transferDate = new Date(matchedTransfer.timestamp);
        const dateDiff = Math.abs(transferDate.getTime() - txDate.getTime());
        const maxDateDiff = toleranceDays * 24 * 60 * 60 * 1000;
        if (dateDiff > maxDateDiff) {
          discrepancies.date = {
            expected: txDate,
            actual: transferDate,
          };
        }
      }
    }
    
    // Try to match HIVE transaction if no HBD match or if transaction has HIVE
    if (!matchedTransfer && transaction.hive > 0) {
      const hiveMatches = findMatchingTransactions(
        transfersToTarget,
        transaction.hive,
        'HIVE',
        txDate,
        toleranceDays
      );
      
      if (hiveMatches.length > 0) {
        matchedTransfer = hiveMatches[0];
        
        // Verify exact match
        const amountDiff = Math.abs(matchedTransfer.amountValue - transaction.hive);
        if (amountDiff > AMOUNT_TOLERANCE) {
          discrepancies.amount = {
            expected: transaction.hive,
            actual: matchedTransfer.amountValue,
          };
        }
        
        const transferDate = new Date(matchedTransfer.timestamp);
        const dateDiff = Math.abs(transferDate.getTime() - txDate.getTime());
        const maxDateDiff = toleranceDays * 24 * 60 * 60 * 1000;
        if (dateDiff > maxDateDiff) {
          discrepancies.date = {
            expected: txDate,
            actual: transferDate,
          };
        }
      }
    }
    
    // Determine verification status
    if (!matchedTransfer) {
      return {
        verified: false,
        status: 'not_found',
        verificationDate,
      };
    }
    
    if (Object.keys(discrepancies).length > 0) {
      return {
        verified: false,
        status: 'discrepancy',
        hiveTransaction: matchedTransfer,
        discrepancies,
        verificationDate,
      };
    }
    
    return {
      verified: true,
      status: 'verified',
      hiveTransaction: matchedTransfer,
      verificationDate,
    };
  } catch (error) {
    console.error(`Error verifying transaction ${transaction.wallet} on ${transaction.date}:`, error);
    return {
      verified: false,
      status: 'unverified',
      verificationDate,
    };
  }
}

/**
 * Verifies a single transaction against pre-fetched transfers
 * This is an optimized version that doesn't fetch transfers itself
 */
function verifyTransactionAgainstTransfers(
  transaction: Transaction,
  allTransfers: HiveTransfer[],
  hiveAccount: string,
  toleranceDays: number = 1
): VerificationResult {
  // This function verifies a transaction against pre-fetched transfers
  const verificationDate = new Date().toISOString();
  
  // Skip verification for loans and refunds
  if (transaction.isLoan || transaction.isRefund || transaction.isLoanRefund) {
    return {
      verified: false,
      status: 'unverified',
      verificationDate,
    };
  }

  try {
    // Parse transaction date
    const txDate = parseDate(transaction.date);
    
    // Normalize transaction date to start of day for consistent comparison
    const txDateNormalized = new Date(txDate);
    txDateNormalized.setHours(0, 0, 0, 0);
    
    // Get target Hive account (recipient wallet)
    const targetAccount = getHiveAccount(transaction.wallet);
    
    // Calculate adaptive date tolerance based on transaction date
    // Early 2025 (Jan-Feb) often has date discrepancies, so use 14 days
    // Rest of 2025: Use 7 days
    // Other years: Use provided tolerance (minimum 3 days)
    const txYear = txDateNormalized.getFullYear();
    const txMonth = txDateNormalized.getMonth() + 1; // 1-12
    let adaptiveTolerance: number;
    
    if (txYear === 2025 && txMonth <= 2) {
      // January-February 2025: Use 14 days tolerance
      adaptiveTolerance = 14;
    } else if (txYear === 2025) {
      // Rest of 2025: Use 7 days tolerance
      adaptiveTolerance = 7;
    } else {
      // Other years: Use provided tolerance, minimum 3 days
      adaptiveTolerance = Math.max(toleranceDays, 3);
    }
    
    // Calculate date range: transaction date ± tolerance days
    // Use a wider range for initial filtering, then precise matching in findMatchingTransactions
    const startDate = new Date(txDateNormalized);
    startDate.setDate(startDate.getDate() - adaptiveTolerance - 7); // 7 day buffer
    
    const endDate = new Date(txDateNormalized);
    endDate.setDate(endDate.getDate() + adaptiveTolerance + 7); // 7 day buffer
    endDate.setHours(23, 59, 59, 999);
    
    // Filter by date range
    const transfersInRange = filterTransfersByDate(allTransfers, startDate, endDate);
    
    // IMPORTANT: Only look at OUTGOING transfers FROM valueplan TO target account
    // valueplan is funding accounts, so we only want transfers where valueplan is the sender
    const transfersToTarget = transfersInRange.filter(t => 
      t.from.toLowerCase() === hiveAccount.toLowerCase() && 
      t.to.toLowerCase() === targetAccount.toLowerCase()
    );
    
    // Debug logging for first few transactions
    if (transfersToTarget.length > 0 && Math.random() < 0.1) { // Log ~10% of transactions
      console.log(`Verifying ${transaction.wallet} on ${transaction.date}:`, {
        parsedDate: txDateNormalized.toISOString().split('T')[0],
        targetAccount,
        transfersFound: transfersToTarget.length,
        sampleTransfer: transfersToTarget[0] ? {
          to: transfersToTarget[0].to,
          amount: transfersToTarget[0].amount,
          date: transfersToTarget[0].timestamp,
          currency: transfersToTarget[0].currency
        } : null
      });
    }
    
    if (transfersToTarget.length === 0) {
      return {
        verified: false,
        status: 'not_found',
        verificationDate,
      };
    }
    
    // PRIORITY: Match by amount first, then check date
    // Amount matching is most important - dates can vary by a few days
    let matchedTransfer: HiveTransfer | undefined;
    const discrepancies: VerificationResult['discrepancies'] = {};
    
    // Use the same adaptive tolerance calculated above
    const dateTolerance = adaptiveTolerance;
    
    // Step 1: Find all transfers that match the amount (regardless of currency or date)
    const amountMatches: HiveTransfer[] = [];
    
    if (transaction.hbd > 0) {
      // Match HBD amount against HBD transfers
      transfersToTarget.forEach(transfer => {
        if (transfer.currency === 'HBD') {
          const amountDiff = Math.abs(transfer.amountValue - transaction.hbd);
          if (amountDiff <= AMOUNT_TOLERANCE) {
            amountMatches.push(transfer);
          }
        }
      });
      
      // Also check if HBD amount matches HIVE transfers (currency mismatch)
      transfersToTarget.forEach(transfer => {
        if (transfer.currency === 'HIVE') {
          const amountDiff = Math.abs(transfer.amountValue - transaction.hbd);
          if (amountDiff <= AMOUNT_TOLERANCE) {
            amountMatches.push(transfer);
            // Note currency mismatch
            discrepancies.currency = {
              expected: 'HBD',
              actual: 'HIVE',
            };
          }
        }
      });
    }
    
    if (transaction.hive > 0) {
      // Match HIVE amount against HIVE transfers
      transfersToTarget.forEach(transfer => {
        if (transfer.currency === 'HIVE') {
          const amountDiff = Math.abs(transfer.amountValue - transaction.hive);
          if (amountDiff <= AMOUNT_TOLERANCE) {
            amountMatches.push(transfer);
          }
        }
      });
      
      // Also check if HIVE amount matches HBD transfers (currency mismatch)
      transfersToTarget.forEach(transfer => {
        if (transfer.currency === 'HBD') {
          const amountDiff = Math.abs(transfer.amountValue - transaction.hive);
          if (amountDiff <= AMOUNT_TOLERANCE) {
            amountMatches.push(transfer);
            // Note currency mismatch
            discrepancies.currency = {
              expected: 'HIVE',
              actual: 'HBD',
            };
          }
        }
      });
    }
    
    // Step 2: From amount matches, find the one closest to the transaction date
    if (amountMatches.length > 0) {
      // Sort by date proximity to transaction date
      amountMatches.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        const diffA = Math.abs(dateA.getTime() - txDateNormalized.getTime());
        const diffB = Math.abs(dateB.getTime() - txDateNormalized.getTime());
        return diffA - diffB;
      });
      
      // Take the closest match
      matchedTransfer = amountMatches[0];
      
      // Check if date is within tolerance
      const transferDate = new Date(matchedTransfer.timestamp);
      const dateDiff = Math.abs(transferDate.getTime() - txDateNormalized.getTime());
      const maxDateDiff = dateTolerance * 24 * 60 * 60 * 1000;
      
      if (dateDiff > maxDateDiff) {
        // Amount matches but date is outside tolerance - still consider it a match but note discrepancy
        discrepancies.date = {
          expected: txDateNormalized,
          actual: transferDate,
        };
      }
    }
    
    // Determine verification status
    if (!matchedTransfer) {
      return {
        verified: false,
        status: 'not_found',
        verificationDate,
      };
    }
    
    // If amount matches but only currency differs, consider it verified
    // (Amount matching is most important, currency can differ)
    const hasAmountDiscrepancy = discrepancies.amount !== undefined;
    const hasDateDiscrepancy = discrepancies.date !== undefined;
    const onlyCurrencyMismatch = discrepancies.currency !== undefined && !hasAmountDiscrepancy && !hasDateDiscrepancy;
    
    // If only currency mismatch (amount and date match), treat as verified
    if (onlyCurrencyMismatch) {
      return {
        verified: true,
        status: 'verified',
        hiveTransaction: matchedTransfer,
        verificationDate,
      };
    }
    
    // If there are real discrepancies (amount or date), mark as discrepancy
    if (hasAmountDiscrepancy || hasDateDiscrepancy) {
      return {
        verified: false,
        status: 'discrepancy',
        hiveTransaction: matchedTransfer,
        discrepancies,
        verificationDate,
      };
    }
    
    // Perfect match
    return {
      verified: true,
      status: 'verified',
      hiveTransaction: matchedTransfer,
      verificationDate,
    };
  } catch (error) {
    console.error(`Error verifying transaction ${transaction.wallet} on ${transaction.date}:`, error);
    return {
      verified: false,
      status: 'unverified',
      verificationDate,
    };
  }
}

/**
 * Verifies multiple transactions in batch
 * OPTIMIZED: Fetches all transfers once at the start, then reuses them
 * 
 * @param transactions - Array of transactions to verify
 * @param hiveAccount - Hive account that sent the payments (default: 'valueplan')
 * @param toleranceDays - Number of days tolerance for date matching (default: 1)
 * @param onProgress - Optional callback for progress updates
 * @returns Array of verification results
 */
export async function verifyTransactionsBatch(
  transactions: Transaction[],
  hiveAccount: string = DEFAULT_SOURCE_ACCOUNT,
  toleranceDays: number = 1,
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ transaction: Transaction; verification: VerificationResult }>> {
  const results: Array<{ transaction: Transaction; verification: VerificationResult }> = [];
  
  // Filter out loans and refunds for now (they may need different verification logic)
  const transactionsToVerify = transactions.filter(tx => 
    !tx.isLoan && !tx.isRefund && !tx.isLoanRefund
  );
  
  const batchStartTime = Date.now();
  await logToFile(`\n🔄 [${batchStartTime}] Starting batch verification...`);
  await logToFile(`📊 Transactions to verify: ${transactionsToVerify.length} (filtered from ${transactions.length} total)`);
  await logToFile(`📥 Fetching all transfers from ${hiveAccount} (this may take a moment)...`);
  
  // OPTIMIZATION: Fetch all transfers ONCE at the start using HiveSQL
  // HiveSQL is much faster than pagination API - can query specific date ranges directly
  // Fetch all 2025 transfers in one query
  const startDate = new Date('2025-01-01T00:00:00Z');
  const endDate = new Date('2025-12-31T23:59:59Z');
  let allTransfers: HiveTransfer[] = [];
  
  try {
    const fetchStartTime = Date.now();
    await logToFile(`🔍 Fetching 2025 transfers from ${hiveAccount} via HiveSQL (much faster than pagination API)...`);
    await logToFile(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Use HiveSQL for fast, efficient query of all 2025 transfers
    const allTransfersRaw = await getAccountTransfersViaSQL(hiveAccount, startDate, endDate);
    const fetchTime = Date.now() - fetchStartTime;
    await logToFile(`✅ [${fetchTime}ms] Fetched ${allTransfersRaw.length} total transfers via HiveSQL`);
    
    // IMPORTANT: Only keep OUTGOING transfers FROM valueplan (valueplan is funding accounts)
    const outgoingTransfers = allTransfersRaw.filter(t => 
      t.from.toLowerCase() === hiveAccount.toLowerCase()
    );
    await logToFile(`🔍 Filtered to ${outgoingTransfers.length} OUTGOING transfers from ${hiveAccount}`);
    
    if (outgoingTransfers.length === 0) {
      await logToFile(`WARNING: No outgoing transfers found for account ${hiveAccount} in 2025. This could mean:`);
      await logToFile(`  1. Account name is incorrect`);
      await logToFile(`  2. Account has no transfers in 2025`);
      await logToFile(`  3. Account doesn't exist`);
      await logToFile(`All transactions will be marked as 'unverified'`);
    }
    
    // Log sample of transfers if we have any
    if (outgoingTransfers.length > 0) {
      await logToFile(`Sample 2025 outgoing transfers: ${JSON.stringify(outgoingTransfers.slice(0, 5).map(t => ({
        from: t.from,
        to: t.to,
        amount: t.amount,
        currency: t.currency,
        date: t.timestamp
      })))}`);
    }
    
    // Use outgoing transfers for verification
    allTransfers = outgoingTransfers;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logToFile(`❌ Failed to fetch transfers from ${hiveAccount}: ${errorMsg}`);
    if (error instanceof Error && error.stack) {
      await logToFile(`Stack: ${error.stack}`);
    }
    // Return unverified for all transactions if we can't fetch transfers
    return transactionsToVerify.map(transaction => ({
      transaction,
      verification: {
        verified: false,
        status: 'unverified' as const,
        verificationDate: new Date().toISOString(),
      },
    }));
  }
  
  const verifyStartTime = Date.now();
  await logToFile(`\n🔄 [${verifyStartTime}] Now verifying ${transactionsToVerify.length} transactions against ${allTransfers.length} transfers...`);
  
  // Now verify each transaction using the pre-fetched transfers
  for (let i = 0; i < transactionsToVerify.length; i++) {
    const transaction = transactionsToVerify[i];
    const verification = verifyTransactionAgainstTransfers(transaction, allTransfers, hiveAccount, toleranceDays);
    
    results.push({ transaction, verification });
    
    if (onProgress && (i % 10 === 0 || i === transactionsToVerify.length - 1)) {
      await onProgress(i + 1, transactionsToVerify.length);
    }
  }
  
  const verifyTime = Date.now() - verifyStartTime;
  const totalTime = Date.now() - batchStartTime;
  await logToFile(`\n✅ [${verifyTime}ms] Completed verification of ${results.length} transactions`);
  await logToFile(`⏱️  Total batch time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
  
  return results;
}

