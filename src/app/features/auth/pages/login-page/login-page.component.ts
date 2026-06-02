import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { institutionalEmailDomain } from '../../../../core/auth/institutional-email.util';
import { AuthService } from '../../../../core/services/auth.service';
import { InstitutionalDialogService } from '../../../../core/services/institutional-dialog.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent implements OnInit {
  private authService = inject(AuthService);
  private dialogService = inject(InstitutionalDialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly institutionalEmailDomain = institutionalEmailDomain;

  loadingMode: 'google' | null = null;
  errorMessage = '';

  get isBusy(): boolean {
    return this.loadingMode !== null;
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('session') !== 'expired') {
      return;
    }

    const dialogRef = this.dialogService.open({
      title: 'Sesion expirada',
      message:
        'Por seguridad, cerramos tu sesion despues de 30 minutos de inactividad. ' +
        'Inicia sesion nuevamente para continuar.',
      actionLabel: 'Iniciar sesion',
      variant: 'warning',
    });

    dialogRef.afterClosed().subscribe(() => {
      void this.router.navigate([], {
        queryParams: { session: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  async loginWithGoogle(): Promise<void> {
    this.loadingMode = 'google';
    this.errorMessage = '';

    try {
      const userCredential = await this.authService.loginWithGoogle();
      const role = await this.authService.getUserRole(userCredential.user);

      await this.router.navigate([role === 'admin' ? '/admin' : '/student']);
    } catch (error) {
      this.errorMessage = this.authService.formatAuthError(error);
    } finally {
      this.loadingMode = null;
    }
  }
}
