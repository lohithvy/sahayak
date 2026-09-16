import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { t, LANGUAGES } from '../i18n';
import { INDIAN_STATES, BUSINESS_TYPES, BUSINESS_CATEGORIES, DOCUMENT_TYPES } from '../utils/constants';
import { AshokaPillar } from '../components/Layout';
import { Check, Upload, ChevronRight, ChevronLeft } from 'lucide-react';

const TOTAL_STEPS = 5;

export default function Onboarding() {
  const { user } = useAuth();
  const { profile, updateProfile, language, setLanguage, uploadDocument, documents } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: '', dob: '', gender: '', preferred_language: 'en',
    state: '', district: '', residence_type: '',
    community_category: '', minority_status: false, disability_status: false,
    disability_percentage: 0, employment_status: '', annual_income: '',
    marital_status: '',
    business_status: '', business_type: '', business_category: '',
    business_location: '', business_stage: '', investment_required: '',
    capital_required: '', udyam_registered: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing profile data
  useEffect(() => {
    if (profile) {
      setForm(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(profile).filter(([k, v]) => v !== null && k in prev)
        )
      }));
      if (profile.onboarding_step && profile.onboarding_step > 1) {
        setStep(profile.onboarding_step);
      }
      if (profile.onboarding_completed) {
        navigate('/dashboard');
      }
    }
  }, [profile, navigate]);

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const saveProgress = useCallback(async (currentStep, completed = false) => {
    setSaving(true);
    setError('');
    try {
      const updates = {
        ...form,
        annual_income: form.annual_income ? Number(form.annual_income) : null,
        investment_required: form.investment_required ? Number(form.investment_required) : null,
        capital_required: form.capital_required ? Number(form.capital_required) : null,
        disability_percentage: form.disability_percentage ? Number(form.disability_percentage) : 0,
        onboarding_step: currentStep,
        onboarding_completed: completed,
      };
      // Calculate profile completion
      const fields = ['full_name', 'dob', 'gender', 'preferred_language', 'state', 'district',
        'residence_type', 'community_category', 'employment_status', 'annual_income',
        'business_status', 'business_type', 'business_category'];
      const filled = fields.filter(f => updates[f] !== null && updates[f] !== '' && updates[f] !== undefined);
      updates.profile_completion_percentage = Math.round((filled.length / fields.length) * 100);

      await updateProfile(updates);
    } catch (e) {
      setError('Unable to save. Please retry.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [form, updateProfile]);

  const nextStep = async () => {
    await saveProgress(step + 1);
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const prevStep = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  const completeOnboarding = async () => {
    await saveProgress(TOTAL_STEPS, true);
    navigate('/dashboard');
  };

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File size must be under 10MB.');
      return;
    }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF, JPG, and PNG files are allowed.');
      return;
    }
    try {
      setError('');
      await uploadDocument(file, docType);
    } catch (e) {
      setError('Upload failed. Please try again.');
    }
  };

  const lang = form.preferred_language || language;

  const stepLabels = [
    t('onboarding.basic', lang),
    t('onboarding.eligibility', lang),
    t('onboarding.business', lang),
    t('onboarding.documents', lang),
    t('onboarding.review', lang),
  ];

  return (
    <div className="app-layout" style={{ background: 'var(--color-off-white)', minHeight: '100vh' }}>
      {/* Compact header for onboarding */}
      <div className="gov-topbar">
        <div className="gov-topbar__inner">
          <div className="gov-topbar__left">
            <span>{t('app.prototype', lang)}</span>
          </div>
          <div className="gov-topbar__right"></div>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <AshokaPillar size={48} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--color-navy)', marginTop: '0.5rem' }}>
            {t('onboarding.title', lang)}
          </h1>
          {profile && !profile.onboarding_completed && profile.onboarding_step > 1 && (
            <div className="alert alert--info mt-3" style={{ textAlign: 'left' }}>
              {t('onboarding.incomplete', lang)}
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="progress-steps" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isCompleted = step > stepNum;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && <div className={`progress-step__connector ${isCompleted ? 'progress-step__connector--completed' : ''}`} />}
                <div className={`progress-step ${isActive ? 'progress-step--active' : ''} ${isCompleted ? 'progress-step--completed' : ''}`}>
                  <div className="progress-step__number">
                    {isCompleted ? <Check size={14} /> : stepNum}
                  </div>
                  <span className="visually-hidden">{label}</span>
                  <span style={{ display: 'none' }} className="progress-step-label">{label}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {t('onboarding.step', lang)} {step} {t('onboarding.of', lang)} {TOTAL_STEPS} — {stepLabels[step - 1]}
        </div>

        {error && <div className="alert alert--error mb-4">{error}</div>}

        {/* Form Card */}
        <div className="card">
          <div className="card__body" style={{ padding: '1.5rem' }}>

            {/* Step 1: Basic Identity */}
            {step === 1 && (
              <>
                <div className="form-group">
                  <label className="form-label form-label--required" htmlFor="full_name">{t('form.full_name', lang)}</label>
                  <input id="full_name" className="form-input" value={form.full_name} onChange={e => updateField('full_name', e.target.value)} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label form-label--required" htmlFor="dob">{t('form.dob', lang)}</label>
                    <input id="dob" type="date" className="form-input" value={form.dob || ''} onChange={e => updateField('dob', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label--required" htmlFor="gender">{t('form.gender', lang)}</label>
                    <select id="gender" className="form-select" value={form.gender} onChange={e => updateField('gender', e.target.value)}>
                      <option value="">{t('form.select', lang)}</option>
                      <option value="male">{t('form.male', lang)}</option>
                      <option value="female">{t('form.female', lang)}</option>
                      <option value="other">{t('form.other', lang)}</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label form-label--required" htmlFor="preferred_language">{t('form.language', lang)}</label>
                  <select id="preferred_language" className="form-select" value={form.preferred_language}
                    onChange={e => { updateField('preferred_language', e.target.value); setLanguage(e.target.value); }}>
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.nativeName} ({l.name})</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label form-label--required" htmlFor="state">{t('form.state', lang)}</label>
                    <select id="state" className="form-select" value={form.state} onChange={e => updateField('state', e.target.value)}>
                      <option value="">{t('form.select', lang)}</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="district">{t('form.district', lang)}</label>
                    <input id="district" className="form-input" value={form.district} onChange={e => updateField('district', e.target.value)} placeholder="e.g. Chennai" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label form-label--required">{t('form.residence_type', lang)}</label>
                  <div className="form-radio-group">
                    <label className="form-radio-label">
                      <input type="radio" name="residence" value="urban" checked={form.residence_type === 'urban'} onChange={e => updateField('residence_type', e.target.value)} />
                      {t('form.urban', lang)}
                    </label>
                    <label className="form-radio-label">
                      <input type="radio" name="residence" value="rural" checked={form.residence_type === 'rural'} onChange={e => updateField('residence_type', e.target.value)} />
                      {t('form.rural', lang)}
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Eligibility Profile */}
            {step === 2 && (
              <>
                <div className="form-group">
                  <label className="form-label form-label--required" htmlFor="community_category">{t('form.community_category', lang)}</label>
                  <select id="community_category" className="form-select" value={form.community_category} onChange={e => updateField('community_category', e.target.value)}>
                    <option value="">{t('form.select', lang)}</option>
                    <option value="general">{t('form.general', lang)}</option>
                    <option value="sc">{t('form.sc', lang)}</option>
                    <option value="st">{t('form.st', lang)}</option>
                    <option value="obc">{t('form.obc', lang)}</option>
                    <option value="ews">{t('form.ews', lang)}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.minority_status', lang)}</label>
                  <div className="form-radio-group">
                    <label className="form-radio-label">
                      <input type="radio" name="minority" value="true" checked={form.minority_status === true} onChange={() => updateField('minority_status', true)} />
                      {t('form.yes', lang)}
                    </label>
                    <label className="form-radio-label">
                      <input type="radio" name="minority" value="false" checked={form.minority_status === false} onChange={() => updateField('minority_status', false)} />
                      {t('form.no', lang)}
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.disability_status', lang)}</label>
                  <div className="form-radio-group">
                    <label className="form-radio-label">
                      <input type="radio" name="disability" value="true" checked={form.disability_status === true} onChange={() => updateField('disability_status', true)} />
                      {t('form.yes', lang)}
                    </label>
                    <label className="form-radio-label">
                      <input type="radio" name="disability" value="false" checked={form.disability_status === false} onChange={() => updateField('disability_status', false)} />
                      {t('form.no', lang)}
                    </label>
                  </div>
                </div>
                {form.disability_status && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="disability_pct">{t('form.disability_percentage', lang)}</label>
                    <input id="disability_pct" type="number" className="form-input" min="0" max="100"
                      value={form.disability_percentage} onChange={e => updateField('disability_percentage', e.target.value)} />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label form-label--required" htmlFor="employment_status">{t('form.employment_status', lang)}</label>
                    <select id="employment_status" className="form-select" value={form.employment_status} onChange={e => updateField('employment_status', e.target.value)}>
                      <option value="">{t('form.select', lang)}</option>
                      <option value="employed">{t('form.employed', lang)}</option>
                      <option value="self_employed">{t('form.self_employed', lang)}</option>
                      <option value="unemployed">{t('form.unemployed', lang)}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label--required" htmlFor="annual_income">{t('form.annual_income', lang)}</label>
                    <input id="annual_income" type="number" className="form-input" value={form.annual_income} onChange={e => updateField('annual_income', e.target.value)} placeholder="e.g. 200000" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="marital_status">{t('form.marital_status', lang)}</label>
                  <select id="marital_status" className="form-select" value={form.marital_status} onChange={e => updateField('marital_status', e.target.value)}>
                    <option value="">{t('form.select', lang)}</option>
                    <option value="single">{t('form.single', lang)}</option>
                    <option value="married">{t('form.married', lang)}</option>
                    <option value="widowed">{t('form.widowed', lang)}</option>
                    <option value="divorced">{t('form.divorced', lang)}</option>
                  </select>
                </div>
              </>
            )}

            {/* Step 3: Business Details */}
            {step === 3 && (
              <>
                <div className="form-group">
                  <label className="form-label form-label--required">{t('form.business_status', lang)}</label>
                  <div className="form-radio-group">
                    <label className="form-radio-label">
                      <input type="radio" name="biz_status" value="starting" checked={form.business_status === 'starting'} onChange={e => updateField('business_status', e.target.value)} />
                      {t('form.starting', lang)}
                    </label>
                    <label className="form-radio-label">
                      <input type="radio" name="biz_status" value="existing" checked={form.business_status === 'existing'} onChange={e => updateField('business_status', e.target.value)} />
                      {t('form.existing', lang)}
                    </label>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label form-label--required" htmlFor="business_type">{t('form.business_type', lang)}</label>
                    <select id="business_type" className="form-select" value={form.business_type} onChange={e => updateField('business_type', e.target.value)}>
                      <option value="">{t('form.select', lang)}</option>
                      {BUSINESS_TYPES.map(bt => <option key={bt} value={bt}>{bt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="business_category">{t('form.business_category', lang)}</label>
                    <select id="business_category" className="form-select" value={form.business_category} onChange={e => updateField('business_category', e.target.value)}>
                      <option value="">{t('form.select', lang)}</option>
                      {BUSINESS_CATEGORIES.map(bc => <option key={bc} value={bc}>{bc}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="business_location">{t('form.business_location', lang)}</label>
                  <input id="business_location" className="form-input" value={form.business_location} onChange={e => updateField('business_location', e.target.value)} placeholder="e.g. Chennai, Tamil Nadu" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="business_stage">{t('form.business_stage', lang)}</label>
                  <select id="business_stage" className="form-select" value={form.business_stage} onChange={e => updateField('business_stage', e.target.value)}>
                    <option value="">{t('form.select', lang)}</option>
                    <option value="idea">{t('form.idea', lang)}</option>
                    <option value="early">{t('form.early', lang)}</option>
                    <option value="growing">{t('form.growing', lang)}</option>
                    <option value="established">{t('form.established', lang)}</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="investment_required">{t('form.investment_required', lang)}</label>
                    <input id="investment_required" type="number" className="form-input" value={form.investment_required} onChange={e => updateField('investment_required', e.target.value)} placeholder="e.g. 200000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="capital_required">{t('form.capital_required', lang)}</label>
                    <input id="capital_required" type="number" className="form-input" value={form.capital_required} onChange={e => updateField('capital_required', e.target.value)} placeholder="e.g. 200000" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('form.udyam_registered', lang)}</label>
                  <div className="form-radio-group">
                    <label className="form-radio-label">
                      <input type="radio" name="udyam" value="true" checked={form.udyam_registered === true} onChange={() => updateField('udyam_registered', true)} />
                      {t('form.yes', lang)}
                    </label>
                    <label className="form-radio-label">
                      <input type="radio" name="udyam" value="false" checked={form.udyam_registered === false} onChange={() => updateField('udyam_registered', false)} />
                      {t('form.no', lang)}
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Documents */}
            {step === 4 && (
              <>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Upload applicable documents. You can also upload later from your profile. Accepted formats: PDF, JPG, PNG (max 10MB).
                </p>
                {DOCUMENT_TYPES.map(doc => {
                  const uploaded = documents.find(d => d.document_type === doc.key);
                  return (
                    <div key={doc.key} className="doc-card" style={{ marginBottom: '0.75rem' }}>
                      <div className="doc-card__icon">
                        {uploaded ? <Check size={18} /> : <Upload size={18} />}
                      </div>
                      <div className="doc-card__info">
                        <div className="doc-card__name">{doc.label}</div>
                        {uploaded ? (
                          <span className="status-tag status-tag--uploaded">{t('doc.uploaded', lang)}</span>
                        ) : (
                          <span className="status-tag status-tag--missing">{t('doc.missing', lang)}</span>
                        )}
                      </div>
                      <div className="doc-card__actions">
                        {!uploaded && (
                          <label className="btn btn--sm btn--secondary" style={{ cursor: 'pointer' }}>
                            <Upload size={12} /> {t('doc.upload', lang)}
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                              onChange={e => handleFileUpload(e, doc.key)} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
              <>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '1rem' }}>Review Your Information</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {[
                    ['Full Name', form.full_name],
                    ['Date of Birth', form.dob],
                    ['Gender', form.gender],
                    ['Language', LANGUAGES.find(l => l.code === form.preferred_language)?.nativeName],
                    ['State', form.state],
                    ['District', form.district],
                    ['Area Type', form.residence_type],
                    ['Community Category', form.community_category?.toUpperCase()],
                    ['Minority Status', form.minority_status ? 'Yes' : 'No'],
                    ['Disability Status', form.disability_status ? `Yes (${form.disability_percentage}%)` : 'No'],
                    ['Employment', form.employment_status],
                    ['Annual Income', form.annual_income ? `₹${Number(form.annual_income).toLocaleString('en-IN')}` : '—'],
                    ['Business Status', form.business_status],
                    ['Business Type', form.business_type],
                    ['Business Category', form.business_category],
                    ['Business Location', form.business_location],
                    ['Business Stage', form.business_stage],
                    ['Capital Required', form.capital_required ? `₹${Number(form.capital_required).toLocaleString('en-IN')}` : '—'],
                    ['Udyam Registered', form.udyam_registered ? 'Yes' : 'No'],
                    ['Documents Uploaded', `${documents.length} document(s)`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-100)', padding: '0.5rem 0' }}>
                      <span style={{ width: '180px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="alert alert--info mt-4">
                  You can edit your information anytime from the Profile page.
                </div>
              </>
            )}
          </div>

          {/* Navigation Footer */}
          <div className="card__footer" style={{ justifyContent: 'space-between' }}>
            <button
              className="btn btn--ghost"
              onClick={prevStep}
              disabled={step === 1}
            >
              <ChevronLeft size={16} /> {t('onboarding.prev', lang)}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {saving && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{t('application.saved', lang)}</span>}
              {step < TOTAL_STEPS ? (
                <button className="btn btn--primary" onClick={nextStep} disabled={saving}>
                  {t('onboarding.next', lang)} <ChevronRight size={16} />
                </button>
              ) : (
                <button className="btn btn--green btn--lg" onClick={completeOnboarding} disabled={saving}>
                  <Check size={16} /> {t('onboarding.complete', lang)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
