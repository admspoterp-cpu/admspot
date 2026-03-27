import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'onboarding',
    pathMatch: 'full'
  },
  {
    path: 'onboarding',
    loadChildren: () => import('./features/onboarding/onboarding.module').then( m => m.OnboardingPageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./features/login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'session-bootstrap',
    loadChildren: () =>
      import('./features/session-bootstrap/session-bootstrap.module').then(
        (m) => m.SessionBootstrapPageModule
      ),
  },
  {
    path: 'wallet-digital-setup',
    loadChildren: () =>
      import('./features/wallet-digital-setup/wallet-digital-setup.module').then(
        (m) => m.WalletDigitalSetupPageModule
      ),
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.module').then( m => m.DashboardPageModule)
  },
  {
    path: 'charge-scan-results',
    loadChildren: () =>
      import('./features/charge-scan-results/charge-scan-results.module').then(
        (m) => m.ChargeScanResultsPageModule
      ),
  },
  {
    path: 'depositar',
    loadChildren: () =>
      import('./features/depositar/depositar.module').then((m) => m.DepositarPageModule),
  },
  {
    path: 'cartoes',
    loadChildren: () =>
      import('./features/cartoes/cartoes.module').then((m) => m.CartoesPageModule),
  },
  {
    path: 'transactions',
    loadChildren: () => import('./features/transactions/transactions.module').then( m => m.TransactionsPageModule)
  },
  {
    path: 'qr-scan',
    loadChildren: () => import('./features/qr-scan/qr-scan.module').then( m => m.QrScanPageModule)
  },
  {
    path: 'boleto-scan',
    loadChildren: () => import('./features/boleto-scan/boleto-scan.module').then( m => m.BoletoScanPageModule)
  },
  {
    path: 'boleto-manual',
    loadChildren: () => import('./features/boleto-manual/boleto-manual.module').then( m => m.BoletoManualPageModule)
  },
  {
    path: 'boleto-payment-details',
    loadChildren: () =>
      import('./features/boleto-payment-details/boleto-payment-details.module').then(
        (m) => m.BoletoPaymentDetailsPageModule
      ),
  },
  {
    path: 'boleto-payment-success',
    loadChildren: () =>
      import('./features/boleto-payment-success/boleto-payment-success.module').then(
        (m) => m.BoletoPaymentSuccessPageModule
      ),
  },
  {
    path: 'pix-qr-payment-details',
    loadChildren: () =>
      import('./features/pix-qr-payment-details/pix-qr-payment-details.module').then(
        (m) => m.PixQrPaymentDetailsPageModule
      ),
  },
  {
    path: 'pix-qr-processing',
    loadChildren: () =>
      import('./features/pix-qr-processing/pix-qr-processing.module').then(
        (m) => m.PixQrProcessingPageModule
      ),
  },
  {
    path: 'transfer-pix',
    loadChildren: () =>
      import('./features/transfer-pix/transfer-pix.module').then((m) => m.TransferPixPageModule),
  },
  {
    path: 'transfer-ted',
    loadChildren: () =>
      import('./features/transfer-ted/transfer-ted.module').then((m) => m.TransferTedPageModule),
  },
  {
    path: 'transfer-ted-info',
    loadChildren: () =>
      import('./features/transfer-ted-info/transfer-ted-info.module').then((m) => m.TransferTedInfoPageModule),
  },
  {
    path: 'pay-transfer-pix',
    loadChildren: () =>
      import('./features/pay-transfer-pix/pay-transfer-pix.module').then((m) => m.PayTransferPixPageModule),
  },
  {
    path: 'comprovante-payment',
    loadChildren: () =>
      import('./features/comprovante-payment/comprovante-payment.module').then(
        (m) => m.ComprovantePaymentPageModule
      ),
  },
  {
    path: 'recarga-success',
    loadChildren: () =>
      import('./features/recarga-success/recarga-success.module').then((m) => m.RecargaSuccessPageModule),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
