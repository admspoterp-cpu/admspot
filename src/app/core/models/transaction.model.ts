export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: TransactionType;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}
