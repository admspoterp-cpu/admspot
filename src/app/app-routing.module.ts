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
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.module').then( m => m.DashboardPageModule)
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
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
