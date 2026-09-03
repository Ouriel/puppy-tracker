import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, CheckCircle2, FileText, Shield, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Button, Link } from '@heroui/react';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { TermsOfServiceModal } from './TermsOfServiceModal';
import { useI18n } from '../i18n';

interface AuthLockScreenProps {
  onUnlockWithSSO: (email: string, name: string, token: string) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  onUnlockWithSSO,
}) => {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [success] = useState('');
  const [showAboutDetails, setShowAboutDetails] = useState(false);

  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Google OAuth Client ID — environment variable with default project fallback
  const googleClientId =
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
    '8924902082-52mf1l272khij6ac2racnh4p34h7fh08.apps.googleusercontent.com';

  useEffect(() => {
    if (!googleClientId) return;

    // Dynamically load Google GSI script on demand if not already loaded
    if (!window.google?.accounts?.id) {
      const existingScript = document.getElementById('google-gsi-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 50; // Poll up to 5 seconds for async script load

    const initGoogleSignIn = () => {
      if (!isMounted || !googleBtnRef.current) return;

      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            auto_select: true,
            callback: async (response: any) => {
              const credential = response.credential;
              try {
                const base64Url = credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                  window
                    .atob(base64)
                    .split('')
                    .map((char) => '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
                );
                const decoded = JSON.parse(jsonPayload);

                const res = await onUnlockWithSSO(decoded.email, decoded.name, credential);
                if (!res.success) {
                  setError(res.message || t.auth.pendingActivation);
                }
              } catch {
                setError(t.auth.ssoFailed);
              }
            },
          });

          if (googleBtnRef.current) {
            googleBtnRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: 'outline',
              size: 'large',
              width: '100%',
            });
          }

          // Trigger Google One-Tap seamless auto-sign-in
          try {
            window.google.accounts.id.prompt();
          } catch {
            // One-Tap prompt is optional/fallback
          }
        } catch (err) {
          console.error('Google accounts ID initialization error', err);
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        timerId = setTimeout(initGoogleSignIn, 100);
      }
    };

    initGoogleSignIn();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [onUnlockWithSSO, googleClientId, t]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white flex-col py-8">
      {/* Sleek Hero Card Container */}
      <Card className="w-full max-w-md bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
        <Card.Content className="p-8 space-y-6">
          {/* Glow Background */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Mascot & Sleek Header */}
          <div className="text-center space-y-2 relative z-10">
            <div className="relative inline-block">
              <img
                src="/puppace_logo.webp"
                alt="PupPace Logo"
                width="80"
                height="80"
                fetchPriority="high"
                className="w-20 h-20 object-contain mx-auto drop-shadow-xl"
              />
              <div className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full shadow-lg ring-2 ring-slate-900">
                <Lock className="w-4 h-4" />
              </div>
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              PupPace
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {t.auth.subtitle}
            </p>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-800/50 text-red-300 p-3 rounded-xl text-xs font-medium text-center">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 p-3.5 rounded-xl text-xs font-medium text-left leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>{success}</div>
            </div>
          )}

          <div className="space-y-5 relative z-10">
            {/* Google SSO Container */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-2 text-center">
                {t.auth.signInWithGoogle}
              </label>
              <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
            </div>
          </div>

          {/* Security Footer Note */}
          <div className="pt-2 border-t border-slate-800/80 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.auth.requireActivationNote}</span>
          </div>
        </Card.Content>
      </Card>

      {/* Footer Legal & Application Details (Bottom Section) */}
      <div className="w-full max-w-md mt-6 space-y-3">
        {/* Toggleable App Description Section for Google Verification */}
        <Card className="bg-slate-900/60 border border-slate-800/80 overflow-hidden">
          <Button
            variant="tertiary"
            onPress={() => setShowAboutDetails(!showAboutDetails)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.auth.aboutPupPace}</span>
            </span>
            {showAboutDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {/* Rendered in HTML for Google OAuth Verification Crawlers */}
          <div className={`${showAboutDetails ? 'block' : 'hidden'} px-4 pb-4 space-y-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2.5`}>
            <p>
              <strong>PupPace</strong> is a smart puppy activity & potty tracking application designed for dog owners and family caretakers. It records potty times, meals, walks, and health metrics, computing adaptive predictive schedules for your puppy.
            </p>
            <p>
              <strong>Google SSO Disclosure:</strong> Google Sign-In is used strictly to authenticate household members and sync puppy activity logs seamlessly across family caretakers.
            </p>
          </div>
        </Card>

        {/* Public Legal Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 font-medium">
          <Link
            href="/privacy"
            onPress={() => setIsPrivacyOpen(true)}
            className="hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.auth.privacyPolicy}</span>
          </Link>
          <span>•</span>
          <Link
            href="/terms"
            onPress={() => setIsTermsOpen(true)}
            className="hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.auth.termsOfService}</span>
          </Link>
        </div>
      </div>

      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <TermsOfServiceModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </div>
  );
};

declare global {
  interface Window {
    google?: any;
  }
}
