import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { t, LANGUAGES, getLanguageName } from '../i18n';
import LanguageSelector from './LanguageSelector';
import { Bell, User, Menu, X, Globe, LogOut, Search, MessageSquare, LayoutDashboard, FileText, Users, Bot } from 'lucide-react';

// Ashoka Pillar SVG emblem
function AshokaPillar({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" stroke="#1a4f8b" strokeWidth="2" fill="#e8f0fa"/>
      <circle cx="50" cy="35" r="10" fill="#1a4f8b"/>
      <rect x="44" y="30" width="12" height="6" rx="1" fill="#1a4f8b"/>
      <circle cx="50" cy="35" r="4" fill="#e8f0fa"/>
      <rect x="46" y="45" width="8" height="24" fill="#1a4f8b"/>
      <rect x="42" y="42" width="16" height="4" rx="1" fill="#1a4f8b"/>
      <rect x="40" y="68" width="20" height="4" rx="1" fill="#1a4f8b"/>
      <rect x="38" y="72" width="24" height="3" fill="#1a4f8b"/>
      <circle cx="42" cy="37" r="2" fill="#1a4f8b"/>
      <circle cx="58" cy="37" r="2" fill="#1a4f8b"/>
      <text x="50" y="88" textAnchor="middle" fill="#1a4f8b" fontSize="7" fontWeight="700" fontFamily="Noto Sans">सत्यमेव जयते</text>
    </svg>
  );
}

export default function Layout() {
  const { signOut } = useAuth();
  const { language, setLanguage, notifications, unreadCount, markNotificationRead, profile } = useApp();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const langRef = useRef(null);
  const notifRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const navLinks = [
    { to: '/dashboard', label: t('nav.dashboard', language), icon: <LayoutDashboard size={16} /> },
    { to: '/ai-chat', label: t('nav.ai_chat', language), icon: <Bot size={16} /> },
    { to: '/applications', label: t('nav.applications', language), icon: <FileText size={16} /> },
    { to: '/waiting-list', label: t('nav.waiting_list', language), icon: <Users size={16} /> },
    { to: '/messages', label: t('nav.messages', language), icon: <MessageSquare size={16} /> },
  ];

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-to-content">Skip to main content</a>

      {/* Government-style top bar */}
      <div className="gov-topbar">
        <div className="gov-topbar__inner">
          <div className="gov-topbar__left">
            <span>{t('app.prototype', language)}</span>
            <span>|</span>
            <span>{t('app.disclaimer', language)}</span>
          </div>
          <div className="gov-topbar__right">
            <a href="#accessibility">{t('footer.accessibility', language)}</a>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="gov-header" role="banner">
        <div className="gov-header__inner">
          <Link to="/dashboard" className="gov-header__brand">
            <div className="gov-header__emblem">
              <AshokaPillar size={44} />
            </div>
            <div>
              <div className="gov-header__title">{t('app.name', language)}</div>
              <div className="gov-header__subtitle">{t('app.subtitle', language)}</div>
            </div>
          </Link>

          <nav className={`gov-header__nav ${mobileNavOpen ? 'gov-header__nav--open' : ''}`} role="navigation" aria-label="Main navigation">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `gov-header__nav-link ${isActive ? 'gov-header__nav-link--active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
              >
                {link.icon}
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="gov-header__actions">
            {/* Reusable Global Language Selector */}
            <LanguageSelector />

            {/* Notifications */}
            <div className="notif-badge" ref={notifRef} style={{ position: 'relative' }}>
              <button
                className="btn btn--icon btn--ghost"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label={`${t('nav.notifications', language)} ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="notif-badge__count">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-panel" role="dialog" aria-label="Notifications">
                  <div className="notif-panel__header">{t('notif.title', language)}</div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
                      {t('notif.no_notifications', language)}
                    </div>
                  ) : (
                    notifications.slice(0, 10).map(notif => (
                      <div
                        key={notif.id}
                        className={`notif-item ${!notif.is_read ? 'notif-item--unread' : ''}`}
                        onClick={() => {
                          markNotificationRead(notif.id);
                          if (notif.target_url) navigate(notif.target_url);
                          setNotifOpen(false);
                        }}
                      >
                        <div className="notif-item__title">{notif.title}</div>
                        <div className="notif-item__message">{notif.message}</div>
                        <div className="notif-item__time">{new Date(notif.created_at).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Profile */}
            <NavLink
              to="/profile"
              className={({ isActive }) => `btn btn--icon btn--ghost ${isActive ? 'gov-header__nav-link--active' : ''}`}
              aria-label={t('nav.profile', language)}
            >
              <User size={18} />
            </NavLink>

            {/* Logout */}
            <button className="btn btn--icon btn--ghost" onClick={handleLogout} aria-label={t('nav.logout', language)}>
              <LogOut size={18} />
            </button>

            {/* Mobile Toggle */}
            <button
              className="gov-header__mobile-toggle"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle navigation"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="app-main" role="main">
        <Outlet />
      </main>

      {/* Government-style Footer */}
      <footer className="gov-footer" role="contentinfo">
        <div className="gov-footer__inner">
          <div className="gov-footer__top">
            <div>
              <div className="gov-footer__brand-title">{t('app.name', language)}</div>
              <p className="gov-footer__brand-desc">{t('app.tagline', language)}</p>
              <p className="gov-footer__brand-desc mt-2" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                {t('app.disclaimer', language)}
              </p>
            </div>
            <div>
              <div className="gov-footer__heading">Quick Links</div>
              <ul className="gov-footer__links">
                <li><Link to="/dashboard">{t('nav.dashboard', language)}</Link></li>
                <li><Link to="/ai-chat">{t('nav.ai_chat', language)}</Link></li>
                <li><Link to="/applications">{t('nav.applications', language)}</Link></li>
                <li><Link to="/profile">{t('nav.profile', language)}</Link></li>
              </ul>
            </div>
            <div>
              <div className="gov-footer__heading">Support</div>
              <ul className="gov-footer__links">
                <li><a href="#help">{t('footer.help', language)}</a></li>
                <li><a href="#accessibility">{t('footer.accessibility', language)}</a></li>
                <li><a href="#contact">{t('footer.contact', language)}</a></li>
                <li><a href="#source">{t('footer.source', language)}</a></li>
              </ul>
            </div>
            <div>
              <div className="gov-footer__heading">Legal</div>
              <ul className="gov-footer__links">
                <li><a href="#privacy">{t('footer.privacy', language)}</a></li>
                <li><a href="#terms">{t('footer.terms', language)}</a></li>
              </ul>
            </div>
          </div>
          <div className="gov-footer__bottom">
            <span className="gov-footer__disclaimer">{t('app.prototype', language)} • {t('app.disclaimer', language)}</span>
            <span className="gov-footer__disclaimer">© 2026 Sahayak. Built for SIH 2026.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { AshokaPillar };
