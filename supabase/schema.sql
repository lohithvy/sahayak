-- ============================================================
-- SAHAYAK - Complete Database Schema
-- Smart India Hackathon 2026 Prototype
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  dob DATE,
  gender TEXT,
  preferred_language TEXT DEFAULT 'en',
  state TEXT,
  district TEXT,
  residence_type TEXT, -- urban/rural
  community_category TEXT, -- general/sc/st/obc/ews
  minority_status BOOLEAN DEFAULT FALSE,
  disability_status BOOLEAN DEFAULT FALSE,
  disability_percentage INTEGER DEFAULT 0,
  employment_status TEXT,
  annual_income NUMERIC,
  marital_status TEXT,
  business_status TEXT, -- existing/starting
  business_type TEXT,
  business_category TEXT,
  business_stage TEXT,
  business_location TEXT,
  investment_required NUMERIC,
  capital_required NUMERIC,
  udyam_registered BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 1,
  profile_completion_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  masked_identifier TEXT,
  verification_status TEXT DEFAULT 'pending', -- pending/uploaded/verified_prototype/missing
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEMES
-- ============================================================
CREATE TABLE IF NOT EXISTS schemes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_hi TEXT,
  name_ta TEXT,
  slug TEXT UNIQUE,
  description TEXT,
  ministry TEXT,
  state TEXT, -- NULL = central
  scheme_type TEXT, -- loan/subsidy/grant/training/insurance
  benefit TEXT,
  benefit_amount TEXT,
  application_method TEXT,
  official_url TEXT,
  source_url TEXT,
  source_type TEXT, -- myscheme/ministry/state_portal
  last_verified_at TIMESTAMPTZ,
  eligibility_summary TEXT,
  required_documents TEXT[], -- array of document types
  target_categories TEXT[], -- sc/st/obc/ews/general/women/minority
  target_genders TEXT[],
  target_business_types TEXT[],
  target_states TEXT[],
  min_age INTEGER,
  max_age INTEGER,
  min_income NUMERIC,
  max_income NUMERIC,
  requires_udyam BOOLEAN DEFAULT FALSE,
  requires_disability BOOLEAN DEFAULT FALSE,
  min_disability_percentage INTEGER DEFAULT 0,
  residence_type TEXT, -- urban/rural/both
  group_scheme BOOLEAN DEFAULT FALSE,
  required_members INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEME_RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS scheme_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL, -- age/gender/income/category/state/document/business/disability
  field_name TEXT NOT NULL,
  operator TEXT NOT NULL, -- eq/ne/gt/lt/gte/lte/in/contains
  expected_value TEXT NOT NULL,
  explanation TEXT,
  required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEME_SOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS scheme_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT,
  source_title TEXT,
  source_excerpt TEXT,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  is_official BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'started', -- started/in_progress/documents_pending/review/submitted_demo/rejected_demo
  progress_percentage INTEGER DEFAULT 0,
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 5,
  form_data JSONB DEFAULT '{}',
  missing_requirements TEXT[],
  eligibility_status TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

-- ============================================================
-- APPLICATION_STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS application_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending/in_progress/completed
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- incomplete_application/missing_document/scheme_update/group_match/waiting_list_update/new_opportunity/system/message
  title TEXT NOT NULL,
  message TEXT,
  target_url TEXT,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAVED_SCHEMES
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_schemes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, scheme_id)
);

-- ============================================================
-- GROUP_SCHEMES
-- ============================================================
CREATE TABLE IF NOT EXISTS group_schemes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  required_members INTEGER DEFAULT 5,
  current_members INTEGER DEFAULT 1,
  status TEXT DEFAULT 'forming', -- forming/ready/applied/closed
  creator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP_MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES group_schemes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- creator/member
  status TEXT DEFAULT 'active', -- active/pending/left
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ============================================================
-- WAITING_LIST
-- ============================================================
CREATE TABLE IF NOT EXISTS waiting_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheme_id UUID REFERENCES schemes(id) ON DELETE SET NULL,
  group_id UUID REFERENCES group_schemes(id) ON DELETE SET NULL,
  location TEXT,
  required_members INTEGER,
  business_type TEXT,
  status TEXT DEFAULT 'waiting', -- waiting/matched/joined/expired
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PUBLIC_GROUP_PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public_group_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  business_type TEXT,
  business_category TEXT,
  district TEXT,
  state TEXT,
  category_visibility BOOLEAN DEFAULT FALSE,
  seeking_members BOOLEAN DEFAULT FALSE,
  language TEXT DEFAULT 'en',
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_message TEXT NOT NULL,
  original_language TEXT,
  translated_message TEXT,
  target_language TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- ============================================================
