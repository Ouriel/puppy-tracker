import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, CheckCircle2, FileText, Shield, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { TermsOfServiceModal } from './TermsOfServiceModal';
import { useI18n } from '../i18n';
import { apiAuthenticate } from '../utils/storage';

interface AuthLockScreenProps {
  onUnlockWithSSO: (email: string, name: string, token: string) => { success: boolean; message?: string };
  onUnlockWithPassword: (email: string, pass: string) => { success: boolean; message?: string };
  onRegisterAccount: (email: string, pass: string, name: string, role: string) => { success: boolean; message?: string; isPending?: boolean };
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

  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';

  useEffect(() => {
    if (googleClientId && window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            const credential = response.credential;
            try {
              const base64Url = credential.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                window
                  .atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const decoded = JSON.parse(jsonPayload);
              
              const authRes = await apiAuthenticate(credential);
              if (authRes.success && authRes.token) {
                onUnlockWithSSO(decoded.email, decoded.name, authRes.token);
              } else {
                setError(authRes.error || t.auth.pendingActivation);
              }
            } catch {
              setError(t.auth.ssoFailed);
            }
          },
        });

        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
        });
      } catch (err) {
        console.error('Google accounts ID initialization error', err);
      }
    }
  }, [onUnlockWithSSO, googleClientId, t]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white flex-col py-8">
      {/* Sleek Hero Card Container */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow Background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Mascot & Sleek Header */}
        <div className="text-center space-y-2 relative z-10">
          <div className="relative inline-block">
            <img
              src="/flat_cocker_spaniel_logo.jpg"
              alt="PupPace Logo"
              className="w-20 h-20 rounded-full object-cover mx-auto ring-4 ring-indigo-500/50 shadow-xl"
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
      </div>

      {/* Footer Legal & Application Details (Bottom Section) */}
      <div className="w-full max-w-md mt-6 space-y-3">
        {/* Toggleable App Description Section for Google Verification */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAboutDetails(!showAboutDetails)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.auth.aboutPupPace}</span>
            </span>
            {showAboutDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Rendered in HTML for Google OAuth Verification Crawlers */}
          <div className={`${showAboutDetails ? 'block' : 'hidden'} px-4 pb-4 space-y-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2.5`}>
            <p>
              <strong>PupPace</strong> is a smart puppy activity & potty tracking application designed for dog owners and family caretakers. It records potty times, meals, walks, and health metrics, computing adaptive predictive schedules for your puppy.
            </p>
            <p>
              <strong>Google SSO Disclosure:</strong> Google Sign-In is used strictly to authenticate household members and sync puppy activity logs seamlessly across family caretakers.
            </p>
          </div>
        </div>

        {/* Public Legal Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 font-medium">
          <a
            href="/privacy"
            onClick={(event) => { event.preventDefault(); setIsPrivacyOpen(true); }}
            className="hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.auth.privacyPolicy}</span>
          </a>
          <span>•</span>
          <a
            href="/terms"
            onClick={(event) => { event.preventDefault(); setIsTermsOpen(true); }}
            className="hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
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
