import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../services/supabase';
import { GroupService, getSafePublicId } from '../services/groupService';
import { t } from '../i18n';
import {
  Users, MapPin, MessageSquare, UserPlus, Plus, CheckCircle2,
  Clock, ShieldCheck, X, Crown, Globe, AlertCircle, AlertTriangle
} from 'lucide-react';

export default function WaitingList() {
  const { user } = useAuth();
  const { profile, language } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'people' | 'my_groups'
  const [groups, setGroups] = useState([]);
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [waitingList, setWaitingList] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [myMemberships, setMyMemberships] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
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
  const [createError, setCreateError] = useState('');

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

      // 5. User-specific memberships and join requests
      if (user) {
        const { data: memData } = await supabase
          .from('group_members')
          .select('group_id, role, status')
          .eq('user_id', user.id)
          .eq('status', 'active');
        setMyMemberships(memData || []);

        const reqData = await GroupService.fetchUserJoinRequests(user.id);
        setUserRequests(reqData);
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

  // Handle URL query parameters (e.g. /waiting-list?schemeId=xxx&create=true)
  useEffect(() => {
    const qSchemeId = searchParams.get('schemeId');
    const qCreate = searchParams.get('create');

    if (qSchemeId) {
      const matchingScheme = schemes.find(s => s.id === qSchemeId);
      setNewGroup(prev => ({
        ...prev,
        scheme_id: qSchemeId,
        title: prev.title || (matchingScheme ? `${matchingScheme.name} Collective` : ''),
        required_members: matchingScheme?.required_members > 1 ? matchingScheme.required_members : (prev.required_members || 5),
      }));
      if (qCreate === 'true' || qCreate === '1') {
        setShowCreate(true);
      }
    }
  }, [searchParams, schemes]);

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
    if (!user || !selectedGroupForJoin || submitting) return;
    setSubmitting(true);
    try {
      const res = await GroupService.requestToJoin(
        selectedGroupForJoin.id,
        user.id,
        selectedGroupForJoin.creator_user_id,
        selectedGroupForJoin.title || selectedGroupForJoin.schemes?.name,
        joinMessage
      );

      setActionSuccess(res?.message || 'Join request sent to the group creator!');
      setTimeout(() => setActionSuccess(''), 4000);
      setSelectedGroupForJoin(null);
      setJoinMessage('');
      await fetchData();
    } catch (e) {
      console.error('submitJoinRequest error:', e);
      alert('Could not submit join request: ' + (e.message || 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Create new group
  const handleCreateGroup = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!newGroup.scheme_id || !newGroup.scheme_id.trim()) {
      setCreateError('Please select a scheme before creating a group.');
      return;
    }

    if (!newGroup.title.trim()) {
      setCreateError('Please enter a title for your group.');
      return;
    }

    setCreateError('');
    setSubmitting(true);
    try {
      await GroupService.createGroup(user.id, {
        ...newGroup,
        scheme_id: newGroup.scheme_id.trim(),
        location: newGroup.location || profile?.district || 'Tamil Nadu',
      });

      setShowCreate(false);
      setNewGroup({ title: '', description: '', location: '', required_members: 5, scheme_id: '' });
      setActionSuccess('Collective group created successfully!');
      setTimeout(() => setActionSuccess(''), 4000);
      await fetchData();
    } catch (e) {
      setCreateError('Could not create group: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Join general waiting list
  const handleJoinWaitingList = async () => {
    if (!user) return;
    try {
      await GroupService.addToWaitingList(user.id, {
        notes: profile?.business_type ? `Entrepreneur working in ${profile.business_type}` : 'Seeking collective collaboration',
        business_type: profile?.business_type,
        district: profile?.district,
      });
      setActionSuccess('You have been added to the waiting list!');
      setTimeout(() => setActionSuccess(''), 4000);
      await fetchData();
    } catch (e) {
      alert('Could not join waiting list: ' + e.message);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const myGroupIds = myMemberships.map(m => m.group_id);
  const acceptedGroupIds = userRequests.filter(r => r.status === 'accepted').map(r => r.group_id);
  const allJoinedGroupIds = [...new Set([...myGroupIds, ...acceptedGroupIds])];
  const pendingGroupIds = userRequests.filter(r => r.status === 'pending').map(r => r.group_id);
  const declinedGroupIds = userRequests.filter(r => r.status === 'declined').map(r => r.group_id);

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
          <button className="btn btn--primary" onClick={() => { setCreateError(''); setShowCreate(true); }}>
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
          <Crown size={16} /> My Groups & Memberships ({allJoinedGroupIds.length})
        </button>
      </div>

      {/* TAB 1: COLLECTIVE GROUPS */}
      {activeTab === 'groups' && (
        <div>
          {groups.length === 0 ? (
            <div className="empty-state">
              <Users size={48} className="empty-state__icon" />
              <p className="empty-state__text">No active collective groups currently forming.</p>
              <button className="btn btn--primary mt-4" onClick={() => { setCreateError(''); setShowCreate(true); }}>Create the First Group</button>
            </div>
          ) : (
            <div className="scheme-grid">
              {groups.map(group => {
                const isCreator = user && group.creator_user_id === user.id;
                const isMember = user && allJoinedGroupIds.includes(group.id);
                const userReq = user && userRequests.find(r => r.group_id === group.id);
                const requestStatus = userReq?.status;
                const hasPending = user && requestStatus === 'pending';
                const isDeclined = user && requestStatus === 'declined';
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
                      {/* 1. Member or Creator -> Open Group Chat */}
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
                        /* 2. Pending join request -> Show status and Message creator */
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                          <span className="status-tag status-tag--more-info" style={{ flex: 1 }}>
                            <Clock size={12} /> Request Pending
                          </span>
                          <button
                            className="btn btn--sm btn--ghost"
                            onClick={() => navigate(`/messages?userId=${group.creator_user_id}`)}
                          >
                            <MessageSquare size={13} /> Message
                          </button>
                        </div>
                      ) : isDeclined ? (
                        /* 3. Declined join request -> Allow Request Again */
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                          <span className="status-tag status-tag--missing" style={{ flex: 1 }}>
                            <AlertTriangle size={12} /> Request Declined
                          </span>
                          <button
                            className="btn btn--sm btn--secondary"
                            onClick={() => setSelectedGroupForJoin(group)}
                            disabled={isReady}
                          >
                            Request Again
                          </button>
                        </div>
                      ) : (
                        /* 4. Non-member: Request to join or Message creator */
                        <>
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => {
                              if (!user) {
                                navigate('/login');
                                return;
                              }
                              setSelectedGroupForJoin(group);
                            }}
                            disabled={isReady || submitting}
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
          {allJoinedGroupIds.length === 0 && !groups.some(g => g.creator_user_id === user?.id) ? (
            <div className="empty-state">
              <Users size={40} className="empty-state__icon" />
              <p className="empty-state__text">You haven't joined any groups yet.</p>
              <button className="btn btn--primary mt-4" onClick={() => setActiveTab('groups')}>Browse Groups</button>
            </div>
          ) : (
            <div className="scheme-grid">
              {groups.filter(g => allJoinedGroupIds.includes(g.id) || g.creator_user_id === user?.id).map(g => (
                <div key={g.id} className="card">
                  <div className="card__body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: 'var(--text-md)' }}>
                        {g.title || 'Collective Group'}
                      </div>
                      {g.creator_user_id === user?.id ? (
                        <span className="status-tag status-tag--info" style={{ fontSize: '10px' }}>
                          <Crown size={10} /> Creator
                        </span>
                      ) : (
                        <span className="status-tag status-tag--eligible" style={{ fontSize: '10px' }}>
                          <CheckCircle2 size={10} /> Member
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

          {/* Sub-section: Pending Requests */}
          {pendingGroupIds.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3 className="section-heading" style={{ marginBottom: '1rem' }}>Pending Requests ({pendingGroupIds.length})</h3>
              <div className="scheme-grid">
                {groups.filter(g => pendingGroupIds.includes(g.id)).map(g => (
                  <div key={g.id} className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                    <div className="card__body">
                      <div style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: 'var(--text-md)' }}>
                        {g.title || 'Collective Group'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0.25rem 0 0.75rem' }}>
                        {g.location || 'Tamil Nadu'} • Creator: {getSafePublicId(g.creator_user_id)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span className="status-tag status-tag--more-info" style={{ fontSize: '11px' }}>
                          <Clock size={11} /> Request Pending
                        </span>
                        <button
                          className="btn btn--sm btn--ghost"
                          onClick={() => navigate(`/messages?userId=${g.creator_user_id}`)}
                        >
                          <MessageSquare size={13} /> Message Creator
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-section: Declined Requests */}
          {declinedGroupIds.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3 className="section-heading" style={{ marginBottom: '1rem' }}>Declined Requests ({declinedGroupIds.length})</h3>
              <div className="scheme-grid">
                {groups.filter(g => declinedGroupIds.includes(g.id)).map(g => (
                  <div key={g.id} className="card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
                    <div className="card__body">
                      <div style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: 'var(--text-md)' }}>
                        {g.title || 'Collective Group'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0.25rem 0 0.75rem' }}>
                        {g.location || 'Tamil Nadu'} • Creator: {getSafePublicId(g.creator_user_id)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span className="status-tag status-tag--missing" style={{ fontSize: '11px' }}>
                          <AlertTriangle size={11} /> Request Declined
                        </span>
                        <button
                          className="btn btn--sm btn--secondary"
                          onClick={() => setSelectedGroupForJoin(g)}
                          disabled={submitting}
                        >
                          Request Again
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
      {selectedGroupForJoin && (() => {
        const isDeclined = declinedGroupIds.includes(selectedGroupForJoin.id);
        return (
          <div className="modal-overlay" onClick={() => setSelectedGroupForJoin(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <span className="modal__title">
                  {isDeclined ? 'Request Again to Join Group' : 'Request to Join Group'}
                </span>
                <button className="btn btn--sm btn--ghost" onClick={() => setSelectedGroupForJoin(null)}><X size={18} /></button>
              </div>
              <div className="modal__body">
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '0.25rem' }}>
                  {selectedGroupForJoin.title}
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                  {selectedGroupForJoin.schemes?.name || 'Collective Scheme'} • {selectedGroupForJoin.location}
                </p>

                {isDeclined && (
                  <div className="alert alert--warning mb-3" style={{ fontSize: 'var(--text-xs)' }}>
                    Your previous request for this group was declined. You can send an updated message to request again.
                  </div>
                )}

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
                  {submitting ? 'Submitting...' : (isDeclined ? 'Send Request Again' : 'Submit Join Request')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                    const requesterId = req.requester_id || req.user_id;
                    const safeId = profileData?.public_id || getSafePublicId(requesterId);
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
                              onClick={() => handleRequestResponse(req.id, requesterId, 'decline', 'Your Group')}
                              disabled={submitting}
                            >
                              Decline
                            </button>
                            <button
                              className="btn btn--sm btn--primary"
                              onClick={() => handleRequestResponse(req.id, requesterId, 'accept', 'Your Group')}
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
              {createError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  background: 'var(--color-error-bg, #fef2f2)',
                  border: '1px solid var(--color-error, #ef4444)',
                  borderRadius: 'var(--border-radius, 6px)',
                  color: 'var(--color-error, #b91c1c)',
                  fontSize: 'var(--text-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 500,
                }}>
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Target Scheme * <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 400 }}>(Required — every group belongs to a real scheme)</span>
                </label>
                <select
                  className="form-select"
                  value={newGroup.scheme_id}
                  onChange={e => {
                    const sId = e.target.value;
                    const selScheme = schemes.find(s => s.id === sId);
                    setNewGroup(prev => ({
                      ...prev,
                      scheme_id: sId,
                      title: !prev.title || schemes.some(s => prev.title === `${s.name} Collective`)
                        ? (selScheme ? `${selScheme.name} Collective` : prev.title)
                        : prev.title,
                      required_members: selScheme?.required_members > 1 ? selScheme.required_members : (prev.required_members || 5),
                    }));
                    if (sId) setCreateError('');
                  }}
                  required
                >
                  <option value="">-- Please select a scheme --</option>
                  {schemes.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.ministry ? `(${s.ministry})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Group Title *</label>
                <input
                  className="form-input"
                  value={newGroup.title}
                  onChange={e => {
                    setNewGroup({ ...newGroup, title: e.target.value });
                    if (e.target.value.trim()) setCreateError('');
                  }}
                  placeholder="e.g. Chennai Women Tailors Collective"
                  required
                />
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
                disabled={submitting || !newGroup.title.trim() || !newGroup.scheme_id}
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
