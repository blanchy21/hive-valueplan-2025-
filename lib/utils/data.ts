import { Transaction, Metrics } from '@/lib/types';
import { parse, format, startOfMonth } from 'date-fns';

// Parse date string (handles various formats like "3/01/2025", "06/01/2025")
export function parseDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Invalid date string');
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    throw new Error('Empty date string');
  }

  // Try different date formats (most common first)
  const formats = [
    'd/M/yyyy',      // 3/01/2025
    'dd/M/yyyy',     // 03/01/2025
    'd/MM/yyyy',     // 3/01/2025
    'dd/MM/yyyy',    // 03/01/2025
    'd/M/yy',        // 3/01/25
    'dd/M/yy',       // 03/01/25
    'd/MM/yy',       // 3/01/25
    'dd/MM/yy',      // 03/01/25
    'yyyy-MM-dd',    // 2025-01-03
    'MM/dd/yyyy',    // 01/03/2025
    'dd-MM-yyyy',    // 03-01-2025
    'd.M.yyyy',      // 3.1.2025
    'dd.MM.yyyy',    // 03.01.2025
  ];
  
  for (const fmt of formats) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (!isNaN(parsed.getTime())) {
        // Validate the parsed date is reasonable
        const year = parsed.getFullYear();
        if (year >= 2020 && year <= 2030) {
          return parsed;
        }
      }
    } catch {
      continue;
    }
  }
  
  // Try Date constructor as last resort
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    const year = fallback.getFullYear();
    if (year >= 2020 && year <= 2030) {
      return fallback;
    }
  }
  
  throw new Error(`Unable to parse date: ${trimmed}`);
}

// Convert number string to number
// Handles both US format (1,234.56) and European format (1.234,56 or 1234,56)
export function parseNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === '') return 0;
  
  const str = value.toString().trim();
  if (!str) return 0;
  
  // Check if it's European format (comma as decimal separator)
  // European format: "300,00" or "8309,24" (comma is decimal, no thousands separator)
  // US format: "1,234.56" (comma is thousands, dot is decimal)
  
  // If there's a comma and no dot, or comma comes after dot, it's likely European format
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && !hasDot) {
    // European format: "300,00" -> "300.00"
    return parseFloat(str.replace(',', '.')) || 0;
  } else if (hasComma && hasDot) {
    // Need to determine which is decimal separator
    const commaIndex = str.indexOf(',');
    const dotIndex = str.indexOf('.');
    
    if (commaIndex > dotIndex) {
      // "1.234,56" - European format (dot is thousands, comma is decimal)
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // "1,234.56" - US format (comma is thousands, dot is decimal)
      return parseFloat(str.replace(/,/g, '')) || 0;
    }
  } else {
    // No comma, just remove any dots (could be thousands separator in some formats)
    // Or it's already a plain number
    return parseFloat(str.replace(/,/g, '')) || 0;
  }
}

// Convert Hive to HBD (using 2025 average conversion rate)
// Average Hive price for 2025: 0.24 HBD per HIVE
export function convertHiveToHbd(hive: number): number {
  const conversionRate = 0.24; // 2025 average rate from promote.hive.io
  return hive * conversionRate;
}

// Detect if a transaction is a loan, refund, or loan refund
// Based on patterns in wallet name, category, eventProject, or eventType
export function detectTransactionType(transaction: {
  wallet: string;
  category: string;
  eventProject: string;
  eventType: string;
}): { isLoan: boolean; isRefund: boolean; isLoanRefund: boolean } {
  const walletLower = transaction.wallet.toLowerCase();
  const categoryLower = (transaction.category || '').toLowerCase();
  const eventProjectLower = (transaction.eventProject || '').toLowerCase();
  const eventTypeLower = (transaction.eventType || '').toLowerCase();
  
  const combinedText = `${walletLower} ${categoryLower} ${eventProjectLower} ${eventTypeLower}`;
  
  // Check for loan refund first (most specific)
  const isLoanRefund = 
    combinedText.includes('loan refund') ||
    combinedText.includes('loan-refund') ||
    combinedText.includes('refund loan') ||
    combinedText.includes('refund-loan');
  
  // Check for refund (but not loan refund)
  const isRefund = !isLoanRefund && (
    combinedText.includes('refund') ||
    walletLower.includes('refund') ||
    categoryLower.includes('refund') ||
    eventProjectLower.includes('refund')
  );
  
  // Known loan wallets (transactions to these wallets are loans)
  // These wallets received loans that were later paid back
  const knownLoanWallets = [
    'guitieparties',
    'blocktrades',
    'alpha'
  ];
  
  // Check if wallet matches known loan wallets (with or without @ prefix)
  const walletNameOnly = walletLower.replace('@', '').trim();
  const isKnownLoanWallet = knownLoanWallets.some(loanWallet => 
    walletNameOnly === loanWallet.toLowerCase()
  );
  
  // Check for loan (but not loan refund)
  const isLoan = !isLoanRefund && (
    combinedText.includes('loan') ||
    walletLower.includes('loan') ||
    categoryLower.includes('loan') ||
    eventProjectLower.includes('loan') ||
    isKnownLoanWallet
  );
  
  return { isLoan, isRefund, isLoanRefund };
}

