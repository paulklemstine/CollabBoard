import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithGoogle,
  signInAsGuest,
  signOutUser,
  signUpWithEmail,
  signInWithEmail,
} from '../../services/authService';
import { getAuthErrorMessage } from '../../utils/authErrors';

interface AuthPanelProps {
  user: User | null;
  onSignOut?: () => void;
  onAuthChange?: () => void;
}

export function AuthPanel({ user, onSignOut, onAuthChange }: AuthPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignInWithGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  };

  const handleSignInAsGuest = async () => {
    setError(null);
    try {
      await signInAsGuest();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  };

  const handleSignUp = async () => {
    setError(null);
    try {
      await signUpWithEmail(name, email, password);
      onAuthChange?.();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  };

  const handleSignIn = async () => {
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  };

  if (user) {
    return (
      <div className="glass-playful rounded-2xl shadow-lg animate-float-up">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
            }}
          >
            {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-gray-700">
            {user.displayName || user.email?.split('@')[0] || 'User'}
          </span>
          <button
            onClick={() => (onSignOut ?? signOutUser)()}
            className="btn-lift ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-500 border border-orange-400 hover:text-white hover:bg-orange-500 transition-all duration-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-playful rounded-3xl shadow-2xl p-10 max-w-sm w-full animate-bounce-in">
      <div className="flex flex-col items-center gap-6">
        {/* Logo / Brand */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #fb923c 100%)',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
            <g transform="rotate(-10, 38, 50)">
              <rect x="18" y="26" width="40" height="44" rx="7" fill="rgba(255,255,255,0.4)"/>
            </g>
            <g transform="rotate(5, 58, 50)">
              <rect x="38" y="26" width="40" height="44" rx="7" fill="white" opacity="0.95"/>
            </g>
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-violet-600">
            Flow Space
          </h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">
            Where ideas spark and friends build — together, in real time.
          </p>
          <p className="text-xs text-gray-400/90 mt-2 max-w-[280px] mx-auto leading-relaxed">
            Throw down sticky notes, sketch wild shapes, and let AI surprise you. Your crew sees everything live.
          </p>
        </div>

        {error && (
          <div className="w-full p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm text-center font-medium animate-float-up">
            {error}
          </div>
        )}

        {/* Email/Password Form */}
        <div className="flex flex-col gap-3 w-full">
          {isSignUp && (
            <input
              type="text"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/60 border border-gray-200 text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all duration-200"
            />
          )}
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/60 border border-gray-200 text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all duration-200"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/60 border border-gray-200 text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all duration-200"
          />

          <button
            onClick={isSignUp ? handleSignUp : handleSignIn}
            className="btn-lift btn-shimmer w-full px-5 py-3 rounded-xl text-white font-semibold text-sm shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)',
            }}
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-gray-500">
            {isSignUp ? 'Been here before?' : 'First time?'}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="font-semibold text-violet-600 hover:text-violet-800 transition-colors duration-200"
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Google + Guest */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleSignInWithGoogle}
            className="btn-lift w-full px-5 py-3 rounded-xl font-semibold text-sm text-gray-600 bg-white/60 hover:bg-white/90 border border-gray-200 shadow-sm transition-all duration-200"
          >
            Sign in with Google
          </button>
          <button
            onClick={handleSignInAsGuest}
            className="btn-lift w-full px-5 py-3 rounded-xl font-semibold text-sm text-gray-600 bg-white/60 hover:bg-white/90 border border-gray-200 shadow-sm transition-all duration-200"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
