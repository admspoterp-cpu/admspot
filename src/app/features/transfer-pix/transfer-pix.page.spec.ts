import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { TransferPixPage } from './transfer-pix.page';

describe('TransferPixPage', () => {
  let component: TransferPixPage;
  let fixture: ComponentFixture<TransferPixPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TransferPixPage],
      imports: [IonicModule.forRoot(), FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferPixPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