// Calculate total spend in HBD
// Uses actual Hive To HBD value from spreadsheet if available, otherwise calculates it
export function calculateTotalSpend(transaction: Transaction): number {
  const hbdAmount = transaction.hbd || 0;
  // Use the actual Hive To HBD value from the spreadsheet if available
  // Otherwise, calculate it using the conversion rate
  const hiveInHbd = transaction.hiveToHbd !== undefined 
    ? transaction.hiveToHbd 
    : (transaction.hive ? convertHiveToHbd(transaction.hive) : 0);
  return hbdAmount + hiveInHbd;
}

// Helper function to filter out loans and refunds from spending calculations
// Loans and refunds are not considered "spending" - they're either money lent out or money coming back
// Only exclude explicit loans/refunds from data files, not pattern-matched ones from CSV
export function filterSpendingTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(tx => {
    // Exclude explicit loans from loans.ts file (category is 'Loan')
    // Don't exclude pattern-matched loans from CSV as they might be legitimate spending
    if (tx.isLoan && tx.category === 'Loan') return false;
    // Exclude explicit loan refunds from loan-refunds.ts file (category is 'Loan Refund')
    // All loan refunds come from the data file, so isLoanRefund is sufficient
    if (tx.isLoanRefund) return false;
    // Exclude explicit event refunds from event-refunds.ts file (category is 'Event Refund')
    // Don't exclude pattern-matched refunds from CSV
    if (tx.isRefund && tx.category === 'Event Refund') return false;
    return true;
  });
}

// Aggregate transactions by category
export function aggregateByCategory(transactions: Transaction[]): Record<string, number> {
  const aggregated: Record<string, number> = {};
  
  // Only include actual spending, exclude loans and refunds
  const spendingTransactions = filterSpendingTransactions(transactions);
  
  spendingTransactions.forEach(tx => {
    const category = tx.category || 'Uncategorized';
    const total = calculateTotalSpend(tx);
    aggregated[category] = (aggregated[category] || 0) + total;
  });
  
  return aggregated;
}

// Aggregate transactions by country
export function aggregateByCountry(transactions: Transaction[]): Record<string, number> {
  const aggregated: Record<string, number> = {};
  
  // Only include actual spending, exclude loans and refunds
  const spendingTransactions = filterSpendingTransactions(transactions);
  
  spendingTransactions.forEach(tx => {
    const country = tx.country || 'Unknown';
    const total = calculateTotalSpend(tx);
    aggregated[country] = (aggregated[country] || 0) + total;
  });
  
  return aggregated;
}

// Aggregate transactions by event type
export function aggregateByEventType(transactions: Transaction[]): Record<string, number> {
  const aggregated: Record<string, number> = {};
  
  // Only include actual spending, exclude loans and refunds
  const spendingTransactions = filterSpendingTransactions(transactions);
  
  spendingTransactions.forEach(tx => {
    const eventType = tx.eventType || 'Unknown';
    const total = calculateTotalSpend(tx);
    aggregated[eventType] = (aggregated[eventType] || 0) + total;
  });
  
  return aggregated;
}

