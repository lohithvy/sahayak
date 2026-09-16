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
  const { language } = useApp();

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
      const { data: memberGroups } = await supabase
        .from('group_members')
        .select('group_id, role, group_schemes(*, schemes(name))')
        .eq('user_id', user.id)
        .eq('status', 'active');

      const { data: createdGroups } = await supabase
        .from('group_schemes')
        .select('*, schemes(name)')
        .eq('creator_user_id', user.id);

      const allGroupMap = new Map();
      (memberGroups || []).forEach(mg => {
        if (mg.group_schemes) allGroupMap.set(mg.group_schemes.id, mg.group_schemes);
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

      // Fetch public profiles for contacts
      const otherIds = Array.from(contactMap.keys());
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('public_group_profiles')
          .select('*')
          .in('user_id', otherIds);

        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        const formattedContacts = otherIds.map(id => {
          const prof = profileMap.get(id);
          const meta = contactMap.get(id);
          return {
            user_id: id,
            display_name: prof?.display_name || 'Entrepreneur',
            public_id: prof?.public_id || getSafePublicId(id),
            business_type: prof?.business_type || 'General',
            district: prof?.district || 'Tamil Nadu',
            language: prof?.language || 'en',
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

    if (qGroupId && groupChats.length > 0) {
      const targetGroup = groupChats.find(g => g.id === qGroupId);
      if (targetGroup) {
        setActiveChat({ type: 'group', id: targetGroup.id, data: targetGroup });
        return;
      }
    }

    if (qUserId && user && qUserId !== user.id) {
      // If contact already loaded
      const existing = directContacts.find(c => c.user_id === qUserId);
      if (existing) {
        setActiveChat({ type: 'direct', id: existing.user_id, data: existing });
      } else {
        // Fetch public profile for new contact
        supabase
          .from('public_group_profiles')
          .select('*')
          .eq('user_id', qUserId)
          .maybeSingle()
          .then(({ data }) => {
            const newContact = {
              user_id: qUserId,
              display_name: data?.display_name || 'Entrepreneur',
              public_id: data?.public_id || getSafePublicId(qUserId),
              business_type: data?.business_type || 'General',
              district: data?.district || 'Tamil Nadu',
              language: data?.language || 'en',
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

  // Fetch messages when activeChat changes and subscribe to Realtime
  useEffect(() => {
    if (!activeChat || !user) return;

    let isMounted = true;

    async function loadChatMessages() {
      if (activeChat.type === 'direct') {
        const msgs = await GroupService.fetch1to1Messages(user.id, activeChat.id);
        if (isMounted) setMessages(msgs);
      } else {
        const msgs = await GroupService.fetchGroupMessages(activeChat.id);
        if (isMounted) setMessages(msgs);
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
            }
          } else {
            if (newMsg.group_id === activeChat.id) {
              setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeChat, user]);

  // Send message
  const handleSendMessage = async () => {
    if (!input.trim() || !activeChat || sending || !user) return;
    setSending(true);
    const textToSend = input.trim();
    setInput('');

    try {
      if (activeChat.type === 'direct') {
        const receiverLang = activeChat.data?.language || 'en';
        const newMsg = await GroupService.send1to1Message(
          user.id,
          activeChat.id,
          textToSend,
          language,
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
          language
        );
        if (newMsg) {
          setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        }
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      alert('Message could not be sent: ' + (e.message || 'Please verify database schema.'));
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
                          <span><Globe size={11} style={{ verticalAlign: 'middle' }} /> {getLanguageEnglishName(activeChat.data?.language || 'en')}</span>
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
                    const showOrig = showOriginal[msg.id];
                    const hasTranslation = msg.translated_message && msg.original_message !== msg.translated_message;
                    const displayMessage = isSender
                      ? msg.original_message
                      : (showOrig ? msg.original_message : (msg.translated_message || msg.original_message));

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
                          <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                            {displayMessage}
                          </div>

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
                          {!isSender && hasTranslation && (
                            <div
                              className="msg-bubble__translate"
                              onClick={() => toggleOriginal(msg.id)}
                              style={{
                                borderTop: '1px solid rgba(0,0,0,0.08)',
                                marginTop: '6px',
                                paddingTop: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                color: 'var(--color-blue)',
                              }}
                            >
                              <Globe size={10} style={{ display: 'inline', marginRight: '4px' }} />
                              {showOrig
                                ? t('msg.view_translation', language)
                                : `View Original (${getLanguageEnglishName(msg.original_language || 'en')})`
                              }
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
                      ? 'Message the group...'
                      : `Message in ${getLanguageEnglishName(language)} (auto-translated to ${getLanguageEnglishName(activeChat.data?.language || 'en')})...`
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
