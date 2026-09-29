/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace google {
  namespace accounts {
    namespace id {
      function initialize(config: {
        client_id: string;
        callback: (response: { credential: string; select_by?: string }) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        context?: 'signin' | 'signup' | 'use';
      }): void;

      function renderButton(
        parent: HTMLElement,
        options: {
          type?: 'standard' | 'icon';
          theme?: 'outline' | 'filled_blue' | 'filled_black';
          size?: 'large' | 'medium' | 'small';
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
          shape?: 'rectangular' | 'pill' | 'circle' | 'square';
          logo_alignment?: 'left' | 'center';
          width?: number | string;
          locale?: string;
        }
      ): void;

      function prompt(momentListener?: (notification: {
        isNotDisplayed: () => boolean;
        isSkippedMoment: () => boolean;
        isDismissedMoment: () => boolean;
        getNotDisplayedReason: () => string;
        getSkippedReason: () => string;
        getDismissedReason: () => string;
      }) => void): void;

      function disableAutoSelect(): void;
    }
  }
}
