import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../services/supabase';
import { t } from '../i18n';
import { DOCUMENT_TYPES, formatDate } from '../utils/constants';
import { ArrowLeft, Check, Upload, AlertCircle, CheckCircle2, Clock, Info } from 'lucide-react';

export default function ApplicationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { profile, documents, language, createNotification } = useApp();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [scheme, setScheme] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    async function fetch() {
      const { data: app } = await supabase.from('applications')
        .select('*, schemes(*)')
        .eq('id', id)
        .single();
      if (app) {
        setApplication(app);
        setScheme(app.schemes);
        setCurrentStep(app.current_step || 1);
        setFormData(app.form_data || {});
      }
      const { data: stepsData } = await supabase.from('application_steps')
        .select('*')
        .eq('application_id', id)
        .order('step_number', { ascending: true });
      setSteps(stepsData || []);
      setLoading(false);
    }
    fetch();
  }, [id]);

  const saveApplication = async (updates = {}) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('applications')
        .update({
          form_data: formData,
          current_step: currentStep,
          progress_percentage: Math.min(100, currentStep * 20),
          status: currentStep >= 5 ? 'submitted_demo' : 'in_progress',
          ...updates,
        })
        .eq('id', id);
      if (error) throw error;
      setApplication(prev => ({ ...prev, ...updates, current_step: currentStep, form_data: formData }));
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const goToStep = async (stepNum) => {
    await saveApplication();
    setCurrentStep(stepNum);
  };

  const submitDemo = async () => {
    await saveApplication({
      status: 'submitted_demo',
      progress_percentage: 100,
      submitted_at: new Date().toISOString(),
    });

    // Update all steps to completed
    for (const step of steps) {
      await supabase.from('application_steps')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', step.id);
    }

    await createNotification(
      'system',
      'Application Submitted (Demo)',
      `Your demo application for ${scheme?.name} has been submitted.`,
      `/applications/${id}`
    );

    navigate('/applications');
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!application) return <div className="empty-state"><p>Application not found.</p></div>;

  const isSubmitted = application.status === 'submitted_demo';

  return (
    <div>
      <button className="btn btn--ghost mb-4" onClick={() => navigate('/applications')}>
        <ArrowLeft size={16} /> Back to Applications
      </button>

      {/* Application Header */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card__body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--color-navy)' }}>
                {t('application.title', language)}: {scheme?.name}
              </h1>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{scheme?.ministry}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-blue)' }}>
                {application.progress_percentage}%
              </div>
              <span className={`status-tag status-tag--${isSubmitted ? 'eligible' : 'more-info'}`}>
                {isSubmitted ? t('application.submitted', language) : t('application.in_progress', language)}
              </span>
            </div>
          </div>
          <div className="alert alert--info mt-3">
            <Info size={14} />
            {t('application.prototype_note', language)}
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="progress-steps" style={{ marginBottom: '1.5rem' }}>
        {['Personal Info', 'Business Info', 'Documents', 'Review', 'Submit'].map((label, i) => {
          const stepNum = i + 1;
          const isActive = currentStep === stepNum;
          const isCompleted = currentStep > stepNum || isSubmitted;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div className={`progress-step__connector ${isCompleted ? 'progress-step__connector--completed' : ''}`} />}
              <button
                className={`progress-step ${isActive ? 'progress-step--active' : ''} ${isCompleted ? 'progress-step--completed' : ''}`}
                onClick={() => !isSubmitted && goToStep(stepNum)}
                style={{ cursor: isSubmitted ? 'default' : 'pointer', background: 'none', border: 'none' }}
              >
                <div className="progress-step__number">
                  {isCompleted ? <Check size={14} /> : stepNum}
                </div>
                {label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="card">
        <div className="card__body" style={{ padding: '1.5rem' }}>
          {/* Step 1: Personal Info (auto-filled) */}
          {currentStep === 1 && (
            <>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '1rem' }}>Personal Information</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Auto-filled from your profile. Edit if needed.
              </p>
              {[
                ['Full Name', profile?.full_name],
                ['Date of Birth', profile?.dob],
                ['Gender', profile?.gender],
                ['State', profile?.state],
                ['District', profile?.district],
                ['Community Category', profile?.community_category?.toUpperCase()],
                ['Annual Income', profile?.annual_income ? `₹${Number(profile.annual_income).toLocaleString('en-IN')}` : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', padding: '0.5rem 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                  <span style={{ width: '160px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: 'var(--text-sm)' }}>{value || '—'}</span>
                </div>
              ))}
            </>
          )}

          {/* Step 2: Business Info */}
          {currentStep === 2 && (
            <>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '1rem' }}>Business Information</h3>
              {[
                ['Business Status', profile?.business_status],
                ['Business Type', profile?.business_type],
                ['Business Category', profile?.business_category],
                ['Business Location', profile?.business_location],
                ['Business Stage', profile?.business_stage],
                ['Udyam Registered', profile?.udyam_registered ? 'Yes' : 'No'],
                ['Capital Required', profile?.capital_required ? `₹${Number(profile.capital_required).toLocaleString('en-IN')}` : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', padding: '0.5rem 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                  <span style={{ width: '160px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: 'var(--text-sm)' }}>{value || '—'}</span>
                </div>
              ))}
            </>
          )}

          {/* Step 3: Documents */}
          {currentStep === 3 && (
            <>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '1rem' }}>Required Documents</h3>
              {(scheme?.required_documents || []).map(docType => {
                const doc = documents.find(d => d.document_type === docType);
                const label = DOCUMENT_TYPES.find(d => d.key === docType)?.label || docType;
                return (
                  <div key={docType} className="doc-card" style={{ marginBottom: '0.5rem' }}>
                    <div className="doc-card__icon" style={{
                      background: doc ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                      color: doc ? 'var(--color-success)' : 'var(--color-error)',
                    }}>
                      {doc ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div className="doc-card__info">
                      <div className="doc-card__name">{label}</div>
                      <span className={`status-tag status-tag--${doc ? 'uploaded' : 'missing'}`}>
                        {doc ? t('doc.uploaded', language) : t('doc.missing', language)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '1rem' }}>Application Review</h3>
              <div className="alert alert--info mb-4">
                Review your application before submitting. This is a demo submission and will not be sent to any government portal.
              </div>
              <div style={{ fontSize: 'var(--text-sm)' }}>
                <p><strong>Scheme:</strong> {scheme?.name}</p>
                <p><strong>Applicant:</strong> {profile?.full_name}</p>
                <p><strong>Category:</strong> {profile?.community_category?.toUpperCase()}</p>
                <p><strong>Business:</strong> {profile?.business_type} ({profile?.business_status})</p>
                <p><strong>Documents:</strong> {documents.length} uploaded</p>
              </div>
            </>
          )}

          {/* Step 5: Submit */}
          {currentStep === 5 && (
            <>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '1rem' }}>Submit Application</h3>
              {isSubmitted ? (
                <div className="alert alert--success">
                  <CheckCircle2 size={16} />
                  Your demo application has been submitted successfully.
                </div>
              ) : (
                <>
                  <div className="alert alert--warning mb-4">
                    {t('application.prototype_note', language)}
                  </div>
                  <button className="btn btn--green btn--lg btn--full" onClick={submitDemo}>
                    <Check size={16} /> {t('application.submit_demo', language)}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Step Navigation */}
        {!isSubmitted && (
          <div className="card__footer" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn--ghost" onClick={() => goToStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1}>
              Previous
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {saving && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{t('application.saved', language)}</span>}
              {currentStep < 5 && (
                <button className="btn btn--primary" onClick={() => goToStep(currentStep + 1)}>
                  Next <Check size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
