import { UserProfile } from '../entities/User';

export interface IAuthService {
  getClientId(): string;
  isConfigured(): boolean;
  getCurrentUser(): UserProfile | null;
  loginWithCredential(credential: string): Promise<UserProfile>;
  loginWithMock(mockUser?: Partial<UserProfile>): Promise<UserProfile>;
  logout(): Promise<void>;
  subscribe(callback: (user: UserProfile | null) => void): () => void;
}
