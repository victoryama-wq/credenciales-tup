import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { institutionalEmailDomain } from '../../../../core/auth/institutional-email.util';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly institutionalEmailDomain = institutionalEmailDomain;

  loadingMode: 'email' | 'google' | null = null;
  errorMessage = '';

  form = this.fb.nonNullable.group({
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.pattern(/^[^\s@]+@tecplayacar\.edu\.mx$/i),
      ],
    ],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get isBusy(): boolean {
    return this.loadingMode !== null;
  }

  async login() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loadingMode = 'email';
    this.errorMessage = '';

    try {
      const { email, password } = this.form.getRawValue();
      const userCredential = await this.authService.login(email, password);
      const role = await this.authService.getUserRole(userCredential.user);

      await this.router.navigate([role === 'admin' ? '/admin' : '/student']);
    } catch (error) {
      this.errorMessage = this.authService.formatAuthError(error);
    } finally {
      this.loadingMode = null;
    }
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
