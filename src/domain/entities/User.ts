export type UserRole = 'admin' | 'player';

export interface UserProfile {
  id: string;             // Google sub or unique user ID
  email: string;          // User email address
  name: string;           // Display name
  givenName?: string;     // First name
  familyName?: string;    // Last name
  picture?: string;       // Avatar picture URL
  provider: 'google' | 'mock' | 'guest';
  role?: UserRole;        // สิทธผ์ีู้ดู้แล้ระบบ (admin = ผ้ดู้แล้ระบบ, player = ผู้ใช้ปกติ)
  idToken?: string;
  loggedInAt: number;     // Timestamp in ms
}

export interface GoogleJwtPayload {
  iss?: string;
  sub: string;
  email: string;
  email_verified?: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat?: number;
  exp?: number;
}
