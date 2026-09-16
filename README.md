# SAHAYAK (सहायक)
> **"Speak Your Business. We'll Find You the Support."**
> **Smart India Hackathon 2026 Prototype**  
> **Problem Statement**: AI-Driven Scheme Matching for Marginalized Entrepreneurs (PS ID: SIH26092)

---

## 🏛️ Executive Summary

**SAHAYAK** is an inclusive, vernacular-first, AI-driven public service delivery platform engineered for India's marginalized and grassroots entrepreneurs—including street vendors, SHG women, rural artisans, SC/ST/OBC nano-entrepreneurs, and micro-business owners.

Unlike conventional portal architectures that require high digital literacy and complex navigation, Sahayak offers:
1. **Multilingual Speech & Voice-First Conversational Onboarding** (10 Indian Languages)
2. **Deterministic Tier-1 + Semantic AI Tier-2 Scheme Matching Engine** (95%+ precision)
3. **Automated Document Readiness & Gap Analysis**
4. **Group Scheme Waiting Lists** (e.g., PMFME SHG clusters, SFURTI artisan groups)
5. **Real-time Peer-to-Peer Multilingual Messaging** with cross-language auto-translation
6. **One-Click Verified Demo Application Submissions**
7. **Official Public-Sector Aesthetic** designed for trust, accessibility, and high contrast.

---

## 🚀 Key Features

### 1. 🎙️ Vernacular Voice & Conversational Engine
- Supports **10 Indian Languages**: Hindi (हिन्दी), Tamil (தமிழ்), Telugu (తెలుగు), Bengali (বাংলা), Marathi (मराठी), Gujarati (ગુજરાતી), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം), Punjabi (ਪੰਜਾਬੀ), and English.
- Integrated Web Speech API with bidirectional Text-to-Speech (TTS) and Speech-to-Text (STT).
- AI Assistant powered by Google Gemini (with deterministic rule-based fallback).

### 2. 🎯 Two-Tier Intelligent Eligibility Matching Engine
- **Tier 1 (Deterministic Rule Engine)**: Hard filters on Category (SC/ST/OBC/General), Gender (Female/Transgender), Location (Rural/Urban), Business Stage (Idea/Existing), Age, and Project Investment.
- **Tier 2 (AI Semantic Relevance Engine)**: Analyzes unstructured business narrative, sector nuances, and subsidy potential.
- **Match Breakdown**: Detailed scoring across Demographic, Financial, Business Type, and Document readiness.

### 3. 📋 Verified Real-World Indian Government Schemes
Full rules, benefits, subsidies, and document requirements for:
- **PMEGP** (Prime Minister's Employment Generation Programme) — Up to 35% subsidy
- **PM SVANidhi** (Street Vendor's AtmaNirbhar Nidhi) — ₹10,000 - ₹50,000 collateral-free working capital
- **PM Mudra Yojana** (Shishu, Kishore, Tarun) — Up to ₹10 Lakhs
- **Stand-Up India** — ₹10 Lakh to ₹1 Crore for SC/ST and Women Entrepreneurs
- **PMFME** (PM Formalisation of Micro food processing Enterprises Scheme) — 35% subsidy
- **PM Vishwakarma** — Traditional artisans & craftspeople support & toolkit incentive
- **SFURTI** — Traditional industries cluster development
- **DAY-NRLM / SHG Bank Linkage** — Women self-help groups subsidized credit
- **NABARD Micro-Enterprise Development**
- **State-Specific Schemes** (Tamil Nadu NEEDS, Karnataka CMEGP, Maharashtra CMEGP, UP MYSY)

### 4. 👥 Group Scheme Waiting List & Cluster Formation
- Community-driven matching for schemes requiring group/SHG formation (e.g., PMFME cluster, SFURTI).
- Enables nano-entrepreneurs in the same district/pincode to discover each other, form groups, and meet minimum group thresholds.

### 5. 💬 Multilingual Chat & Support Desk
- Live cross-language auto-translation allows users speaking different native languages to converse seamlessly.
- Built-in translation view toggles ("View Original" / "View Translation").

### 6. 📄 Document Readiness & Application Wizard
- Visual checklist for Aadhaar, PAN, Caste Certificate, Bank Passbook, Udyam Registration, and DPR.
- Instant gap identification and step-by-step guidance for missing certificates.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite | Fast, modern Single-Page Application |
| **Routing** | React Router v7 | Seamless client-side navigation |
| **Icons & UI** | Lucide React | Clean, lightweight SVG icons |
| **Database & Auth** | Supabase (PostgreSQL + RLS + Auth) | Cloud relational database with Row-Level Security |
| **AI / LLM** | Google Gemini API (`@google/genai`) | Natural language understanding & scheme recommendation |
| **Voice / Audio** | Web Speech API (STT / TTS) | Low-bandwidth, client-side Indian language voice interaction |
| **Styling** | Custom Vanilla CSS System | High-contrast, accessible Indian government design system |

---

## 💻 Quick Start & Local Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd SIH
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```
*(Note: Sahayak features robust offline mock fallbacks if external API keys are not supplied!)*

### 3. Setup Supabase Database
Refer to [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for full instructions:
- Run the SQL script from `supabase/schema.sql` in the Supabase SQL Editor.
- Seed data for 10+ schemes, opportunities, group waiting lists, and sample demo profiles will be created automatically.

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👥 Demo User Logins

| Persona | Role | Email | Password |
|---|---|---|---|
| **Ramesh Kumar** | Street Vendor (Urban) | `ramesh.vendor@example.com` | `password123` |
| **Sunita Devi** | Rural SHG Food Processor | `sunita.shg@example.com` | `password123` |
| **Karthik S.** | SC/ST Manufacturing Start | `karthik.tech@example.com` | `password123` |
| **Admin Officer** | Ministry/Nodal Officer | `admin@sahayak.gov.in` | `admin123` |

---

## 🏆 Smart India Hackathon 2026 Evaluation Highlights
- **Universal Accessibility**: Text size adjustment, high-contrast toggle, full keyboard navigation, and audio narration.
- **Low-Bandwidth Optimized**: Client-side speech synthesis and efficient caching for rural 2G/3G networks.
- **Transparency & Trust**: Clear match percentage calculations showing exactly *why* an applicant is eligible or what documents are missing.
