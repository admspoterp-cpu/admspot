import { Component, OnInit, inject } from '@angular/core';
import { Transaction } from 'src/app/core/models/transaction.model';
import { FinanceSummaryService } from 'src/app/core/services/finance-summary';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: false,
})
export class TransactionsPage implements OnInit {
  transactions: Transaction[] = [];
  private readonly financeSummaryService = inject(FinanceSummaryService);

  ngOnInit(): void {
    this.transactions = this.financeSummaryService.getTransactions();
  }

}
