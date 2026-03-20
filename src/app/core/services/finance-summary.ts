import { Injectable } from '@angular/core';
import { FinanceSummary, Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root',
})
export class FinanceSummaryService {
  private readonly transactions: Transaction[] = [
    {
      id: 'trx-001',
      description: 'Salario',
      amount: 6500,
      category: 'Renda',
      date: '2026-03-05',
      type: 'income',
    },
    {
      id: 'trx-002',
      description: 'Aluguel',
      amount: 1900,
      category: 'Moradia',
      date: '2026-03-06',
      type: 'expense',
    },
    {
      id: 'trx-003',
      description: 'Mercado',
      amount: 720.5,
      category: 'Alimentacao',
      date: '2026-03-08',
      type: 'expense',
    },
    {
      id: 'trx-004',
      description: 'Freelance',
      amount: 1500,
      category: 'Renda Extra',
      date: '2026-03-11',
      type: 'income',
    },
  ];

  getTransactions(): Transaction[] {
    return this.transactions;
  }

  getSummary(): FinanceSummary {
    const totalIncome = this.transactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + transaction.amount, 0);

    const totalExpense = this.transactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }
}
