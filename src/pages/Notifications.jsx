import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { timeAgo } from '../utils/constants';
import { useNavigate } from 'react-router-dom';
import { Bell, FileText, AlertTriangle, Users, Briefcase, MessageSquare, Info, CheckCircle2 } from 'lucide-react';

export default function Notifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadCount, language } = useApp();
  const navigate = useNavigate();

  const typeIcons = {
    incomplete_application: <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />,
    missing_document: <FileText size={16} style={{ color: 'var(--color-error)' }} />,
    scheme_update: <Info size={16} style={{ color: 'var(--color-info)' }} />,
    group_match: <Users size={16} style={{ color: 'var(--color-blue)' }} />,
    waiting_list_update: <Users size={16} style={{ color: 'var(--color-blue)' }} />,
    new_opportunity: <Briefcase size={16} style={{ color: 'var(--color-saffron)' }} />,
    system: <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />,
    message: <MessageSquare size={16} style={{ color: 'var(--color-blue)' }} />,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">{t('notif.title', language)}</h1>
          <p className="page-subtitle">{t('notif.subtitle', language)}</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn--sm btn--secondary" onClick={markAllNotificationsRead}>
            {t('notif.mark_all_read', language)} ({unreadCount})
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} className="empty-state__icon" />
          <p className="empty-state__text">{t('notif.no_notifications', language)}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`card ${!notif.is_read ? 'card--hover' : ''}`}
              style={{
                cursor: notif.target_url ? 'pointer' : 'default',
                background: !notif.is_read ? 'var(--color-blue-pale)' : 'var(--color-white)',
                borderLeft: !notif.is_read ? '3px solid var(--color-blue)' : undefined,
              }}
              onClick={() => {
                markNotificationRead(notif.id);
                if (notif.target_url) navigate(notif.target_url);
              }}
            >
              <div className="card__body" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem 1rem' }}>
                <div style={{ marginTop: '2px' }}>
                  {typeIcons[notif.type] || <Bell size={16} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: notif.is_read ? 400 : 600, fontSize: 'var(--text-sm)' }}>{notif.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>{notif.message}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>{timeAgo(notif.created_at)}</div>
                </div>
                {!notif.is_read && (
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={(e) => { e.stopPropagation(); markNotificationRead(notif.id); }}
                  >
                    {t('notif.mark_read', language)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