// Aggregate transactions by event project
export function aggregateByEventProject(transactions: Transaction[]): Record<string, number> {
  const aggregated: Record<string, number> = {};
  
  // Only include actual spending, exclude loans and refunds
  const spendingTransactions = filterSpendingTransactions(transactions);
  
  spendingTransactions.forEach(tx => {
    const eventProject = tx.eventProject || 'Unknown';
    const total = calculateTotalSpend(tx);
    aggregated[eventProject] = (aggregated[eventProject] || 0) + total;
  });
  
  return aggregated;
}

// Aggregate transactions by wallet/account name
// Optionally filter by year
export function aggregateByWallet(transactions: Transaction[], year?: number): Record<string, number> {
  const aggregated: Record<string, number> = {};
  
  // Only include actual spending, exclude loans and refunds
  const spendingTransactions = filterSpendingTransactions(transactions);
  
  // Debug: Check if ssekulji transactions are being filtered out
  const ssekuljiBeforeFilter = transactions.filter(tx => {
    const wallet = tx.wallet ? tx.wallet.toLowerCase().replace('@', '').trim() : '';
    return wallet === 'ssekulji';
  });
  const ssekuljiAfterFilter = spendingTransactions.filter(tx => {
    const wallet = tx.wallet ? tx.wallet.toLowerCase().replace('@', '').trim() : '';
    return wallet === 'ssekulji';
  });
  
  if (ssekuljiBeforeFilter.length > 0) {
    console.log(`aggregateByWallet: Found ${ssekuljiBeforeFilter.length} ssekulji transactions before filter, ${ssekuljiAfterFilter.length} after filter`);
    if (ssekuljiBeforeFilter.length !== ssekuljiAfterFilter.length) {
      const ssekuljiAfterFilterSet = new Set(ssekuljiAfterFilter.map(tx => `${tx.date}-${tx.hbd}-${tx.hive}`));
      const filteredOut = ssekuljiBeforeFilter.filter(tx => {
        const key = `${tx.date}-${tx.hbd}-${tx.hive}`;
        return !ssekuljiAfterFilterSet.has(key);
      });
      console.log(`aggregateByWallet: ${filteredOut.length} ssekulji transactions were filtered out:`);
      filteredOut.forEach(tx => {
        console.log(`  - ${tx.date}: category=${tx.category}, isLoan=${tx.isLoan}, isRefund=${tx.isRefund}, isLoanRefund=${tx.isLoanRefund}`);
      });
    }
  }
  
  spendingTransactions.forEach(tx => {
    // Filter by year if specified
    if (year !== undefined) {
      try {
        const txDate = parseDate(tx.date);
        if (txDate.getFullYear() !== year) {
          return; // Skip transactions not in the specified year
        }
      } catch {
        return; // Skip transactions with invalid dates
      }
    }
    
    // Normalize wallet name (remove @ prefix, trim whitespace)
    const wallet = tx.wallet ? tx.wallet.replace('@', '').trim() : 'Unknown';
    const total = calculateTotalSpend(tx);
    aggregated[wallet] = (aggregated[wallet] || 0) + total;
  });
  
  // Debug: Log ssekulji total
  const ssekuljiTotal = aggregated['ssekulji'] || 0;
  if (ssekuljiTotal > 0) {
    console.log(`aggregateByWallet: ssekulji total in aggregated data: ${ssekuljiTotal.toFixed(2)} HBD (year filter: ${year || 'all'})`);
  }
  
  return aggregated;
}

