import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

export type InstitutionalDialogVariant = 'info' | 'warning' | 'error';

export interface InstitutionalDialogData {
  title: string;
  message: string;
  actionLabel?: string;
  variant?: InstitutionalDialogVariant;
}

@Component({
  selector: 'app-institutional-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule],
  template: `
    <section class="institutional-dialog" [class]="'institutional-dialog-' + variant">
      <div class="institutional-dialog-icon" aria-hidden="true">
        @if (variant === 'error') {
          <svg viewBox="0 0 24 24">
            <path d="M12 8v5" />
            <path d="M12 17h.01" />
            <path d="M10.3 4.1 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0Z" />
          </svg>
        } @else if (variant === 'warning') {
          <svg viewBox="0 0 24 24">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M5 19h14L12 4 5 19Z" />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24">
            <path d="M12 17v-5" />
            <path d="M12 8h.01" />
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        }
      </div>

      <div>
        <h2 mat-dialog-title>{{ data.title }}</h2>
        <mat-dialog-content>
          <p>{{ data.message }}</p>
        </mat-dialog-content>
      </div>

      <mat-dialog-actions align="end">
        <button mat-flat-button color="primary" type="button" (click)="close()">
          {{ data.actionLabel || 'Entendido' }}
        </button>
      </mat-dialog-actions>
    </section>
  `,
})
export class InstitutionalDialogComponent {
  readonly data = inject<InstitutionalDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<InstitutionalDialogComponent>);

  get variant(): InstitutionalDialogVariant {
    return this.data.variant || 'info';
  }

  close(): void {
    this.dialogRef.close();
  }
}