-- GOVERNMENT_OPPORTUNITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS government_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  department TEXT,
  category TEXT,
  location TEXT,
  tender_value TEXT,
  deadline TIMESTAMPTZ,
  official_url TEXT,
  source_url TEXT,
  source_type TEXT, -- gem/tender/procurement/ministry
  published_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OPPORTUNITY_MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS opportunity_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES government_opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_reason TEXT,
  match_score INTEGER,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(opportunity_id, user_id)
);

-- ============================================================
-- AI_RESEARCH_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_research_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT,
  source TEXT,
  response_summary TEXT,
  citations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI_CHAT_MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  role TEXT NOT NULL, -- user/assistant
  content TEXT NOT NULL,
  language TEXT,
  citations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSLATIONS_CACHE
-- ============================================================
CREATE TABLE IF NOT EXISTS translations_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_schemes_slug ON schemes(slug);
CREATE INDEX IF NOT EXISTS idx_schemes_state ON schemes(state);
CREATE INDEX IF NOT EXISTS idx_schemes_active ON schemes(is_active);
CREATE INDEX IF NOT EXISTS idx_scheme_rules_scheme ON scheme_rules(scheme_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_scheme ON applications(scheme_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_user ON waiting_list(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_matches_user ON opportunity_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_translations_cache_lookup ON translations_cache(source_language, target_language, source_text);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE USING (auth.uid() = user_id);

-- Schemes (public read)
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active schemes" ON schemes FOR SELECT USING (is_active = true);

-- Scheme Rules (public read)
ALTER TABLE scheme_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scheme rules" ON scheme_rules FOR SELECT USING (true);

-- Scheme Sources (public read)
ALTER TABLE scheme_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scheme sources" ON scheme_sources FOR SELECT USING (true);

-- Applications
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own applications" ON applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON applications FOR UPDATE USING (auth.uid() = user_id);

-- Application Steps
ALTER TABLE application_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own application steps" ON application_steps FOR SELECT 
  USING (EXISTS (SELECT 1 FROM applications WHERE applications.id = application_steps.application_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can insert own application steps" ON application_steps FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM applications WHERE applications.id = application_steps.application_id AND applications.user_id = auth.uid()));
CREATE POLICY "Users can update own application steps" ON application_steps FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM applications WHERE applications.id = application_steps.application_id AND applications.user_id = auth.uid()));

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Saved Schemes
ALTER TABLE saved_schemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saved schemes" ON saved_schemes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved schemes" ON saved_schemes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved schemes" ON saved_schemes FOR DELETE USING (auth.uid() = user_id);

-- Group Schemes (public read for discovery)
ALTER TABLE group_schemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view forming groups" ON group_schemes FOR SELECT USING (status = 'forming');
CREATE POLICY "Creators can insert groups" ON group_schemes FOR INSERT WITH CHECK (auth.uid() = creator_user_id);
CREATE POLICY "Creators can update groups" ON group_schemes FOR UPDATE USING (auth.uid() = creator_user_id);

-- Group Members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group members" ON group_members FOR SELECT 
  USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()));
CREATE POLICY "Users can join groups" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own membership" ON group_members FOR UPDATE USING (auth.uid() = user_id);

-- Waiting List
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own waiting list" ON waiting_list FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view waiting entries" ON waiting_list FOR SELECT USING (status = 'waiting');
CREATE POLICY "Users can insert waiting list" ON waiting_list FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own waiting list" ON waiting_list FOR UPDATE USING (auth.uid() = user_id);

-- Public Group Profiles (public read for discovery)
ALTER TABLE public_group_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view public profiles" ON public_group_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own public profile" ON public_group_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own public profile" ON public_group_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Receivers can update messages" ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- Government Opportunities (public read)
ALTER TABLE government_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active opportunities" ON government_opportunities FOR SELECT USING (is_active = true);

-- Opportunity Matches
ALTER TABLE opportunity_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own matches" ON opportunity_matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own matches" ON opportunity_matches FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AI Research Logs
ALTER TABLE ai_research_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own research" ON ai_research_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert research" ON ai_research_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AI Chat Messages
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chats" ON ai_chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert chats" ON ai_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Translations Cache (public read/write for caching)
ALTER TABLE translations_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read translations" ON translations_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can cache translations" ON translations_cache FOR INSERT WITH CHECK (true);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER schemes_updated_at BEFORE UPDATE ON schemes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER group_schemes_updated_at BEFORE UPDATE ON group_schemes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER public_group_profiles_updated_at BEFORE UPDATE ON public_group_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    user_id,
    preferred_language,
    onboarding_completed,
    onboarding_step,
    profile_completion_percentage,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en'),
    false,
    1,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Prevent trigger failure from blocking user creation
    RETURN NEW;
END;
$$;

-- Table and Schema permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA: SCHEMES
-- ============================================================

INSERT INTO schemes (id, name, name_hi, name_ta, slug, description, ministry, state, scheme_type, benefit, benefit_amount, application_method, official_url, source_url, source_type, last_verified_at, eligibility_summary, required_documents, target_categories, target_genders, target_business_types, target_states, min_age, max_age, min_income, max_income, requires_udyam, requires_disability, residence_type, group_scheme, required_members) VALUES

('a0000001-0000-0000-0000-000000000001', 'PM SVANidhi - Street Vendor''s AtmaNirbhar Nidhi', 'पीएम स्वनिधि', 'PM SVANidhi', 'pm-svanidhi', 'Micro credit facility for street vendors affected by COVID-19. Provides working capital loan up to ₹50,000.', 'Ministry of Housing and Urban Affairs', NULL, 'loan', 'Working capital loan for street vendors', '₹10,000 - ₹50,000', 'Online via pmsvanidhi.mohua.gov.in', 'https://pmsvanidhi.mohua.gov.in/', 'https://www.myscheme.gov.in/schemes/pmsvanidhi', 'myscheme', NOW(), 'Street vendors with vending certificate or survey identification. Age 18+.', ARRAY['aadhaar', 'pan', 'bank_statement', 'vending_certificate'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['street_vending','retail','food'], NULL, 18, 65, NULL, NULL, false, false, 'urban', false, 1),

('a0000001-0000-0000-0000-000000000002', 'PMEGP - Prime Minister Employment Generation Programme', 'पीएमईजीपी', 'PMEGP', 'pmegp', 'Credit-linked subsidy for setting up micro enterprises. Provides margin money subsidy of 15-35% for projects up to ₹50 lakh in manufacturing and ₹20 lakh in service sector.', 'Ministry of MSME', NULL, 'subsidy', 'Margin money subsidy for new enterprises', '15-35% subsidy on project cost', 'Online via kviconline.gov.in', 'https://www.kviconline.gov.in/pmegpeportal/', 'https://www.myscheme.gov.in/schemes/pmegp', 'myscheme', NOW(), 'Age 18+. For manufacturing projects up to ₹50 lakh and service projects up to ₹20 lakh. Higher subsidy for SC/ST/OBC/minority/women/disabled.', ARRAY['aadhaar', 'pan', 'community_certificate', 'income_certificate', 'bank_statement'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['manufacturing','tailoring','food_processing','handicraft','service'], NULL, 18, 65, NULL, NULL, false, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000003', 'Stand-Up India Scheme', 'स्टैंड-अप इंडिया', 'Stand-Up India', 'stand-up-india', 'Facilitates bank loans between ₹10 lakh and ₹1 crore to at least one SC/ST and one woman borrower per bank branch for greenfield enterprises.', 'Ministry of Finance / SIDBI', NULL, 'loan', 'Bank loan for greenfield enterprise', '₹10 lakh - ₹1 crore', 'Online via standupmitra.in', 'https://www.standupmitra.in/', 'https://www.myscheme.gov.in/schemes/sui', 'myscheme', NOW(), 'SC/ST and/or Women entrepreneurs. Age 18+. For greenfield (new) enterprise in manufacturing, services, or trading.', ARRAY['aadhaar', 'pan', 'community_certificate', 'income_certificate', 'business_plan'], ARRAY['sc','st'], ARRAY['male','female','other'], ARRAY['manufacturing','service','trading','tailoring'], NULL, 18, 65, NULL, NULL, false, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000004', 'Mudra Yojana - PMMY', 'मुद्रा योजना', 'முத்ரா யோஜனா', 'mudra-yojana', 'Provides loans up to ₹10 lakh to non-corporate, non-farm small/micro enterprises. Three categories: Shishu (up to ₹50,000), Kishore (₹50,001 - ₹5 lakh), Tarun (₹5 lakh - ₹10 lakh).', 'Ministry of Finance', NULL, 'loan', 'Collateral-free loans for micro enterprises', 'Up to ₹10 lakh', 'Through banks, MFIs, NBFCs', 'https://www.mudra.org.in/', 'https://www.myscheme.gov.in/schemes/pmmy', 'myscheme', NOW(), 'Any Indian citizen with a business plan for non-farm income generating activity. No collateral required.', ARRAY['aadhaar', 'pan', 'address_proof'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['manufacturing','service','trading','tailoring','food','retail','handicraft'], NULL, 18, 65, NULL, NULL, false, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000005', 'National SC/ST Hub Scheme', 'राष्ट्रीय अनुसूचित जाति/जनजाति हब योजना', 'தேசிய SC/ST Hub திட்டம்', 'national-sc-st-hub', 'Provides professional support to SC/ST entrepreneurs for public procurement and GeM registration. Capacity building and handholding support.', 'Ministry of MSME', NULL, 'training', 'Procurement support and capacity building for SC/ST entrepreneurs', 'Training, handholding, GeM support', 'Through NSSH portal', 'https://www.nssh.in/', 'https://www.myscheme.gov.in/schemes/nssh', 'myscheme', NOW(), 'SC/ST entrepreneurs with existing or planned MSME enterprise.', ARRAY['aadhaar', 'community_certificate', 'udyam_certificate'], ARRAY['sc','st'], ARRAY['male','female','other'], ARRAY['manufacturing','service','trading','tailoring','food_processing','handicraft'], NULL, 18, 65, NULL, NULL, true, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000006', 'PM Vishwakarma Yojana', 'पीएम विश्वकर्मा योजना', 'PM விஸ்வகர்மா திட்டம்', 'pm-vishwakarma', 'End-to-end support for traditional artisans and craftspeople through recognition, skill upgradation, toolkit incentive, credit support, and market linkage.', 'Ministry of MSME', NULL, 'subsidy', 'Skill training + toolkit + credit support for artisans', 'Up to ₹3 lakh loan + toolkit grant', 'Online via pmvishwakarma.gov.in', 'https://pmvishwakarma.gov.in/', 'https://www.myscheme.gov.in/schemes/pmvy', 'myscheme', NOW(), 'Traditional artisans and craftspeople working with hands and tools. 18 traditional trades including tailor, carpenter, blacksmith, etc.', ARRAY['aadhaar', 'pan', 'bank_statement'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['tailoring','handicraft','carpentry','blacksmith','goldsmith','pottery','weaving'], NULL, 18, 65, NULL, NULL, false, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000007', 'TNSRLM - Puthu Vazhvu Project', 'तमिलनाडु पुथु वाझ्वु', 'புது வாழ்வு திட்டம்', 'tnsrlm-puthu-vazhvu', 'Tamil Nadu State Rural Livelihoods Mission promoting self-employment through SHGs and enterprise development. Provides revolving fund and community investment fund.', 'TN Department of Rural Development', 'Tamil Nadu', 'grant', 'SHG formation + revolving fund + enterprise support', 'Revolving fund ₹15,000 per SHG + CIF', 'Through block-level TNSRLM offices', 'https://www.tnsrlm.tn.gov.in/', 'https://www.tnsrlm.tn.gov.in/', 'state_portal', NOW(), 'Rural women in Tamil Nadu. BPL households preferred. Must form or join SHG.', ARRAY['aadhaar', 'income_certificate', 'address_proof'], ARRAY['general','sc','st','obc','ews'], ARRAY['female'], ARRAY['tailoring','food','handicraft','agriculture','service'], ARRAY['Tamil Nadu'], 18, 60, NULL, 300000, false, false, 'rural', true, 5),

('a0000001-0000-0000-0000-000000000008', 'NEEDS - National Entrepreneurship Development Scheme for SC', 'एनईईडीएस', 'NEEDS திட்டம்', 'needs-sc', 'Provides financial assistance to SC entrepreneurs for setting up their own enterprise. Loan up to ₹15 lakh for SC/ST beneficiaries.', 'Ministry of Social Justice and Empowerment', NULL, 'loan', 'Concessional loan for SC entrepreneurs', 'Up to ₹15 lakh', 'Through NSFDC', 'https://nsfdc.nic.in/', 'https://www.myscheme.gov.in/schemes/needs', 'myscheme', NOW(), 'SC category. Age 18-50. Annual family income up to ₹3 lakh.', ARRAY['aadhaar', 'pan', 'community_certificate', 'income_certificate', 'bank_statement'], ARRAY['sc'], ARRAY['male','female','other'], ARRAY['manufacturing','service','trading','tailoring','food','retail'], NULL, 18, 50, NULL, 300000, false, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000009', 'NHFDC Scheme for Persons with Disabilities', 'एनएचएफडीसी विकलांग योजना', 'NHFDC மாற்றுத்திறனாளர் திட்டம்', 'nhfdc-disability', 'Concessional loans to persons with disabilities for self-employment. Up to ₹25 lakh for business ventures.', 'Department of Empowerment of Persons with Disabilities', NULL, 'loan', 'Concessional loan for disabled entrepreneurs', 'Up to ₹25 lakh at 5% interest', 'Through state channelizing agencies', 'https://www.nhfdc.nic.in/', 'https://www.myscheme.gov.in/schemes/nhfdc', 'myscheme', NOW(), 'Person with 40%+ disability. Age 18-55. Annual income up to ₹3 lakh.', ARRAY['aadhaar', 'pan', 'disability_certificate', 'income_certificate', 'bank_statement'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['manufacturing','service','trading','tailoring','food','retail','handicraft'], NULL, 18, 55, NULL, 300000, false, true, 'both', false, 1),

('a0000001-0000-0000-0000-000000000010', 'Tamil Nadu Adi Dravidar Housing and Development Corporation Loans', 'तमिलनाडु आदि द्रविड़ लोन', 'TAHDCO கடன் திட்டம்', 'tahdco-loans', 'Provides concessional loans to SC/ST entrepreneurs in Tamil Nadu for various business activities.', 'TN Adi Dravidar and Tribal Welfare Department', 'Tamil Nadu', 'loan', 'Subsidized loans for SC/ST entrepreneurs in TN', 'Up to ₹5 lakh at subsidized interest', 'Through TAHDCO offices', 'https://www.tahdco.tn.gov.in/', 'https://www.tahdco.tn.gov.in/', 'state_portal', NOW(), 'SC/ST category. Tamil Nadu resident. Age 18-55. Annual family income up to ₹3 lakh.', ARRAY['aadhaar', 'community_certificate', 'income_certificate', 'address_proof', 'bank_statement'], ARRAY['sc','st'], ARRAY['male','female','other'], ARRAY['manufacturing','service','trading','tailoring','food','retail'], ARRAY['Tamil Nadu'], 18, 55, NULL, 300000, false, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000011', 'Credit Guarantee Fund Trust for Micro and Small Enterprises', 'सीजीटीएमएसई', 'CGTMSE', 'cgtmse', 'Collateral-free credit facility for micro and small enterprises. Guarantees up to ₹5 crore.', 'Ministry of MSME', NULL, 'loan', 'Credit guarantee for collateral-free loans', 'Guarantee cover up to ₹5 crore', 'Through member lending institutions', 'https://www.cgtmse.in/', 'https://www.myscheme.gov.in/schemes/cgtmse', 'myscheme', NOW(), 'New and existing micro/small enterprises. Udyam registration required.', ARRAY['aadhaar', 'pan', 'udyam_certificate', 'business_plan', 'bank_statement'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['manufacturing','service','trading','tailoring','food_processing'], NULL, 18, 65, NULL, NULL, true, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000012', 'Pradhan Mantri Kaushal Vikas Yojana (PMKVY)', 'प्रधानमंत्री कौशल विकास योजना', 'PMKVY திறன் மேம்பாட்டு திட்டம்', 'pmkvy', 'Skill development and certification scheme for Indian youth. Free short-term training with placement support.', 'Ministry of Skill Development and Entrepreneurship', NULL, 'training', 'Free skill training and certification', 'Free training + ₹8,000 reward on certification', 'Through training centers / Skill India portal', 'https://www.pmkvyofficial.org/', 'https://www.myscheme.gov.in/schemes/pmkvy', 'myscheme', NOW(), 'Indian citizens aged 15-45. No minimum education for many trades. Priority for SC/ST/OBC/minority/women.', ARRAY['aadhaar', 'address_proof'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['tailoring','manufacturing','service','food','handicraft','retail'], NULL, 15, 45, NULL, NULL, false, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000013', 'Startup India Seed Fund Scheme', 'स्टार्टअप इंडिया सीड फंड', 'Startup India Seed Fund', 'startup-india-seed', 'Provides financial assistance to startups for proof of concept, prototype development, product trials and market entry.', 'DPIIT', NULL, 'grant', 'Seed funding for recognized startups', 'Up to ₹20 lakh for validation, ₹50 lakh for market entry', 'Online through Startup India portal', 'https://www.startupindia.gov.in/', 'https://www.myscheme.gov.in/schemes/sisfs', 'myscheme', NOW(), 'DPIIT recognized startup. Incorporated not more than 2 years ago. Revenue not exceeding ₹25 crore.', ARRAY['aadhaar', 'pan', 'udyam_certificate', 'business_registration', 'bank_statement'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['manufacturing','service','technology','food_processing'], NULL, 18, 65, NULL, NULL, true, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000014', 'Mahila E-Haat', 'महिला ई-हाट', 'மகிளா E-Haat', 'mahila-e-haat', 'Online marketing platform for women entrepreneurs/SHGs/NGOs to showcase products. Provides direct marketing access.', 'Ministry of Women and Child Development', NULL, 'training', 'Online marketplace for women entrepreneurs', 'Free online platform + marketing support', 'Registration on mahilaehaat-rmk.gov.in', 'http://mahilaehaat-rmk.gov.in/', 'https://www.myscheme.gov.in/schemes/meh', 'myscheme', NOW(), 'Women entrepreneurs, SHGs, NGOs. Must have products/services to sell.', ARRAY['aadhaar', 'bank_statement'], ARRAY['general','sc','st','obc','ews'], ARRAY['female'], ARRAY['tailoring','handicraft','food','retail','manufacturing'], NULL, 18, 65, NULL, NULL, false, false, 'both', false, 1),

('a0000001-0000-0000-0000-000000000015', 'Udyam Registration', 'उद्यम पंजीकरण', 'உத்யம் பதிவு', 'udyam-registration', 'Free registration of micro, small and medium enterprises. Provides Udyam Registration Number which enables access to multiple MSME schemes and benefits.', 'Ministry of MSME', NULL, 'subsidy', 'Free MSME registration + access to government benefits', 'Free registration + scheme eligibility', 'Online via udyamregistration.gov.in', 'https://udyamregistration.gov.in/', 'https://www.myscheme.gov.in/schemes/ur', 'myscheme', NOW(), 'Any Indian citizen with business activity in manufacturing or service sector. Based on Aadhaar.', ARRAY['aadhaar', 'pan'], ARRAY['general','sc','st','obc','ews'], ARRAY['male','female','other'], ARRAY['manufacturing','service','trading','tailoring','food','retail','handicraft'], NULL, 18, 65, NULL, NULL, false, false, 'both', false, 1);

-- ============================================================
-- SEED DATA: SCHEME RULES (for eligibility engine)
-- ============================================================

-- Stand-Up India rules
INSERT INTO scheme_rules (scheme_id, rule_type, field_name, operator, expected_value, explanation, required) VALUES
('a0000001-0000-0000-0000-000000000003', 'category', 'community_category', 'in', 'sc,st', 'Must be SC or ST category', true),
('a0000001-0000-0000-0000-000000000003', 'age', 'age', 'gte', '18', 'Must be 18 years or older', true),
('a0000001-0000-0000-0000-000000000003', 'business', 'business_status', 'eq', 'starting', 'Must be a greenfield (new) enterprise', true);

-- NEEDS SC rules
INSERT INTO scheme_rules (scheme_id, rule_type, field_name, operator, expected_value, explanation, required) VALUES
('a0000001-0000-0000-0000-000000000008', 'category', 'community_category', 'eq', 'sc', 'Must be SC category', true),
('a0000001-0000-0000-0000-000000000008', 'age', 'age', 'gte', '18', 'Must be 18 years or older', true),
('a0000001-0000-0000-0000-000000000008', 'age', 'age', 'lte', '50', 'Must be 50 years or younger', true),
('a0000001-0000-0000-0000-000000000008', 'income', 'annual_income', 'lte', '300000', 'Annual family income must not exceed ₹3 lakh', true);

-- NHFDC Disability rules
INSERT INTO scheme_rules (scheme_id, rule_type, field_name, operator, expected_value, explanation, required) VALUES
('a0000001-0000-0000-0000-000000000009', 'disability', 'disability_status', 'eq', 'true', 'Must be a person with disability', true),
('a0000001-0000-0000-0000-000000000009', 'disability', 'disability_percentage', 'gte', '40', 'Disability must be 40% or more', true),
('a0000001-0000-0000-0000-000000000009', 'age', 'age', 'gte', '18', 'Must be 18 years or older', true),
('a0000001-0000-0000-0000-000000000009', 'income', 'annual_income', 'lte', '300000', 'Annual family income must not exceed ₹3 lakh', true);

-- PM Vishwakarma rules
INSERT INTO scheme_rules (scheme_id, rule_type, field_name, operator, expected_value, explanation, required) VALUES
('a0000001-0000-0000-0000-000000000006', 'business', 'business_type', 'in', 'tailoring,handicraft,carpentry,blacksmith,goldsmith,pottery,weaving', 'Must be a traditional artisan trade', true),
('a0000001-0000-0000-0000-000000000006', 'age', 'age', 'gte', '18', 'Must be 18 years or older', true);

-- TAHDCO rules
INSERT INTO scheme_rules (scheme_id, rule_type, field_name, operator, expected_value, explanation, required) VALUES
('a0000001-0000-0000-0000-000000000010', 'category', 'community_category', 'in', 'sc,st', 'Must be SC or ST category', true),
('a0000001-0000-0000-0000-000000000010', 'state', 'state', 'eq', 'Tamil Nadu', 'Must be Tamil Nadu resident', true),
('a0000001-0000-0000-0000-000000000010', 'age', 'age', 'gte', '18', 'Must be 18 years or older', true),
('a0000001-0000-0000-0000-000000000010', 'income', 'annual_income', 'lte', '300000', 'Annual family income must not exceed ₹3 lakh', true);

-- ============================================================
-- SEED DATA: SCHEME SOURCES
-- ============================================================
INSERT INTO scheme_sources (scheme_id, url, domain, source_title, source_excerpt, is_official) VALUES
('a0000001-0000-0000-0000-000000000001', 'https://pmsvanidhi.mohua.gov.in/', 'pmsvanidhi.mohua.gov.in', 'PM SVANidhi Official Portal', 'Official portal for PM Street Vendor AtmaNirbhar Nidhi', true),
('a0000001-0000-0000-0000-000000000002', 'https://www.kviconline.gov.in/pmegpeportal/', 'kviconline.gov.in', 'PMEGP Official Portal', 'Official KVIC portal for PMEGP scheme', true),
('a0000001-0000-0000-0000-000000000003', 'https://www.standupmitra.in/', 'standupmitra.in', 'Stand-Up India Portal', 'Official Stand-Up Mitra portal for Stand-Up India scheme', true),
('a0000001-0000-0000-0000-000000000004', 'https://www.mudra.org.in/', 'mudra.org.in', 'MUDRA Official Portal', 'Official MUDRA Yojana portal', true),
('a0000001-0000-0000-0000-000000000006', 'https://pmvishwakarma.gov.in/', 'pmvishwakarma.gov.in', 'PM Vishwakarma Official Portal', 'Official PM Vishwakarma Yojana portal', true);

-- ============================================================
-- SEED DATA: GOVERNMENT OPPORTUNITIES
-- ============================================================
INSERT INTO government_opportunities (id, title, description, department, category, location, tender_value, deadline, official_url, source_url, source_type, published_at) VALUES

('b0000001-0000-0000-0000-000000000001', 'Supply of School Uniforms - Chennai Corporation', 'Procurement of 5,000 school uniforms for Chennai Corporation schools. Preference for local MSME vendors.', 'Greater Chennai Corporation - Education Department', 'textile', 'Chennai, Tamil Nadu', '₹25,00,000', '2026-10-15 23:59:59+05:30', 'https://www.chennaicorporation.gov.in/tenders', 'https://gem.gov.in/', 'gem', NOW()),

('b0000001-0000-0000-0000-000000000002', 'Tailoring Services for Government Hospital Staff', 'Annual contract for stitching uniforms for government hospital staff. Approximately 2,000 sets required.', 'Tamil Nadu Health Department', 'textile', 'Tamil Nadu', '₹12,00,000', '2026-11-01 23:59:59+05:30', 'https://www.tn.gov.in/tenders', 'https://gem.gov.in/', 'gem', NOW()),

('b0000001-0000-0000-0000-000000000003', 'Handloom Products for Government Emporium', 'Supply of handloom/handcraft products for Co-optex retail outlets. Multiple product categories.', 'Tamil Nadu Handloom Weavers Co-operative Society', 'handicraft', 'Tamil Nadu', '₹50,00,000', '2026-12-31 23:59:59+05:30', 'https://www.cooptex.com/', 'https://www.cooptex.com/', 'tender', NOW()),

('b0000001-0000-0000-0000-000000000004', 'Catering Services for Government Training Centers', 'Catering and food preparation services for ITI and government training centers in Chennai district.', 'Directorate of Industrial Training, TN', 'food', 'Chennai, Tamil Nadu', '₹8,00,000', '2026-10-30 23:59:59+05:30', 'https://www.tn.gov.in/tenders', 'https://gem.gov.in/', 'gem', NOW()),

('b0000001-0000-0000-0000-000000000005', 'Printing and Stationery Supply', 'Supply of printed materials and stationery items for government offices. Open for MSME vendors with Udyam registration.', 'Directorate of Stationery and Printing', 'manufacturing', 'Tamil Nadu', '₹15,00,000', '2026-11-15 23:59:59+05:30', 'https://www.tn.gov.in/tenders', 'https://gem.gov.in/', 'gem', NOW()),

('b0000001-0000-0000-0000-000000000006', 'Skill Training Partner for Apparel Making', 'Empanelment of training partners for conducting apparel-making / tailoring courses under PMKVY in multiple districts.', 'National Skill Development Corporation', 'training', 'Pan India', 'As per NSDC norms', '2026-12-01 23:59:59+05:30', 'https://www.nsdcindia.org/', 'https://www.nsdcindia.org/', 'tender', NOW()),

('b0000001-0000-0000-0000-000000000007', 'Supply of Traditional Craft Items for Cultural Events', 'Procurement of traditional handicraft and artisan products for display and sale during Republic Day and Independence Day cultural events.', 'Ministry of Culture', 'handicraft', 'New Delhi', '₹10,00,000', '2026-11-30 23:59:59+05:30', 'https://www.indiaculture.gov.in/', 'https://gem.gov.in/', 'gem', NOW()),

('b0000001-0000-0000-0000-000000000008', 'Women SHG Products Procurement', 'Government procurement of products manufactured by women SHGs. Categories include garments, food products, and handicrafts.', 'Ministry of Rural Development', 'shg_products', 'Pan India', '₹1,00,00,000', '2027-03-31 23:59:59+05:30', 'https://rural.nic.in/', 'https://gem.gov.in/', 'gem', NOW());

-- ============================================================
-- STORAGE BUCKET & STORAGE POLICIES
-- Creates private 'documents' bucket with user-isolated RLS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760, -- 10MB max limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- Storage RLS: Users can only upload, read, update, and delete their own files
CREATE POLICY "Users can upload own documents to storage"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own documents from storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own documents in storage"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own documents from storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