// Aggregate transactions by month
export function aggregateByMonth(transactions: Transaction[]): Array<{ month: string; hbd: number; hive: number; total: number }> {
  const monthly: Record<string, { hbd: number; hive: number; total: number }> = {};
  
  // Only include actual spending, exclude loans and refunds
  const spendingTransactions = filterSpendingTransactions(transactions);
  
  spendingTransactions.forEach(tx => {
    try {
      const date = parseDate(tx.date);
      const monthKey = format(startOfMonth(date), 'yyyy-MM');
      
      if (!monthly[monthKey]) {
        monthly[monthKey] = { hbd: 0, hive: 0, total: 0 };
      }
      
      monthly[monthKey].hbd += tx.hbd || 0;
      monthly[monthKey].hive += tx.hive || 0;
      monthly[monthKey].total += calculateTotalSpend(tx);
    } catch (e) {
      // Skip invalid dates
      console.error('Invalid date:', tx.date, e);
    }
  });
  
  return Object.entries(monthly)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// Calculate metrics from transactions
// Uses actual Hive To HBD values from spreadsheet when available
// Optionally filter by year (defaults to all years)
export function calculateMetrics(transactions: Transaction[], year?: number): Metrics {
  // Filter to only spending transactions (exclude loans and refunds) for totals
  // This ensures totals match what's shown in the charts
  let spendingTransactions = filterSpendingTransactions(transactions);
  
  // Filter by year if specified
  if (year !== undefined) {
    spendingTransactions = spendingTransactions.filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === year;
      } catch {
        return false;
      }
    });
  }
  
  // Calculate spending totals (excluding loans/refunds) - these should match chart totals
  const totalHbd = spendingTransactions.reduce((sum, tx) => sum + (tx.hbd || 0), 0);
  const totalHive = spendingTransactions.reduce((sum, tx) => sum + (tx.hive || 0), 0);
  // Use actual Hive To HBD values from spreadsheet, fallback to calculation if missing
  const hiveInHbd = spendingTransactions.reduce((sum, tx) => {
    if (tx.hiveToHbd !== undefined) {
      return sum + tx.hiveToHbd;
    } else if (tx.hive) {
      return sum + convertHiveToHbd(tx.hive);
    }
    return sum;
  }, 0);
  const combinedTotalHbd = totalHbd + hiveInHbd;
  
  // Filter transactions for aggregations if year is specified
  let transactionsForAggregation = transactions;
  if (year !== undefined) {
    transactionsForAggregation = transactions.filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === year;
      } catch {
        return false;
      }
    });
  }
  
  // Validate that chart totals match spending totals
  const categoryTotal = Object.values(aggregateByCategory(transactionsForAggregation)).reduce((sum, val) => sum + val, 0);
  const countryTotal = Object.values(aggregateByCountry(transactionsForAggregation)).reduce((sum, val) => sum + val, 0);
  const eventTypeTotal = Object.values(aggregateByEventType(transactionsForAggregation)).reduce((sum, val) => sum + val, 0);
  const eventProjectTotal = Object.values(aggregateByEventProject(transactionsForAggregation)).reduce((sum, val) => sum + val, 0);
  const monthlyTotal = aggregateByMonth(transactionsForAggregation).reduce((sum, month) => sum + month.total, 0);
  
  console.log(`\n=== METRICS VALIDATION ===`);
  console.log(`Spending Total (combinedTotalHbd): ${combinedTotalHbd.toFixed(2)} HBD`);
  console.log(`Category Aggregation Total: ${categoryTotal.toFixed(2)} HBD`);
  console.log(`Country Aggregation Total: ${countryTotal.toFixed(2)} HBD`);
  console.log(`Event Type Aggregation Total: ${eventTypeTotal.toFixed(2)} HBD`);
  console.log(`Event Project Aggregation Total: ${eventProjectTotal.toFixed(2)} HBD`);
  console.log(`Monthly Aggregation Total: ${monthlyTotal.toFixed(2)} HBD`);
  
  // Check for discrepancies (allow small rounding differences)
  const tolerance = 0.01;
  if (Math.abs(categoryTotal - combinedTotalHbd) > tolerance) {
    console.warn(`⚠️ WARNING: Category total (${categoryTotal.toFixed(2)}) doesn't match spending total (${combinedTotalHbd.toFixed(2)})`);
  }
  if (Math.abs(countryTotal - combinedTotalHbd) > tolerance) {
    console.warn(`⚠️ WARNING: Country total (${countryTotal.toFixed(2)}) doesn't match spending total (${combinedTotalHbd.toFixed(2)})`);
  }
  if (Math.abs(eventTypeTotal - combinedTotalHbd) > tolerance) {
    console.warn(`⚠️ WARNING: Event Type total (${eventTypeTotal.toFixed(2)}) doesn't match spending total (${combinedTotalHbd.toFixed(2)})`);
  }
  if (Math.abs(eventProjectTotal - combinedTotalHbd) > tolerance) {
    console.warn(`⚠️ WARNING: Event Project total (${eventProjectTotal.toFixed(2)}) doesn't match spending total (${combinedTotalHbd.toFixed(2)})`);
  }
  if (Math.abs(monthlyTotal - combinedTotalHbd) > tolerance) {
    console.warn(`⚠️ WARNING: Monthly total (${monthlyTotal.toFixed(2)}) doesn't match spending total (${combinedTotalHbd.toFixed(2)})`);
  }
  console.log(`========================\n`);
  
  // Filter loans/refunds by year if specified
  let loansAndRefundsTransactions = transactions;
  if (year !== undefined) {
    loansAndRefundsTransactions = transactions.filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === year;
      } catch {
        return false;
      }
    });
  }
  
  // Calculate loans (excluding loan refunds)
  const loanTransactions = loansAndRefundsTransactions.filter(tx => tx.isLoan && !tx.isLoanRefund);
  console.log(`calculateMetrics: Found ${loanTransactions.length} loan transactions (excluding loan refunds)`);
  if (loanTransactions.length > 0) {
    console.log(`calculateMetrics: Sample loan transactions:`);
    loanTransactions.slice(0, 5).forEach(tx => {
      const hiveValue = tx.hiveToHbd !== undefined ? tx.hiveToHbd : (tx.hive ? convertHiveToHbd(tx.hive) : 0);
      const total = (tx.hbd || 0) + hiveValue;
      console.log(`  - ${tx.date}: wallet=${tx.wallet}, category=${tx.category}, hbd=${tx.hbd}, hive=${tx.hive}, total=${total.toFixed(2)}`);
    });
  }
  const totalLoansHbd = loanTransactions.reduce((sum, tx) => sum + (tx.hbd || 0), 0);
  const totalLoansHive = loanTransactions.reduce((sum, tx) => sum + (tx.hive || 0), 0);
  const totalLoansHbdEquivalent = loanTransactions.reduce((sum, tx) => {
    const hiveValue = tx.hiveToHbd !== undefined ? tx.hiveToHbd : (tx.hive ? convertHiveToHbd(tx.hive) : 0);
    return sum + (tx.hbd || 0) + hiveValue;
  }, 0);
  console.log(`calculateMetrics: Total loans - HBD: ${totalLoansHbd.toFixed(2)}, HIVE: ${totalLoansHive.toFixed(2)}, Equivalent: ${totalLoansHbdEquivalent.toFixed(2)}`);
  
  // Group loans by wallet to see which wallets are contributing
  const loansByWallet: Record<string, number> = {};
  loanTransactions.forEach(tx => {
    const wallet = tx.wallet.toLowerCase().replace('@', '').trim();
    const hiveValue = tx.hiveToHbd !== undefined ? tx.hiveToHbd : (tx.hive ? convertHiveToHbd(tx.hive) : 0);
    const total = (tx.hbd || 0) + hiveValue;
    loansByWallet[wallet] = (loansByWallet[wallet] || 0) + total;
  });
  console.log(`calculateMetrics: Loans by wallet (top 10):`);
  Object.entries(loansByWallet)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([wallet, amount]) => {
      console.log(`  - ${wallet}: ${amount.toFixed(2)} HBD`);
    });
  
  // Calculate refunds (excluding loan refunds)
  const refundTransactions = loansAndRefundsTransactions.filter(tx => tx.isRefund && !tx.isLoanRefund);
  console.log(`calculateMetrics: Found ${refundTransactions.length} refund transactions (excluding loan refunds)`);
  if (refundTransactions.length > 0) {
    const sampleRefund = refundTransactions[0];
    console.log(`calculateMetrics: Sample refund - wallet: ${sampleRefund.wallet}, hbd: ${sampleRefund.hbd}, isRefund: ${sampleRefund.isRefund}, isLoanRefund: ${sampleRefund.isLoanRefund}`);
  }
  const totalRefundsHbd = refundTransactions.reduce((sum, tx) => sum + (tx.hbd || 0), 0);
  const totalRefundsHive = refundTransactions.reduce((sum, tx) => sum + (tx.hive || 0), 0);
  const totalRefundsHbdEquivalent = refundTransactions.reduce((sum, tx) => {
    const hiveValue = tx.hiveToHbd !== undefined ? tx.hiveToHbd : (tx.hive ? convertHiveToHbd(tx.hive) : 0);
    return sum + (tx.hbd || 0) + hiveValue;
  }, 0);
  console.log(`calculateMetrics: Total refunds - HBD: ${totalRefundsHbd.toFixed(2)}, HIVE: ${totalRefundsHive.toFixed(2)}, Equivalent: ${totalRefundsHbdEquivalent.toFixed(2)}`);
  
  // Calculate loan refunds
  const loanRefundTransactions = loansAndRefundsTransactions.filter(tx => tx.isLoanRefund);
  console.log(`calculateMetrics: Found ${loanRefundTransactions.length} loan refund transactions`);
  if (loanRefundTransactions.length > 0) {
    console.log(`calculateMetrics: Sample loan refund transactions:`);
    loanRefundTransactions.slice(0, 5).forEach(tx => {
      const hiveValue = tx.hiveToHbd !== undefined ? tx.hiveToHbd : (tx.hive ? convertHiveToHbd(tx.hive) : 0);
      const total = (tx.hbd || 0) + hiveValue;
      console.log(`  - ${tx.date}: wallet=${tx.wallet}, category=${tx.category}, hbd=${tx.hbd}, hive=${tx.hive}, total=${total.toFixed(2)}`);
    });
  }
  const totalLoanRefundsHbd = loanRefundTransactions.reduce((sum, tx) => sum + (tx.hbd || 0), 0);
  const totalLoanRefundsHive = loanRefundTransactions.reduce((sum, tx) => sum + (tx.hive || 0), 0);
  const totalLoanRefundsHbdEquivalent = loanRefundTransactions.reduce((sum, tx) => {
    const hiveValue = tx.hiveToHbd !== undefined ? tx.hiveToHbd : (tx.hive ? convertHiveToHbd(tx.hive) : 0);
    return sum + (tx.hbd || 0) + hiveValue;
  }, 0);
  console.log(`calculateMetrics: Total loan refunds - HBD: ${totalLoanRefundsHbd.toFixed(2)}, HIVE: ${totalLoanRefundsHive.toFixed(2)}, Equivalent: ${totalLoanRefundsHbdEquivalent.toFixed(2)}`);
  
  // Remaining Q4 funds (placeholder - should be calculated from actual budget)
  const remainingQ4Funds = 60741.71;
  
  return {
    totalHbd,
    totalHive,
    combinedTotalHbd,
    remainingQ4Funds,
    spendingByCategory: aggregateByCategory(transactionsForAggregation),
    spendingByCountry: aggregateByCountry(transactionsForAggregation),
    spendingByEventType: aggregateByEventType(transactionsForAggregation),
    spendingByEventProject: aggregateByEventProject(transactionsForAggregation),
    spendingByWallet: aggregateByWallet(transactionsForAggregation, year || 2025), // Use specified year or default to 2025
    monthlySpending: aggregateByMonth(transactionsForAggregation),
    // Loan and refund tracking
    totalLoansHbd,
    totalLoansHive,
    totalLoansHbdEquivalent,
    totalRefundsHbd,
    totalRefundsHive,
    totalRefundsHbdEquivalent,
    totalLoanRefundsHbd,
    totalLoanRefundsHive,
    totalLoanRefundsHbdEquivalent,
  };
}

