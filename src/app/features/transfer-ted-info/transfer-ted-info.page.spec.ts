import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { TransferTedInfoPage } from './transfer-ted-info.page';

describe('TransferTedInfoPage', () => {
  let component: TransferTedInfoPage;
  let fixture: ComponentFixture<TransferTedInfoPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TransferTedInfoPage],
      imports: [IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferTedInfoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
