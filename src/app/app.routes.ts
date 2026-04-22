import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page.component').then(
        (m) => m.LoginPageComponent
      ),
  },
  {
    path: 'student',
    canActivate: [roleGuard],
    data: { role: 'student' },
    loadComponent: () =>
      import(
        './features/student/pages/student-dashboard/student-dashboard.component'
      ).then((m) => m.StudentDashboardComponent),
  },
  {
    path: 'admin',
    canActivate: [roleGuard],
    data: { role: 'admin' },
    loadComponent: () =>
      import('./features/admin/pages/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent
      ),
  },
  { path: '**', redirectTo: 'login' },
];