// Filter transactions by date range
export function filterByDateRange(transactions: Transaction[], startDate: Date, endDate: Date): Transaction[] {
  // Normalize dates to start and end of day for proper comparison
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  return transactions.filter(tx => {
    try {
      const txDate = parseDate(tx.date);
      // Normalize transaction date to start of day for comparison
      const normalizedTxDate = new Date(txDate);
      normalizedTxDate.setHours(0, 0, 0, 0);
      
      return normalizedTxDate >= start && normalizedTxDate <= end;
    } catch {
      return false;
    }
  });
}

// Filter transactions by month and year
export function filterByMonth(transactions: Transaction[], year: number, month: number): Transaction[] {
  return transactions.filter(tx => {
    try {
      const txDate = parseDate(tx.date);
      return txDate.getFullYear() === year && txDate.getMonth() === month;
    } catch {
      return false;
    }
  });
}

// Filter transactions by various criteria
export function filterTransactions(
  transactions: Transaction[],
  filters: {
    country?: string;
    category?: string;
    eventType?: string;
    wallet?: string;
    search?: string;
  }
): Transaction[] {
  return transactions.filter(tx => {
    if (filters.country && tx.country !== filters.country) return false;
    if (filters.category && tx.category !== filters.category) return false;
    if (filters.eventType && tx.eventType !== filters.eventType) return false;
    if (filters.wallet && tx.wallet !== filters.wallet) return false;
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        tx.wallet?.toLowerCase().includes(searchLower) ||
        tx.eventProject?.toLowerCase().includes(searchLower) ||
        tx.country?.toLowerCase().includes(searchLower) ||
        tx.theme?.toLowerCase().includes(searchLower) ||
        tx.eventType?.toLowerCase().includes(searchLower) ||
        tx.category?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });
}

