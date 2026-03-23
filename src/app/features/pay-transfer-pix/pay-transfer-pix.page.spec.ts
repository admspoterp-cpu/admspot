import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { PayTransferPixPage } from './pay-transfer-pix.page';

describe('PayTransferPixPage', () => {
  let component: PayTransferPixPage;
  let fixture: ComponentFixture<PayTransferPixPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PayTransferPixPage],
      imports: [IonicModule.forRoot(), FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PayTransferPixPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
