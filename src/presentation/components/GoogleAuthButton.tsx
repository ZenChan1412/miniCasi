import React, { useEffect, useRef } from 'react';
import { UserProfile } from '../../domain/entities/User';

interface GoogleAuthButtonProps {
  user: UserProfile | null;
  isConfigured: boolean;
  clientId: string;
  onOpenProfile: () => void;
  onOpenConfig: () => void;
  onCredentialSuccess: (credential: string) => void;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  user,
  isConfigured,
  clientId,
  onOpenProfile,
  onOpenConfig,
  onCredentialSuccess,
}) => {
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // เก็บ callback ไว้ใน ref: App เรนเดอร์ใหม่ทุกวินาที (ตัวนับถอยหลัง) ทำให้ onCredentialSuccess
  // เป็นฟังก์ชันใหม่ทุกครั้ง ถ้าใส่ใน deps ของ effect ปุ่ม Google จะถูกล้างแล้ววาดใหม่ทุกวินาที (กระพริบ)
  const onCredentialRef = useRef(onCredentialSuccess);
  useEffect(() => {
    onCredentialRef.current = onCredentialSuccess;
  }, [onCredentialSuccess]);

  // Initialize and render Google Identity Services button when configured
  useEffect(() => {
    if (!isConfigured || user || !clientId) return;

    const checkAndInitGoogle = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: { credential: string }) => {
              if (response && response.credential) {
                onCredentialRef.current(response.credential);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (googleBtnContainerRef.current) {
            googleBtnContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              type: 'standard',
              theme: 'filled_black',
              size: 'medium',
              text: 'signin_with',
              shape: 'pill',
              logo_alignment: 'left',
              width: 190,
            });
          }
        } catch (e) {
          console.error('Google Identity Services init error:', e);
        }
      }
    };

    // Check if script is already ready or wait a short interval
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      checkAndInitGoogle();
    } else {
      const interval = setInterval(() => {
        if (typeof window !== 'undefined' && window.google?.accounts?.id) {
          clearInterval(interval);
          checkAndInitGoogle();
        }
      }, 300);

      return () => clearInterval(interval);
    }
  }, [isConfigured, user, clientId]);

  // Case 1: User is already logged in
  if (user) {
    return (
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex items-center gap-2 py-1 px-2.5 rounded-full bg-slate-900 border border-slate-700/80 hover:border-amber-500/50 hover:bg-slate-850 transition-all cursor-pointer group shadow-sm"
        title="จัดการบัญชี Google"
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-full object-cover border border-amber-500/50 group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 transition-colors max-w-[100px] truncate">
          {user.givenName || user.name}
        </span>
        {/* Google G mini icon */}
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.09C3.25 21.36 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.27C.46 8.2.005 10.05.005 12s.46 3.8 1.265 5.41l4.01-3.09z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.59l4.01 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
          />
        </svg>
      </button>
    );
  }

  // Case 2: Configured with valid Client ID in .env -> Render GIS Button
  if (isConfigured) {
    return (
      <div className="flex items-center">
        <div ref={googleBtnContainerRef} className="min-h-[38px] flex items-center" />
      </div>
    );
  }

  // Case 3: Not yet configured -> Show Google button that opens help/modal
  return (
    <button
      type="button"
      onClick={onOpenConfig}
      className="py-1.5 px-3 rounded-full bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-amber-500/50 text-slate-200 hover:text-white font-medium text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer group"
      title="เชื่อมต่อด้วย Google (ใส่ key ใน .env)"
    >
      <svg className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.09C3.25 21.36 7.31 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.27C.46 8.2.005 10.05.005 12s.46 3.8 1.265 5.41l4.01-3.09z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.59l4.01 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
        />
      </svg>
      <span className="hidden sm:inline">เข้าสู่ระบบด้วย Google</span>
      <span className="sm:hidden">Google</span>
    </button>
  );
};
