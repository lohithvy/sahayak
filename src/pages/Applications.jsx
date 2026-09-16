import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../services/supabase';
import { t } from '../i18n';
import { timeAgo } from '../utils/constants';
import { FileText, Clock, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Applications() {
  const { user } = useAuth();
  const { language } = useApp();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      if (!user) return;
      const { data } = await supabase.from('applications')
        .select('*, schemes(name, ministry, benefit)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      setApplications(data || []);
      setLoading(false);
    }
    fetch();
  }, [user]);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const statusConfig = {
    started: { label: t('application.started', language), color: 'info', icon: <FileText size={14} /> },
    in_progress: { label: t('application.in_progress', language), color: 'more-info', icon: <Clock size={14} /> },
    documents_pending: { label: t('application.documents_pending', language), color: 'more-info', icon: <AlertTriangle size={14} /> },
    review: { label: t('application.review', language), color: 'more-info', icon: <Clock size={14} /> },
    submitted_demo: { label: t('application.submitted', language), color: 'eligible', icon: <CheckCircle2 size={14} /> },
  };

  return (
    <div>
      <h1 className="page-title">{t('nav.applications', language)}</h1>
      <p className="page-subtitle mb-4">{t('application.track_subtitle', language)}</p>

      {applications.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} className="empty-state__icon" />
          <p className="empty-state__text">{t('application.no_applications', language)}</p>
          <Link to="/dashboard" className="btn btn--primary mt-4">{t('application.browse_schemes', language)}</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {applications.map(app => {
            const config = statusConfig[app.status] || statusConfig.started;
            return (
              <div key={app.id} className="card card--hover" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/applications/${app.id}`)}>
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
