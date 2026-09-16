import { t } from '../i18n';

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export const BUSINESS_TYPES = [
  'tailoring', 'food', 'food_processing', 'retail', 'trading', 'manufacturing',
  'handicraft', 'service', 'carpentry', 'blacksmith', 'goldsmith', 'pottery',
  'weaving', 'agriculture', 'technology', 'street_vending',
];

export const BUSINESS_CATEGORIES = [
  'Textile & Garment', 'Food & Catering', 'Handicraft & Artisan', 'Retail & Trading',
  'Manufacturing', 'Services', 'Agriculture & Farming', 'Technology & IT',
  'Beauty & Wellness', 'Transport & Logistics', 'Education & Training',
  'Healthcare', 'Construction', 'Other',
];

export const DOCUMENT_TYPES = [
  { key: 'aadhaar', label: 'Aadhaar Card' },
  { key: 'pan', label: 'PAN Card' },
  { key: 'community_certificate', label: 'Community / Caste Certificate' },
  { key: 'disability_certificate', label: 'Disability Certificate' },
  { key: 'income_certificate', label: 'Income Certificate' },
  { key: 'udyam_certificate', label: 'Udyam Certificate' },
  { key: 'business_registration', label: 'Business Registration' },
  { key: 'bank_statement', label: 'Bank Statement' },
  { key: 'address_proof', label: 'Address Proof' },
  { key: 'vending_certificate', label: 'Vending Certificate' },
  { key: 'business_plan', label: 'Business Plan' },
];

export function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return formatDate(dateStr);
}

export function maskAadhaar(value) {
  if (!value) return '';
  const clean = value.replace(/\s/g, '');
  if (clean.length < 4) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${clean.slice(-4)}`;
}

export function maskPAN(value) {
  if (!value) return '';
  if (value.length < 3) return 'XXXXXXXXXX';
  return `XXXXXX${value.slice(-4)}`;
}

export function getEligibilityColor(status) {
  switch (status) {
    case 'ELIGIBLE': return 'eligible';
    case 'NOT_ELIGIBLE': return 'not-eligible';
    case 'MORE_INFORMATION_REQUIRED':
    case 'DOCUMENT_MISSING':
    case 'CONDITIONALLY_ELIGIBLE':
      return 'more-info';
    default: return 'info';
  }
}

export function getStatusLabel(status, lang = 'en') {
  const map = {
    ELIGIBLE: 'scheme.eligible',
    NOT_ELIGIBLE: 'scheme.not_eligible',
    MORE_INFORMATION_REQUIRED: 'scheme.more_info',
    DOCUMENT_MISSING: 'scheme.document_missing',
    CONDITIONALLY_ELIGIBLE: 'scheme.conditionally_eligible',
  };
  if (map[status]) {
    return t(map[status], lang);
  }
  return status;
}
