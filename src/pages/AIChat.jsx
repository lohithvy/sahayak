import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { GeminiService } from '../services/gemini';
import { ASRService, TTSService, LANGUAGE_CAPABILITIES } from '../services/language';
import { supabase } from '../services/supabase';
import { t } from '../i18n';
import { Send, Mic, MicOff, Volume2, VolumeX, Bot, User, Square } from 'lucide-react';

export default function AIChat() {
  const { user } = useAuth();
  const { profile, documents, language, voiceEnabled, setVoiceEnabled } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load existing chat messages
  useEffect(() => {
    async function loadMessages() {
      if (!user) return;
      const { data } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setMessages(data.map(m => ({ role: m.role, content: m.content, citations: m.citations })));
      }
    }
    loadMessages();
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      TTSService.stop();
    };
  }, []);

  const sendMessage = async (overrideText, isVoice = false) => {
    const textToSend = (typeof overrideText === 'string' ? overrideText : input).trim();
    if (!textToSend || loading) return;

    const userMsg = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Save user message
    if (user) {
      await supabase.from('ai_chat_messages').insert({
        user_id: user.id, session_id: sessionId,
        role: 'user', content: userMsg.content, language,
      });
    }

    try {
      const allMessages = [...messages, userMsg];
      const response = await GeminiService.chatAssistant(allMessages, profile, language);
      const assistantMsg = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMsg]);

      // Save assistant message
      if (user) {
        await supabase.from('ai_chat_messages').insert({
          user_id: user.id, session_id: sessionId,
          role: 'assistant', content: response, language,
        });
      }

      // Voice Behavior:
      // Default: Do NOT automatically speak every AI response.
      // Spoken response is only allowed if user initiated a voice interaction AND voice mode is enabled.
      if (isVoice && voiceEnabled && TTSService.isSupported(language)) {
        TTSService.speak(response, language, () => setSpeakingIndex(null));
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('error.ai_unavailable', language),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReadAloud = (text, index) => {
    if (speakingIndex === index) {
      TTSService.stop();
      setSpeakingIndex(null);
    } else {
      TTSService.stop();
      setSpeakingIndex(index);
      TTSService.speak(text, language, () => {
        setSpeakingIndex(null);
      });
    }
  };

  const toggleMic = () => {
    if (isListening) {
      ASRService.stopListening();
      setIsListening(false);
    } else {
      const started = ASRService.startListening(
        language,
        (transcript, isFinal) => {
          setInput(transcript);
          if (isFinal) {
            setIsListening(false);
            sendMessage(transcript, true);
          }
        },
        (err) => {
          alert(err);
          setIsListening(false);
        },
        () => setIsListening(false)
      );
      setIsListening(started);
    }
  };

  const asrSupported = ASRService.isSupported(language);
  const ttsSupported = TTSService.isSupported(language);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 className="page-title">{t('nav.ai_chat', language)}</h1>
          <p className="page-subtitle">Ask about schemes, eligibility, documents, or opportunities</p>
        </div>
        {ttsSupported && (
          <button
            className={`btn btn--sm ${voiceEnabled ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              if (!next) {
                TTSService.stop();
                setSpeakingIndex(null);
              }
            }}
            aria-label={voiceEnabled ? 'Disable Voice Mode' : 'Enable Voice Mode'}
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            Voice Mode: {voiceEnabled ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      <div className="chat-container">
        <div className="chat-messages" role="log" aria-label="Chat messages">
          {messages.length === 0 && (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <Bot size={48} className="empty-state__icon" />
              <p className="empty-state__text">{t('ai.start_conversation', language)}</p>
              <div style={{ marginTop: '1rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                <p>Try asking in {LANGUAGE_CAPABILITIES[language]?.nativeName || 'your language'}:</p>
                <ul style={{ listStyle: 'none', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <li><button className="btn btn--sm btn--ghost" onClick={() => { setInput('What schemes am I eligible for?'); sendMessage('What schemes am I eligible for?'); }}>
                    "What schemes am I eligible for?"
                  </button></li>
                  <li><button className="btn btn--sm btn--ghost" onClick={() => { setInput('I need a loan for my tailoring business'); sendMessage('I need a loan for my tailoring business'); }}>
                    "I need a loan for my tailoring business"
                  </button></li>
                  <li><button className="btn btn--sm btn--ghost" onClick={() => { setInput('How do I get Udyam registration?'); sendMessage('How do I get Udyam registration?'); }}>
                    "How do I get Udyam registration?"
                  </button></li>
                </ul>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`chat-message chat-message--${msg.role}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: 'var(--text-xs)', opacity: 0.7 }}>
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                {msg.role === 'user' ? 'You' : 'Sahayak'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.content}</div>
              {msg.role === 'assistant' && ttsSupported && (
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    className={`btn btn--sm ${speakingIndex === i ? 'btn--secondary' : 'btn--ghost'}`}
                    style={{ fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => handleReadAloud(msg.content, i)}
                    aria-label={speakingIndex === i ? 'Stop reading' : 'Read aloud'}
                  >
                    {speakingIndex === i ? <Square size={12} /> : <Volume2 size={12} />}
                    {speakingIndex === i ? 'Stop' : 'Read aloud'}
                  </button>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="chat-message chat-message--assistant">
              <div className="ai-status" style={{ background: 'transparent', padding: 0 }}>
                <div className="ai-status__dot" />
                {t('ai.thinking', language)}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <button
            className={`btn btn--icon ${isListening ? 'btn--danger' : 'btn--ghost'}`}
            onClick={toggleMic}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={t('ai.chat_placeholder', language)}
            rows={1}
            aria-label="Chat input"
          />
          <button
            className="btn btn--primary btn--icon"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
