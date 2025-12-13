export interface Transaction {
  wallet: string;
  date: string;
  hbd: number;
  hive: number;
  eventProject: string;
  country: string;
  theme: string;
  eventType: string;
  category: string;
  memo?: string; // Transaction memo/comment from blockchain
  hiveToHbd?: number;
  totalSpend?: number;
  isLoan?: boolean;
  isRefund?: boolean;
  isLoanRefund?: boolean;
  // Verification fields
  verified?: boolean;
  verificationStatus?: 'verified' | 'unverified' | 'discrepancy' | 'not_found';
  hiveTransactionId?: string; // Link to blockchain transaction
  verificationDate?: string; // When verification was performed
  verificationNotes?: string; // Any notes about discrepancies
}

export interface Metrics {
  totalHbd: number;
  totalHive: number;
  combinedTotalHbd: number;
  remainingQ4Funds: number;
  spendingByCategory: Record<string, number>;
  spendingByCountry: Record<string, number>;
  spendingByEventType: Record<string, number>;
  spendingByEventProject: Record<string, number>;
  spendingByWallet: Record<string, number>; // Spending by account/wallet name, filtered by year
  monthlySpending: Array<{ month: string; hbd: number; hive: number; total: number }>;
  // Loan and refund tracking
  totalLoansHbd: number;
  totalLoansHive: number;
  totalLoansHbdEquivalent: number;
  totalRefundsHbd: number;
  totalRefundsHive: number;
  totalRefundsHbdEquivalent: number;
  totalLoanRefundsHbd: number;
  totalLoanRefundsHive: number;
  totalLoanRefundsHbdEquivalent: number;
  // Metadata
  sourceOfTruth?: string; // Data source (e.g., 'HiveSQL')
  dataYear?: number; // Year of the data
}

export interface GitLabContent {
  valuePlan: string;
  planning: string;
}

export interface HackMDContent {
  content: string;
}

// Hive blockchain transaction types
export interface HiveTransaction {
  trx_id: string;
  block: number;
  timestamp: string;
  op: {
    type: string;
    value: {
      from?: string;
      to?: string;
      amount?: string;
      memo?: string;
      [key: string]: unknown;
    };
  };
}

export interface HiveAccountHistory {
  history: Array<[number, HiveTransaction]>;
}

export interface HiveTransfer {
  trx_id: string;
  block: number;
  timestamp: string;
  from: string;
  to: string;
  amount: string;
  amountValue: number;
  currency: 'HIVE' | 'HBD';
  memo?: string;
}

export interface HiveAccountTransactions {
  account: string;
  transfers: HiveTransfer[];
  totalCount: number;
}

// Verification result types
export interface VerificationResult {
  verified: boolean;
  status: 'verified' | 'unverified' | 'discrepancy' | 'not_found';
  hiveTransaction?: HiveTransfer;
  discrepancies?: {
    amount?: { expected: number; actual: number };
    date?: { expected: Date; actual: Date };
    currency?: { expected: 'HIVE' | 'HBD'; actual: 'HIVE' | 'HBD' };
  };
  verificationDate: string;
}

export interface BatchVerificationResult {
  transaction: Transaction;
  verification: VerificationResult;
}

export interface BatchVerificationSummary {
  year: number;
  totalTransactions: number;
  verified: number;
  unverified: number;
  discrepancies: number;
  notFound: number;
  results: BatchVerificationResult[];
  summary: {
    totalHbdVerified: number;
    totalHiveVerified: number;
    totalHbdDiscrepancies: number;
    totalHiveDiscrepancies: number;
  };
}

