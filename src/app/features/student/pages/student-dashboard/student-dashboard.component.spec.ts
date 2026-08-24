import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { CredentialRequestService } from '../../../../core/services/credential-request.service';
import { ImageCompressionService } from '../../../../core/services/image-compression.service';
import { InstitutionalDialogService } from '../../../../core/services/institutional-dialog.service';
import { InstitutionalProfileService } from '../../../../core/services/institutional-profile.service';
import { StudentDashboardComponent } from './student-dashboard.component';

describe('StudentDashboardComponent', () => {
  const logout = vi.fn();

  beforeEach(async () => {
    logout.mockReset();

    await TestBed.configureTestingModule({
      imports: [StudentDashboardComponent],
      providers: [
        { provide: AuthService, useValue: { logout } },
        { provide: CredentialRequestService, useValue: {} },
        { provide: InstitutionalProfileService, useValue: {} },
        { provide: InstitutionalDialogService, useValue: {} },
        { provide: ImageCompressionService, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('moves focus to tracking without navigating or closing the session', () => {
    const fixture = TestBed.createComponent(StudentDashboardComponent);
    const component = fixture.componentInstance;
    const trackingPanel = fixture.nativeElement.querySelector('#student-requests') as HTMLElement;
    const trackingTitle = fixture.nativeElement.querySelector(
      '#student-requests-title',
    ) as HTMLElement;
    const scrollIntoView = vi.fn();
    const initialUrl = window.location.href;

    Object.defineProperty(trackingPanel, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const focus = vi.spyOn(trackingTitle, 'focus');

    component.scrollToTracking();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(window.location.href).toBe(initialUrl);
    expect(logout).not.toHaveBeenCalled();

    fixture.destroy();
  });
});
