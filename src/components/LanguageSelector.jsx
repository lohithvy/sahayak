import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { LANGUAGES, getLanguageName } from '../i18n';
import { Globe, Check } from 'lucide-react';

export default function LanguageSelector({ variant = 'default', showLabel = true }) {
  const { language, setLanguage } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    setLanguage(code);
    setIsOpen(false);
  };

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <div className={`lang-selector lang-selector--${variant}`} ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="lang-selector__btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <Globe size={15} />
        {showLabel && (
          <span className="lang-selector__current">
            {currentLang.nativeName} <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({currentLang.name})</span>
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="lang-selector__dropdown"
          role="listbox"
          aria-label="23 Scheduled Indian Languages + English"
          style={{
            maxHeight: '380px',
            overflowY: 'auto',
            minWidth: '240px',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--color-gray-200)' }}>
            Select Language ({LANGUAGES.length})
          </div>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              type="button"
              className={`lang-selector__option ${language === lang.code ? 'lang-selector__option--active' : ''}`}
              onClick={() => handleSelect(lang.code)}
              role="option"
              aria-selected={language === lang.code}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px' }}
            >
              <div style={{ textAlign: 'start' }}>
                <div style={{ fontWeight: language === lang.code ? 700 : 500 }}>
                  {lang.nativeName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {lang.name} • {lang.script}
                </div>
              </div>
              {language === lang.code && <Check size={16} style={{ color: 'var(--color-blue)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
