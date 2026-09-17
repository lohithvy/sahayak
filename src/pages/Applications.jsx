import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../services/supabase';
import { t } from '../i18n';
import { timeAgo } from '../utils/constants';
import { 
  FileText, Clock, ChevronRight, AlertTriangle, CheckCircle2, 
  AlertCircle, RefreshCw, UserCheck 
} from 'lucide-react';

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }
  const prefix = localPart.slice(0, 2);
  const suffix = localPart.slice(-1);
  return `${prefix}***${suffix}@${domain}`;
}

export default function Applications() {
  const { user } = useAuth();
  const { language } = useApp();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApplications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('applications')
        .select('*, schemes(name, ministry, benefit)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (queryError) {
        console.error('[Applications Query Error]:', queryError);
        setError(queryError.message || 'Failed to fetch applications from server.');
        setApplications([]);
      } else {
        setApplications(data || []);
      }
    } catch (err) {
      console.error('[Applications Network/Unexpected Error]:', err);
      setError(err?.message || 'A network error occurred while loading applications.');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const statusConfig = {
    started: { label: t('application.started', language), color: 'info', icon: <FileText size={14} /> },
    in_progress: { label: t('application.in_progress', language), color: 'more-info', icon: <Clock size={14} /> },
    documents_pending: { label: t('application.documents_pending', language), color: 'more-info', icon: <AlertTriangle size={14} /> },
    review: { label: t('application.review', language), color: 'more-info', icon: <Clock size={14} /> },
    submitted_demo: { label: t('application.submitted', language), color: 'eligible', icon: <CheckCircle2 size={14} /> },
  };

  const renderHeader = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <div>
        <h1 className="page-title">{t('nav.applications', language)}</h1>
        <p className="page-subtitle">{t('application.track_subtitle', language) || 'Track your government scheme applications and progress'}</p>
      </div>

      {user?.email && (
        <div 
          title={`Authenticated as ${user.email}`}
          style={{ 
            fontSize: 'var(--text-xs)', 
            color: 'var(--text-secondary)',
            background: 'var(--color-gray-100)',
            border: '1px solid var(--color-gray-200)',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontWeight: 500,
          }}
        >
          <UserCheck size={13} style={{ color: 'var(--color-green, #16a34a)' }} />
          <span>{t('application.account', language) || 'Account'}:</span>
          <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{maskEmail(user.email)}</span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div>
        {renderHeader()}
        <div className="loading-spinner" style={{ minHeight: '260px' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {renderHeader()}
        <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', borderColor: 'var(--color-error)' }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '0.85rem', 
            borderRadius: '50%', 
            background: 'var(--color-error-bg)', 
            color: 'var(--color-error)', 
            marginBottom: '1rem' 
          }}>
            <AlertCircle size={36} />
          </div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-error)', marginBottom: '0.5rem' }}>
            {t('application.error_loading', language) || 'Unable to load applications'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '520px', margin: '0 auto 1.5rem', wordBreak: 'break-word' }}>
            {error}
          </p>
          <button 
            type="button" 
            className="btn btn--primary" 
            onClick={fetchApplications}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}
          >
            <RefreshCw size={15} />
            {t('common.retry', language) || 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderHeader()}

      {applications.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} className="empty-state__icon" />
          <p className="empty-state__text">{t('application.no_applications', language)}</p>
          <Link to="/dashboard" className="btn btn--primary mt-4">
            {t('application.browse_schemes', language) || 'Browse Schemes'}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {applications.map(app => {
            const config = statusConfig[app.status] || statusConfig.started;
            return (
              <div 
                key={app.id} 
                className="card card--hover" 
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/applications/${app.id}`)}
              >
                <div className="card__body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{app.schemes?.name || 'Unknown Scheme'}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{app.schemes?.ministry}</div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
                      <span className={`status-tag status-tag--${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {t('application.updated', language)} {timeAgo(app.updated_at)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-blue)' }}>{app.progress_percentage}%</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{t('application.progress', language)}</div>
                    </div>
                    <ChevronRight size={20} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
                {app.status !== 'submitted_demo' && app.progress_percentage < 100 && (
                  <div className="card__footer" style={{ background: 'var(--color-warning-bg)', borderTop: '1px solid var(--color-warning)' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>
                      {t('application.incomplete', language)} {t('application.continue', language)} →
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
