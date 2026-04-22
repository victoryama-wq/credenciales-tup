import { UserRole } from './user-role.model';

export interface UserProfile {
  uid: string;
  role: UserRole;
  studentId?: string;
  name: string;
  email: string;
  career?: string;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}
