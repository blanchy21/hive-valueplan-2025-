/**
 * Loan Refunds Data
 * 
 * This file contains loan refunds (repayments) received from wallets that were given loans.
 * These are repayments of loans that were previously given out.
 * 
 * Last updated: Based on user-provided loan refund list
 */

import { Transaction } from '@/lib/types';

export interface LoanRefund {
  date: string; // Date in format that can be parsed by parseDate
  amountHbd: number; // Amount in HBD (0 if not HBD)
  amountHive: number; // Amount in HIVE (0 if not HIVE)
  sender: string; // Account that sent the loan refund (repayment)
  description: string; // Description/memo of the loan refund
  year: number; // Year for filtering
}

/**
 * Loan refunds (repayments) received from various wallets
 */
export const LOAN_REFUNDS: LoanRefund[] = [
  {
    date: '12/09/2025',
    amountHbd: 0,
    amountHive: 1000.00,
    sender: 'guiltyparties',
    description: 'minor bridge loan',
    year: 2025,
  },
  {
    date: '08/07/2025',
    amountHbd: 0,
    amountHive: 91325.00,
    sender: 'alpha',
    description: 'bridge',
    year: 2025,
  },
];

/**
 * Calculate total loan refunds for a given year
 */
export function getTotalLoanRefunds(year?: number): { hbd: number; hive: number } {
  const refunds = year 
    ? LOAN_REFUNDS.filter(r => r.year === year)
    : LOAN_REFUNDS;
  return {
    hbd: refunds.reduce((sum, refund) => sum + refund.amountHbd, 0),
    hive: refunds.reduce((sum, refund) => sum + refund.amountHive, 0),
  };
}

/**
 * Get loan refunds as Transaction objects for integration with existing system
 */
export function getLoanRefundsAsTransactions(): Transaction[] {
  return LOAN_REFUNDS.map(refund => ({
    wallet: refund.sender,
    date: refund.date,
    hbd: refund.amountHbd,
    hive: refund.amountHive,
    eventProject: '',
    country: '',
    theme: '',
    eventType: '',
    category: 'Loan Refund',
    isLoan: false,
    isRefund: false,
    isLoanRefund: true,
    totalSpend: refund.amountHbd + (refund.amountHive * 0.24), // Using 0.24 conversion rate for 2025
  }));
}

