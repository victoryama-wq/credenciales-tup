import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/user-role.model';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const expectedRole = route.data['role'] as UserRole | undefined;
  const user = await authService.waitForCurrentUser();

  if (!user) {
    return router.createUrlTree(['/login']);
  }

  const actualRole = await authService.getUserRole(user);

  if (!expectedRole || actualRole === expectedRole) {
    return true;
  }

  return router.createUrlTree([actualRole === 'admin' ? '/admin' : '/student']);
};
