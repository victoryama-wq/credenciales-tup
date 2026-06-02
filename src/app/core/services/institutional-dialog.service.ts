import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  InstitutionalDialogComponent,
  InstitutionalDialogData,
} from '../ui/institutional-dialog/institutional-dialog.component';

@Injectable({
  providedIn: 'root',
})
export class InstitutionalDialogService {
  private readonly dialog = inject(MatDialog);

  open(data: InstitutionalDialogData): MatDialogRef<InstitutionalDialogComponent> {
    return this.dialog.open(InstitutionalDialogComponent, {
      data,
      width: 'min(92vw, 440px)',
      panelClass: 'institutional-dialog-panel',
      autoFocus: false,
      restoreFocus: false,
    });
  }
}
