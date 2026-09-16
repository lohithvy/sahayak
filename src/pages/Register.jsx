import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';
import { AshokaPillar } from '../components/Layout';

export default function Register() {
  const { signUp } = useAuth();
  const { language } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError(t('auth.password_mismatch', language));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.password_length', language));
      return;
    }

    setLoading(true);
    try {
      const data = await signUp(email, password);
      if (data?.session || data?.user) {
        navigate('/onboarding');
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || t('auth.register_failed', language));
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
          <p className="auth-card__subtitle">{t('auth.register_subtitle', language)}</p>
        </div>

        {error && <div className="alert alert--error mb-4">{error}</div>}
        {success && <div className="alert alert--success mb-4">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">{t('auth.email', language)}</label>
            <input
              id="reg-email"
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
            <label className="form-label" htmlFor="reg-password">{t('auth.password', language)}</label>
            <input
              id="reg-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder={t('auth.password', language)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">{t('auth.confirm_password', language)}</label>
            <input
              id="reg-confirm"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder={t('auth.confirm_password', language)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
            {loading ? t('auth.creating_account', language) : t('auth.sign_up_btn', language)}
          </button>
        </form>

        <div className="auth-card__footer">
          <p>{t('auth.have_account', language)} <Link to="/login">{t('auth.sign_in_btn', language)}</Link></p>
          <p className="mt-2"><Link to="/">← {t('common.back', language)}</Link></p>
        </div>
      </div>
    </div>
  );
}

