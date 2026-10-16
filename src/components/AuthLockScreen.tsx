import React, { useState, useEffect, useEffectEvent, useRef } from 'react';
import { Lock, ShieldCheck, CheckCircle2, FileText, Shield, Sparkles, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Card, Button } from '@heroui/react';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { TermsOfServiceModal } from './TermsOfServiceModal';
import { useI18n } from '../i18n';
import type { SignInOutcome } from '../types';

// The account waiting for approval on this device, so the note is still there after a reload (app review decision 14)
const PENDING_EMAIL_KEY = 'puppace_pending_email';

function readPendingEmail(): string {
  try {
    return localStorage.getItem(PENDING_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

/** '' forgets it. */
function storePendingEmail(email: string) {
  try {
    if (email) localStorage.setItem(PENDING_EMAIL_KEY, email);
    else localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Private mode: the note lasts until the page closes
  }
}

interface AuthLockScreenProps {
  onUnlockWithSSO: (email: string, name: string, token: string) => Promise<SignInOutcome>;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  onUnlockWithSSO,
}) => {
  const { t } = useI18n();
  // A key of t.auth, so the message follows the language
  const [error, setError] = useState<'' | 'ssoFailed' | 'googleScriptFailed'>('');
  const [pendingEmail, setPendingEmail] = useState(readPendingEmail);
  const [success] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showAboutDetails, setShowAboutDetails] = useState(false);

  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Google calls this back with the latest props, so the setup below runs once, not at each App render
  const handleGoogleCredential = useEffectEvent(async (credential: string) => {
    setError('');
    setIsSigningIn(true);
    let outcome: SignInOutcome = 'failed';
    let email = '';
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

      email = decoded.email;
      outcome = await onUnlockWithSSO(decoded.email, decoded.name, credential);
    } catch {
      // An unreadable credential or a thrown error is a failed sign-in
    }
    setIsSigningIn(false);
    if (outcome === 'failed') {
      setError('ssoFailed');
      return;
    }
    // Waiting for approval: noted for the next visit. Signed in: approved, so nothing waits any more.
    const waitingEmail = outcome === 'pending' ? email : '';
    setPendingEmail(waitingEmail);
    storePendingEmail(waitingEmail);
  });

  // Google stops signing in the waiting account by itself (One Tap's auto-select), so another can be picked
  const handleUseAnotherAccount = () => {
    setPendingEmail('');
    storePendingEmail('');
    window.google?.accounts?.id?.disableAutoSelect?.();
  };

  // Google OAuth Client ID — environment variable with default project fallback
  const googleClientId =
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
    '8924902082-52mf1l272khij6ac2racnh4p34h7fh08.apps.googleusercontent.com';

  useEffect(() => {
    if (!googleClientId) return;

    const initGoogleSignIn = () => {
      if (!googleBtnRef.current || !window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          auto_select: true,
          callback: (response: { credential: string }) => handleGoogleCredential(response.credential),
        });

        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
        });

        // Trigger Google One-Tap seamless auto-sign-in
        try {
          window.google.accounts.id.prompt();
        } catch {
          // One-Tap prompt is optional/fallback
        }
      } catch (err) {
        console.error('Google accounts ID initialization error', err);
      }
    };

    if (window.google?.accounts?.id) {
      initGoogleSignIn();
      return;
    }

    // Load Google's script on demand; its load or error event says when it is done, however slow the network
    const script =
      document.getElementById('google-gsi-script') ??
      document.head.appendChild(
        Object.assign(document.createElement('script'), {
          id: 'google-gsi-script',
          src: 'https://accounts.google.com/gsi/client',
          async: true,
          defer: true,
        })
      );
    const handleScriptError = () => setError('googleScriptFailed');
    script.addEventListener('load', initGoogleSignIn);
    script.addEventListener('error', handleScriptError);
    return () => {
      script.removeEventListener('load', initGoogleSignIn);
      script.removeEventListener('error', handleScriptError);
    };
  }, [googleClientId]);

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

          {pendingEmail && (
            <div role="status" className="relative z-10 bg-indigo-950/40 border border-indigo-800/50 text-indigo-200 p-3.5 rounded-xl text-xs leading-relaxed flex items-start gap-2.5">
              <Clock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <p className="font-semibold">{t.auth.pendingActivation}</p>
                <p className="text-indigo-300/90 break-all">{pendingEmail}</p>
                <button
                  type="button"
                  onClick={handleUseAnotherAccount}
                  className="min-h-11 text-left font-bold text-indigo-300 hover:text-white underline underline-offset-2"
                >
                  {t.auth.useAnotherAccount}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="bg-red-950/40 border border-red-800/50 text-red-300 p-3 rounded-xl text-xs font-medium text-center">
              ⚠️ {t.auth[error]}
              {error === 'googleScriptFailed' && (
                // A reload fetches the script again
                <Button size="sm" variant="secondary" onPress={() => window.location.reload()} className="mx-auto mt-2 flex">
                  {t.auth.retry}
                </Button>
              )}
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
              <label className="block text-xs font-semibold text-slate-400 mb-2 text-center">
                {t.auth.signInWithGoogle}
              </label>
              {isSigningIn && (
                <div role="status" className="w-full flex items-center justify-center gap-2 min-h-[44px] text-xs text-slate-300">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span>{t.auth.signingIn}</span>
                </div>
              )}
              {/* Hidden, not removed, while signing in: Google renders its button here once */}
              <div ref={googleBtnRef} className={`w-full justify-center min-h-[44px] ${isSigningIn ? 'hidden' : 'flex'}`} />
            </div>
          </div>

          {/* Security Footer Note */}
          <div className="pt-2 border-t border-slate-800/80 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
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
            aria-expanded={showAboutDetails}
            onPress={() => setShowAboutDetails(!showAboutDetails)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.auth.aboutPupPace}</span>
            </span>
            {showAboutDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {/* Rendered in HTML for Google OAuth Verification Crawlers; in the app's language, so English for an English browser */}
          <div className={`${showAboutDetails ? 'block' : 'hidden'} px-4 pb-4 space-y-2 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2.5`}>
            <p>{t.auth.aboutDescription}</p>
            <p>
              <strong>{t.auth.googleDisclosureTitle}</strong> {t.auth.googleDisclosure}
            </p>
          </div>
        </Card>

        {/* Legal links: the translated popups in the app; the href to the static English pages stays for Google's crawler */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 font-medium">
          <a
            href="/privacy"
            onClick={(event) => {
              event.preventDefault();
              setIsPrivacyOpen(true);
            }}
            className="min-h-11 hover:text-indigo-300 flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{t.auth.privacyPolicy}</span>
          </a>
          <span aria-hidden="true">•</span>
          <a
            href="/terms"
            onClick={(event) => {
              event.preventDefault();
              setIsTermsOpen(true);
            }}
            className="min-h-11 hover:text-indigo-300 flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{t.auth.termsOfService}</span>
          </a>
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
