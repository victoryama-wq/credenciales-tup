import { UserRole } from './user-role.model';
import {
  InstitutionalAcademicStatus,
  InstitutionalProfileSource,
} from './institutional-profile.model';
import { CredentialApplicantType } from './credential-request.model';

export interface UserProfile {
  uid: string;
  role: UserRole;
  applicantType?: CredentialApplicantType;
  academicStatus?: InstitutionalAcademicStatus;
  statusSource?: InstitutionalProfileSource;
  studentId?: string;
  name: string;
  email: string;
  career?: string;
  currentTerm?: string;
  position?: string;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}
