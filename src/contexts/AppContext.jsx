import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const AppContext = createContext({});

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [savedSchemes, setSavedSchemes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('sahayak_language') || 'en';
    } catch {
      return 'en';
    }
  });
  const [voiceEnabled, setVoiceEnabledState] = useState(() => {
    try {
      return localStorage.getItem('sahayak_voice_enabled') === 'true';
    } catch {
      return false; // Default: voice_enabled = false
    }
  });
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const setVoiceEnabled = useCallback((val) => {
    const boolVal = !!val;
    setVoiceEnabledState(boolVal);
    try {
      localStorage.setItem('sahayak_voice_enabled', String(boolVal));
    } catch {}
  }, []);

  // Sync document dir and lang attribute whenever language changes
  useEffect(() => {
    if (typeof document !== 'undefined' && language) {
      try {
        localStorage.setItem('sahayak_language', language);
      } catch (e) {
        // ignore storage errors
      }
      const isRtl = ['ur', 'ks', 'sd'].includes(language);
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
  }, [language]);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching profile from Supabase:', error);
      }

      if (data) {
        setProfile(data);
        if (data.preferred_language) {
          setLanguageState(data.preferred_language);
          try {
            localStorage.setItem('sahayak_language', data.preferred_language);
          } catch {}
        }
      } else {
        // Auto-create initial profile row if missing
        const initial = {
          user_id: user.id,
          preferred_language: language || 'en',
          onboarding_completed: false,
          onboarding_step: 1,
          profile_completion_percentage: 0,
        };
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .upsert(initial, { onConflict: 'user_id' })
          .select()
          .single();

        if (!insertError && created) {
          setProfile(created);
        } else {
          setProfile(initial);
        }
      }
    } catch (e) {
      console.warn('Profile fetch exception:', e);
    } finally {
      setProfileLoading(false);
    }
  }, [user, language]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!user) {
      setDocuments([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (e) {
      console.warn('Error fetching documents from Supabase:', e);
    }
  }, [user]);

  // Fetch saved schemes
  const fetchSavedSchemes = useCallback(async () => {
    if (!user) {
      setSavedSchemes([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('saved_schemes')
        .select('scheme_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setSavedSchemes((data || []).map(s => s.scheme_id));
    } catch (e) {
      console.warn('Error fetching saved schemes:', e);
    }
  }, [user]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      const notifs = data || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (e) {
      console.warn('Error fetching notifications from Supabase:', e);
    }
  }, [user]);

  // Update profile with Supabase upsert and sync public group profile
  const updateProfile = async (updates) => {
    if (!user) return;
    try {
      const payload = {
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      setProfile(data);

      // Sync public group profile for peer discovery
      if (data.full_name || data.business_type || data.district) {
        supabase
          .from('public_group_profiles')
          .upsert({
            user_id: user.id,
            display_name: data.full_name || 'Entrepreneur',
            business_type: data.business_type,
            business_category: data.business_category,
            district: data.district,
            state: data.state,
            language: data.preferred_language || 'en',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          .then(() => {})
          .catch(e => console.warn('Public profile sync skipped:', e));
      }

      return data;
    } catch (e) {
      console.error('Error updating profile in Supabase:', e);
      throw e;
    }
  };

  // Set language
  const setLanguage = async (langCode) => {
    setLanguageState(langCode);
    try {
      localStorage.setItem('sahayak_language', langCode);
    } catch {}
    if (typeof document !== 'undefined') {
      const isRtl = ['ur', 'ks', 'sd'].includes(langCode);
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = langCode;
    }
    if (user) {
      try {
        await updateProfile({ preferred_language: langCode });
      } catch (e) {
        console.warn('Could not sync preferred_language to profile:', e);
      }
    }
  };

  // Toggle Save Scheme
  const toggleSaveScheme = async (schemeId) => {
    if (!user || !schemeId) return;
    const isSaved = savedSchemes.includes(schemeId);
    try {
      if (isSaved) {
        await supabase
          .from('saved_schemes')
          .delete()
          .eq('user_id', user.id)
          .eq('scheme_id', schemeId);
        setSavedSchemes(prev => prev.filter(id => id !== schemeId));
      } else {
        await supabase
          .from('saved_schemes')
          .insert({ user_id: user.id, scheme_id: schemeId });
        setSavedSchemes(prev => [...prev, schemeId]);
      }
    } catch (e) {
      console.error('Error toggling saved scheme:', e);
    }
  };

  // Mark single notification read
  const markNotificationRead = async (notifId) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Error marking notification read:', e);
    }
  };

  // Mark all notifications read
  const markAllNotificationsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Error marking all notifications read:', e);
    }
  };

  // Create notification
  const createNotification = async (type, title, message, targetUrl = null, relatedId = null) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type,
          title,
          message,
          target_url: targetUrl,
          related_id: relatedId,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setNotifications(prev => [data, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
      return data;
    } catch (e) {
      console.error('Error creating notification in Supabase:', e);
    }
  };

  // Upload document to Supabase Storage & insert record in documents table
  const uploadDocument = async (file, documentType, maskedIdentifier = null) => {
    if (!user) throw new Error('User must be logged in to upload documents.');
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/${documentType}/${Date.now()}_${sanitizedName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage bucket upload issue, continuing with record insertion:', uploadError);
      }

      // Insert record in documents table
      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          document_type: documentType,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          masked_identifier: maskedIdentifier,
          verification_status: 'uploaded',
        })
        .select()
        .single();

      if (error) throw error;
      setDocuments(prev => [data, ...prev]);

      // Automatically create a notification
      await createNotification(
        'missing_document',
        'Document Uploaded',
        `${file.name} has been uploaded securely to your profile.`,
        '/profile'
      );

      return data;
    } catch (e) {
      console.error('Error uploading document:', e);
      throw e;
    }
  };

  // Get signed URL for private document download/viewing
  const getDocumentSignedUrl = async (filePath) => {
    if (!filePath) return null;
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600); // 1 hour validity

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (e) {
      console.warn('Error getting signed document URL:', e);
      return null;
    }
  };

  // Delete document
  const deleteDocument = async (documentId, filePath) => {
    if (!user) return;
    try {
      if (filePath) {
        await supabase.storage.from('documents').remove([filePath]);
      }
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== documentId));
    } catch (e) {
      console.error('Error deleting document:', e);
      throw e;
    }
  };

  // Initial fetch and Realtime subscriptions
  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchDocuments();
      fetchSavedSchemes();
      fetchNotifications();

      // Realtime subscription for user notifications
      const notifChannel = supabase
        .channel(`public:notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(notifChannel);
      };
    } else {
      setProfile(null);
      setDocuments([]);
      setSavedSchemes([]);
      setNotifications([]);
      setUnreadCount(0);
      setProfileLoading(false);
    }
  }, [user, fetchProfile, fetchDocuments, fetchSavedSchemes, fetchNotifications]);

  return (
    <AppContext.Provider value={{
      profile, documents, savedSchemes, notifications, unreadCount, language,
      voiceEnabled, setVoiceEnabled,
      loading, setLoading, profileLoading,
      fetchProfile, fetchDocuments, fetchSavedSchemes, fetchNotifications,
      updateProfile, setLanguage, toggleSaveScheme,
      markNotificationRead, markAllNotificationsRead, createNotification,
      uploadDocument, getDocumentSignedUrl, deleteDocument,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
