import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../../domain/entities/User';
import { authService } from '../../infrastructure/auth/GoogleAuthService';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(() => authService.getCurrentUser());
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  const clientId = authService.getClientId();
  const isConfigured = authService.isConfigured();

  useEffect(() => {
    const unsubscribe = authService.subscribe((newUser) => {
      setUser(newUser);
    });
    return () => unsubscribe();
  }, []);

  const loginWithCredential = useCallback(async (credential: string) => {
    return await authService.loginWithCredential(credential);
  }, []);

  const loginWithMock = useCallback(async (mockUser?: Partial<UserProfile>) => {
    return await authService.loginWithMock(mockUser);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setShowProfileModal(false);
  }, []);

  return {
    user,
    isAuthenticated: Boolean(user),
    isConfigured,
    clientId,
    showConfigModal,
    setShowConfigModal,
    showProfileModal,
    setShowProfileModal,
    loginWithCredential,
    loginWithMock,
    logout,
  };
}
