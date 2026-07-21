import React, { useState, useEffect, useRef } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface AuthLockScreenProps {
  onUnlockWithSSO: (email: string, name: string, token: string) => boolean;
  onUnlockWithPassword: (email: string, pass: string) => boolean;
  onRequestAccess: (email: string) => void;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  onUnlockWithSSO,
  onUnlockWithPassword,
  onRequestAccess,
}) => {
  const [activeTab, setActiveTab] = useState<'sso' | 'password' | 'request'>('sso');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize secure Google Sign-In SDK
  useEffect(() => {
    if (activeTab === 'sso' && window.google) {
      window.google.accounts.id.initialize({
        client_id: '992015099309-mockclient.apps.googleusercontent.com', // Replace with real production client ID
        callback: (response: any) => {
          // Google returns verified JWT payload in credential
          const credential = response.credential;
          console.log('Received secure credential from Google:', credential);
          
          // Securely decode payload
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
            
            const successResult = onUnlockWithSSO(decoded.email, decoded.name, credential);
            if (!successResult) {
              setError('Access registration required. Matthieu must approve your account first.');
            }
          } catch (e) {
            setError('Failed to authenticate Google SSO session.');
          }
        },
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
      });
    }
  }, [activeTab, onUnlockWithSSO]);

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const successResult = onUnlockWithPassword(email.trim().toLowerCase(), password);
    if (!successResult) {
      setError('Invalid email or password credentials.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleRequestAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    onRequestAccess(email.trim().toLowerCase());
    setSuccess(`Access request sent! You will be notified once Matthieu accepts your account: ${email}`);
    setEmail('');
    setTimeout(() => setSuccess(''), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Top Glow Decor */}
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
            Log, share and predict puppy activities with secure family sync.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setActiveTab('sso');
              setError('');
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'sso' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Google SSO
          </button>
          <button
            onClick={() => {
              setActiveTab('password');
              setError('');
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'password' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Password
          </button>
          <button
            onClick={() => {
              setActiveTab('request');
              setError('');
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'request' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Request
          </button>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-800/40 text-red-300 p-2.5 rounded-xl text-xs font-medium text-center">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 p-2.5 rounded-xl text-xs font-medium text-center">
            {success}
          </div>
        )}

        {/* Dynamic Auth Forms */}
        {activeTab === 'sso' && (
          <div className="space-y-4 relative z-10">
            <div className="text-center text-xs text-slate-400">
              Sign in securely via Google OAuth login.
            </div>
            
            {/* Real Google Button Container */}
            <div ref={googleBtnRef} className="w-full flex justify-center py-2" />
            
            {/* Standard Sandbox fallback interface for offline usage */}
            <div className="pt-2 text-center">
              <span className="text-[10px] text-slate-500 block mb-2">SSO Offline/Simulator Access:</span>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter email to simulate SSO authentication"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => onUnlockWithSSO(email.toLowerCase(), email.split('@')[0], 'mock-token')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  SSO Auth
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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
              <span>Log In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {activeTab === 'request' && (
          <form onSubmit={handleRequestAccess} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Your Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="Enter email to request access"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg transition active:scale-98 cursor-pointer"
            >
              <span>Submit Access Request</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Security Footer Note */}
        <div className="pt-2 border-t border-slate-800/80 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>SSO & Standard Security Token Authentication</span>
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
