import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Headphones, Eye, EyeOff, Loader2, AudioLines, BookMarked, Trophy } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister, useGoogleLogin } from '../hooks/useAuth';
import { extractApiError } from '@/shared/lib/httpClient';

const features = [
  { icon: AudioLines, label: 'Practice from real videos' },
  { icon: BookMarked, label: 'Save hard words as you study' },
  { icon: Trophy, label: 'Track accuracy over time' },
];

export function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const googleLoginMutation = useGoogleLogin();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSuccess = (response: CredentialResponse) => {
    if (!response.credential) return;
    setError('');
    googleLoginMutation.mutate(response.credential, {
      onSuccess: () => navigate('/dashboard'),
      onError: (err) => setError(extractApiError(err, 'Google sign-in failed')),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password) return;
    setError('');
    registerMutation.mutate(
      { email: email.trim(), display_name: displayName.trim(), password },
      {
        onSuccess: () => navigate('/dashboard'),
        onError: (err) => setError(extractApiError(err, 'Registration failed')),
      },
    );
  };

  return (
    <div className="auth-layout min-h-screen px-4 py-8 flex items-center justify-center">
      <div className="grid w-full max-w-[1040px] overflow-hidden rounded-[18px] border border-border bg-card shadow-soft-lg md:grid-cols-[1.1fr_0.9fr]">
        {/* ── Left: Branding panel ── */}
        <div className="hidden md:flex flex-col justify-between border-r border-border bg-muted p-8 lg:p-10 min-h-[580px]">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary shadow-soft">
              <Headphones className="h-5 w-5 text-primary-foreground" />
            </div>

            <h1 className="mt-5 text-[28px] font-extrabold tracking-[-0.03em] text-foreground leading-tight">
              DictaLearn
            </h1>

            <p className="mt-3 max-w-[340px] text-[15px] leading-relaxed text-muted-foreground">
              Build a listening habit with focused dictation sessions and vocabulary review.
            </p>

            <div className="mt-6 grid gap-2.5">
              {features.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 h-[48px] text-[14px] font-medium text-foreground shadow-soft"
                >
                  <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary-soft text-primary shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70 mt-8">
            &copy; {new Date().getFullYear()} DictaLearn &middot; Listening lab
          </p>
        </div>

        {/* ── Right: Register form ── */}
        <div className="flex flex-col items-center justify-center bg-card px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-[360px]">
            {/* Mobile-only logo */}
            <div className="flex flex-col items-center md:hidden mb-6">
              <div className="h-11 w-11 rounded-2xl bg-primary flex items-center justify-center shadow-soft">
                <Headphones className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>

            <div className="md:text-left text-center">
              <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-foreground leading-tight">
                Create account
              </h1>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Start building your listening habit
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6">
              {error && (
                <div className="mb-4 bg-destructive/10 border border-destructive/30 text-destructive text-[13px] px-3.5 py-2.5 rounded-xl">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[14px] font-semibold">Display Name</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="h-[46px]"
                />
              </div>

              <div className="mt-4 space-y-1.5">
                <Label htmlFor="email" className="text-[14px] font-semibold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-[46px]"
                />
              </div>

              <div className="mt-4 space-y-1.5">
                <Label htmlFor="password" className="text-[14px] font-semibold">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="h-[46px] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="mt-4 w-full h-[46px] text-[14px]"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google login */}
            <div className="flex justify-center">
              {googleLoginMutation.isPending ? (
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Signing in with Google...
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in failed')}
                  width="360"
                  text="signup_with"
                  shape="rectangular"
                  theme="outline"
                />
              )}
            </div>

            {/* Footer */}
            <p className="text-center text-[13px] text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
