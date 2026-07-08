import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password);
      onClose();
    } catch (ex) {
      setErr((ex as Error).message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="overlay show"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('overlay')) onClose();
      }}
    >
      <div className="modal auth-modal">
        <div className="modal-top">
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
          <div className="modal-badge">{mode === 'login' ? 'Вход' : 'Регистрация'}</div>
          <h3 className="modal-name">{mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h3>
          <div className="modal-life">
            {mode === 'login'
              ? 'Войдите, чтобы открыть своё древо'
              : 'Заведите своё семейное древо'}
          </div>
        </div>
        <form className="modal-body auth-form" onSubmit={submit}>
          <label className="field">
            <span>Эл. почта</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 6 : 1}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••"
            />
          </label>
          {err && (
            <div className="auth-error" role="alert">
              {err}
            </div>
          )}
          <button type="submit" className="tbtn primary auth-submit" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
          <div className="auth-switch">
            {mode === 'login' ? (
              <>
                Нет аккаунта?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErr(null);
                  }}
                >
                  Регистрация
                </button>
              </>
            ) : (
              <>
                Уже есть аккаунт?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErr(null);
                  }}
                >
                  Войти
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
