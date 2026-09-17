import { supabase } from './supabase.js';
import { GeminiService } from './gemini.js';

/**
 * Safe public identifier generator (e.g. SAH-B82F19)
 * Never exposes raw UUIDs in the UI
 */
export function getSafePublicId(uuid) {
  if (!uuid) return 'SAH-000000';
  const clean = uuid.replace(/-/g, '').toUpperCase();
  return `SAH-${clean.slice(-6)}`;
}

export class GroupService {
  /**
   * Syncs the user's safe public profile for peer discovery.
   * STRICT PRIVACY: NEVER exposes Aadhaar, PAN, Bank details, Income, Phone, Email, or Documents.
   */
  static async syncPublicProfile(user, profile) {
    if (!user) return null;
    try {
      const publicId = getSafePublicId(user.id);
      const safeData = {
        user_id: user.id,
        display_name: profile?.full_name || 'Entrepreneur',
        public_id: publicId,
        business_type: profile?.business_type || 'General Business',
        business_category: profile?.business_category || 'Micro Enterprise',
        district: profile?.district || 'Not specified',
        state: profile?.state || 'Not specified',
        category_visibility: !!profile?.minority_status,
        community_category: profile?.community_category || null,
        seeking_members: true,
        language: profile?.preferred_language || 'en',
        bio: profile?.business_type 
          ? `Operating in ${profile.business_type} seeking collaborative scheme opportunities.`
          : 'Active entrepreneur exploring group schemes.',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('public_group_profiles')
        .upsert(safeData, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        console.warn('Could not sync public_group_profile:', error.message);
        return safeData;
      }
      return data;
    } catch (e) {
      console.warn('syncPublicProfile error:', e);
      return null;
    }
  }

  /**
   * Fetches all safe public profiles looking for group collaboration
   */
  static async fetchPublicProfiles(excludeUserId = null) {
    try {
      let query = supabase
        .from('public_group_profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (excludeUserId) {
        query = query.neq('user_id', excludeUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('fetchPublicProfiles error:', e);
      return [];
    }
  }

  /**
   * Fetches collective groups with scheme details
   */
  static async fetchGroups() {
    try {
      const { data, error } = await supabase
        .from('group_schemes')
        .select('*, schemes(id, name, ministry, benefit, group_scheme)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('fetchGroups error:', e);
      return [];
    }
  }

  /**
   * Fetches individual waiting list entries
   */
  static async fetchWaitingList() {
    try {
      const { data, error } = await supabase
        .from('waiting_list')
        .select('*, schemes(id, name, ministry)')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('fetchWaitingList error:', e);
      return [];
    }
  }

  /**
   * Adds user to waiting list for a scheme or group search
   */
  static async joinWaitingList(userId, schemeId, businessType, location, notes = '') {
    try {
      const { data, error } = await supabase
        .from('waiting_list')
        .insert({
          user_id: userId,
          scheme_id: schemeId || null,
          business_type: businessType || 'General',
          location: location || 'Tamil Nadu',
          status: 'waiting',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      console.error('joinWaitingList error:', e);
      throw e;
    }
  }

  /**
   * Creates a new collective group scheme
   */
  static async createGroup(userId, groupData) {
    try {
      const payload = {
        creator_user_id: userId,
        scheme_id: groupData.scheme_id || null,
        title: groupData.title,
        description: groupData.description,
        location: groupData.location || '',
        required_members: parseInt(groupData.required_members, 10) || 5,
        current_members: 1,
        status: 'forming',
      };

      const { data, error } = await supabase
        .from('group_schemes')
        .insert(payload)
        .select('*, schemes(id, name, ministry)')
        .single();

      if (error) throw error;

      // Automatically add creator to group_members
      try {
        await supabase.from('group_members').insert({
          group_id: data.id,
          user_id: userId,
          role: 'creator',
          status: 'active',
        });
      } catch (memErr) {
        console.warn('Creator auto-member insert note:', memErr.message);
      }

      return data;
    } catch (e) {
      console.error('createGroup error:', e);
      throw e;
    }
  }

  /**
   * Fetches active members of a specific group
   */
  static async fetchGroupMembers(groupId) {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('*, public_group_profiles:user_id(display_name, public_id, business_type, district, language)')
        .eq('group_id', groupId)
        .eq('status', 'active');

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('fetchGroupMembers error:', e?.message || e);
      return [];
    }
  }

  /**
   * Submits a request to join a collective group
   */
  static async requestToJoin(groupId, userId, creatorId, groupTitle = 'Collective Group', message = '') {
    try {
      // 1. Insert join request using exact valid schema fields: group_id, requester_id, status, message
      const payload = {
        group_id: groupId,
        requester_id: userId,
        status: 'pending',
        message: message || 'I would like to join this scheme group.',
      };

      const { data, error } = await supabase
        .from('join_requests')
        .insert(payload);

      if (error) {
        console.error('[GroupService requestToJoin Error]:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      // 2. Notify the creator
      if (creatorId && creatorId !== userId) {
        await supabase.from('notifications').insert({
          user_id: creatorId,
          type: 'group_match',
          title: 'New Join Request',
          message: `An entrepreneur requested to join "${groupTitle}".`,
          target_url: '/waiting-list',
        }).then(() => {}).catch(() => {});
      }

      return { success: true, groupId, requesterId: userId };
    } catch (e) {
      console.error('requestToJoin error:', e);
      throw e;
    }
  }

  /**
   * Direct join fallback if needed
   */
  static async joinGroupDirect(groupId, userId) {
    const { data, error } = await supabase
      .from('group_members')
      .upsert({
        group_id: groupId,
        user_id: userId,
        role: 'member',
        status: 'active',
      }, { onConflict: 'group_id,user_id' })
      .select()
      .single();

    if (error) throw error;

    // Increment current_members
    await this.recalculateGroupMembers(groupId);
    return data;
  }

  /**
   * Fetches pending join requests for a group
   */
  static async fetchJoinRequests(groupId) {
    try {
      const { data, error } = await supabase
        .from('join_requests')
        .select('id, group_id, requester_id, status, created_at, updated_at, message')
        .eq('group_id', groupId)
        .eq('status', 'pending');

      if (error) {
        console.warn('fetchJoinRequests query note:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return [];
      }

      if (!data || data.length === 0) return [];

      // Fetch public group profiles for the requesters
      const requesterIds = [...new Set(data.map(r => r.requester_id).filter(Boolean))];
      let profilesMap = {};
      if (requesterIds.length > 0) {
        const { data: profs } = await supabase
          .from('public_group_profiles')
          .select('user_id, display_name, public_id, business_type, district, language')
          .in('user_id', requesterIds);

        if (profs) {
          profs.forEach(p => { profilesMap[p.user_id] = p; });
        }
      }

      return data.map(req => ({
        ...req,
        public_group_profiles: profilesMap[req.requester_id] || null,
      }));
    } catch (e) {
      console.warn('fetchJoinRequests error:', e?.message || e);
      return [];
    }
  }

  /**
   * Fetches pending join requests submitted by current user
   */
  static async fetchUserPendingRequests(userId) {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from('join_requests')
        .select('group_id, status')
        .eq('requester_id', userId)
        .eq('status', 'pending');

      if (error) {
        console.warn('fetchUserPendingRequests note:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return [];
      }
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Accepts or declines a join request
   */
  static async respondToJoinRequest(requestId, groupId, requesterId, action, groupTitle = 'Collective Group') {
    try {
      const isAccept = action === 'accept';
      const status = isAccept ? 'accepted' : 'declined';

      // 1. Update request status
      const { error: reqError } = await supabase
        .from('join_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (reqError && reqError.code !== '42P01') throw reqError;

      // 2. If accepted, add to group_members
      if (isAccept) {
        const { error: memError } = await supabase
          .from('group_members')
          .upsert({
            group_id: groupId,
            user_id: requesterId,
            role: 'member',
            status: 'active',
          }, { onConflict: 'group_id,user_id' });

        if (memError) console.warn('group_members upsert note:', memError.message);

        // Recalculate member count and readiness
        await this.recalculateGroupMembers(groupId);

        // Notify requester of acceptance
        await supabase.from('notifications').insert({
          user_id: requesterId,
          type: 'group_match',
          title: 'Join Request Accepted!',
          message: `You are now a member of "${groupTitle}". Open the group chat to collaborate.`,
          target_url: `/messages?groupId=${groupId}`,
        }).then(() => {}).catch(() => {});
      } else {
        // Notify requester of decline
        await supabase.from('notifications').insert({
          user_id: requesterId,
          type: 'group_match',
          title: 'Join Request Update',
          message: `Your request to join "${groupTitle}" was not accepted at this time.`,
          target_url: '/waiting-list',
        }).then(() => {}).catch(() => {});
      }

      return { success: true, action };
    } catch (e) {
      console.error('respondToJoinRequest error:', e);
      throw e;
    }
  }

  /**
   * Recalculates member count and sets status to 'ready' when full
   */
  static async recalculateGroupMembers(groupId) {
    try {
      // Get member count
      const { data: members } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('status', 'active');

      const count = members?.length || 1;

      // Get group required_members
      const { data: group } = await supabase
        .from('group_schemes')
        .select('required_members, creator_user_id, title')
        .eq('id', groupId)
        .single();

      if (group) {
        const isReady = count >= group.required_members;
        const newStatus = isReady ? 'ready' : 'forming';

        await supabase
          .from('group_schemes')
          .update({
            current_members: count,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', groupId);

        // If ready, notify the creator
        if (isReady) {
          await supabase.from('notifications').insert({
            user_id: group.creator_user_id,
            type: 'group_match',
            title: 'Group Ready to Apply!',
            message: `"${group.title}" has reached all ${group.required_members} required members!`,
            target_url: '/waiting-list',
          }).then(() => {}).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('recalculateGroupMembers error:', e);
    }
  }

  /**
   * Sends a 1-to-1 message with optional automated translation
   */
  static async send1to1Message(senderId, receiverId, text, senderLang = 'en', receiverLang = 'en') {
    if (!text?.trim()) return null;

    let translatedMessage = text.trim();
    if (senderLang !== receiverLang) {
      try {
        translatedMessage = await GeminiService.translateText(text.trim(), senderLang, receiverLang);
      } catch (e) {
        translatedMessage = text.trim();
      }
    }

    const payload = {
      sender_id: senderId,
      receiver_id: receiverId,
      group_id: null,
      original_message: text.trim(),
      original_language: senderLang,
      translated_message: translatedMessage,
      target_language: receiverLang,
    };

    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // Send notification to receiver
    try {
      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'message',
        title: 'New Message',
        message: text.trim().slice(0, 60) + (text.length > 60 ? '...' : ''),
        target_url: `/messages?userId=${senderId}`,
      });
    } catch {}

    return data;
  }

  /**
   * Sends a group message to all group members
   */
  static async sendGroupMessage(senderId, groupId, text, senderLang = 'en') {
    if (!text?.trim() || !groupId) return null;

    const payload = {
      sender_id: senderId,
      group_id: groupId,
      original_message: text.trim(),
      original_language: senderLang,
      translated_message: text.trim(),
      target_language: senderLang,
    };

    // If receiver_id column has NOT NULL in DB before migration, use senderId as placeholder
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select()
        .single();

      if (error && error.message?.includes('receiver_id')) {
        // Fallback for pre-migrated schema where receiver_id was NOT NULL
        const fallbackPayload = { ...payload, receiver_id: senderId };
        const { data: fbData, error: fbError } = await supabase
          .from('messages')
          .insert(fallbackPayload)
          .select()
          .single();
        if (fbError) throw fbError;
        return fbData;
      }

      if (error) throw error;
      return data;
    } catch (e) {
      console.error('sendGroupMessage error:', e);
      throw e;
    }
  }

  /**
   * Fetches messages for a 1-to-1 conversation
   */
  static async fetch1to1Messages(userAId, userBId) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .is('group_id', null)
        .or(`and(sender_id.eq.${userAId},receiver_id.eq.${userBId}),and(sender_id.eq.${userBId},receiver_id.eq.${userAId})`)
        .order('created_at', { ascending: true });

      if (error) {
        // If group_id column does not exist yet
        const { data: legacy, error: legacyErr } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${userAId},receiver_id.eq.${userBId}),and(sender_id.eq.${userBId},receiver_id.eq.${userAId})`)
          .order('created_at', { ascending: true });
        if (legacyErr) throw legacyErr;
        return legacy || [];
      }

      return data || [];
    } catch (e) {
      console.warn('fetch1to1Messages error:', e);
      return [];
    }
  }

  /**
   * Fetches messages for a group conversation
   */
  static async fetchGroupMessages(groupId) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:sender_id(id), sender_profile:public_group_profiles!messages_sender_id_fkey(display_name, public_id)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) {
        // Simple query without foreign key join
        const { data: simpleData, error: simpleErr } = await supabase
          .from('messages')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });

        if (simpleErr) throw simpleErr;
        return simpleData || [];
      }

      return data || [];
    } catch (e) {
      console.warn('fetchGroupMessages error:', e);
      return [];
    }
  }
}
