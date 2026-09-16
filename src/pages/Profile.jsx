import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { t, LANGUAGES } from '../i18n';
import { INDIAN_STATES, BUSINESS_TYPES, BUSINESS_CATEGORIES, DOCUMENT_TYPES } from '../utils/constants';
import { EligibilityEngine } from '../services/eligibility';
import { Edit3, Save, Upload, Check, User, Shield, FileText, Globe, Briefcase, Heart } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const {
    profile, documents, language, setLanguage,
    updateProfile, uploadDocument, getDocumentSignedUrl, deleteDocument
  } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [error, setError] = useState('');

  const startEdit = () => {
    setForm({ ...profile });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError('');
    try {
      const updates = { ...form };
      if (updates.annual_income) updates.annual_income = Number(updates.annual_income);
      if (updates.investment_required) updates.investment_required = Number(updates.investment_required);
      if (updates.capital_required) updates.capital_required = Number(updates.capital_required);
      if (updates.disability_percentage) updates.disability_percentage = Number(updates.disability_percentage);
      updates.profile_completion_percentage = EligibilityEngine.calculateProfileCompletion(updates);
      await updateProfile(updates);
      setEditing(false);
    } catch (e) {
      setError('Unable to save. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Max 10MB.'); return; }
    try {
      setError('');
      await uploadDocument(file, docType);
    } catch (e) {
      setError('Upload failed.');
    }
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const profileCompletion = EligibilityEngine.calculateProfileCompletion(profile);

  const tabs = [
    { id: 'personal', label: t('profile.personal', language), icon: <User size={14} /> },
    { id: 'eligibility', label: t('profile.eligibility', language), icon: <Heart size={14} /> },
    { id: 'business', label: t('profile.business', language), icon: <Briefcase size={14} /> },
    { id: 'documents', label: t('profile.documents', language), icon: <FileText size={14} /> },
    { id: 'language', label: t('profile.language', language), icon: <Globe size={14} /> },
    { id: 'security', label: t('profile.security', language), icon: <Shield size={14} /> },
  ];

  const renderField = (label, field, type = 'text', options = null) => {
    const value = editing ? (form[field] ?? '') : (profile?.[field] ?? '');
    if (!editing) {
      let display = value;
      if (typeof value === 'boolean') display = value ? 'Yes' : 'No';
      if (field === 'annual_income' && value) display = `₹${Number(value).toLocaleString('en-IN')}`;
      if (field === 'community_category' && value) display = value.toUpperCase();
      if (field === 'preferred_language') display = LANGUAGES.find(l => l.code === value)?.nativeName || value;
      return (
        <div style={{ display: 'flex', padding: '0.5rem 0', borderBottom: '1px solid var(--color-gray-100)' }}>
          <span style={{ width: '180px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: 'var(--text-sm)' }}>{display || '—'}</span>
        </div>
      );
    }

    return (
      <div className="form-group">
        <label className="form-label" htmlFor={field}>{label}</label>
        {type === 'select' && options ? (
          <select id={field} className="form-select" value={value} onChange={e => updateField(field, e.target.value)}>
            <option value="">Select...</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : type === 'boolean' ? (
          <div className="form-radio-group">
            <label className="form-radio-label"><input type="radio" checked={value === true} onChange={() => updateField(field, true)} /> Yes</label>
            <label className="form-radio-label"><input type="radio" checked={value === false} onChange={() => updateField(field, false)} /> No</label>
          </div>
        ) : (
          <input id={field} type={type} className="form-input" value={value} onChange={e => updateField(field, e.target.value)} />
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">{t('profile.title', language)}</h1>
          <p className="page-subtitle">{t('profile.eligibility_profile', language)}</p>
        </div>
        {!editing ? (
          <button className="btn btn--secondary" onClick={startEdit}><Edit3 size={14} /> {t('profile.edit', language)}</button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn--primary" onClick={saveEdit} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving...' : t('profile.save', language)}
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert--error mb-4">{error}</div>}

      {/* Profile Completion */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card__body">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '0.5rem' }}>
            <span>{t('profile.completion', language)}</span>
            <span style={{ fontWeight: 600 }}>{profileCompletion}%</span>
          </div>
          <div className="completion-meter__bar">
            <div className="completion-meter__fill" style={{ width: `${profileCompletion}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card__body" style={{ padding: '1.5rem' }}>
          {activeTab === 'personal' && (
            <>
              {renderField(t('form.full_name', language), 'full_name')}
              {renderField(t('form.dob', language), 'dob', 'date')}
              {renderField(t('form.gender', language), 'gender', 'select', [
                { value: 'male', label: t('form.male', language) },
                { value: 'female', label: t('form.female', language) },
                { value: 'other', label: t('form.other', language) },
              ])}
              {renderField(t('form.state', language), 'state', 'select', INDIAN_STATES.map(s => ({ value: s, label: s })))}
              {renderField(t('form.district', language), 'district')}
              {renderField(t('form.residence_type', language), 'residence_type', 'select', [
                { value: 'urban', label: t('form.urban', language) },
                { value: 'rural', label: t('form.rural', language) },
              ])}
              {renderField(t('form.marital_status', language), 'marital_status', 'select', [
                { value: 'single', label: t('form.single', language) },
                { value: 'married', label: t('form.married', language) },
                { value: 'widowed', label: t('form.widowed', language) },
                { value: 'divorced', label: t('form.divorced', language) },
              ])}
            </>
          )}

          {activeTab === 'eligibility' && (
            <>
              {renderField(t('form.community_category', language), 'community_category', 'select', [
                { value: 'general', label: t('form.general', language) },
                { value: 'sc', label: t('form.sc', language) },
                { value: 'st', label: t('form.st', language) },
                { value: 'obc', label: t('form.obc', language) },
                { value: 'ews', label: t('form.ews', language) },
              ])}
              {renderField(t('form.minority_status', language), 'minority_status', 'boolean')}
              {renderField(t('form.disability_status', language), 'disability_status', 'boolean')}
              {(editing ? form.disability_status : profile?.disability_status) && renderField(t('form.disability_percentage', language), 'disability_percentage', 'number')}
              {renderField(t('form.employment_status', language), 'employment_status', 'select', [
                { value: 'employed', label: t('form.employed', language) },
                { value: 'self_employed', label: t('form.self_employed', language) },
                { value: 'unemployed', label: t('form.unemployed', language) },
              ])}
              {renderField(t('form.annual_income', language), 'annual_income', 'number')}
            </>
          )}

          {activeTab === 'business' && (
            <>
              {renderField(t('form.business_status', language), 'business_status', 'select', [
                { value: 'starting', label: t('form.starting', language) },
                { value: 'existing', label: t('form.existing', language) },
              ])}
              {renderField(t('form.business_type', language), 'business_type', 'select', BUSINESS_TYPES.map(bt => ({ value: bt, label: bt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })))}
              {renderField(t('form.business_category', language), 'business_category', 'select', BUSINESS_CATEGORIES.map(bc => ({ value: bc, label: bc })))}
              {renderField(t('form.business_location', language), 'business_location')}
              {renderField(t('form.business_stage', language), 'business_stage', 'select', [
                { value: 'idea', label: t('form.idea', language) },
                { value: 'early', label: t('form.early', language) },
                { value: 'growing', label: t('form.growing', language) },
                { value: 'established', label: t('form.established', language) },
              ])}
              {renderField(t('form.investment_required', language), 'investment_required', 'number')}
              {renderField(t('form.capital_required', language), 'capital_required', 'number')}
              {renderField(t('form.udyam_registered', language), 'udyam_registered', 'boolean')}
            </>
          )}

          {activeTab === 'documents' && (
            <>
              {DOCUMENT_TYPES.map(doc => {
                const uploaded = documents.find(d => d.document_type === doc.key);
                return (
                  <div key={doc.key} className="doc-card" style={{ marginBottom: '0.75rem' }}>
                    <div className="doc-card__icon" style={{
                      background: uploaded ? 'var(--color-success-bg)' : 'var(--color-gray-100)',
                      color: uploaded ? 'var(--color-success)' : 'var(--text-tertiary)',
                    }}>
                      {uploaded ? <Check size={18} /> : <Upload size={18} />}
                    </div>
                    <div className="doc-card__info">
                      <div className="doc-card__name">{doc.label}</div>
                      {uploaded ? (
                        <>
                          <span className="status-tag status-tag--uploaded">{t('doc.uploaded', language)}</span>
                          {uploaded.file_name && <span className="doc-card__masked">{uploaded.file_name}</span>}
                          {uploaded.masked_identifier && <span className="doc-card__masked">{uploaded.masked_identifier}</span>}
                        </>
                      ) : (
                        <span className="status-tag status-tag--missing">{t('doc.missing', language)}</span>
                      )}
                    </div>
                    <div className="doc-card__actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {uploaded && (
                        <button
                          className="btn btn--sm btn--ghost"
                          onClick={async () => {
                            if (uploaded.file_path) {
                              const url = await getDocumentSignedUrl(uploaded.file_path);
                              if (url) window.open(url, '_blank', 'noopener,noreferrer');
                              else alert('Unable to open document.');
                            }
                          }}
                        >
                          View
                        </button>
                      )}
                      <label className="btn btn--sm btn--secondary" style={{ cursor: 'pointer' }}>
                        <Upload size={12} /> {uploaded ? 'Replace' : t('doc.upload', language)}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                          onChange={e => handleFileUpload(e, doc.key)} />
                      </label>
                      {uploaded && (
                        <button
                          className="btn btn--sm btn--ghost"
                          style={{ color: 'var(--color-error)' }}
                          onClick={async () => {
                            if (window.confirm(`Delete ${doc.label}?`)) {
                              await deleteDocument(uploaded.id, uploaded.file_path);
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {activeTab === 'language' && (
            <>
              <div className="form-group">
                <label className="form-label">{t('form.language', language)}</label>
                <select className="form-select" value={language}
                  onChange={e => { setLanguage(e.target.value); if (editing) updateField('preferred_language', e.target.value); }}>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.nativeName} ({l.name})</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'security' && (
            <>
              <div style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Email</span>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{user?.email}</div>
              </div>
              <div style={{ padding: '0.5rem 0' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Account Created</span>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{new Date(user?.created_at).toLocaleDateString()}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
