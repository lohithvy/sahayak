import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { GeminiService } from '../services/gemini';
import { EligibilityEngine } from '../services/eligibility';
import { ASRService, LANGUAGE_CAPABILITIES } from '../services/language';
import { t } from '../i18n';
import { formatDate, formatCurrency, getEligibilityColor, getStatusLabel, timeAgo } from '../utils/constants';
import {
  Search, Mic, MicOff, ChevronRight, ExternalLink, FileText, AlertTriangle,
  CheckCircle2, XCircle, AlertCircle, Clock, Users, BookOpen, TrendingUp,
  Volume2, Bot
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { profile, documents, language, notifications, createNotification } = useApp();
  const navigate = useNavigate();

  const [schemes, setSchemes] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [groupSchemes, setGroupSchemes] = useState([]);
  const [loadingSchemes, setLoadingSchemes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Fetch schemes
  const fetchSchemes = useCallback(async () => {
    try {
      const { data } = await supabase.from('schemes').select('*').eq('is_active', true).limit(20);
      setSchemes(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSchemes(false);
    }
  }, []);

  // Fetch applications
  const fetchApplications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('applications').select('*, schemes(name, ministry)')
        .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5);
      setApplications(data || []);
    } catch (e) { console.error(e); }
  }, [user]);

  // Fetch opportunities
  const fetchOpportunities = useCallback(async () => {
    try {
      const { data } = await supabase.from('government_opportunities').select('*')
        .eq('is_active', true).order('created_at', { ascending: false }).limit(6);
      setOpportunities(data || []);
    } catch (e) { console.error(e); }
  }, []);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      const { data } = await supabase.from('group_schemes').select('*, schemes(name)')
        .eq('status', 'forming').limit(4);
      setGroupSchemes(data || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchSchemes();
    fetchApplications();
    fetchOpportunities();
    fetchGroups();
  }, [fetchSchemes, fetchApplications, fetchOpportunities, fetchGroups]);

  // Compute eligibility for each scheme
  const schemesWithEligibility = schemes.map(scheme => ({
    ...scheme,
    eligibility: EligibilityEngine.checkEligibility(scheme, profile, documents),
  }));

  // Sort: eligible first, then more-info, then not-eligible
  const sortedSchemes = [...schemesWithEligibility].sort((a, b) => {
    const order = { ELIGIBLE: 0, CONDITIONALLY_ELIGIBLE: 1, DOCUMENT_MISSING: 2, MORE_INFORMATION_REQUIRED: 3, NOT_ELIGIBLE: 4 };
    return (order[a.eligibility.status] || 5) - (order[b.eligibility.status] || 5);
  });

  // AI Search
  const handleSearch = async (overrideQuery) => {
    const q = (typeof overrideQuery === 'string' ? overrideQuery : searchQuery).trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    setSearchStatus(t('ai.searching', language));
    try {
      setSearchStatus(t('ai.analyzing', language));
      const result = await GeminiService.searchDashboard(q, profile, language);
      setSearchResults(result);
    } catch (e) {
      console.error('[Dashboard Search Error]:', e);
      setSearchError(e.message || 'AI search service is temporarily unavailable. Please try again.');
    } finally {
      setSearching(false);
      setSearchStatus('');
    }
  };

  // Voice input
  const toggleMic = () => {
    if (isListening) {
      ASRService.stopListening();
      setIsListening(false);
    } else {
      const started = ASRService.startListening(
        language,
        (transcript, isFinal) => {
          setSearchQuery(transcript);
          if (isFinal) {
            setIsListening(false);
            handleSearch(transcript);
          }
        },
        (error) => {
          alert(error);
          setIsListening(false);
        },
        () => { setIsListening(false); }
      );
      setIsListening(started);
    }
  };

  const profileCompletion = EligibilityEngine.calculateProfileCompletion(profile);

  // Incomplete applications
  const incompleteApps = applications.filter(a => a.status !== 'submitted_demo');

  // Normalize scheme list
  const retrievedSchemes = Array.isArray(searchResults)
    ? searchResults
    : (searchResults?.schemes || searchResults?.recommendations || []);

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">{t('dashboard.welcome', language)}, {profile?.full_name || 'User'}</h1>
        <p className="page-subtitle">{t('app.tagline', language)}</p>
      </div>

      {/* AI Search */}
      <div className="ai-search" role="search">
        <div className="ai-search__input-wrap">
          <input
            className="ai-search__input"
            type="text"
            placeholder={t('dashboard.ai_search_placeholder', language)}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            aria-label="Search for schemes"
          />
          <button
            className={`ai-search__mic ${isListening ? 'ai-search__mic--active' : ''}`}
            onClick={toggleMic}
            aria-label={isListening ? t('ai.stop', language) : t('ai.speak', language)}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button className="ai-search__btn" onClick={() => handleSearch()} disabled={searching}>
            <Search size={16} />
            {searching ? t('ai.thinking', language) : 'Search'}
          </button>
        </div>
        {(searching || searchStatus) && (
          <div className="ai-status" role="status" aria-live="polite">
            <div className="ai-status__dot" />
            {searchStatus}
          </div>
        )}
      </div>

      {/* Developer-side Error Display */}
      {searchError && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-error)', background: '#fff9f9' }}>
          <div className="card__body" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertCircle size={20} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>
                {t('error.ai_unavailable', language)}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {searchError}
              </div>
            </div>
            <button className="btn btn--sm btn--secondary" onClick={() => handleSearch()}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Smart Response: Greeting / General Inquiry */}
      {searchResults?.type === 'general' && searchResults?.response && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-blue)' }}>
          <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={18} style={{ color: 'var(--color-blue)' }} />
              <span className="card__title">{t('app.name', language)}</span>
            </div>
            <button className="btn btn--sm btn--ghost" onClick={() => setSearchResults(null)} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="card__body">
            <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-navy)', lineHeight: 1.6 }}>
              {searchResults.response}
            </p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn--sm btn--secondary"
                onClick={() => {
                  const q = 'Find government schemes for a tailoring business';
                  setSearchQuery(q);
                  handleSearch(q);
                }}
              >
                Tailoring Schemes
              </button>
              <button
                className="btn btn--sm btn--secondary"
                onClick={() => {
                  const q = 'What government support is available for my business?';
                  setSearchQuery(q);
                  handleSearch(q);
                }}
              >
                Business Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Response: Eligibility Inquiries */}
      {searchResults?.type === 'eligibility' && searchResults?.response && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-saffron)' }}>
          <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card__title">Eligibility Assessment</span>
            <button className="btn btn--sm btn--ghost" onClick={() => setSearchResults(null)} aria-label="Close">✕</button>
          </div>
          <div className="card__body">
            <div style={{ marginBottom: '0.5rem' }}>
              <span className={`status-tag status-tag--${searchResults.status === 'eligible' ? 'eligible' : 'more-info'}`}>
                {searchResults.status || 'Assessment'}
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-navy)', lineHeight: 1.5 }}>
              {searchResults.response}
            </p>
            {searchResults.missing_requirements?.length > 0 && (
              <div style={{ background: 'var(--color-gray-50)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', marginTop: '0.75rem' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-warning)' }}>
                  Requirements to check:
                </div>
                <ul style={{ margin: '0.25rem 0 0 1.25rem', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {searchResults.missing_requirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Response: Scheme Results */}
      {retrievedSchemes.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 className="section-heading" style={{ margin: 0 }}>{t('scheme.search_results', language)}</h2>
            <button className="btn btn--sm btn--ghost" onClick={() => setSearchResults(null)}>
              ✕ {t('common.clear', language) || 'Clear'}
            </button>
          </div>
          {searchResults?.summary && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
              {searchResults.summary}
            </p>
          )}
          <div className="scheme-grid">
            {retrievedSchemes.map((result, i) => (
              <div key={i} className="scheme-card">
                <div className="scheme-card__header">
                  <div>
                    <div className="scheme-card__name">{result.name}</div>
                    <div className="scheme-card__ministry">{result.ministry}</div>
                  </div>
                  {result.status && (
                    <span className={`status-tag status-tag--${result.status === 'eligible' ? 'eligible' : 'more-info'}`}>
                      {result.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <div className="scheme-card__body">
                  <div className="scheme-card__benefit">{result.benefit}</div>
                  {result.reason && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-blue)', marginTop: '0.5rem' }}>
                      <strong>{t('scheme.why_matches', language)}:</strong> {result.reason}
                    </div>
                  )}
                  {result.why_relevant && !result.reason && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-blue)', marginTop: '0.5rem' }}>
                      <strong>{t('scheme.why_matches', language)}:</strong> {result.why_relevant}
                    </div>
                  )}
                  {result.official_url && (
                    <div className="scheme-card__meta" style={{ marginTop: '0.5rem' }}>
                      <a href={result.official_url} target="_blank" rel="noopener noreferrer" className="scheme-card__meta-item" style={{ color: 'var(--text-link)' }}>
                        <ExternalLink size={12} /> {t('scheme.official_source', language)}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile & Document Status Row */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        {/* Profile Completion */}
        <div className="card">
          <div className="card__header">
            <span className="card__title">{t('dashboard.profile_completion', language)}</span>
            <Link to="/profile" className="btn btn--sm btn--secondary">{t('profile.edit', language)}</Link>
          </div>
          <div className="card__body">
            <div className="completion-meter">
              <div className="completion-meter__bar">
                <div className="completion-meter__fill" style={{ width: `${profileCompletion}%` }} />
              </div>
              <span className="completion-meter__text">{profileCompletion}%</span>
            </div>
            {profileCompletion < 100 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                Complete your profile to improve scheme matching accuracy.
              </p>
            )}
          </div>
        </div>

        {/* Document Status */}
        <div className="card">
          <div className="card__header">
            <span className="card__title">{t('dashboard.document_status', language)}</span>
            <Link to="/profile" className="btn btn--sm btn--secondary">{t('profile.upload_document', language)}</Link>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {['aadhaar', 'pan', 'community_certificate', 'income_certificate', 'udyam_certificate', 'bank_statement'].map(docType => {
                const doc = documents.find(d => d.document_type === docType);
                const label = { aadhaar: 'Aadhaar', pan: 'PAN', community_certificate: 'Caste Cert.', income_certificate: 'Income Cert.', udyam_certificate: 'Udyam', bank_statement: 'Bank Stmt.' }[docType];
                return (
                  <div key={docType} style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', margin: '0 auto 4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: doc ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                      color: doc ? 'var(--color-success)' : 'var(--color-error)',
                    }}>
                      {doc ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Incomplete Applications Alert */}
      {incompleteApps.length > 0 && (
        <div className="alert alert--warning mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} />
            <span>{t('application.incomplete', language)} {incompleteApps.length} {t('application.incomplete_detail', language)}</span>
          </div>
          <Link to="/applications" className="btn btn--sm btn--secondary">{t('application.continue', language)}</Link>
        </div>
      )}

      {/* Schemes For You */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-heading">{t('dashboard.schemes_for_you', language)}</h2>
        {loadingSchemes ? (
          <div className="scheme-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="scheme-card">
                <div className="card__body">
                  <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 16 }} />
                  <div className="skeleton" style={{ height: 40, width: '100%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="scheme-grid">
            {sortedSchemes.slice(0, 6).map(scheme => (
              <SchemeCard
                key={scheme.id}
                scheme={scheme}
                eligibility={scheme.eligibility}
                language={language}
                onView={() => navigate(`/schemes/${scheme.id}`)}
                onApply={() => navigate(`/schemes/${scheme.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active Applications */}
      {applications.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-heading">{t('dashboard.active_applications', language)}</h2>
          <div className="card">
            <div className="card__body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Scheme</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Updated</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => (
                      <tr key={app.id}>
                        <td style={{ fontWeight: 500 }}>{app.schemes?.name || 'Unknown'}</td>
                        <td>
                          <span className={`status-tag status-tag--${app.status === 'submitted_demo' ? 'eligible' : 'more-info'}`}>
                            {app.status === 'submitted_demo' ? t('application.submitted', language) :
                              app.status === 'in_progress' ? t('application.in_progress', language) :
                                t('application.started', language)}
                          </span>
                        </td>
                        <td>
                          <div className="completion-meter">
                            <div className="completion-meter__bar" style={{ width: 80 }}>
                              <div className="completion-meter__fill" style={{ width: `${app.progress_percentage}%` }} />
                            </div>
                            <span style={{ fontSize: 'var(--text-xs)' }}>{app.progress_percentage}%</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(app.updated_at)}</td>
                        <td>
                          <Link to={`/applications/${app.id}`} className="btn btn--sm btn--secondary">
                            {app.status === 'submitted_demo' ? 'View' : t('application.continue', language)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Government Opportunities */}
      {opportunities.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-heading">{t('dashboard.govt_opportunities', language)}</h2>
          <div className="scheme-grid">
            {opportunities.slice(0, 4).map(opp => (
              <div key={opp.id} className="opp-card">
                <div className="opp-card__title">{opp.title}</div>
                <div className="opp-card__dept">{opp.department}</div>
                <div className="opp-card__detail">{opp.description}</div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {opp.location && (
                    <span className="scheme-card__meta-item">📍 {opp.location}</span>
                  )}
                  {opp.tender_value && (
                    <span className="scheme-card__meta-item">💰 {opp.tender_value}</span>
                  )}
                  {opp.deadline && (
                    <span className="scheme-card__meta-item">📅 Deadline: {formatDate(opp.deadline)}</span>
                  )}
                </div>
                {profile?.business_type && (
                  <div className="opp-card__relevance">
                    {t('opp.potentially_relevant', language)}: Business category appears relevant to your profile. {t('opp.check_conditions', language)}.
                  </div>
                )}
                {opp.official_url && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <a href={opp.official_url} target="_blank" rel="noopener noreferrer" className="btn btn--sm btn--secondary">
                      <ExternalLink size={12} /> {t('opp.view_official', language)}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Opportunities */}
      {groupSchemes.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-heading">{t('dashboard.group_opportunities', language)}</h2>
          <div className="scheme-grid">
            {groupSchemes.map(group => (
              <div key={group.id} className="group-card">
                <div className="group-card__title">{group.title || group.schemes?.name || 'Group Scheme'}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {group.location || 'Location not specified'}
                </div>
                <div className="group-card__members">
                  {Array.from({ length: group.required_members }).map((_, i) => (
                    <div key={i} className={`group-card__member ${i < group.current_members ? 'group-card__member--filled' : 'group-card__member--empty'}`}>
                      {i < group.current_members ? '✓' : '?'}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {group.current_members}/{group.required_members} {t('group.members', language)} •
                  {t('waiting.looking_for', language)} {group.required_members - group.current_members} {t('waiting.more_members', language)}
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <Link to="/waiting-list" className="btn btn--sm btn--primary">{t('group.view', language)}</Link>
                  <Link to="/messages" className="btn btn--sm btn--ghost">{t('group.message', language)}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Scheme Card Component
function SchemeCard({ scheme, eligibility, language, onView, onApply }) {
  const statusColor = getEligibilityColor(eligibility.status);
  const readinessColor = eligibility.readiness_percentage >= 80 ? 'var(--color-success)' :
    eligibility.readiness_percentage >= 50 ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <div className="scheme-card">
      <div className="scheme-card__header">
        <div>
          <div className="scheme-card__name">{scheme.name}</div>
          <div className="scheme-card__ministry">{scheme.ministry}</div>
        </div>
        <span className={`status-tag status-tag--${statusColor}`} role="status">
          {eligibility.status === 'ELIGIBLE' && <CheckCircle2 size={12} />}
          {eligibility.status === 'NOT_ELIGIBLE' && <XCircle size={12} />}
          {(eligibility.status === 'MORE_INFORMATION_REQUIRED' || eligibility.status === 'DOCUMENT_MISSING' || eligibility.status === 'CONDITIONALLY_ELIGIBLE') && <AlertCircle size={12} />}
          {getStatusLabel(eligibility.status, language)}
        </span>
      </div>
      <div className="scheme-card__body">
        <div className="scheme-card__benefit">
          <strong>{t('scheme.benefit', language)}:</strong> {scheme.benefit || scheme.benefit_amount}
        </div>

        {/* Readiness bar */}
        <div className="scheme-card__readiness">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
            <span>{t('scheme.readiness', language)}</span>
            <span style={{ fontWeight: 600, color: readinessColor }}>{eligibility.readiness_percentage}%</span>
          </div>
          <div className="scheme-card__readiness-bar">
            <div className="scheme-card__readiness-fill" style={{ width: `${eligibility.readiness_percentage}%`, background: readinessColor }} />
          </div>
        </div>

        {/* Missing docs summary */}
        {eligibility.missing_documents.length > 0 && (
          <div style={{ marginTop: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>
            ⚠ {eligibility.missing_documents.length} {t('scheme.missing_docs', language).toLowerCase()}
          </div>
        )}

        {/* Source */}
        <div className="scheme-card__meta">
          {scheme.source_type && (
            <span className="scheme-card__meta-item">
              <BookOpen size={10} /> {scheme.source_type}
            </span>
          )}
          {scheme.last_verified_at && (
            <span className="scheme-card__meta-item">
              <Clock size={10} /> {formatDate(scheme.last_verified_at)}
            </span>
          )}
        </div>
      </div>
      <div className="scheme-card__footer">
        <button className="btn btn--sm btn--secondary" onClick={onView}>
          {t('scheme.view', language)}
        </button>
        {eligibility.status !== 'NOT_ELIGIBLE' && (
          <button className="btn btn--sm btn--primary" onClick={onApply}>
            {t('scheme.apply', language)}
          </button>
        )}
        {scheme.official_url && (
          <a href={scheme.official_url} target="_blank" rel="noopener noreferrer" className="btn btn--sm btn--ghost" style={{ marginLeft: 'auto' }}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
