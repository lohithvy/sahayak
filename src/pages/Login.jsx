import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';
import { AshokaPillar } from '../components/Layout';

export default function Login() {
  const { signIn } = useAuth();
  const { language } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || t('auth.login_failed', language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div style={{ position: 'absolute', top: '1rem', right: '1.5rem' }}>
        <LanguageSelector variant="compact" />
      </div>

      <div className="auth-card">
        <div className="auth-card__header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <AshokaPillar size={48} />
          </div>
          <h1 className="auth-card__title">{t('app.name', language)}</h1>
          <p className="auth-card__subtitle">{t('auth.login_subtitle', language)}</p>
        </div>

        {error && <div className="alert alert--error mb-4">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">{t('auth.email', language)}</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">{t('auth.password', language)}</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder={t('auth.password', language)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
            {loading ? t('auth.signing_in', language) : t('auth.sign_in_btn', language)}
          </button>
        </form>

        <div className="auth-card__footer">
          <p>{t('auth.no_account', language)} <Link to="/register">{t('auth.sign_up_btn', language)}</Link></p>
          <p className="mt-2"><Link to="/">← {t('common.back', language)}</Link></p>
        </div>
      </div>
    </div>
  );
}

