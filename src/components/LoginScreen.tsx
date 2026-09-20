import React, { useState } from 'react';
import { User } from '../types';
import { PRESET_AVATARS } from '../data';
import { 
  Shield, Sparkles, UserPlus, Image, LogIn, Mail, Lock, 
  User as UserIcon, Globe, Calendar, Check, AlertCircle, 
  Chrome, Facebook, Twitter, ArrowRight, ExternalLink 
} from 'lucide-react';
import YoYoLogo from './YoYoLogo';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);

  // Input states
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('Male');
  const [dateOfBirth, setDateOfBirth] = useState('2005-01-01');
  const [country, setCountry] = useState('Saudi Arabia');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);

  // Social simulation popup state
  const [socialModal, setSocialModal] = useState<{
    isOpen: boolean;
    provider: 'google' | 'facebook' | 'twitter' | null;
  }>({
    isOpen: false,
    provider: null
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Validate email address format helper
  const isValidEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  // Form submission for standard Mail ID authentication
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isSignUp && !isValidEmail(email)) {
      setErrorMsg('Please enter a valid Mail ID (e.g. user@gmail.com).');
      return;
    }

    if (!email.trim()) {
      setErrorMsg(isSignUp ? 'Mail ID is mandatory.' : 'Mail ID or Username is mandatory.');
      return;
    }

    if (isSignUp) {
      // REGISTRATION MANDATORY FIELD CHECKS
      if (!username.trim()) {
        setErrorMsg('Username/Nickname is mandatory.');
        return;
      }
      if (password.length < 4) {
        setErrorMsg('Security Password must be at least 4 characters.');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim(),
            email: email.trim().toLowerCase(),
            gender,
            dateOfBirth,
            country,
            avatar: selectedAvatar,
            coins: 0
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSuccessMsg('Account registered successfully with Mail ID! Please login now.');
          setIsSignUp(false);
          setPassword('');
        } else {
          setErrorMsg(data.error || 'Failed to complete registration.');
        }
      } catch (err) {
        setErrorMsg('Could not connect to full-stack server.');
      } finally {
        setLoading(false);
      }
    } else {
      // LOGIN VIA MAIL ID (OR USERNAME)
      setLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: email.trim(), // Server handles either display name or email address
            password: password.trim()
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onLoginSuccess({
            ...data.user,
            id: data.user._id || data.user.id
          });
        } else {
          setErrorMsg(data.error || 'Invalid Mail ID or Password.');
        }
      } catch (err) {
        setErrorMsg('Could not connect to full-stack server.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle Social Login selection click
  const triggerSocialLogin = (provider: 'google' | 'facebook' | 'twitter') => {
    setErrorMsg('');
    setSuccessMsg('');
    setSocialModal({ isOpen: true, provider });
  };

  // Confirm Social Login choice
  const handleSelectSocialAccount = async (profile: {
    email: string;
    name: string;
    avatar: string;
    socialId: string;
  }) => {
    setSocialModal({ isOpen: false, provider: null });
    setLoading(true);
    try {
      const res = await fetch('/api/auth/social-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          provider: socialModal.provider,
          socialId: profile.socialId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess({
          ...data.user,
          id: data.user._id || data.user.id
        });
      } else {
        setErrorMsg(data.error || 'Social authentication failed.');
      }
    } catch (err) {
      setErrorMsg('Failed to process social credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto h-full px-5 py-6 bg-slate-50 text-xs text-zinc-800 scrollbar-none flex flex-col relative">
      <div className="bg-white border border-zinc-200/80 rounded-[32px] p-6 flex flex-col gap-5 shadow-lg max-w-sm mx-auto w-full my-auto">
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center">
          <img 
            src="/logo.jpg" 
            alt="ZOYO Logo" 
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-[22px] object-cover shadow-lg border border-zinc-200/60 mb-2 hover:scale-105 transition-transform duration-300"
          />
          <h2 className="text-sm font-display font-black text-zinc-900 flex items-center justify-center gap-1.5 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-rose-500 animate-pulse" />
            {isSignUp ? 'Mail ID Signup' : 'ZOYO Secure Access'}
          </h2>
          <p className="text-[10px] text-zinc-500 mt-1 font-medium leading-normal max-w-[220px]">
            {isSignUp 
              ? 'Create a unique user profile using your Mail ID & optional avatar customization.' 
              : 'Sign in to access voice channels, direct chat rooms, and play games.'}
          </p>
        </div>

        {/* Error / Success Feedback Banner */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl flex items-start gap-2 text-[10px]">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-xl flex items-start gap-2 text-[10px]">
            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Standard Email Authentication Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Mail ID Input Field */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-zinc-500 text-[9px] uppercase tracking-wider flex justify-between">
              <span>{isSignUp ? 'Mail ID (Email Address)' : 'Mail ID or Username'}</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isSignUp ? 'e.g. user@gmail.com' : 'e.g. Admin or user@gmail.com'}
                className="w-full bg-stone-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Registration Extra Details */}
          {isSignUp && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Display Username */}
              <div className="flex flex-col gap-1">
                <label className="font-extrabold text-zinc-500 text-[9px] uppercase tracking-wider flex justify-between">
                  <span>Username / Nickname</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. zoyo_star"
                    className="w-full bg-stone-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Security Password */}
          <div className="flex flex-col gap-1">
            <label className="font-extrabold text-zinc-500 text-[9px] uppercase tracking-wider flex justify-between">
              <span>Security Password</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Demographic Parameters (SignUp only) */}
          {isSignUp && (
            <div className="grid grid-cols-2 gap-3 bg-stone-50 border border-zinc-200 p-3 rounded-2xl">
              <div className="flex flex-col gap-1">
                <label className="font-extrabold text-zinc-500 text-[9px] uppercase tracking-wider flex items-center gap-1">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 focus:outline-none focus:border-rose-500 shadow-sm"
                >
                  <option value="Male">👦 Male</option>
                  <option value="Female">👧 Female</option>
                  <option value="Other">✨ Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-extrabold text-zinc-500 text-[9px] uppercase tracking-wider flex items-center gap-1">
                  Location <span className="text-rose-500">*</span>
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 focus:outline-none focus:border-rose-500 shadow-sm"
                >
                  <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
                  <option value="Egypt">🇪🇬 Egypt</option>
                  <option value="United Arab Emirates">🇦🇪 UAE</option>
                  <option value="India">🇮🇳 India</option>
                  <option value="United States">🇺🇸 United States</option>
                  <option value="Turkey">🇹🇷 Turkey</option>
                  <option value="Iraq">🇮🇶 Iraq</option>
                  <option value="Morocco">🇲🇦 Morocco</option>
                  <option value="Global">🌐 Global</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <label className="font-extrabold text-zinc-500 text-[9px] uppercase tracking-wider flex items-center gap-1">
                  Date of Birth <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 focus:outline-none focus:border-rose-500 shadow-sm"
                />
              </div>
            </div>
          )}

          {/* Preset Avatar Selection (Only Sign Up Mode) */}
          {isSignUp && (
            <div className="flex flex-col gap-1.5">
              <label className="font-extrabold text-zinc-500 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                <Image className="w-3.5 h-3.5 text-rose-500" /> Choose Profile Avatar
              </label>
              <div className="flex gap-2 justify-center py-2 bg-stone-50 rounded-xl border border-zinc-200 p-2">
                {PRESET_AVATARS.map((av, idx) => (
                  <img
                    key={idx}
                    src={av}
                    alt=""
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-9 h-9 rounded-full object-cover cursor-pointer border-2 transition-all ${
                      selectedAvatar === av ? 'border-rose-500 scale-110 shadow-md animate-pulse' : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Action Trigger Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black py-2.5 rounded-xl shadow-md cursor-pointer active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-xs uppercase"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : isSignUp ? (
              <>
                <UserPlus className="w-4 h-4 font-black" />
                Register with Mail ID
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 font-black" />
                Login with Mail ID
              </>
            )}
          </button>
        </form>

        {/* ================= SOCIAL CONNECT SECTION ================= */}
        <div className="flex flex-col gap-3 mt-1 pt-3 border-t border-zinc-200/60">
          <span className="text-[8px] text-zinc-400 font-extrabold uppercase tracking-widest text-center">
            OR CONNECT WITH SOCIAL NETWORKS
          </span>

          <div className="flex flex-col gap-2">
            {/* Google Login Button */}
            <button
              onClick={() => triggerSocialLogin('google')}
              className="w-full py-2 px-3 bg-white border border-zinc-200 rounded-xl font-bold text-[11px] text-zinc-700 hover:bg-zinc-50 flex items-center justify-between transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <span className="flex items-center gap-2">
                <Chrome className="w-4 h-4 text-rose-500 fill-rose-500/10" />
                <span>Continue with Google</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {/* Facebook Login Button */}
            <button
              onClick={() => triggerSocialLogin('facebook')}
              className="w-full py-2 px-3 bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-xl font-bold text-[11px] text-[#1877F2] hover:bg-[#1877F2]/15 flex items-center justify-between transition-all cursor-pointer active:scale-98"
            >
              <span className="flex items-center gap-2">
                <Facebook className="w-4 h-4 fill-current text-[#1877F2]" />
                <span>Continue with Facebook</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            {/* X Login Button */}
            <button
              onClick={() => triggerSocialLogin('twitter')}
              className="w-full py-2 px-3 bg-zinc-950 border border-zinc-900 rounded-xl font-bold text-[11px] text-white hover:bg-zinc-900 flex items-center justify-between transition-all cursor-pointer active:scale-98"
            >
              <span className="flex items-center gap-2">
                <Twitter className="w-4 h-4 fill-current text-white" />
                <span>Continue with X (Twitter)</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>
        </div>

        {/* Switch Sign Up / Login State Toggle */}
        <div className="border-t border-zinc-200/80 pt-4 text-center">
          <p className="text-[10px] text-zinc-500 font-medium">
            {isSignUp ? 'Already have a Mail ID account?' : "Don't have a Mail ID account yet?"}
          </p>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="mt-1 text-rose-600 hover:text-rose-700 font-extrabold hover:underline cursor-pointer transition-all"
          >
            {isSignUp ? 'Sign In as Existing Member' : 'Register New Mail ID Account'}
          </button>
        </div>

        {/* Backdoor Help Information */}
        {!isSignUp && (
          <div className="bg-stone-50 p-2.5 rounded-2xl border border-zinc-200 flex flex-col gap-1 text-[9px] text-zinc-500">
            <span className="font-extrabold text-zinc-700 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-amber-600" /> Admin Default Credentials:
            </span>
            <div className="flex justify-between px-1">
              <span>Username: <strong className="text-zinc-800 select-all font-mono font-bold">Admin</strong></span>
              <span>Password: <strong className="text-zinc-800 select-all font-mono font-bold">Admin123</strong></span>
            </div>
          </div>
        )}

      </div>

      {/* ================= SOCIAL ACCREDITATION POPUP SIMULATOR ================= */}
      {socialModal.isOpen && (
        <div className="absolute inset-0 bg-zinc-950/65 backdrop-blur-sm z-[9999] flex items-center justify-center p-5">
          <div className="bg-white rounded-[28px] border border-zinc-200/80 p-5 shadow-2xl max-w-xs w-full flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-zinc-800">
            
            {/* Header depending on Social Brand */}
            <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-150">
              {socialModal.provider === 'google' && <Chrome className="w-5 h-5 text-rose-500" />}
              {socialModal.provider === 'facebook' && <Facebook className="w-5 h-5 text-blue-600" />}
              {socialModal.provider === 'twitter' && <Twitter className="w-5 h-5 text-zinc-900" />}
              <div>
                <h4 className="font-black text-zinc-900 text-xs uppercase tracking-wider">
                  {socialModal.provider === 'google' ? 'Google Account Hub' : socialModal.provider === 'facebook' ? 'Facebook Connect' : 'X Auth Link'}
                </h4>
                <p className="text-[8.5px] text-zinc-400 font-bold leading-none">AIS-DEMO-SECURE-HANDSHAKE</p>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-relaxed font-semibold">
              Select one of the preseeded mock social accounts to instantly sign-in and test the system response:
            </p>

            <div className="flex flex-col gap-2.5">
              
              {/* Account 1 */}
              <button
                onClick={() => handleSelectSocialAccount({
                  email: `${socialModal.provider}_gamer@zoyo.com`,
                  name: `${socialModal.provider === 'google' ? 'GoogleGamer' : socialModal.provider === 'facebook' ? 'FB_ProHost' : 'X_Streamer'}`,
                  avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
                  socialId: `oauth_998877_${socialModal.provider}`
                })}
                className="p-2.5 bg-stone-50 border border-zinc-200/80 rounded-2xl hover:bg-rose-500/5 hover:border-rose-500/30 transition-all flex items-center gap-3 text-left cursor-pointer active:scale-98"
              >
                <img 
                  src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80" 
                  alt="" 
                  className="w-9 h-9 rounded-full object-cover border border-zinc-300" 
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-zinc-900 leading-tight">
                    {socialModal.provider === 'google' ? 'GoogleGamer' : socialModal.provider === 'facebook' ? 'FB_ProHost' : 'X_Streamer'}
                  </span>
                  <span className="text-[8.5px] text-zinc-400 font-bold truncate">
                    {socialModal.provider}_gamer@zoyo.com
                  </span>
                </div>
              </button>

              {/* Account 2 */}
              <button
                onClick={() => handleSelectSocialAccount({
                  email: `${socialModal.provider}_superstar@zoyo.com`,
                  name: `${socialModal.provider === 'google' ? 'ZoyoGoogleStar' : socialModal.provider === 'facebook' ? 'FBAngel' : 'X_ZoyoKing'}`,
                  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
                  socialId: `oauth_554433_${socialModal.provider}`
                })}
                className="p-2.5 bg-stone-50 border border-zinc-200/80 rounded-2xl hover:bg-rose-500/5 hover:border-rose-500/30 transition-all flex items-center gap-3 text-left cursor-pointer active:scale-98"
              >
                <img 
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80" 
                  alt="" 
                  className="w-9 h-9 rounded-full object-cover border border-zinc-300" 
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-zinc-900 leading-tight">
                    {socialModal.provider === 'google' ? 'ZoyoGoogleStar' : socialModal.provider === 'facebook' ? 'FBAngel' : 'X_ZoyoKing'}
                  </span>
                  <span className="text-[8.5px] text-zinc-400 font-bold truncate">
                    {socialModal.provider}_superstar@zoyo.com
                  </span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setSocialModal({ isOpen: false, provider: null })}
              className="mt-1.5 w-full py-2 text-zinc-500 hover:text-zinc-700 font-extrabold text-[10px] text-center uppercase tracking-wider"
            >
              Cancel Handshake
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
