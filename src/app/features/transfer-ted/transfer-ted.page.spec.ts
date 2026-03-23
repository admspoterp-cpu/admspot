import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { TransferTedPage } from './transfer-ted.page';

describe('TransferTedPage', () => {
  let component: TransferTedPage;
  let fixture: ComponentFixture<TransferTedPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TransferTedPage],
      imports: [IonicModule.forRoot(), FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferTedPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
