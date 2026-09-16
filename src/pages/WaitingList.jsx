import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../services/supabase';
import { GroupService, getSafePublicId } from '../services/groupService';
import { t } from '../i18n';
import {
  Users, MapPin, MessageSquare, UserPlus, Plus, CheckCircle2,
  Clock, ShieldCheck, X, Crown, Globe
} from 'lucide-react';

export default function WaitingList() {
  const { user } = useAuth();
  const { profile, language } = useApp();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'people' | 'my_groups'
  const [groups, setGroups] = useState([]);
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [myMemberships, setMyMemberships] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedGroupForJoin, setSelectedGroupForJoin] = useState(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [managingGroupId, setManagingGroupId] = useState(null);
  const [groupRequests, setGroupRequests] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const [newGroup, setNewGroup] = useState({
    title: '',
    description: '',
    location: '',
    required_members: 5,
    scheme_id: '',
  });

  // Ensure current user has public profile synced
  useEffect(() => {
    if (user && profile) {
      GroupService.syncPublicProfile(user, profile);
    }
  }, [user, profile]);

  // Main data fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch groups
      const groupData = await GroupService.fetchGroups();
      setGroups(groupData);

      // 2. Fetch public profiles
      const profileData = await GroupService.fetchPublicProfiles(user?.id);
      setPublicProfiles(profileData);

      // 3. Fetch waiting list
      const waitData = await GroupService.fetchWaitingList();
      setWaitingList(waitData);

      // 4. Fetch collective schemes
      const { data: schemeData } = await supabase
        .from('schemes')
        .select('id, name, ministry, required_members')
        .eq('is_active', true);
      setSchemes(schemeData || []);

      // 5. User-specific memberships and requests
      if (user) {
        const { data: memData } = await supabase
          .from('group_members')
          .select('group_id, role, status')
          .eq('user_id', user.id)
          .eq('status', 'active');
        setMyMemberships(memData || []);

        const reqData = await GroupService.fetchUserPendingRequests(user.id);
        setPendingRequests(reqData);
      }
    } catch (e) {
      console.error('Error fetching waiting list data:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open manage requests modal for creator
  const openManageRequests = async (groupId) => {
    setManagingGroupId(groupId);
    try {
      const requests = await GroupService.fetchJoinRequests(groupId);
      setGroupRequests(requests);
    } catch (e) {
      console.warn('Could not load group requests:', e);
      setGroupRequests([]);
    }
  };

  // Accept or decline join request
  const handleRequestResponse = async (requestId, requesterId, action, groupTitle) => {
    if (!managingGroupId) return;
    setSubmitting(true);
    try {
      await GroupService.respondToJoinRequest(requestId, managingGroupId, requesterId, action, groupTitle);
      setActionSuccess(`Request ${action === 'accept' ? 'accepted' : 'declined'} successfully.`);
      setTimeout(() => setActionSuccess(''), 3500);

      // Refresh requests list and groups
      const updatedRequests = await GroupService.fetchJoinRequests(managingGroupId);
      setGroupRequests(updatedRequests);
      fetchData();
    } catch (e) {
      alert('Action could not be completed: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit join request
  const submitJoinRequest = async () => {
    if (!user || !selectedGroupForJoin) return;
    setSubmitting(true);
    try {
      await GroupService.requestToJoin(
        selectedGroupForJoin.id,
        user.id,
        selectedGroupForJoin.creator_user_id,
        selectedGroupForJoin.title || selectedGroupForJoin.schemes?.name,
        joinMessage
      );

      setActionSuccess('Join request sent to the group creator!');
      setTimeout(() => setActionSuccess(''), 4000);
      setSelectedGroupForJoin(null);
      setJoinMessage('');
      fetchData();
    } catch (e) {
      alert('Could not submit join request: ' + (e.message || 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Create new group
  const handleCreateGroup = async () => {
    if (!user || !newGroup.title.trim()) return;
    setSubmitting(true);
    try {
      await GroupService.createGroup(user.id, {
        ...newGroup,
        location: newGroup.location || profile?.district || 'Tamil Nadu',
      });

      setShowCreate(false);
      setNewGroup({ title: '', description: '', location: '', required_members: 5, scheme_id: '' });
      setActionSuccess('New collective group created successfully!');
      setTimeout(() => setActionSuccess(''), 4000);
      fetchData();
    } catch (e) {
      alert('Error creating group: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Join waiting list directly
  const handleJoinWaitingList = async () => {
    if (!user) return;
    try {
      await GroupService.joinWaitingList(
        user.id,
        schemes[0]?.id || null,
        profile?.business_type || 'General Business',
        profile?.district || 'Tamil Nadu'
      );
      setActionSuccess('You have been added to the public Waiting List!');
      setTimeout(() => setActionSuccess(''), 4000);
      fetchData();
    } catch (e) {
      alert('Could not join waiting list: ' + e.message);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const myGroupIds = myMemberships.map(m => m.group_id);
  const pendingGroupIds = pendingRequests.map(r => r.group_id);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">{t('waiting.title', language)}</h1>
          <p className="page-subtitle">Form groups for collective schemes, connect with fellow entrepreneurs, and apply together.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn--secondary" onClick={handleJoinWaitingList}>
            <Users size={14} /> Join Waiting List
          </button>
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> {t('group.create', language)}
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="card" style={{ background: 'var(--color-success-bg, #f0fdf4)', borderLeft: '4px solid var(--color-success)', marginBottom: '1rem' }}>
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', fontWeight: 600 }}>{actionSuccess}</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', gap: '1rem' }}>
        <button
          onClick={() => setActiveTab('groups')}
          style={{
            padding: '0.75rem 0.5rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'groups' ? '3px solid var(--color-blue)' : '3px solid transparent',
            color: activeTab === 'groups' ? 'var(--color-blue)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'groups' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Users size={16} /> Collective Groups ({groups.length})
        </button>

        <button
          onClick={() => setActiveTab('people')}
          style={{
            padding: '0.75rem 0.5rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'people' ? '3px solid var(--color-blue)' : '3px solid transparent',
            color: activeTab === 'people' ? 'var(--color-blue)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'people' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <ShieldCheck size={16} /> Entrepreneurs Seeking Groups ({publicProfiles.length})
        </button>

        <button
          onClick={() => setActiveTab('my_groups')}
          style={{
            padding: '0.75rem 0.5rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'my_groups' ? '3px solid var(--color-blue)' : '3px solid transparent',
            color: activeTab === 'my_groups' ? 'var(--color-blue)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'my_groups' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Crown size={16} /> My Groups & Memberships ({myMemberships.length})
        </button>
      </div>

      {/* TAB 1: COLLECTIVE GROUPS */}
      {activeTab === 'groups' && (
        <div>
          {groups.length === 0 ? (
            <div className="empty-state">
              <Users size={48} className="empty-state__icon" />
              <p className="empty-state__text">No active collective groups currently forming.</p>
              <button className="btn btn--primary mt-4" onClick={() => setShowCreate(true)}>Create the First Group</button>
            </div>
          ) : (
            <div className="scheme-grid">
              {groups.map(group => {
                const isCreator = user && group.creator_user_id === user.id;
                const isMember = user && myGroupIds.includes(group.id);
                const hasPending = user && pendingGroupIds.includes(group.id);
                const isReady = group.current_members >= group.required_members;

                return (
                  <div key={group.id} className="group-card" style={{ borderTop: isReady ? '4px solid var(--color-success)' : '4px solid var(--color-blue)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div className="group-card__title">{group.title || group.schemes?.name || 'Collective Scheme Group'}</div>
                      {isReady ? (
                        <span className="status-tag status-tag--eligible" style={{ fontSize: '10px' }}>
                          Ready to Apply
                        </span>
                      ) : (
                        <span className="status-tag status-tag--more-info" style={{ fontSize: '10px' }}>
                          Forming
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
                      {group.schemes?.name ? `${group.schemes.name} • ` : ''}{group.schemes?.ministry || 'Ministry of MSME'}
                    </div>

                    {group.description && (
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                        {group.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      <MapPin size={13} style={{ color: 'var(--text-tertiary)' }} />
                      <span>{group.location || 'Tamil Nadu'}</span>
                      <span style={{ margin: '0 4px' }}>•</span>
                      <span>Creator: <strong>{getSafePublicId(group.creator_user_id)}</strong></span>
                    </div>

                    {/* Member Slots Counter */}
                    <div className="group-card__members" style={{ margin: '0.75rem 0' }}>
                      {Array.from({ length: group.required_members }).map((_, i) => (
                        <div
                          key={i}
                          className={`group-card__member ${i < group.current_members ? 'group-card__member--filled' : 'group-card__member--empty'}`}
                          title={i < group.current_members ? `Member ${i + 1} Joined` : 'Open Slot'}
                        >
                          {i < group.current_members ? (i + 1) : '?'}
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        <strong>{group.current_members} / {group.required_members}</strong> Members
                      </span>
                      <span style={{ color: isReady ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 600 }}>
                        {isReady ? 'Group Ready to Apply' : `${group.required_members - group.current_members} more needed`}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      {/* 1. Group Chat Button (for members or creator) */}
                      {(isMember || isCreator) ? (
                        <>
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => navigate(`/messages?groupId=${group.id}`)}
                          >
                            <MessageSquare size={13} /> Open Group Chat
                          </button>
                          {isCreator && (
                            <button
                              className="btn btn--sm btn--secondary"
                              onClick={() => openManageRequests(group.id)}
                            >
                              Requests
                            </button>
                          )}
                          {isReady && (
                            <Link
                              to={group.scheme_id ? `/schemes/${group.scheme_id}` : '/dashboard'}
                              className="btn btn--sm btn--secondary"
                            >
                              Continue Application →
                            </Link>
                          )}
                        </>
                      ) : hasPending ? (
                        /* 2. Pending join request */
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                          <span className="status-tag status-tag--more-info" style={{ flex: 1 }}>
                            <Clock size={12} /> Join Request Sent
                          </span>
                          <button
                            className="btn btn--sm btn--ghost"
                            onClick={() => navigate(`/messages?userId=${group.creator_user_id}`)}
                          >
                            <MessageSquare size={13} /> Message
                          </button>
                        </div>
                      ) : (
                        /* 3. Non-member: Request to join or Message creator */
                        <>
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => setSelectedGroupForJoin(group)}
                            disabled={isReady}
                          >
                            <UserPlus size={13} /> {isReady ? 'Group Full' : 'Request to Join'}
                          </button>
                          <button
                            className="btn btn--sm btn--ghost"
                            onClick={() => navigate(`/messages?userId=${group.creator_user_id}`)}
                          >
                            <MessageSquare size={13} /> Message Creator
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ENTREPRENEURS LOOKING FOR GROUPS */}
      {activeTab === 'people' && (
        <div>
          {publicProfiles.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck size={48} className="empty-state__icon" />
              <p className="empty-state__text">No other entrepreneurs listed right now.</p>
              <button className="btn btn--primary mt-4" onClick={handleJoinWaitingList}>Add My Profile to Waiting List</button>
            </div>
          ) : (
            <div className="scheme-grid">
              {publicProfiles.map(person => {
                const safeId = person.public_id || getSafePublicId(person.user_id);
                return (
                  <div key={person.user_id} className="card card--hover">
                    <div className="card__body">
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: 'var(--color-blue-pale)', color: 'var(--color-blue)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 'var(--text-md)'
                        }}>
                          {(person.display_name || 'E')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: 'var(--text-md)' }}>
                            {person.display_name || 'Entrepreneur'}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-blue)', fontFamily: 'monospace' }}>
                            {safeId}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        <strong>Business:</strong> {person.business_type || 'General Enterprise'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                        <span><MapPin size={11} /> {person.district || 'Tamil Nadu'}</span>
                        <span><Globe size={11} /> {person.language?.toUpperCase() || 'EN'}</span>
                        {person.category_visibility && person.community_category && (
                          <span className="status-tag status-tag--info" style={{ fontSize: '10px' }}>
                            {person.community_category.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {person.bio && (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1rem', fontStyle: 'italic' }}>
                          "{person.bio}"
                        </p>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                        <button
                          className="btn btn--sm btn--secondary"
                          style={{ flex: 1 }}
                          onClick={() => setSelectedPerson(person)}
                        >
                          View Profile
                        </button>
                        <button
                          className="btn btn--sm btn--primary"
                          style={{ flex: 1 }}
                          onClick={() => navigate(`/messages?userId=${person.user_id}`)}
                        >
                          <MessageSquare size={13} /> Message
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY GROUPS & REQUESTS */}
      {activeTab === 'my_groups' && (
        <div>
          <h3 className="section-heading" style={{ marginBottom: '1rem' }}>Groups You Belong To</h3>
          {myMemberships.length === 0 ? (
            <div className="empty-state">
              <Users size={40} className="empty-state__icon" />
              <p className="empty-state__text">You haven't joined any groups yet.</p>
              <button className="btn btn--primary mt-4" onClick={() => setActiveTab('groups')}>Browse Groups</button>
            </div>
          ) : (
            <div className="scheme-grid">
              {groups.filter(g => myGroupIds.includes(g.id) || g.creator_user_id === user?.id).map(g => (
                <div key={g.id} className="card">
                  <div className="card__body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: 'var(--text-md)' }}>
                        {g.title || 'Collective Group'}
                      </div>
                      {g.creator_user_id === user?.id && (
                        <span className="status-tag status-tag--info" style={{ fontSize: '10px' }}>
                          <Crown size={10} /> Creator
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0.25rem 0 0.75rem' }}>
                      {g.location || 'Tamil Nadu'} • {g.current_members}/{g.required_members} Members
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        className="btn btn--sm btn--primary"
                        onClick={() => navigate(`/messages?groupId=${g.id}`)}
                      >
                        <MessageSquare size={13} /> Open Group Chat
                      </button>
                      {g.creator_user_id === user?.id && (
                        <button
                          className="btn btn--sm btn--secondary"
                          onClick={() => openManageRequests(g.id)}
                        >
                          Manage Requests
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: SAFE PUBLIC PROFILE DETAIL */}
      {selectedPerson && (
        <div className="modal-overlay" onClick={() => setSelectedPerson(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">Public Entrepreneur Profile</span>
              <button className="btn btn--sm btn--ghost" onClick={() => setSelectedPerson(null)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'var(--color-blue-pale)',
                  color: 'var(--color-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 'var(--text-xl)'
                }}>
                  {(selectedPerson.display_name || 'E')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-navy)' }}>
                    {selectedPerson.display_name || 'Entrepreneur'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-blue)', fontFamily: 'monospace' }}>
                    ID: {selectedPerson.public_id || getSafePublicId(selectedPerson.user_id)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', background: 'var(--color-gray-50)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Business Type</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{selectedPerson.business_type || 'General'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>District & State</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{selectedPerson.district || 'Chennai'}, {selectedPerson.state || 'TN'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Preferred Language</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{selectedPerson.language?.toUpperCase() || 'EN'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Status</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-success)' }}>Seeking Group</div>
                </div>
              </div>

              {selectedPerson.bio && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>Purpose & Notes</div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedPerson.bio}</p>
                </div>
              )}

              <div style={{ background: '#f8fafc', borderLeft: '3px solid var(--color-blue)', padding: '0.5rem 0.75rem', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Verified Public Profile. Sensitive documents, Aadhaar, and financials are kept strictly private.
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setSelectedPerson(null)}>Close</button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  const id = selectedPerson.user_id;
                  setSelectedPerson(null);
                  navigate(`/messages?userId=${id}`);
                }}
              >
                <MessageSquare size={14} /> Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST TO JOIN GROUP */}
      {selectedGroupForJoin && (
        <div className="modal-overlay" onClick={() => setSelectedGroupForJoin(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">Request to Join Group</span>
              <button className="btn btn--sm btn--ghost" onClick={() => setSelectedGroupForJoin(null)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '0.25rem' }}>
                {selectedGroupForJoin.title}
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                {selectedGroupForJoin.schemes?.name || 'Collective Scheme'} • {selectedGroupForJoin.location}
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Message for Group Creator (optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={joinMessage}
                  onChange={e => setJoinMessage(e.target.value)}
                  placeholder="Introduce yourself, your trade, or why you want to collaborate..."
                />
              </div>

              <div style={{ background: 'var(--color-blue-pale)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--color-navy)' }}>
                Once you send this request, the creator ({getSafePublicId(selectedGroupForJoin.creator_user_id)}) will receive a notification to Accept or Decline. Upon acceptance, you'll be automatically enrolled into the group and group chat.
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setSelectedGroupForJoin(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={submitJoinRequest} disabled={submitting}>
                {submitting ? 'Sending Request...' : 'Submit Join Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MANAGE JOIN REQUESTS (FOR CREATOR) */}
      {managingGroupId && (
        <div className="modal-overlay" onClick={() => setManagingGroupId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">Manage Group Join Requests</span>
              <button className="btn btn--sm btn--ghost" onClick={() => setManagingGroupId(null)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              {groupRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-tertiary)' }}>
                  <Users size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                  <p>No pending join requests for this group.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {groupRequests.map(req => {
                    const profileData = req.public_group_profiles;
                    const safeId = profileData?.public_id || getSafePublicId(req.user_id);
                    return (
                      <div key={req.id} className="card" style={{ background: 'var(--color-gray-50)' }}>
                        <div className="card__body" style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: 'var(--text-sm)' }}>
                                {profileData?.display_name || 'Entrepreneur'}
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-blue)', fontFamily: 'monospace' }}>
                                {safeId} • {profileData?.business_type || 'General'} • {profileData?.district || 'TN'}
                              </div>
                            </div>
                            <span className="status-tag status-tag--more-info" style={{ fontSize: '10px' }}>Pending</span>
                          </div>

                          {req.message && (
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                              "{req.message}"
                            </p>
                          )}

                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn--sm btn--ghost"
                              onClick={() => handleRequestResponse(req.id, req.user_id, 'decline', 'Your Group')}
                              disabled={submitting}
                            >
                              Decline
                            </button>
                            <button
                              className="btn btn--sm btn--primary"
                              onClick={() => handleRequestResponse(req.id, req.user_id, 'accept', 'Your Group')}
                              disabled={submitting}
                            >
                              Accept to Group
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setManagingGroupId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE GROUP FORM */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">{t('group.create', language)}</span>
              <button className="btn btn--sm btn--ghost" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <div className="form-group">
                <label className="form-label">Group Title *</label>
                <input
                  className="form-input"
                  value={newGroup.title}
                  onChange={e => setNewGroup({ ...newGroup, title: e.target.value })}
                  placeholder="e.g. Chennai Women Tailors Collective"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Scheme (Optional)</label>
                <select
                  className="form-select"
                  value={newGroup.scheme_id}
                  onChange={e => setNewGroup({ ...newGroup, scheme_id: e.target.value })}
                >
                  <option value="">Select a scheme or general collective</option>
                  {schemes.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Location / District</label>
                  <input
                    className="form-input"
                    value={newGroup.location}
                    onChange={e => setNewGroup({ ...newGroup, location: e.target.value })}
                    placeholder="e.g. Chennai"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Members Needed</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newGroup.required_members}
                    onChange={e => setNewGroup({ ...newGroup, required_members: parseInt(e.target.value, 10) || 5 })}
                    min="2"
                    max="25"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Group Objective & Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={newGroup.description}
                  onChange={e => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="Explain what type of business, skills, or cooperation you are seeking..."
                />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="btn btn--primary"
                onClick={handleCreateGroup}
                disabled={submitting || !newGroup.title.trim()}
              >
                {submitting ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
