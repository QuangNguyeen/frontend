import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Headphones, Eye, EyeOff, Loader2, AudioLines, BookMarked, Trophy } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin, useGoogleLogin } from '../hooks/useAuth';
import { extractApiError } from '@/shared/lib/httpClient';

const features = [
  { icon: AudioLines, label: 'Sentence and cloze practice' },
  { icon: BookMarked, label: 'Vocabulary review loop' },
  { icon: Trophy, label: 'Progress and streak tracking' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const googleLoginMutation = useGoogleLogin();

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
    if (!email.trim() || !password) return;
    setError('');
    loginMutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate('/dashboard'),
        onError: (err) => setError(extractApiError(err, 'Invalid email or password')),
      },
    );
  };

  return (
    <div className="auth-layout min-h-screen px-4 py-6 flex items-center justify-center">
      <div className="grid w-full max-w-[820px] overflow-hidden rounded-[18px] border border-border bg-card shadow-soft-lg md:grid-cols-2">
        {/* ── Left: Branding panel ── */}
        <div className="hidden md:flex flex-col justify-between border-r border-border bg-muted p-6 lg:p-7">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary shadow-soft">
              <Headphones className="h-5 w-5 text-primary-foreground" />
            </div>

            <h1 className="mt-4 text-[28px] font-extrabold tracking-[-0.03em] text-foreground leading-tight">
              DictaLearn
            </h1>

            <p className="mt-2.5 max-w-[340px] text-[15px] leading-relaxed text-muted-foreground">
              Practice listening, dictation, word ordering, and vocabulary review from real video transcripts.
            </p>

            <div className="mt-5 grid gap-2">
              {features.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 h-[44px] text-[14px] font-medium text-foreground shadow-soft"
                >
                  <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary-soft text-primary shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70 mt-6">
            &copy; {new Date().getFullYear()} DictaLearn &middot; Listening lab
          </p>
        </div>

        {/* ── Right: Login form ── */}
        <div className="flex flex-col items-center justify-center bg-card px-6 py-6 sm:px-7">
          <div className="w-full max-w-[340px]">
            {/* Mobile-only logo */}
            <div className="flex flex-col items-center md:hidden mb-4">
              <div className="h-11 w-11 rounded-2xl bg-primary flex items-center justify-center shadow-soft">
                <Headphones className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>

            <div className="md:text-left text-center">
              <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-foreground leading-tight">
                Welcome back
              </h1>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Sign in to continue your listening practice
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-4">
              {error && (
                <div className="mb-4 bg-destructive/10 border border-destructive/30 text-destructive text-[13px] px-3.5 py-2.5 rounded-xl">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[14px] font-semibold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-[44px]"
                />
              </div>

              <div className="mt-3.5 space-y-1.5">
                <Label htmlFor="password" className="text-[14px] font-semibold">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="h-[44px] pr-10"
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
                className="mt-4 w-full h-[44px] text-[14px]"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
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
                  width="340"
                  text="signin_with"
                  shape="rectangular"
                  theme="outline"
                />
              )}
            </div>

            {/* Footer */}
            <p className="text-center text-[13px] text-muted-foreground mt-4">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary font-bold hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
