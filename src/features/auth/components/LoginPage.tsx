import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Headphones, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogin } from '../hooks/useAuth';
import { extractApiError } from '@/shared/lib/httpClient';

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    loginMutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate('/library'),
        onError: (err) => setError(extractApiError(err, 'Invalid email or password')),
      },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <Headphones className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">DictaLearn</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 pr-10 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loginMutation.isPending}>
            {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-foreground font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}