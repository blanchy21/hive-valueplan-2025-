/**
 * Loans Data
 * 
 * This file contains loans given to various wallets.
 * These are loans that were provided and may have been paid back.
 * 
 * Last updated: Based on user-provided loan list
 */

import { Transaction } from '@/lib/types';

export interface Loan {
  date: string; // Date in format that can be parsed by parseDate
  amountHbd: number; // Amount in HBD (0 if not HBD)
  amountHive: number; // Amount in HIVE (0 if not HIVE)
  recipient: string; // Account that received the loan
  description: string; // Description/memo of the loan
  year: number; // Year for filtering
}

/**
 * Loans given to various wallets
 * Note: These are loans GIVEN OUT (money sent to these wallets)
 */
export const LOANS: Loan[] = [
  {
    date: '24/01/2025',
    amountHbd: 13000.00,
    amountHive: 0,
    recipient: 'blocktrades',
    description: 'Loan to @blocktrades',
    year: 2025,
  },
  {
    date: '22/01/2025',
    amountHbd: 2000.00,
    amountHive: 0,
    recipient: 'alpha',
    description: 'Loan to @alpha',
    year: 2025,
  },
  // Note: The 1,000 HIVE to guitieparties and 91,325 HIVE to alpha are actually loan refunds (repayments),
  // not loans given out. They are recorded in loan-refunds.ts
];

/**
 * Calculate total loans for a given year
 */
export function getTotalLoans(year?: number): { hbd: number; hive: number } {
  const loans = year 
    ? LOANS.filter(l => l.year === year)
    : LOANS;
  return {
    hbd: loans.reduce((sum, loan) => sum + loan.amountHbd, 0),
    hive: loans.reduce((sum, loan) => sum + loan.amountHive, 0),
  };
}

/**
 * Get loans as Transaction objects for integration with existing system
 */
export function getLoansAsTransactions(): Transaction[] {
  return LOANS.map(loan => ({
    wallet: loan.recipient,
    date: loan.date,
    hbd: loan.amountHbd,
    hive: loan.amountHive,
    eventProject: '',
    country: '',
    theme: '',
    eventType: '',
    category: 'Loan',
    isLoan: true,
    isRefund: false,
    isLoanRefund: false,
    totalSpend: loan.amountHbd + (loan.amountHive * 0.24), // Using 0.24 conversion rate for 2025
  }));
}

