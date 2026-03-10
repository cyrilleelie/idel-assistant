import { useState } from 'react';
import { Stethoscope, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { login } from '../api/auth';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tokens = await login(email, password);
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      onLogin(email);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Email ou mot de passe incorrect.');
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Erreur de connexion au serveur.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f8] flex items-center justify-center p-4 font-display">
      <div className="w-full max-w-[384px]">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
              <Stethoscope className="text-primary" size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">IDEL Planning Pro</h1>
          <p className="text-sm text-slate-500">Logiciel de gestion pour infirmiers lib&eacute;raux</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Banner */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="nom@exemple.com"
                required
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Mot de passe
                </label>
                <a href="#" className="text-sm text-primary hover:text-primary/80 font-medium">
                  Oubli&eacute; ?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <label htmlFor="remember" className="text-sm text-slate-600">
                Se souvenir de moi
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Pas encore de compte ?{' '}
            <a href="#" className="text-primary hover:text-primary/80 font-semibold">
              S'inscrire gratuitement
            </a>
          </p>
          <p className="mt-4 text-xs text-slate-400">
            <a href="#" className="hover:text-slate-500 transition-colors">Conditions d'utilisation</a>
            {' '}
            <span className="mx-1">&bull;</span>
            {' '}
            <a href="#" className="hover:text-slate-500 transition-colors">Confidentialit&eacute;</a>
          </p>
        </div>
      </div>
    </div>
  );
}
