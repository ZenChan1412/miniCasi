import { UserProfile } from '../../domain/entities/User';
import { IAuthService } from '../../domain/ports/IAuthService';
import { decodeGoogleJwt } from './jwtDecoder';
import { resolveRole, setUserRoleOverride } from '../../domain/constants/AdminConfig';
import { adminService } from '../../application/services/AdminService';

export class GoogleAuthService implements IAuthService {
  private static readonly STORAGE_KEY = 'high_low_auth_user_v1';
  private currentUser: UserProfile | null = null;
  private listeners: Set<(user: UserProfile | null) => void> = new Set();

  constructor() {
    this.loadUserFromStorage();
  }

  public getClientId(): string {
    // อ่านค่า Client ID จาก .env ผ่าน Vite (รองรับทั้ง VITE_GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_ID)
    const envClientId =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
      (typeof import.meta !== 'undefined' && (import.meta.env as Record<string, string | undefined>)?.GOOGLE_CLIENT_ID) ||
      '';

    return envClientId.trim();
  }

  public isConfigured(): boolean {
    const clientId = this.getClientId();
    return (
      Boolean(clientId) &&
      clientId.length > 10 &&
      !clientId.includes('your-google-client-id')
    );
  }

  private loadUserFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const dataStr = window.localStorage.getItem(GoogleAuthService.STORAGE_KEY);
      if (dataStr) {
        const parsed = JSON.parse(dataStr) as UserProfile;
        // ตรวจสอบสิทธิ์ทุกครั้งที่โหลด (กัน role เก่าค้างใน localStorage — creator > admin > player)
        if (parsed.email) {
          parsed.role = resolveRole(parsed.email);
        }
        this.currentUser = parsed;
        this.persistUser(parsed);
        adminService.registerUser(parsed);
      }
    } catch (e) {
      console.error('โหลดข้อมูลผู้ใช้จาก LocalStorage ล้มเหลว:', e);
      this.currentUser = null;
    }
  }

  private persistUser(user: UserProfile | null): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    if (user) {
      window.localStorage.setItem(GoogleAuthService.STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(GoogleAuthService.STORAGE_KEY);
    }
  }

  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public async loginWithCredential(credential: string): Promise<UserProfile> {
    const payload = decodeGoogleJwt(credential);
    if (!payload || !payload.sub) {
      throw new Error('โทเค็นการยืนยันตัวตนจาก Google ไม่ถูกต้อง');
    }

    // ตรวจสอบสิทธิ์โดย Email ที่ Google ยืนยันแล้ว (creator > admin > player)
    const email = (payload.email || '').trim().toLowerCase();

    const user: UserProfile = {
      id: `google_${payload.sub}`,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      givenName: payload.given_name || payload.name?.split(' ')[0],
      familyName: payload.family_name,
      picture: payload.picture,
      provider: 'google',
      role: resolveRole(email),
      idToken: credential,
      loggedInAt: Date.now(),
    };

    this.currentUser = user;
    this.persistUser(user);
    adminService.registerUser(user);
    this.notifyListeners();
    return user;
  }

  public async loginWithMock(mockData?: Partial<UserProfile>): Promise<UserProfile> {
    const email = (mockData?.email || 'player@gmail.com').trim().toLowerCase();

    const user: UserProfile = {
      id: mockData?.id || `mock_${Math.random().toString(36).substring(2, 9)}`,
      email: mockData?.email || 'player@gmail.com',
      name: mockData?.name || 'Google Player (Demo)',
      givenName: mockData?.givenName || 'Google Player',
      picture: mockData?.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      provider: 'mock',
      role: resolveRole(email),
      loggedInAt: Date.now(),
    };

    this.currentUser = user;
    this.persistUser(user);
    adminService.registerUser(user);
    this.notifyListeners();
    return user;
  }

  public updateCurrentUserRole(role: 'creator' | 'admin' | 'player'): void {
    if (!this.currentUser) return;
    if (this.currentUser.email) {
      setUserRoleOverride(this.currentUser.email, role);
    }
    this.currentUser.role = role;
    this.persistUser(this.currentUser);
    adminService.registerUser(this.currentUser);
    this.notifyListeners();
  }

  public async logout(): Promise<void> {
    if (typeof window !== 'undefined' && window.google?.accounts?.id?.disableAutoSelect) {
      try {
        window.google.accounts.id.disableAutoSelect();
      } catch (err) {
        console.warn('Google disableAutoSelect warning:', err);
      }
    }

    this.currentUser = null;
    this.persistUser(null);
    this.notifyListeners();
  }

  public subscribe(callback: (user: UserProfile | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentUser);

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.error('Error notifying auth listener:', e);
      }
    }
  }
}

// Singleton Auth Service Instance
export const authService = new GoogleAuthService();
