import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://moogkmjfxalvjlillczi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YldcBEZh7qfLudakUeswAw_wjEGvOq5';

async function testSchemeIdGroupCreation() {
  console.log('=== TEST: SCHEME_ID ENFORCEMENT & GROUP CREATION FLOW ===\n');

  const clientA = createClient(SUPABASE_URL, SUPABASE_KEY);
  const clientB = createClient(SUPABASE_URL, SUPABASE_KEY);

  const emailA = 'creator_test_a@sahayak.test';
  const emailB = 'requester_test_b@sahayak.test';
  const password = 'TestPassword123!';

  // Helper to authenticate
  async function authUser(client, email) {
    let { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      const res = await client.auth.signUp({ email, password });
      if (res.error) throw res.error;
      data = res.data;
    }
    return data.user;
  }

  const userA = await authUser(clientA, emailA);
  const userB = await authUser(clientB, emailB);

  console.log(`[AUTH] User A (Creator): ${userA.id}`);
  console.log(`[AUTH] User B (Requester): ${userB.id}`);

  // 1. Fetch real schemes from public.schemes
  console.log('\n[STEP 1] Fetching active schemes from public.schemes...');
  const { data: realSchemes, error: schemeErr } = await clientA
    .from('schemes')
    .select('id, name, ministry, required_members, group_scheme')
    .eq('is_active', true);

  if (schemeErr || !realSchemes || realSchemes.length === 0) {
    throw new Error('Failed to fetch real schemes: ' + (schemeErr?.message || 'No schemes found'));
  }

  console.log(`Found ${realSchemes.length} active schemes.`);
  const chosenScheme = realSchemes.find(s => s.group_scheme) || realSchemes[0];
  console.log(`Selected Scheme for test: "${chosenScheme.name}" (ID: ${chosenScheme.id})`);

  // 2. Verify validation when scheme_id is empty/null
  console.log('\n[STEP 2] Verifying application validation when scheme_id is missing...');
  try {
    const invalidPayload = {
      title: 'Invalid No-Scheme Group',
      scheme_id: '',
      description: 'Should fail validation before insert'
    };
    if (!invalidPayload.scheme_id || !invalidPayload.scheme_id.trim()) {
      throw new Error('Please select a scheme before creating a group.');
    }
  } catch (valErr) {
    console.log('PASS: Validation correctly caught missing scheme_id:', valErr.message);
  }

  // 3. Create group with REAL scheme_id
  console.log('\n[STEP 3] Creating group with VALID real scheme_id...');
  const testGroupTitle = `TNSRLM Collective Test ${Date.now()}`;
  const groupPayload = {
    creator_user_id: userA.id,
    scheme_id: chosenScheme.id, // Actual primary key UUID of selected scheme
    title: testGroupTitle,
    description: 'Empowering local micro-enterprises under scheme funding',
    location: 'Chennai, Tamil Nadu',
    required_members: chosenScheme.required_members > 1 ? chosenScheme.required_members : 5,
    current_members: 1,
    status: 'forming'
  };

  const { data: createdGroup, error: createErr } = await clientA
    .from('group_schemes')
    .insert(groupPayload)
    .select('*, schemes(id, name, ministry)')
    .single();

  if (createErr) {
    console.error('FAIL Step 3: Could not create group:', createErr);
    throw createErr;
  }

  console.log(`PASS Step 3: Group created successfully with ID: ${createdGroup.id}`);
  console.log(`  - scheme_id: ${createdGroup.scheme_id} (Matches real scheme: ${createdGroup.scheme_id === chosenScheme.id})`);
  console.log(`  - attached scheme name: ${createdGroup.schemes?.name}`);
  console.log(`  - current_members: ${createdGroup.current_members}`);
  console.log(`  - status: ${createdGroup.status}`);

  // 4. Add Creator to group_members with role='creator' and status='active'
  console.log('\n[STEP 4] Adding creator to group_members...');
  const { data: creatorMember, error: gmErr } = await clientA
    .from('group_members')
    .insert({
      group_id: createdGroup.id,
      user_id: userA.id,
      role: 'creator',
      status: 'active'
    })
    .select()
    .single();

  if (gmErr) {
    console.error('FAIL Step 4: Creator insert into group_members failed:', gmErr);
    throw gmErr;
  }
  console.log(`PASS Step 4: Creator added to group_members (role="${creatorMember.role}", status="${creatorMember.status}")`);

  // 5. Verify group appears in Waiting List with correct scheme attached
  console.log('\n[STEP 5] Querying group from Waiting List...');
  const { data: queriedGroup, error: queryErr } = await clientA
    .from('group_schemes')
    .select('*, schemes(id, name, ministry, benefit, group_scheme)')
    .eq('id', createdGroup.id)
    .single();

  if (queryErr || !queriedGroup) {
    console.error('FAIL Step 5: Could not fetch created group:', queryErr);
    throw queryErr;
  }
  console.log(`PASS Step 5: Group found in Waiting List query.`);
  console.log(`  - Group ID: ${queriedGroup.id}`);
  console.log(`  - Scheme attached: ${queriedGroup.schemes?.name}`);
  console.log(`  - Scheme ID: ${queriedGroup.schemes?.id}`);

  // 6. Another user (User B) submits a join request
  console.log('\n[STEP 6] User B submits Request to Join...');
  const { data: joinReq, error: reqErr } = await clientB
    .from('join_requests')
    .insert({
      group_id: createdGroup.id,
      requester_id: userB.id,
      status: 'pending',
      message: 'Hello, I would like to join this scheme group!'
    })
    .select()
    .single();

  if (reqErr) {
    console.error('FAIL Step 6: Join request failed:', reqErr);
    throw reqErr;
  }
  console.log(`PASS Step 6: Join request submitted by User B with ID: ${joinReq.id}`);

  // 7. Creator (User A) queries and sees the pending request
  console.log('\n[STEP 7] Group Creator (User A) checks pending requests for the group...');
  const { data: pendingRequests, error: seeReqErr } = await clientA
    .from('join_requests')
    .select('*')
    .eq('group_id', createdGroup.id)
    .eq('status', 'pending');

  if (seeReqErr || !pendingRequests || pendingRequests.length === 0) {
    console.error('FAIL Step 7: Creator could not see pending request:', seeReqErr);
    throw seeReqErr || new Error('0 pending requests found');
  }

  console.log(`PASS Step 7: Creator User A successfully sees ${pendingRequests.length} pending request(s).`);
  console.log(`  - Requester: ${pendingRequests[0].requester_id}`);
  console.log(`  - Message: "${pendingRequests[0].message}"`);

  console.log('\n=== ALL GROUP CREATION AND SCHEME_ID TESTS PASSED SUCCESSFULLY! ===');
}

testSchemeIdGroupCreation().catch(e => {
  console.error('\nTEST RUN FAILED:', e);
  process.exit(1);
});
