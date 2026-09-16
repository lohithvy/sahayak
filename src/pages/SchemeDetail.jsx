import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { EligibilityEngine } from '../services/eligibility';
import { GeminiService } from '../services/gemini';
import { t } from '../i18n';
import { formatDate, getEligibilityColor, getStatusLabel } from '../utils/constants';
import { CheckCircle2, XCircle, AlertCircle, ExternalLink, ArrowLeft, BookOpen, Clock, FileText } from 'lucide-react';

export default function SchemeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { profile, documents, language, createNotification } = useApp();
  const navigate = useNavigate();
  const [scheme, setScheme] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    async function fetchScheme() {
      const { data } = await supabase.from('schemes').select('*').eq('id', id).single();
      if (data) setScheme(data);

      const { data: srcData } = await supabase.from('scheme_sources').select('*').eq('scheme_id', id);
      setSources(srcData || []);
      setLoading(false);
    }
    fetchScheme();
  }, [id]);

  const eligibility = scheme ? EligibilityEngine.checkEligibility(scheme, profile, documents) : null;

  const runAIAnalysis = async () => {
    if (!scheme) return;
    setAnalyzing(true);
    try {
      const result = await GeminiService.analyzeEligibility(scheme, profile, documents);
      setAiAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const startApplication = async () => {
    if (!scheme || !user) return;
    setApplying(true);
    try {
      // Check if application already exists
      const { data: existing } = await supabase.from('applications')
        .select('id')
        .eq('user_id', user.id)
        .eq('scheme_id', scheme.id)
        .single();

      if (existing) {
        navigate(`/applications/${existing.id}`);
        return;
      }

      const { data, error } = await supabase.from('applications').insert({
        user_id: user.id,
        scheme_id: scheme.id,
        status: 'started',
        progress_percentage: 10,
        current_step: 1,
        total_steps: 5,
        eligibility_status: eligibility?.status,
        missing_requirements: eligibility?.missing_documents || [],
        form_data: {
          personal: {
            full_name: profile?.full_name,
            dob: profile?.dob,
            gender: profile?.gender,
            state: profile?.state,
            district: profile?.district,
          },
          business: {
            business_type: profile?.business_type,
            business_category: profile?.business_category,
            business_status: profile?.business_status,
          },
        },
      }).select().single();

      if (error) throw error;

      // Create application steps
      const steps = [
        { step_number: 1, step_name: 'Personal Information', status: 'completed' },
        { step_number: 2, step_name: 'Business Information', status: 'completed' },
        { step_number: 3, step_name: 'Documents', status: 'pending' },
        { step_number: 4, step_name: 'Review', status: 'pending' },
        { step_number: 5, step_name: 'Submit', status: 'pending' },
      ];

      for (const step of steps) {
        await supabase.from('application_steps').insert({
          application_id: data.id,
          ...step,
          completed_at: step.status === 'completed' ? new Date().toISOString() : null,
        });
      }

      await createNotification(
        'incomplete_application',
        t('application.started', language),
        `Application started for ${scheme.name}. Complete to submit.`,
        `/applications/${data.id}`,
        data.id
      );

      navigate(`/applications/${data.id}`);
    } catch (e) {
      console.error('Error starting application:', e);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  if (!scheme) {
    return <div className="empty-state"><p>Scheme not found.</p></div>;
  }

  const statusColor = getEligibilityColor(eligibility?.status);

  return (
    <div>
      <button className="btn btn--ghost mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Scheme Header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--color-navy)' }}>{scheme.name}</h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>{scheme.ministry}</p>
          </div>
          <span className={`status-tag status-tag--${statusColor}`} style={{ fontSize: 'var(--text-sm)', padding: '4px 12px' }}>
            {eligibility?.status === 'ELIGIBLE' && <CheckCircle2 size={14} />}
            {eligibility?.status === 'NOT_ELIGIBLE' && <XCircle size={14} />}
            {(eligibility?.status !== 'ELIGIBLE' && eligibility?.status !== 'NOT_ELIGIBLE') && <AlertCircle size={14} />}
            {getStatusLabel(eligibility?.status, language)}
          </span>
        </div>
        <div className="card__body">
          <p style={{ marginBottom: '1rem' }}>{scheme.description}</p>

          <div className="grid-2">
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>Benefit</div>
              <div style={{ fontWeight: 500 }}>{scheme.benefit}</div>
              {scheme.benefit_amount && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-green)' }}>{scheme.benefit_amount}</div>}
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>Scheme Type</div>
              <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{scheme.scheme_type}</div>
            </div>
          </div>

          {scheme.application_method && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>How to Apply</div>
              <div style={{ fontSize: 'var(--text-sm)' }}>{scheme.application_method}</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Eligibility Checks */}
        <div className="card">
          <div className="card__header">
            <span className="card__title">{t('scheme.eligibility_checks', language)}</span>
            <button className="btn btn--sm btn--secondary" onClick={runAIAnalysis} disabled={analyzing}>
              {analyzing ? 'Analyzing...' : 'AI Analysis'}
            </button>
          </div>
          <div className="card__body">
            {/* Readiness */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span>{t('scheme.readiness', language)}</span>
                <span style={{ fontWeight: 600 }}>{eligibility?.readiness_percentage}%</span>
              </div>
              <div className="scheme-card__readiness-bar" style={{ marginTop: '0.5rem' }}>
                <div className="scheme-card__readiness-fill" style={{
                  width: `${eligibility?.readiness_percentage}%`,
                  background: eligibility?.readiness_percentage >= 80 ? 'var(--color-success)' : eligibility?.readiness_percentage >= 50 ? 'var(--color-warning)' : 'var(--color-error)'
                }} />
              </div>
            </div>

            <ul className="eligibility-list">
              {eligibility?.checks.map((check, i) => (
                <li key={i} className="eligibility-list__item">
                  <span className={`eligibility-list__icon eligibility-list__icon--${check.passed === true ? 'pass' : check.passed === false ? 'fail' : 'unknown'}`}>
                    {check.passed === true ? <CheckCircle2 size={16} /> : check.passed === false ? <XCircle size={16} /> : <AlertCircle size={16} />}
                  </span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{check.label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{check.reason}</div>
                  </div>
                </li>
              ))}
            </ul>

            {/* AI Analysis Results */}
            {aiAnalysis && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--color-blue-pale)', borderRadius: 'var(--border-radius)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '0.5rem' }}>AI Analysis</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  Status: {aiAnalysis.status} • Readiness: {aiAnalysis.readiness_percentage}%
                </div>
                {aiAnalysis.alternatives_note && (
                  <div style={{ marginTop: '0.5rem', fontSize: 'var(--text-xs)' }}>{aiAnalysis.alternatives_note}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Items */}
        <div className="card">
          <div className="card__header">
            <span className="card__title">{t('scheme.action_items', language)}</span>
          </div>
          <div className="card__body">
            {eligibility?.action_items.length > 0 ? (
              <ol style={{ paddingLeft: '1.25rem', fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {eligibility.action_items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            ) : (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
                <CheckCircle2 size={14} style={{ verticalAlign: 'middle' }} /> No pending action items. You appear ready to apply.
              </p>
            )}

            {eligibility?.missing_documents.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '0.5rem' }}>{t('scheme.missing_docs', language)}</div>
                {eligibility.missing_documents.map((doc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', padding: '0.25rem 0' }}>
                    <AlertCircle size={14} style={{ color: 'var(--color-warning)' }} />
                    {EligibilityEngine.getDocLabel(doc)}
                  </div>
                ))}
              </div>
            )}

            {/* Apply Button */}
            <div style={{ marginTop: '1.5rem' }}>
              {eligibility?.status !== 'NOT_ELIGIBLE' ? (
                <button className="btn btn--primary btn--lg btn--full" onClick={startApplication} disabled={applying}>
                  {applying ? 'Starting...' : t('scheme.apply', language)}
                </button>
              ) : (
                <div className="alert alert--error">
                  {t('scheme.not_eligible', language)}. Review the eligibility checks above for details.
                </div>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '0.5rem', textAlign: 'center' }}>
                {t('application.prototype_note', language)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="card">
        <div className="card__header">
          <span className="card__title">{t('scheme.official_source', language)}</span>
        </div>
        <div className="card__body">
          {scheme.official_url && (
            <div style={{ marginBottom: '0.75rem' }}>
              <a href={scheme.official_url} target="_blank" rel="noopener noreferrer" className="btn btn--secondary">
                <ExternalLink size={14} /> Visit Official Portal
              </a>
            </div>
          )}
          {sources.map(src => (
            <div key={src.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-gray-100)' }}>
              <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                {src.source_title || src.domain}
              </a>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {src.domain} • {src.is_official ? 'Official Source' : 'Reference'} • Last checked: {formatDate(src.last_checked)}
              </div>
              {src.source_excerpt && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{src.source_excerpt}</div>
              )}
            </div>
          ))}
          <div style={{ marginTop: '0.75rem', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            <Clock size={10} style={{ verticalAlign: 'middle' }} /> {t('scheme.last_checked', language)}: {formatDate(scheme.last_verified_at)}
          </div>
        </div>
      </div>
    </div>
  );
}
