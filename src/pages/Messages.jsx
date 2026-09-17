import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../services/supabase';
import { GroupService, getSafePublicId } from '../services/groupService';
import { GeminiService } from '../services/gemini';
import { t, getLanguageEnglishName } from '../i18n';
import {
  Send, Globe, Users, User, Clock, ShieldCheck,
  CheckCheck, AlertCircle, ArrowLeft, MessageSquare
} from 'lucide-react';

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { language, profile } = useApp();

  // Active chat state: { type: 'direct' | 'group', id: string, data: object }
  const [activeChat, setActiveChat] = useState(null);

  // Lists of conversations
  const [directContacts, setDirectContacts] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOriginal, setShowOriginal] = useState({});
  const [translations, setTranslations] = useState({});
  const translatingRef = useRef(new Set());

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch all recent conversations (1-to-1 contacts & active groups)
  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch user's active groups
      let memberGroups = [];
      try {
        const { data: mg } = await supabase
          .from('group_members')
          .select('group_id, role, group_schemes(*, schemes(name))')
          .eq('user_id', user.id)
          .eq('status', 'active');
        memberGroups = mg || [];
      } catch (err) {
        console.warn('memberGroups fetch note:', err);
      }

      // Also fetch accepted join requests as membership fallback
      let acceptedGroups = [];
      try {
        const { data: reqs } = await supabase
          .from('join_requests')
          .select('group_id, group_schemes:group_id(*, schemes(name))')
          .eq('requester_id', user.id)
          .eq('status', 'accepted');
        acceptedGroups = reqs || [];
      } catch (err) {
        console.warn('accepted join_requests fetch note:', err);
      }

      let createdGroups = [];
      try {
        const { data: cg } = await supabase
          .from('group_schemes')
          .select('*, schemes(name)')
          .eq('creator_user_id', user.id);
        createdGroups = cg || [];
      } catch (err) {
        console.warn('createdGroups fetch note:', err);
      }

      const allGroupMap = new Map();
      (memberGroups || []).forEach(mg => {
        if (mg.group_schemes) allGroupMap.set(mg.group_schemes.id, mg.group_schemes);
      });
      (acceptedGroups || []).forEach(ag => {
        if (ag.group_schemes) allGroupMap.set(ag.group_schemes.id, ag.group_schemes);
      });
      (createdGroups || []).forEach(cg => {
        allGroupMap.set(cg.id, cg);
      });

      const userGroups = Array.from(allGroupMap.values());
      setGroupChats(userGroups);

      // 2. Fetch 1-to-1 messages to identify contacts
      const { data: msgHistory } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, created_at, original_message, group_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      const contactMap = new Map();
      (msgHistory || []).forEach(msg => {
        if (msg.group_id) return; // Skip group messages
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (otherId && otherId !== user.id && !contactMap.has(otherId)) {
          contactMap.set(otherId, {
            userId: otherId,
            lastMessage: msg.original_message,
            timestamp: msg.created_at,
          });
        }
      });

      // Fetch public profiles and preferred languages for contacts
      const otherIds = Array.from(contactMap.keys());
      if (otherIds.length > 0) {
        const [profilesRes, langsMap] = await Promise.all([
          supabase.from('public_group_profiles').select('*').in('user_id', otherIds),
          GroupService.getUsersPreferredLanguages(otherIds),
        ]);

        const profiles = profilesRes.data || [];
        const profileMap = new Map(profiles.map(p => [p.user_id, p]));
        const formattedContacts = otherIds.map(id => {
          const prof = profileMap.get(id);
          const meta = contactMap.get(id);
          const resolvedLang = langsMap.get(id) || prof?.language || 'en';
          return {
            user_id: id,
            display_name: prof?.display_name || 'Entrepreneur',
            public_id: prof?.public_id || getSafePublicId(id),
            business_type: prof?.business_type || 'General',
            district: prof?.district || 'Tamil Nadu',
            language: resolvedLang,
            preferred_language: resolvedLang,
            lastMessage: meta?.lastMessage,
            timestamp: meta?.timestamp,
          };
        });
        setDirectContacts(formattedContacts);
      } else {
        setDirectContacts([]);
      }
    } catch (e) {
      console.warn('Error loading conversations:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle URL query parameters (?userId=xxx or ?groupId=yyy)
  useEffect(() => {
    const qUserId = searchParams.get('userId') || routeParams.userId;
    const qGroupId = searchParams.get('groupId') || routeParams.groupId;

    if (qGroupId) {
      const targetGroup = groupChats.find(g => g.id === qGroupId);
      if (targetGroup) {
        setActiveChat({ type: 'group', id: targetGroup.id, data: targetGroup });
        return;
      } else {
        // Direct fetch if not yet loaded in groupChats
        supabase
          .from('group_schemes')
          .select('*, schemes(name)')
          .eq('id', qGroupId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setActiveChat({ type: 'group', id: data.id, data });
            }
          })
          .catch(() => {});
      }
    }

    if (qUserId && user && qUserId !== user.id) {
      // If contact already loaded
      const existing = directContacts.find(c => c.user_id === qUserId);
      if (existing) {
        setActiveChat({ type: 'direct', id: existing.user_id, data: existing });
      } else {
        // Fetch public profile and resolved preferred language for new contact
        Promise.all([
          supabase.from('public_group_profiles').select('*').eq('user_id', qUserId).maybeSingle(),
          GroupService.getUserPreferredLanguage(qUserId)
        ]).then(([{ data }, resolvedLang]) => {
          const newContact = {
            user_id: qUserId,
            display_name: data?.display_name || 'Entrepreneur',
            public_id: data?.public_id || getSafePublicId(qUserId),
            business_type: data?.business_type || 'General',
            district: data?.district || 'Tamil Nadu',
            language: resolvedLang || data?.language || 'en',
            preferred_language: resolvedLang || data?.language || 'en',
          };
          setActiveChat({ type: 'direct', id: qUserId, data: newContact });
        });
      }
    } else if (!activeChat && (groupChats.length > 0 || directContacts.length > 0)) {
      // Default to first group or first contact
      if (groupChats.length > 0) {
        setActiveChat({ type: 'group', id: groupChats[0].id, data: groupChats[0] });
      } else if (directContacts.length > 0) {
        setActiveChat({ type: 'direct', id: directContacts[0].user_id, data: directContacts[0] });
      }
    }
  }, [searchParams, routeParams, groupChats, directContacts, user]);

  // Helper to translate and cache a message for the viewer's preferred language
  const resolveTranslation = useCallback(async (msg, targetLang) => {
    if (!msg?.id || !targetLang || !msg?.original_message) return;
    const origLang = msg.original_language || 'en';
    if (origLang === targetLang) return;

    const cacheKey = `${msg.id}_${targetLang}`;
    if (translatingRef.current.has(cacheKey)) return;
    translatingRef.current.add(cacheKey);

    try {
      // 1. Direct message target match check
      if (msg.target_language === targetLang && msg.translated_message) {
        setTranslations(prev => ({ ...prev, [msg.id]: msg.translated_message }));
        return;
      }

      // 2. Fetch from message_translations table
      const cachedMap = await GroupService.fetchMessageTranslations([msg.id], targetLang);
      if (cachedMap.has(msg.id)) {
        setTranslations(prev => ({ ...prev, [msg.id]: cachedMap.get(msg.id) }));
        return;
      }

      // 3. Call server-side Gemini translation
      const translated = await GeminiService.translateText(msg.original_message, origLang, targetLang);
      if (translated && translated !== msg.original_message) {
        setTranslations(prev => ({ ...prev, [msg.id]: translated }));
        await GroupService.saveMessageTranslation(msg.id, targetLang, translated);
      }
    } catch (err) {
      console.warn('resolveTranslation note:', err);
    } finally {
      translatingRef.current.delete(cacheKey);
    }
  }, []);

  // Fetch messages when activeChat changes and subscribe to Realtime
  useEffect(() => {
    if (!activeChat || !user) return;

    let isMounted = true;
    const myLang = profile?.preferred_language || 'en';

    async function loadChatMessages() {
      let msgs = [];
      if (activeChat.type === 'direct') {
        msgs = await GroupService.fetch1to1Messages(user.id, activeChat.id);
      } else {
        msgs = await GroupService.fetchGroupMessages(activeChat.id);
      }
      if (!isMounted) return;
      setMessages(msgs);

      // Identify messages needing translation for viewer
      const needTranslations = msgs.filter(m =>
        m.sender_id !== user.id &&
        (m.original_language || 'en') !== myLang
      );

      if (needTranslations.length > 0) {
        const directMatches = {};
        const missingIds = [];

        needTranslations.forEach(m => {
          if (m.target_language === myLang && m.translated_message) {
            directMatches[m.id] = m.translated_message;
          } else {
            missingIds.push(m.id);
          }
        });

        if (Object.keys(directMatches).length > 0) {
          setTranslations(prev => ({ ...prev, ...directMatches }));
        }

        if (missingIds.length > 0) {
          // Batch fetch from message_translations table
          GroupService.fetchMessageTranslations(missingIds, myLang).then(cachedMap => {
            if (!isMounted) return;
            if (cachedMap.size > 0) {
              setTranslations(prev => {
                const next = { ...prev };
                cachedMap.forEach((val, k) => { next[k] = val; });
                return next;
              });
            }

            // Translate any still missing
            missingIds.forEach(id => {
              if (!cachedMap.has(id)) {
                const item = msgs.find(m => m.id === id);
                if (item) resolveTranslation(item, myLang);
              }
            });
          });
        }
      }
    }

    loadChatMessages();

    // Supabase Realtime Channel
    const channelName = activeChat.type === 'direct'
      ? `dm_${[user.id, activeChat.id].sort().join('_')}`
      : `group_${activeChat.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new;
          if (activeChat.type === 'direct') {
            if (
              (newMsg.sender_id === user.id && newMsg.receiver_id === activeChat.id) ||
              (newMsg.sender_id === activeChat.id && newMsg.receiver_id === user.id)
            ) {
              setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
              if (newMsg.receiver_id === user.id && myLang !== (newMsg.original_language || 'en')) {
                if (newMsg.target_language === myLang && newMsg.translated_message) {
                  setTranslations(prev => ({ ...prev, [newMsg.id]: newMsg.translated_message }));
                } else {
                  resolveTranslation(newMsg, myLang);
                }
              }
            }
          } else {
            if (newMsg.group_id === activeChat.id) {
              setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
              if (newMsg.sender_id !== user.id && myLang !== (newMsg.original_language || 'en')) {
                resolveTranslation(newMsg, myLang);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeChat, user, profile?.preferred_language, resolveTranslation]);

  // Send message
  const handleSendMessage = async () => {
    if (!input.trim() || !activeChat || sending || !user) return;
    setSending(true);
    const textToSend = input.trim();
    setInput('');

    try {
      const senderLang = profile?.preferred_language || 'en';

      if (activeChat.type === 'direct') {
        const receiverLang = activeChat.data?.preferred_language || 
          activeChat.data?.language || 
          (await GroupService.getUserPreferredLanguage(activeChat.id));

        const newMsg = await GroupService.send1to1Message(
          user.id,
          activeChat.id,
          textToSend,
          senderLang,
          receiverLang
        );
        if (newMsg) {
          setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        }
      } else {
        const newMsg = await GroupService.sendGroupMessage(
          user.id,
          activeChat.id,
          textToSend,
          senderLang
        );
        if (newMsg) {
          setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        }
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      alert('Message could not be sent: ' + (e.message || 'Please verify database connection.'));
    } finally {
      setSending(false);
    }
  };

  const toggleOriginal = (msgId) => {
    setShowOriginal(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '1rem' }}>
        <h1 className="page-title">{t('nav.messages', language)}</h1>
        <p className="page-subtitle">Communicate 1-to-1 or collaborate with collective scheme group members in real time.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '1rem',
        height: 'calc(100vh - 270px)',
        minHeight: '520px',
      }}>
        {/* SIDEBAR: CONVERSATIONS LIST */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card__header" style={{ padding: '0.75rem 1rem' }}>
            <span className="card__title" style={{ fontSize: 'var(--text-sm)' }}>Chats & Groups</span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* 1. Group Conversations Section */}
            <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Collective Groups ({groupChats.length})
            </div>

            {groupChats.length === 0 ? (
              <div style={{ padding: '0.5rem 1rem 1rem', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                No groups joined yet. Visit Waiting List to form or join a group.
              </div>
            ) : (
              groupChats.map(group => {
                const isSelected = activeChat?.type === 'group' && activeChat?.id === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      setActiveChat({ type: 'group', id: group.id, data: group });
                      setSearchParams({ groupId: group.id });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      width: '100%',
                      border: 'none',
                      background: isSelected ? 'var(--color-blue-pale)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--color-gray-100)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: '8px',
                      background: isSelected ? 'var(--color-blue)' : 'var(--color-blue-pale)',
                      color: isSelected ? '#fff' : 'var(--color-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Users size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: isSelected ? 600 : 500,
                        color: 'var(--color-navy)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {group.title || group.schemes?.name || 'Group Scheme'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {group.current_members}/{group.required_members} Members • {group.status}
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {/* 2. Direct 1-to-1 Messages Section */}
            <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderTop: '1px solid var(--border-color)' }}>
              Direct Messages ({directContacts.length})
            </div>

            {directContacts.length === 0 ? (
              <div style={{ padding: '0.5rem 1rem 1rem', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                No 1-to-1 chats yet. Click "Message" on any Waiting List profile to start.
              </div>
            ) : (
              directContacts.map(contact => {
                const isSelected = activeChat?.type === 'direct' && activeChat?.id === contact.user_id;
                return (
                  <button
                    key={contact.user_id}
                    onClick={() => {
                      setActiveChat({ type: 'direct', id: contact.user_id, data: contact });
                      setSearchParams({ userId: contact.user_id });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      width: '100%',
                      border: 'none',
                      background: isSelected ? 'var(--color-blue-pale)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--color-gray-100)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: isSelected ? 'var(--color-blue)' : 'var(--color-blue-pale)',
                      color: isSelected ? '#fff' : 'var(--color-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 'var(--text-sm)',
                      flexShrink: 0
                    }}>
                      {(contact.display_name || 'E')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: isSelected ? 600 : 500,
                        color: 'var(--color-navy)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {contact.display_name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'flex', gap: '0.5rem' }}>
                        <span>{contact.public_id}</span>
                        <span>•</span>
                        <span>{contact.district}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* MAIN CHAT WINDOW */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeChat ? (
            <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <MessageSquare size={48} className="empty-state__icon" />
              <p className="empty-state__text">Select a conversation or group chat to view messages.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={{
                padding: '0.75rem 1.25rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--color-white)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: activeChat.type === 'group' ? '8px' : '50%',
                    background: 'var(--color-blue-pale)',
                    color: 'var(--color-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}>
                    {activeChat.type === 'group' ? <Users size={18} /> : (activeChat.data?.display_name || 'E')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: 'var(--text-md)' }}>
                      {activeChat.type === 'group'
                        ? (activeChat.data?.title || activeChat.data?.schemes?.name || 'Group Chat')
                        : (activeChat.data?.display_name || 'Direct Conversation')}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {activeChat.type === 'group' ? (
                        <>
                          <span>{activeChat.data?.current_members} / {activeChat.data?.required_members} Members</span>
                          <span>•</span>
                          <span className={`status-tag status-tag--${activeChat.data?.status === 'ready' ? 'eligible' : 'more-info'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                            {activeChat.data?.status === 'ready' ? 'Ready to Apply' : 'Forming'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontFamily: 'monospace', color: 'var(--color-blue)' }}>
                            {activeChat.data?.public_id || getSafePublicId(activeChat.id)}
                          </span>
                          <span>•</span>
                          <span>{activeChat.data?.business_type || 'Entrepreneur'}</span>
                          <span>•</span>
                          <span><Globe size={11} style={{ verticalAlign: 'middle' }} /> {getLanguageEnglishName(activeChat.data?.preferred_language || activeChat.data?.language || 'en')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {activeChat.type === 'group' && (
                    <button
                      className="btn btn--sm btn--secondary"
                      onClick={() => navigate('/waiting-list')}
                    >
                      Group Details
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Message Stream */}
              <div
                ref={chatContainerRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1rem 1.25rem',
                  background: 'var(--color-gray-50)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {messages.length === 0 ? (
                  <div className="empty-state" style={{ margin: 'auto', padding: '2rem' }}>
                    <p className="empty-state__text">{t('msg.no_messages', language)}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                      {activeChat.type === 'group'
                        ? 'Say hello to your fellow group members!'
                        : 'Send a message to introduce yourself and start collaborating.'}
                    </p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isSender = msg.sender_id === user?.id;
                    const myLang = profile?.preferred_language || 'en';
                    const origLang = msg.original_language || 'en';
                    const isDiffLang = myLang !== origLang;

                    // Translation text resolution:
                    // 1. Direct message match for receiver's language
                    // 2. translations state (from message_translations or on-the-fly translate)
                    const translatedText = (msg.target_language === myLang && msg.translated_message)
                      || translations[msg.id]
                      || null;

                    const hasTranslation = !isSender && isDiffLang && translatedText && translatedText !== msg.original_message;
                    const showOrig = !!showOriginal[msg.id];

                    const displayMessage = isSender
                      ? msg.original_message
                      : (!isDiffLang
                          ? msg.original_message
                          : (showOrig ? msg.original_message : (translatedText || msg.original_message))
                        );

                    const timeStr = msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isSender ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {/* Show sender identity for group messages */}
                        {!isSender && activeChat.type === 'group' && (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '2px', marginLeft: '6px' }}>
                            {getSafePublicId(msg.sender_id)}
                          </div>
                        )}

                        <div className={`msg-bubble msg-bubble--${isSender ? 'sent' : 'received'}`} style={{ maxWidth: '75%' }}>
                          {showOrig ? (
                            <div>
                              <div style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: 'var(--color-navy)',
                                opacity: 0.75,
                                marginBottom: '2px',
                              }}>
                                Original ({getLanguageEnglishName(origLang)}):
                              </div>
                              <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                                {msg.original_message}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                              {displayMessage}
                            </div>
                          )}

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '4px',
                            gap: '0.5rem',
                            fontSize: '10px',
                            opacity: 0.75,
                          }}>
                            <span>{timeStr}</span>
                            {isSender && <CheckCheck size={12} />}
                          </div>

                          {/* Translation controls */}
                          {!isSender && isDiffLang && (
                            <div
                              className="msg-bubble__translate"
                              onClick={() => toggleOriginal(msg.id)}
                              style={{
                                borderTop: '1px solid rgba(0,0,0,0.08)',
                                marginTop: '6px',
                                paddingTop: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'var(--color-blue)',
                              }}
                            >
                              <Globe size={11} style={{ flexShrink: 0 }} />
                              {showOrig ? (
                                <span>View Translation ({getLanguageEnglishName(myLang)})</span>
                              ) : hasTranslation ? (
                                <span>Translated to {getLanguageEnglishName(myLang)} • <strong>View Original</strong></span>
                              ) : (
                                <span style={{ fontStyle: 'italic', opacity: 0.8 }}>Translating to {getLanguageEnglishName(myLang)}...</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="chat-input-area" style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem 1.25rem', background: '#fff' }}>
                <input
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    activeChat.type === 'group'
                      ? `Message the group in ${getLanguageEnglishName(profile?.preferred_language || 'en')} (auto-translated for members)...`
                      : (profile?.preferred_language || 'en') === (activeChat.data?.preferred_language || activeChat.data?.language || 'en')
                        ? 'Type your message...'
                        : `Message in ${getLanguageEnglishName(profile?.preferred_language || 'en')} (auto-translated to ${getLanguageEnglishName(activeChat.data?.preferred_language || activeChat.data?.language || 'en')})...`
                  }
                  style={{ minHeight: 'auto' }}
                  disabled={sending}
                />
                <button
                  className="btn btn--primary btn--icon"
                  onClick={handleSendMessage}
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
