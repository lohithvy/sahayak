import { Link } from 'react-router-dom';
import { AshokaPillar } from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { t, LANGUAGES } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';
import { Search, Shield, FileText, Users, BarChart3, Globe, Mic, ClipboardCheck } from 'lucide-react';

export default function Landing() {
  const { language, setLanguage } = useApp();

  return (
    <div className="app-layout">
      {/* Top Bar */}
      <div className="gov-topbar">
        <div className="gov-topbar__inner">
          <div className="gov-topbar__left">
            <span>{t('app.prototype', language)}</span>
          </div>
          <div className="gov-topbar__right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <LanguageSelector variant="compact" />
            <Link to="/login">{t('nav.login', language)}</Link>
            <Link to="/register">{t('nav.register', language)}</Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero__inner">
          <div className="landing-hero__emblem">
            <AshokaPillar size={64} />
          </div>
          <h1 className="landing-hero__title">{t('app.name', language)}</h1>
          <p className="landing-hero__tagline">{t('app.tagline', language)}</p>
          <p className="landing-hero__desc">
            {t('landing.hero_subtitle', language)}
          </p>
          <div className="landing-hero__actions">
            <Link to="/register" className="btn btn--primary btn--lg">{t('landing.get_started', language)}</Link>
            <a href="#how-it-works" className="btn btn--secondary btn--lg">{t('landing.explore', language)}</a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-section__inner">
          <h2 className="landing-section__title">{t('landing.how_it_works', language)}</h2>
          <p className="landing-section__desc">{t('landing.how_desc', language)}</p>
          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step__number">1</div>
              <h3 className="landing-step__title">{t('onboarding.title', language)}</h3>
              <p className="landing-step__desc">{t('landing.how_step1', language)}</p>
            </div>
            <div className="landing-step">
              <div className="landing-step__number">2</div>
              <h3 className="landing-step__title">{t('ai.speak', language)} / {t('common.search', language)}</h3>
              <p className="landing-step__desc">{t('landing.how_step2', language)}</p>
            </div>
            <div className="landing-step">
              <div className="landing-step__number">3</div>
              <h3 className="landing-step__title">{t('landing.feature_scheme', language)}</h3>
              <p className="landing-step__desc">{t('landing.how_step3', language)}</p>
            </div>
            <div className="landing-step">
              <div className="landing-step__number">4</div>
              <h3 className="landing-step__title">{t('scheme.eligible', language)} & {t('scheme.apply', language)}</h3>
              <p className="landing-step__desc">{t('landing.how_step4', language)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <div className="landing-section__inner">
          <h2 className="landing-section__title">{t('landing.features', language)}</h2>
          <p className="landing-section__desc">{t('app.subtitle', language)}</p>
          <div className="landing-features">
            <div className="landing-feature">
              <div className="landing-feature__icon"><Search size={24} /></div>
              <h3 className="landing-feature__title">{t('landing.feature_scheme', language)}</h3>
              <p className="landing-feature__desc">{t('landing.feature_scheme_desc', language)}</p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature__icon"><BarChart3 size={24} /></div>
              <h3 className="landing-feature__title">{t('landing.feature_eligibility', language)}</h3>
              <p className="landing-feature__desc">{t('landing.feature_eligibility_desc', language)}</p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature__icon"><Shield size={24} /></div>
              <h3 className="landing-feature__title">{t('landing.feature_docs', language)}</h3>
              <p className="landing-feature__desc">{t('landing.feature_docs_desc', language)}</p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature__icon"><ClipboardCheck size={24} /></div>
              <h3 className="landing-feature__title">{t('landing.feature_track', language)}</h3>
              <p className="landing-feature__desc">{t('landing.feature_track_desc', language)}</p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature__icon"><Users size={24} /></div>
              <h3 className="landing-feature__title">{t('landing.feature_group', language)}</h3>
              <p className="landing-feature__desc">{t('landing.feature_group_desc', language)}</p>
            </div>
            <div className="landing-feature">
              <div className="landing-feature__icon"><FileText size={24} /></div>
              <h3 className="landing-feature__title">{t('landing.feature_opp', language)}</h3>
              <p className="landing-feature__desc">{t('landing.feature_opp_desc', language)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="landing-section">
        <div className="landing-section__inner">
          <h2 className="landing-section__title">{t('landing.languages', language)}</h2>
          <p className="landing-section__desc">{t('landing.languages_desc', language)}</p>
          <div className="landing-languages">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`landing-lang-tag ${language === lang.code ? 'landing-lang-tag--active' : ''}`}
                style={{
                  cursor: 'pointer',
                  border: language === lang.code ? '2px solid var(--color-blue)' : '1px solid var(--color-gray-200)',
                  background: language === lang.code ? 'var(--color-blue-pale)' : 'white',
                  fontWeight: language === lang.code ? 700 : 500,
                  padding: '6px 12px',
                  borderRadius: '6px'
                }}
              >
                {lang.nativeName} ({lang.name})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Accessibility */}
      <section className="landing-section">
        <div className="landing-section__inner">
          <h2 className="landing-section__title">{t('landing.accessibility', language)}</h2>
          <p className="landing-section__desc">
            {t('landing.accessibility_desc', language)}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <Mic size={32} style={{ color: 'var(--color-blue)', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('ai.speak', language)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Globe size={32} style={{ color: 'var(--color-blue)', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>23 Languages</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Shield size={32} style={{ color: 'var(--color-blue)', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('profile.security', language)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="gov-footer">
        <div className="gov-footer__inner">
          <div className="gov-footer__bottom">
            <span className="gov-footer__disclaimer">{t('app.prototype', language)} • {t('app.disclaimer', language)}</span>
            <span className="gov-footer__disclaimer">© 2026 {t('app.name', language)}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