// Calculate wallet totals with detailed breakdown
// Useful for verifying specific wallet spending (e.g., ssekulji for rally car)
export function calculateWalletTotals(
  transactions: Transaction[],
  walletName: string,
  options?: {
    year?: number;
    startDate?: Date;
    endDate?: Date;
  }
): {
  transactions: Transaction[];
  totalHbd: number;
  totalHive: number;
  totalHiveInHbd: number;
  grandTotal: number;
  transactionCount: number;
} {
  // Normalize wallet name (remove @, lowercase)
  const normalizedWalletName = walletName.toLowerCase().replace('@', '').trim();
  
  // Filter by wallet
  let filtered = transactions.filter(tx => {
    const txWallet = tx.wallet.toLowerCase().replace('@', '').trim();
    return txWallet === normalizedWalletName;
  });
  
  // Apply date filters if provided
  if (options?.year !== undefined) {
    filtered = filtered.filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === options.year;
      } catch {
        return false;
      }
    });
  }
  
  if (options?.startDate || options?.endDate) {
    const startDate = options.startDate || new Date(2020, 0, 1);
    const endDate = options.endDate || new Date(2030, 11, 31);
    filtered = filterByDateRange(filtered, startDate, endDate);
  }
  
  // Calculate totals
  const totalHbd = filtered.reduce((sum, tx) => sum + (tx.hbd || 0), 0);
  const totalHive = filtered.reduce((sum, tx) => sum + (tx.hive || 0), 0);
  const totalHiveInHbd = filtered.reduce((sum, tx) => {
    if (tx.hiveToHbd !== undefined) {
      return sum + tx.hiveToHbd;
    } else if (tx.hive) {
      return sum + convertHiveToHbd(tx.hive);
    }
    return sum;
  }, 0);
  const grandTotal = filtered.reduce((sum, tx) => sum + calculateTotalSpend(tx), 0);
  
  return {
    transactions: filtered,
    totalHbd,
    totalHive,
    totalHiveInHbd,
    grandTotal,
    transactionCount: filtered.length,
  };
}

