import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://moogkmjfxalvjlillczi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YldcBEZh7qfLudakUeswAw_wjEGvOq5';

async function runProductionVerification() {
  console.log('====================================================');
  console.log('  SAHAYAK FINAL PRODUCTION FLOW VERIFICATION TEST  ');
  console.log('====================================================\n');

  const clientA = createClient(SUPABASE_URL, SUPABASE_KEY);
  const clientB = createClient(SUPABASE_URL, SUPABASE_KEY);
  const clientC = createClient(SUPABASE_URL, SUPABASE_KEY); // Outsider

  const emailA = 'prod_creator@sahayak.test';
  const emailB = 'prod_requester@sahayak.test';
  const emailC = 'prod_outsider@sahayak.test';
  const password = 'ProdPassword2026!';

  async function getAuth(client, email) {
    let { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      const res = await client.auth.signUp({ email, password });
      if (res.error) throw res.error;
      data = res.data;
    }
    return data.user;
  }

  // 1. LOGIN / AUTH
  console.log('[1/12] Testing Login & Authentication...');
  const userA = await getAuth(clientA, emailA);
  const userB = await getAuth(clientB, emailB);
  const userC = await getAuth(clientC, emailC);
  console.log(`  ✓ Creator Authenticated: ${userA.id}`);
  console.log(`  ✓ Requester Authenticated: ${userB.id}`);
  console.log(`  ✓ Outsider Authenticated: ${userC.id}`);

  // 2. DASHBOARD QUERIES
  console.log('\n[2/12] Testing Dashboard Queries...');
  const { data: dashSchemes, error: dsErr } = await clientA.from('schemes').select('*').limit(5);
  const { data: dashGroups, error: dgErr } = await clientA.from('group_schemes').select('*, schemes(name)').limit(5);
  const { data: dashOpps, error: doErr } = await clientA.from('government_opportunities').select('*').limit(5);
  if (dsErr || dgErr || doErr) throw new Error('Dashboard queries failed');
  console.log(`  ✓ Schemes: ${dashSchemes.length} loaded`);
  console.log(`  ✓ Group Schemes: ${dashGroups.length} loaded`);
  console.log(`  ✓ Opportunities: ${dashOpps.length} loaded`);

  // 3. APPLICATIONS VERIFICATION
  console.log('\n[3/12] Testing Applications Flow...');
  const { data: userApps, error: appErr } = await clientA
    .from('applications')
    .select('*, schemes(name, ministry)')
    .eq('user_id', userA.id);
  if (appErr) throw appErr;
  console.log(`  ✓ User applications queried cleanly (${userApps.length} existing records)`);

  // Test inserting an application if none exists
  let testAppId;
  if (userApps.length === 0) {
    const { data: newApp, error: newAppErr } = await clientA
      .from('applications')
      .insert({
        user_id: userA.id,
        scheme_id: dashSchemes[0].id,
        status: 'in_progress',
        progress_percentage: 25,
        current_step: 2,
        total_steps: 5
      })
      .select()
      .single();
    if (newAppErr) throw newAppErr;
    testAppId = newApp.id;
    console.log(`  ✓ Created test application record: ${testAppId}`);
  } else {
    testAppId = userApps[0].id;
    console.log(`  ✓ Verified existing application record: ${testAppId}`);
  }

  // 4. SCHEMES DISCOVERY & SCHEME_ID RESOLUTION
  console.log('\n[4/12] Testing Schemes Discovery...');
  const { data: allSchemes, error: allSErr } = await clientA
    .from('schemes')
    .select('id, name, ministry, required_members, group_scheme')
    .eq('is_active', true);
  if (allSErr || !allSchemes.length) throw new Error('Could not fetch active schemes');
  const targetScheme = allSchemes.find(s => s.group_scheme) || allSchemes[0];
  console.log(`  ✓ Found ${allSchemes.length} schemes`);
  console.log(`  ✓ Selected real scheme: "${targetScheme.name}" (ID: ${targetScheme.id})`);

  // 5. CREATE GROUP WITH VALID SCHEME_ID
  console.log('\n[5/12] Creating Group with Real scheme_id...');
  const groupTitle = `Prod Collective ${Date.now()}`;
  const { data: newGroup, error: crGrpErr } = await clientA
    .from('group_schemes')
    .insert({
      creator_user_id: userA.id,
      scheme_id: targetScheme.id,
      title: groupTitle,
      description: 'Production verification collective group',
      location: 'Tamil Nadu',
      required_members: targetScheme.required_members > 1 ? targetScheme.required_members : 5,
      current_members: 1,
      status: 'forming'
    })
    .select('*, schemes(id, name, ministry)')
    .single();
  if (crGrpErr) throw crGrpErr;
  const groupId = newGroup.id;
  console.log(`  ✓ Group created: ${groupId}`);
  console.log(`  ✓ Attached scheme: ${newGroup.schemes?.name}`);
  console.log(`  ✓ Scheme ID populated: ${newGroup.scheme_id}`);

  // 6. CREATOR ADDED TO GROUP_MEMBERS
  console.log('\n[6/12] Adding Creator to group_members (role=creator, status=active)...');
  const { data: crMember, error: crMemErr } = await clientA
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userA.id,
      role: 'creator',
      status: 'active'
    })
    .select()
    .single();
  if (crMemErr) throw crMemErr;
  console.log(`  ✓ Creator added: role=${crMember.role}, status=${crMember.status}`);

  // 7. WAITING LIST DISCOVERY
  console.log('\n[7/12] Verifying Group in Waiting List...');
  const { data: wlGroup, error: wlErr } = await clientB
    .from('group_schemes')
    .select('*, schemes(name, ministry)')
    .eq('id', groupId)
    .single();
  if (wlErr || !wlGroup) throw new Error('Group not visible to other users');
  console.log(`  ✓ Group "${wlGroup.title}" visible in Waiting List to User B`);

  // 8. REQUEST TO JOIN
  console.log('\n[8/12] User B Submitting Join Request...');
  const { data: joinReq, error: jrErr } = await clientB
    .from('join_requests')
    .insert({
      group_id: groupId,
      requester_id: userB.id,
      status: 'pending',
      message: 'Excited to join this collective!'
    })
    .select()
    .single();
  if (jrErr) throw jrErr;
  console.log(`  ✓ Join request inserted (ID: ${joinReq.id})`);

  // 9. CREATOR SEES PENDING REQUEST
  console.log('\n[9/12] Creator Checking Pending Requests...');
  const { data: creatorReqs, error: crReqErr } = await clientA
    .from('join_requests')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'pending');
  if (crReqErr || !creatorReqs?.length) throw new Error('Creator cannot see pending request');
  console.log(`  ✓ Creator User A sees ${creatorReqs.length} pending request(s)`);

  // 10. ACCEPT REQUEST & UPDATE MEMBERSHIP
  console.log('\n[10/12] Creator Accepting User B...');
  const { error: updErr } = await clientA
    .from('join_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', joinReq.id);
  if (updErr) throw updErr;

  const { error: addBMemErr } = await clientA
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userB.id,
      role: 'member',
      status: 'active'
    });
  if (addBMemErr) throw addBMemErr;
  console.log(`  ✓ Request updated to accepted and User B added to group_members`);

  // 11. GROUP CHAT & MESSAGING
  console.log('\n[11/12] Testing Group Chat & Real-Time Messaging...');
  // A sends message
  const { data: msgA, error: msgAErr } = await clientA
    .from('messages')
    .insert({
      sender_id: userA.id,
      receiver_id: userA.id,
      group_id: groupId,
      original_message: 'Hello and welcome to the collective group!',
      original_language: 'en'
    })
    .select()
    .single();
  if (msgAErr) throw msgAErr;
  console.log(`  ✓ User A sent group message (ID: ${msgA.id})`);

  // B reads message
  const { data: msgsForB, error: readBErr } = await clientB
    .from('messages')
    .select('*')
    .eq('group_id', groupId);
  if (readBErr || !msgsForB?.length) throw new Error('User B could not read group messages');
  console.log(`  ✓ User B received: "${msgsForB[0].original_message}"`);

  // B replies
  const { data: msgB, error: msgBErr } = await clientB
    .from('messages')
    .insert({
      sender_id: userB.id,
      receiver_id: userB.id,
      group_id: groupId,
      original_message: 'Thank you User A! Looking forward to working together.',
      original_language: 'en'
    })
    .select()
    .single();
  if (msgBErr) throw msgBErr;
  console.log(`  ✓ User B replied (ID: ${msgB.id})`);

  // A reads reply
  const { data: msgsForA, error: readAErr } = await clientA
    .from('messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  if (readAErr || msgsForA?.length < 2) throw new Error('User A could not read reply');
  console.log(`  ✓ User A received reply: "${msgsForA[1].original_message}"`);

  // 12. SECURITY ISOLATION & NO RECURSION
  console.log('\n[12/12] Testing Security Isolation & Non-Member Blocking...');
  const { data: outsiderRead, error: outReadErr } = await clientC
    .from('messages')
    .select('*')
    .eq('group_id', groupId);
  const { error: outSendErr } = await clientC
    .from('messages')
    .insert({
      sender_id: userC.id,
      receiver_id: userC.id,
      group_id: groupId,
      original_message: 'Unauthorized intruder message',
      original_language: 'en'
    });

  const readBlocked = !outReadErr && (!outsiderRead || outsiderRead.length === 0);
  const sendBlocked = !!outSendErr;
  console.log(`  ✓ Outsider visible messages: ${outsiderRead ? outsiderRead.length : 0} (Expected: 0)`);
  console.log(`  ✓ Outsider send attempt: ${outSendErr ? 'Blocked by RLS policy (42501)' : 'Allowed (UNEXPECTED)'}`);

  if (readBlocked && sendBlocked) {
    console.log('  ✓ Security isolation confirmed: non-members cannot read or send group messages');
  } else {
    throw new Error('Security isolation violation detected');
  }

  console.log('\n====================================================');
  console.log('  ALL 12 PRODUCTION VERIFICATION CHECKS PASSED!     ');
  console.log('====================================================\n');
}

runProductionVerification().catch(err => {
  console.error('\nVERIFICATION FAILED:', err);
  process.exit(1);
});
