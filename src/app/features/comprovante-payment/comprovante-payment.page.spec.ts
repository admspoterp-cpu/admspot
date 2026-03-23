import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ComprovantePaymentPage } from './comprovante-payment.page';

describe('ComprovantePaymentPage', () => {
  let component: ComprovantePaymentPage;
  let fixture: ComponentFixture<ComprovantePaymentPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ComprovantePaymentPage],
      imports: [IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(ComprovantePaymentPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
