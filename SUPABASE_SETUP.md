# SAHAYAK — Supabase Setup Guide

## Smart India Hackathon 2026 Prototype

---

## 1. Required Environment Variables

Create a `.env` file in the project root with:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

> **Security**: Never put the Supabase `service_role` key in frontend code. The anon/publishable key is safe for client-side use because Row Level Security protects all data.

---

## 2. Running the SQL Migration

### Option A: Supabase Dashboard (Recommended for Quick Setup)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run**

This will create:
- All 19 tables with proper foreign keys
- Indexes for performance
- Row Level Security policies on all tables
- Auto-update triggers for `updated_at` fields
- Auto-create profile trigger on user signup
- Seed data: 15 government schemes, 8 government opportunities

### Option B: Supabase CLI

```bash
supabase db push --db-url postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres < supabase/schema.sql
```

---

## 3. Creating the Storage Bucket

1. Go to **Storage** in your Supabase Dashboard
2. Click **New Bucket**
3. Name: `documents`
4. Set to **Private** (not public)
5. Click **Create bucket**

### Storage Policies

After creating the bucket, go to **Policies** and add:

**Upload Policy** (INSERT):
```sql
-- Users can upload their own documents
CREATE POLICY "Users upload own docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

**Read Policy** (SELECT):
```sql
-- Users can read their own documents
CREATE POLICY "Users read own docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

**Delete Policy** (DELETE):
```sql
-- Users can delete their own documents
CREATE POLICY "Users delete own docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 4. How Row Level Security (RLS) Works

RLS is enabled on **all user-owned tables**. This means:

### Private Data (only accessible by the owning user):
- `profiles` — User can only read/update their own profile
- `documents` — User can only access their own documents
- `applications` — User can only see their own applications
- `notifications` — User can only see their own notifications
- `ai_chat_messages` — User can only see their own chat history
- `ai_research_logs` — User can only see their own research logs

### Public/Shared Data:
- `schemes` — Anyone (authenticated) can read active schemes
- `scheme_rules` — Anyone can read scheme eligibility rules
- `scheme_sources` — Anyone can read scheme source information
- `government_opportunities` — Anyone can read active opportunities
- `public_group_profiles` — Anyone can read (intentionally public data only)
- `group_schemes` — Anyone can see groups with status "forming"

### Controlled Access:
- `messages` — User can see messages where they are sender OR receiver
- `group_members` — Members of a group can see other members in that group
- `waiting_list` — Users can see their own entries + public "waiting" entries
- `translations_cache` — Any authenticated user can read/write (shared cache)

### What's NEVER exposed to other users:
- ❌ Aadhaar/PAN numbers
- ❌ Bank details
- ❌ Full address
- ❌ Income information
- ❌ Private certificates
- ❌ Phone numbers
- ❌ Authentication credentials

---

## 5. How to Start the Application

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

The app will start at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

---

## 6. Database Schema Overview

| Table | Purpose |
|-------|---------|
| `profiles` | User identity, eligibility, and business information |
| `documents` | Document metadata (files stored in Storage bucket) |
| `schemes` | Government scheme records with eligibility criteria |
| `scheme_rules` | Structured eligibility rules for the matching engine |
| `scheme_sources` | Official source URLs and citations for schemes |
| `applications` | User scheme applications with progress tracking |
| `application_steps` | Individual steps within each application |
| `notifications` | User notifications (incomplete apps, updates, etc.) |
| `saved_schemes` | User's bookmarked/saved schemes |
| `group_schemes` | Group-based scheme applications |
| `group_members` | Members of each group scheme |
| `waiting_list` | Waiting list entries for group schemes |
| `public_group_profiles` | Limited public profiles for group discovery |
| `messages` | Multilingual messages between users |
| `government_opportunities` | Tender/procurement opportunities |
| `opportunity_matches` | Matched opportunities for each user |
| `ai_research_logs` | AI research query logs |
| `ai_chat_messages` | Chatbot conversation history |
| `translations_cache` | Cached translations to reduce API calls |

---

## 7. Seed Data

The schema includes seed data for:
- **15 Government Schemes** with real scheme names, official URLs, and eligibility criteria
- **8 Government Opportunities** (tenders/procurement)
- **Scheme Rules** for eligibility engine matching
- **Scheme Sources** with official portal URLs

All seed scheme data references real Indian government schemes from sources like myScheme.gov.in.

---

## 8. Testing Checklist

After setup, verify:

- [ ] Sign up creates a new user
- [ ] Login works with correct credentials
- [ ] Profile is auto-created on signup
- [ ] Onboarding form saves progress
- [ ] Documents upload to Storage bucket
- [ ] Schemes load on dashboard
- [ ] Eligibility engine checks work
- [ ] Applications can be created
- [ ] Notifications appear
- [ ] AI Chat connects to Gemini
- [ ] Data persists after page refresh

---

## 9. Demo User

For hackathon judges, create a user with this profile:

| Field | Value |
|-------|-------|
| Name | Ravi Kumar |
| Age | 32 |
| Language | Tamil |
| State | Tamil Nadu |
| District | Chennai |
| Category | SC |
| Disability | No |
| Annual Income | ₹2,00,000 |
| Business | Tailoring (Starting) |
| Capital Required | ₹2,00,000 |

Documents to upload:
- ✓ Aadhaar
- ✓ PAN
- ✓ SC Certificate
- ✓ Income Certificate
- ⚠ Udyam (missing)
- ⚠ Bank Statement (missing)
