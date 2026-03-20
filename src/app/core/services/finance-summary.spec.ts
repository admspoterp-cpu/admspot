import { TestBed } from '@angular/core/testing';

import { FinanceSummaryService } from './finance-summary';

describe('FinanceSummaryService', () => {
  let service: FinanceSummaryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FinanceSummaryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
