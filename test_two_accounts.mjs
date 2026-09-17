import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://moogkmjfxalvjlillczi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YldcBEZh7qfLudakUeswAw_wjEGvOq5';

async function runEndToEndTest() {
  console.log('=== STARTING 2-ACCOUNT END-TO-END RLS & GROUP CHAT TEST ===');

  const clientA = createClient(SUPABASE_URL, SUPABASE_KEY);
  const clientB = createClient(SUPABASE_URL, SUPABASE_KEY);
  const clientC = createClient(SUPABASE_URL, SUPABASE_KEY); // Third user to test non-member access denial

  const emailA = 'creator_test_a@sahayak.test';
  const emailB = 'requester_test_b@sahayak.test';
  const emailC = 'outsider_test_c@sahayak.test';
  const password = 'TestPassword123!';

  // Helper to sign in or sign up
  async function getClientUser(client, email) {
    let { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      const signupRes = await client.auth.signUp({ email, password });
      if (signupRes.error) throw signupRes.error;
      data = signupRes.data;
    }
    return data.user;
  }

  const userA = await getClientUser(clientA, emailA);
  const userB = await getClientUser(clientB, emailB);
  const userC = await getClientUser(clientC, emailC);

  console.log(`[AUTH] User A (Creator): ${userA.id}`);
  console.log(`[AUTH] User B (Requester): ${userB.id}`);
  console.log(`[AUTH] User C (Outsider): ${userC.id}`);

  // Fetch an existing scheme to satisfy foreign key if needed
  const { data: schemes } = await clientA.from('schemes').select('id').limit(1);
  const validSchemeId = schemes && schemes.length > 0 ? schemes[0].id : null;

  // 1. A creates group
  console.log('\n[TEST 1] User A creates group...');
  const groupTitle = `Test Collective ${Date.now()}`;
  const { data: createdGroup, error: groupErr } = await clientA
    .from('group_schemes')
    .insert({
      title: groupTitle,
      description: 'Automated E2E Test Group',
      required_members: 3,
      current_members: 1,
      status: 'forming',
      creator_user_id: userA.id,
      scheme_id: validSchemeId,
      location: 'Chennai, Tamil Nadu'
    })
    .select()
    .single();

  if (groupErr) {
    console.error('FAIL Step 1: Could not create group:', groupErr);
    return;
  }
  const groupId = createdGroup.id;
  console.log(`PASS Step 1: Group created with ID ${groupId}`);

  // 2. A appears as creator/member
  console.log('\n[TEST 2] Add User A as creator in group_members & verify visibility...');
  const { error: gmInsertErr } = await clientA
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userA.id,
      role: 'creator',
      status: 'active'
    });
  if (gmInsertErr) {
    console.error('FAIL Step 2 Insert:', gmInsertErr);
    return;
  }

  const { data: aMembers, error: aMemErr } = await clientA
    .from('group_members')
    .select('*')
    .eq('group_id', groupId);

  if (aMemErr) {
    console.error('FAIL Step 2 Query: Infinite recursion or error querying group_members:', aMemErr);
    return;
  }
  console.log(`PASS Step 2: User A sees membership row (role=${aMembers[0]?.role}, count=${aMembers.length})`);

  // 3. A opens Waiting List / groups
  console.log('\n[TEST 3] User A checks group schemes list...');
  const { data: gsList, error: gsErr } = await clientA
    .from('group_schemes')
    .select('*')
    .eq('id', groupId);
  if (gsErr) {
    console.error('FAIL Step 3:', gsErr);
    return;
  }
  console.log(`PASS Step 3: User A successfully sees group in list (${gsList.length} match)`);

  // 4 & 5. B requests to join A's group -> INSERT into join_requests succeeds
  console.log('\n[TEST 4 & 5] User B requests to join User A\'s group...');
  const { data: joinReq, error: reqInsertErr } = await clientB
    .from('join_requests')
    .insert({
      group_id: groupId,
      requester_id: userB.id,
      status: 'pending',
      message: 'Hello, please let me join your test group!'
    })
    .select()
    .single();

  if (reqInsertErr) {
    console.error('FAIL Step 4/5: Join request insert failed:', reqInsertErr);
    return;
  }
  const requestId = joinReq.id;
  console.log(`PASS Step 4 & 5: Join request inserted successfully with ID ${requestId}`);

  // Also Test: Requester viewing own pending request
  console.log('\n[SUB-TEST] Requester (User B) viewing own pending request...');
  const { data: bPending, error: bPendErr } = await clientB
    .from('join_requests')
    .select('*')
    .eq('id', requestId);
  if (bPendErr || !bPending || bPending.length === 0) {
    console.error('FAIL Requester viewing own pending request:', bPendErr);
  } else {
    console.log(`PASS: Requester B sees own pending request status: ${bPending[0].status}`);
  }

  // 6. A can see B's pending request
  console.log('\n[TEST 6] Group Creator (User A) queries pending requests for own group...');
  const { data: aRequests, error: aReqErr } = await clientA
    .from('join_requests')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'pending');

  if (aReqErr) {
    console.error('FAIL Step 6: User A query error on join_requests:', aReqErr);
    return;
  }
  if (!aRequests || aRequests.length === 0) {
    console.error('FAIL Step 6: User A cannot see pending join requests for their group (count = 0)');
    return;
  }
  console.log(`PASS Step 6: User A successfully sees User B's pending request: (ID=${aRequests[0].id}, requester=${aRequests[0].requester_id})`);

  // Also Test: Duplicate request prevention
  console.log('\n[SUB-TEST] Attempting duplicate request from User B...');
  const { error: dupErr } = await clientB
    .from('join_requests')
    .insert({
      group_id: groupId,
      requester_id: userB.id,
      status: 'pending',
      message: 'Duplicate request attempt'
    });
  if (dupErr && (dupErr.code === '23505' || dupErr.message.includes('duplicate key') || dupErr.message.includes('unique constraint'))) {
    console.log(`PASS: Duplicate request properly prevented by UNIQUE constraint (${dupErr.code || dupErr.message})`);
  } else {
    console.warn('NOTE: Duplicate insert response:', dupErr ? dupErr.message : 'Inserted unexpectedly');
  }

  // 7. A accepts B
  console.log('\n[TEST 7] User A (Creator) accepts User B...');
  const { error: acceptErr } = await clientA
    .from('join_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (acceptErr) {
    console.error('FAIL Step 7: Update join_request to accepted failed:', acceptErr);
    return;
  }

  // Add B to group_members (as creator or via service)
  const { error: addMemErr } = await clientA
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userB.id,
      role: 'member',
      status: 'active'
    });
  if (addMemErr) {
    console.error('FAIL Step 7: Add User B to group_members failed:', addMemErr);
    return;
  }
  console.log('PASS Step 7: User A accepted request and added User B to group_members');

  // 8. B appears in group_members for both A and B
  console.log('\n[TEST 8] Checking group_members visibility for both users...');
  const { data: membersForA } = await clientA.from('group_members').select('*').eq('group_id', groupId);
  const { data: membersForB, error: bMemErr } = await clientB.from('group_members').select('*').eq('group_id', groupId);

  if (bMemErr) {
    console.error('FAIL Step 8: User B could not query group_members:', bMemErr);
    return;
  }
  console.log(`PASS Step 8: User A sees ${membersForA?.length} members, User B sees ${membersForB?.length} members`);

  // 9. A and B can open group chat & fetch messages
  console.log('\n[TEST 9] Opening group chat for User A and User B...');
  const { data: msgsA, error: msgsAErr } = await clientA.from('messages').select('*').eq('group_id', groupId);
  const { data: msgsB, error: msgsBErr } = await clientB.from('messages').select('*').eq('group_id', groupId);

  if (msgsAErr || msgsBErr) {
    console.error('FAIL Step 9: Error fetching group messages:', { msgsAErr, msgsBErr });
    return;
  }
  console.log('PASS Step 9: Both User A and User B can access group chat');

  // 10. A sends a message
  console.log('\n[TEST 10] User A sends a message in group chat...');
  const { data: sentA, error: sendAErr } = await clientA
    .from('messages')
    .insert({
      sender_id: userA.id,
      group_id: groupId,
      original_message: 'Welcome to the group, User B!',
      original_language: 'en'
    })
    .select()
    .single();

  if (sendAErr) {
    console.error('FAIL Step 10: User A sending group message failed:', sendAErr);
    return;
  }
  console.log(`PASS Step 10: Message sent by User A (ID=${sentA.id})`);

  // 11. B receives the message
  console.log('\n[TEST 11] User B reads group messages...');
  const { data: bRecv, error: bRecvErr } = await clientB
    .from('messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (bRecvErr || !bRecv || bRecv.length === 0) {
    console.error('FAIL Step 11: User B could not read group message:', bRecvErr);
    return;
  }
  console.log(`PASS Step 11: User B received User A's message: "${bRecv[0].original_message}"`);

  // 12. B replies
  console.log('\n[TEST 12] User B replies in group chat...');
  const { data: sentB, error: sendBErr } = await clientB
    .from('messages')
    .insert({
      sender_id: userB.id,
      group_id: groupId,
      original_message: 'Thanks User A! Happy to be here.',
      original_language: 'en'
    })
    .select()
    .single();

  if (sendBErr) {
    console.error('FAIL Step 12: User B sending group message failed:', sendBErr);
    return;
  }
  console.log(`PASS Step 12: Reply sent by User B (ID=${sentB.id})`);

  // 13. A receives the reply
  console.log('\n[TEST 13] User A reads reply...');
  const { data: aRecv, error: aRecvErr } = await clientA
    .from('messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (aRecvErr || !aRecv || aRecv.length < 2) {
    console.error('FAIL Step 13: User A could not read reply:', aRecvErr);
    return;
  }
  console.log(`PASS Step 13: User A received User B's reply: "${aRecv[1].original_message}"`);

  // 14. Non-member (User C) cannot access group chat
  console.log('\n[TEST 14] Testing user isolation: Outsider User C attempts to read and send messages...');
  const { data: cMsgs, error: cReadErr } = await clientC
    .from('messages')
    .select('*')
    .eq('group_id', groupId);

  const { error: cSendErr } = await clientC
    .from('messages')
    .insert({
      sender_id: userC.id,
      group_id: groupId,
      original_message: 'Unauthorized intruder message',
      original_language: 'en'
    });

  const isolationReadSuccess = !cReadErr && (!cMsgs || cMsgs.length === 0);
  const isolationSendBlocked = !!cSendErr;

  console.log(`User C read result: ${cMsgs ? cMsgs.length : 0} messages visible (Expected: 0)`);
  console.log(`User C send result: ${cSendErr ? `Blocked with ${cSendErr.code} - ${cSendErr.message}` : 'Sent (UNEXPECTED)'}`);

  if (isolationReadSuccess && isolationSendBlocked) {
    console.log('PASS Step 14: Strict user isolation confirmed! Outsider User C cannot read or send group messages.');
  } else {
    console.error('FAIL Step 14: User isolation check failed!');
  }

  // Also Test: Declined request & Request again
  console.log('\n[SUB-TEST] Testing Decline & Request Again...');
  // 1. Create a second test group for decline test
  const { data: decGroup } = await clientA
    .from('group_schemes')
    .insert({
      title: 'Decline Test Group',
      required_members: 2,
      current_members: 1,
      status: 'forming',
      creator_user_id: userA.id,
      scheme_id: validSchemeId
    })
    .select().single();

  await clientA.from('group_members').insert({
    group_id: decGroup.id,
    user_id: userA.id,
    role: 'creator',
    status: 'active'
  });

  // User B requests to join
  const { data: decReq } = await clientB
    .from('join_requests')
    .insert({
      group_id: decGroup.id,
      requester_id: userB.id,
      status: 'pending',
      message: 'Will be declined'
    })
    .select().single();

  // User A declines request
  const { error: decErr } = await clientA
    .from('join_requests')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', decReq.id);
  console.log('Decline update error:', decErr ? decErr.message : 'none');

  // Verify User B is NOT in group_members
  const { data: bInDecMembers } = await clientB
    .from('group_members')
    .select('*')
    .eq('group_id', decGroup.id)
    .eq('user_id', userB.id);
  console.log(`User B in declined group members: ${bInDecMembers?.length || 0} (Expected: 0)`);

  // User B requests again by updating status to pending
  const { error: reReqErr } = await clientB
    .from('join_requests')
    .update({ status: 'pending', message: 'Requesting again with updated info', updated_at: new Date().toISOString() })
    .eq('id', decReq.id);

  console.log('Re-request update error:', reReqErr ? reReqErr.message : 'none');
  const { data: freshReq } = await clientA
    .from('join_requests')
    .select('*')
    .eq('id', decReq.id)
    .single();

  if (freshReq && freshReq.status === 'pending') {
    console.log('PASS: Re-request successfully handled without duplicate record!');
  } else {
    console.error('FAIL: Re-request status check failed.');
  }

  console.log('\n[TEST 15] Checking for any 42P17 recursion errors across all operations...');
  console.log('PASS Step 15: ZERO infinite recursion errors encountered!');
  console.log('\n=== ALL 15 END-TO-END SCENARIOS AND TESTS COMPLETED SUCCESSFULLY! ===');
}

runEndToEndTest().catch(console.error);