// Map transaction to vertical category
// First tries to match by eventProject/project name, then falls back to category matching
function mapToVerticalCategory(
  transaction: Transaction,
  verticalProjects: Array<{ project: string; category: string }>
): string | null {
  // First, try to match by eventProject/project name
  const eventProject = (transaction.eventProject || '').trim();
  if (eventProject) {
    const eventProjectLower = eventProject.toLowerCase();
    // Try exact match first
    const exactProjectMatch = verticalProjects.find(vp => 
      vp.project.toLowerCase() === eventProjectLower
    );
    if (exactProjectMatch) {
      return exactProjectMatch.category;
    }
    // Try partial match (project name might be part of eventProject)
    const partialProjectMatch = verticalProjects.find(vp => {
      const projectLower = vp.project.toLowerCase();
      return eventProjectLower.includes(projectLower) || projectLower.includes(eventProjectLower);
    });
    if (partialProjectMatch) {
      return partialProjectMatch.category;
    }
  }
  
  // Fall back to category matching (more flexible)
  const categoryLower = (transaction.category || '').toLowerCase().trim();
  if (!categoryLower) {
    return null;
  }
  
  // Ecosystem Marketing - match "marketing", "ecosystem", etc.
  if (categoryLower.includes('marketing') || 
      categoryLower.includes('ecosystem') ||
      categoryLower === 'marketing') {
    return 'Ecosystem Marketing';
  }
  
  // Social Impact + Niche Promotion
  if (categoryLower.includes('social impact') || 
      categoryLower.includes('niche promotion') ||
      categoryLower.includes('social') && categoryLower.includes('impact')) {
    return 'Social Impact + Niche Promotion';
  }
  
  // Hive and HBD Adoption - match "hive adoption", "hbd adoption", "adoption", etc.
  if ((categoryLower.includes('hive') || categoryLower.includes('hbd')) && 
      (categoryLower.includes('adoption') || categoryLower.includes('adopt'))) {
    return 'Hive and HBD Adoption';
  }
  if (categoryLower.includes('adoption') && !categoryLower.includes('social')) {
    return 'Hive and HBD Adoption';
  }
  
  // Conferences
  if (categoryLower.includes('conference') || 
      categoryLower.includes('convention') ||
      categoryLower === 'conference') {
    return 'Conferences';
  }
  
  // Exact match with vertical category names
  const verticalCategories = [
    'Ecosystem Marketing',
    'Social Impact + Niche Promotion',
    'Hive and HBD Adoption',
    'Conferences'
  ];
  
  const exactMatch = verticalCategories.find(vc => 
    vc.toLowerCase() === categoryLower
  );
  
  return exactMatch || null;
}

