import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { formatDate } from '../utils/constants';
import { Shield, Database, FileText, Users, Bell, Clock, ExternalLink } from 'lucide-react';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [schemes, setSchemes] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    async function fetch() {
      // Get counts
      const [schemesRes, appsRes, oppsRes, notifsRes, groupsRes, usersRes] = await Promise.all([
        supabase.from('schemes').select('id', { count: 'exact', head: true }),
        supabase.from('applications').select('id', { count: 'exact', head: true }),
        supabase.from('government_opportunities').select('id', { count: 'exact', head: true }),
        supabase.from('notifications').select('id', { count: 'exact', head: true }),
        supabase.from('group_schemes').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        schemes: schemesRes.count || 0,
        applications: appsRes.count || 0,
        opportunities: oppsRes.count || 0,
        notifications: notifsRes.count || 0,
        groups: groupsRes.count || 0,
        users: usersRes.count || 0,
      });

      const { data: schemesData } = await supabase.from('schemes').select('*').order('created_at', { ascending: false });
      setSchemes(schemesData || []);

      const { data: oppsData } = await supabase.from('government_opportunities').select('*').order('created_at', { ascending: false });
      setOpportunities(oppsData || []);
    }
    fetch();
  }, []);

  const statCards = [
    { label: 'Schemes', value: stats.schemes, icon: <Database size={20} />, color: 'var(--color-blue)' },
    { label: 'Applications', value: stats.applications, icon: <FileText size={20} />, color: 'var(--color-green)' },
    { label: 'Opportunities', value: stats.opportunities, icon: <ExternalLink size={20} />, color: 'var(--color-saffron)' },
    { label: 'Groups', value: stats.groups, icon: <Users size={20} />, color: 'var(--color-navy)' },
    { label: 'Notifications', value: stats.notifications, icon: <Bell size={20} />, color: 'var(--color-warning)' },
    { label: 'Users', value: stats.users, icon: <Shield size={20} />, color: 'var(--color-error)' },
  ];

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle mb-4">Internal view for debugging and demo control. SIH prototype admin panel.</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {statCards.map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
            <div className="card__body" style={{ padding: '1rem' }}>
              <div style={{ color: stat.color, marginBottom: '0.5rem' }}>{stat.icon}</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>{stat.value}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'tab--active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`tab ${activeTab === 'schemes' ? 'tab--active' : ''}`} onClick={() => setActiveTab('schemes')}>Schemes ({stats.schemes})</button>
        <button className={`tab ${activeTab === 'opportunities' ? 'tab--active' : ''}`} onClick={() => setActiveTab('opportunities')}>Opportunities ({stats.opportunities})</button>
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <div className="card__body">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              This admin panel provides an overview of all data in the Sahayak prototype. Use it to verify scheme data, check application counts, and manage demo content.
            </p>
            <div className="alert alert--info mt-3">
              <Shield size={14} /> This page is for internal demo/debug use only. Not exposed to regular users.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schemes' && (
        <div className="card">
          <div className="card__body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Ministry</th>
                    <th>Type</th>
                    <th>State</th>
                    <th>Source</th>
                    <th>Last Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {schemes.map(s => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/schemes/${s.id}`)}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td>{s.ministry}</td>
                      <td><span className="status-tag status-tag--info">{s.scheme_type}</span></td>
                      <td>{s.state || 'Central'}</td>
                      <td>{s.source_type}</td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{formatDate(s.last_verified_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="card">
          <div className="card__body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Department</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Deadline</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 500 }}>{o.title}</td>
                      <td>{o.department}</td>
                      <td>{o.category}</td>
                      <td>{o.location}</td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{formatDate(o.deadline)}</td>
                      <td>{o.source_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
