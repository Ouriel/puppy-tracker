import React, { useState, useEffect, useRef } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff, UserPlus, LogIn, CheckCircle2, Settings } from 'lucide-react';

interface AuthLockScreenProps {
  onUnlockWithSSO: (email: string, name: string, token: string) => { success: boolean; message?: string };
  onUnlockWithPassword: (email: string, pass: string) => { success: boolean; message?: string };
  onRegisterAccount: (email: string, pass: string, name: string, role: string) => { success: boolean; message?: string; isPending?: boolean };
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  onUnlockWithSSO,
  onUnlockWithPassword,
  onRegisterAccount,
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Wife');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConfiguringClientId, setIsConfiguringClientId] = useState(false);
  const [customClientIdInput, setCustomClientIdInput] = useState('');
  
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Dynamic Google Client ID resolution
  const [googleClientId, setGoogleClientId] = useState<string>(() => {
    return localStorage.getItem('puppace_google_client_id') || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';
  });

  useEffect(() => {
    if (activeTab === 'signin' && googleClientId && window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: any) => {
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
              
              const res = onUnlockWithSSO(decoded.email, decoded.name, credential);
              if (!res.success) {
                setError(res.message || 'Account pending activation by Super Admin Matthieu.');
              }
            } catch (e) {
              setError('Failed to process Google SSO authentication.');
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
  }, [activeTab, onUnlockWithSSO, googleClientId]);

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customClientIdInput.trim()) return;
    const cleanId = customClientIdInput.trim();
    localStorage.setItem('puppace_google_client_id', cleanId);
    setGoogleClientId(cleanId);
    setIsConfiguringClientId(false);
    setSuccess('Google OAuth Client ID configured successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const res = onUnlockWithPassword(email.trim().toLowerCase(), password);
    if (!res.success) {
      setError(res.message || 'Invalid email or password.');
    }
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim() || !password || !name.trim()) return;

    const res = onRegisterAccount(
      email.trim().toLowerCase(),
      password,
      name.trim(),
      role
    );

    if (res.isPending || !res.success) {
      setSuccess('Account Created! Your account is awaiting activation by Super Admin Matthieu (matthieu.jacquet@gmail.com). You can sign in as soon as he activates it.');
      setEmail('');
      setPassword('');
      setName('');
    } else {
      setSuccess('Account activated! Logging you in...');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow Background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Mascot & Header */}
        <div className="text-center space-y-2 relative z-10">
          <div className="relative inline-block">
            <img
              src="/cocker_spaniel_mascot.jpg"
              alt="Cocker Spaniel Mascot"
              className="w-20 h-20 rounded-full object-cover mx-auto ring-4 ring-indigo-500/50 shadow-xl"
            />
            <div className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full shadow-lg ring-2 ring-slate-900">
              <Lock className="w-4 h-4" />
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            PupPace SaaS Platform
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Secure multi-user puppy activity tracking & smart potty predictions.
          </p>
        </div>

        {/* Clean 2-Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setActiveTab('signin'); setError(''); setSuccess(''); }}
            className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'signin' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => { setActiveTab('create'); setError(''); setSuccess(''); }}
            className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'create' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
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

        {/* Tab 1: Sign In */}
        {activeTab === 'signin' && (
          <div className="space-y-5 relative z-10">
            {/* Google SSO Container */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-slate-400">
                  Sign in with Google OAuth
                </label>
                <button
                  type="button"
                  onClick={() => setIsConfiguringClientId(!isConfiguringClientId)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>Configure OAuth Client ID</span>
                </button>
              </div>

              {isConfiguringClientId ? (
                <form onSubmit={handleSaveClientId} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                  <label className="block text-[10px] text-slate-400">
                    Paste Google OAuth Client ID (from Google Cloud Console):
                  </label>
                  <input
                    type="text"
                    placeholder="xxxx-yyyy.apps.googleusercontent.com"
                    value={customClientIdInput}
                    onChange={(e) => setCustomClientIdInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfiguringClientId(false)}
                      className="text-xs text-slate-400 px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-lg cursor-pointer"
                    >
                      Save ID
                    </button>
                  </div>
                </form>
              ) : !googleClientId ? (
                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-center text-[11px] text-slate-400 space-y-2">
                  <p>Google OAuth Client ID is not set yet.</p>
                  <button
                    onClick={() => setIsConfiguringClientId(true)}
                    className="inline-flex items-center gap-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Set Google Client ID Now</span>
                  </button>
                </div>
              ) : (
                <div ref={googleBtnRef} className="w-full flex justify-center" />
              )}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase font-semibold">Or with password</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg transition active:scale-98 cursor-pointer"
              >
                <span>Sign In to Vault</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Create Account */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateAccount} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserPlus className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Sarah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="e.g. wife@family.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Family Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Wife">Wife</option>
                  <option value="Husband">Husband</option>
                  <option value="Partner">Partner</option>
                  <option value="Child">Child</option>
                  <option value="Dog Walker">Dog Walker</option>
                  <option value="Sitter">Sitter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg transition active:scale-98 cursor-pointer"
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Security Footer Note */}
        <div className="pt-2 border-t border-slate-800/80 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Accounts require activation by Super Admin Matthieu</span>
        </div>
      </div>
    </div>
  );
};

declare global {
  interface Window {
    google?: any;
  }
}