// Aggregate transactions by vertical category for a specific year
export function aggregateByVerticalCategory(
  transactions: Transaction[],
  year: number,
  verticalProjects?: Array<{ project: string; category: string }>
): Record<string, {
  totalHbd: number;
  totalHive: number;
  totalHiveInHbd: number;
  combinedTotalHbd: number;
}> {
  const aggregated: Record<string, {
    totalHbd: number;
    totalHive: number;
    totalHiveInHbd: number;
    combinedTotalHbd: number;
  }> = {};
  
  // Initialize all vertical categories
  const verticalCategories = [
    'Ecosystem Marketing',
    'Social Impact + Niche Promotion',
    'Hive and HBD Adoption',
    'Conferences'
  ];
  
  verticalCategories.forEach(cat => {
    aggregated[cat] = {
      totalHbd: 0,
      totalHive: 0,
      totalHiveInHbd: 0,
      combinedTotalHbd: 0
    };
  });
  
  // Only include actual spending, exclude loans and refunds
  const spendingTransactions = filterSpendingTransactions(transactions);
  
  // Track unmapped transactions for debugging
  const unmappedTransactions: Array<{ category: string; eventProject: string; wallet: string }> = [];
  
  spendingTransactions.forEach(tx => {
    // Filter by year
    try {
      const txDate = parseDate(tx.date);
      if (txDate.getFullYear() !== year) {
        return; // Skip transactions not in the specified year
      }
    } catch {
      return; // Skip transactions with invalid dates
    }
    
    // Map transaction to vertical category
    const verticalCategory = mapToVerticalCategory(tx, verticalProjects || []);
    if (!verticalCategory) {
      // Track unmapped transactions for debugging
      if (tx.category || tx.eventProject) {
        unmappedTransactions.push({
          category: tx.category || '',
          eventProject: tx.eventProject || '',
          wallet: tx.wallet || ''
        });
      }
      return; // Skip if no mapping found
    }
    
    const hbd = tx.hbd || 0;
    const hive = tx.hive || 0;
    const hiveInHbd = tx.hiveToHbd !== undefined 
      ? tx.hiveToHbd 
      : (tx.hive ? convertHiveToHbd(tx.hive) : 0);
    const total = hbd + hiveInHbd;
    
    aggregated[verticalCategory].totalHbd += hbd;
    aggregated[verticalCategory].totalHive += hive;
    aggregated[verticalCategory].totalHiveInHbd += hiveInHbd;
    aggregated[verticalCategory].combinedTotalHbd += total;
  });
  
  // Log unmapped transactions for debugging
  if (unmappedTransactions.length > 0) {
    console.log(`aggregateByVerticalCategory: ${unmappedTransactions.length} transactions could not be mapped to verticals:`);
    // Group by category to see patterns
    const categoryGroups: Record<string, number> = {};
    unmappedTransactions.forEach(ut => {
      const key = ut.category || 'No Category';
      categoryGroups[key] = (categoryGroups[key] || 0) + 1;
    });
    console.log('Unmapped by category:', categoryGroups);
  }
  
  return aggregated;
}

