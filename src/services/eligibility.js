// ============================================================
// SAHAYAK - Local Eligibility Engine
// Rule-based eligibility checking against user profile
// ============================================================

export class EligibilityEngine {
  /**
   * Check a user's eligibility for a scheme using local rule-based evaluation.
   * Falls back to Gemini for complex analysis.
   */
  static checkEligibility(scheme, profile, documents) {
    if (!scheme || !profile) {
      return {
        status: 'MORE_INFORMATION_REQUIRED',
        readiness_percentage: 0,
        checks: [],
        missing_documents: [],
        missing_requirements: ['Profile information incomplete'],
        action_items: ['Complete your profile to check eligibility'],
      };
    }

    const checks = [];
    const missingDocs = [];
    const missingReqs = [];
    const actionItems = [];
    let passedChecks = 0;
    let totalChecks = 0;

    // Age check
    if (scheme.min_age || scheme.max_age) {
      totalChecks++;
      const age = profile.dob ? this.calculateAge(profile.dob) : null;
      if (age === null) {
        checks.push({ field: 'age', label: 'Age', passed: null, reason: 'Date of birth not provided' });
        missingReqs.push('Date of birth required');
        actionItems.push('Add your date of birth in profile');
      } else {
        const ageOk = (!scheme.min_age || age >= scheme.min_age) && (!scheme.max_age || age <= scheme.max_age);
        checks.push({
          field: 'age', label: 'Age',
          passed: ageOk,
          reason: ageOk
            ? `Age ${age} is within required range (${scheme.min_age || '–'}–${scheme.max_age || '–'})`
            : `Age requirement: ${scheme.min_age || '–'}–${scheme.max_age || '–'}. Your profile: ${age}`
        });
        if (ageOk) passedChecks++;
      }
    }

    // Gender check
    if (scheme.target_genders && scheme.target_genders.length > 0 && !scheme.target_genders.includes('male') || !scheme.target_genders?.includes('female')) {
      if (scheme.target_genders && !scheme.target_genders.includes('male') && !scheme.target_genders.includes('female') && !scheme.target_genders.includes('other')) {
        // Skip if all genders are included
      } else if (scheme.target_genders && scheme.target_genders.length < 3) {
        totalChecks++;
        if (!profile.gender) {
          checks.push({ field: 'gender', label: 'Gender', passed: null, reason: 'Gender not specified' });
          missingReqs.push('Gender information required');
        } else {
          const genderOk = scheme.target_genders.includes(profile.gender);
          checks.push({
            field: 'gender', label: 'Gender',
            passed: genderOk,
            reason: genderOk ? 'Gender matches scheme requirement' : `Scheme is for: ${scheme.target_genders.join(', ')}`
          });
          if (genderOk) passedChecks++;
        }
      }
    }

    // Category check
    if (scheme.target_categories && scheme.target_categories.length > 0 && scheme.target_categories.length < 5) {
      totalChecks++;
      if (!profile.community_category) {
        checks.push({ field: 'community_category', label: 'Community Category', passed: null, reason: 'Category not specified' });
        missingReqs.push('Community category required');
        actionItems.push('Add your community category in profile');
      } else {
        const catOk = scheme.target_categories.includes(profile.community_category.toLowerCase());
        checks.push({
          field: 'community_category', label: 'Community Category',
          passed: catOk,
          reason: catOk ? `Category "${profile.community_category}" matches` : `Scheme targets: ${scheme.target_categories.join(', ').toUpperCase()}`
        });
        if (catOk) passedChecks++;
      }
    }

    // State check
    if (scheme.target_states && scheme.target_states.length > 0) {
      totalChecks++;
      if (!profile.state) {
        checks.push({ field: 'state', label: 'State', passed: null, reason: 'State not specified' });
        missingReqs.push('State information required');
      } else {
        const stateOk = scheme.target_states.includes(profile.state);
        checks.push({
          field: 'state', label: 'State',
          passed: stateOk,
          reason: stateOk ? `State "${profile.state}" matches` : `Scheme available in: ${scheme.target_states.join(', ')}`
        });
        if (stateOk) passedChecks++;
      }
    }

    // Income check
    if (scheme.max_income) {
      totalChecks++;
      if (!profile.annual_income && profile.annual_income !== 0) {
        checks.push({ field: 'income', label: 'Annual Income', passed: null, reason: 'Income not specified' });
        missingReqs.push('Annual income required');
        actionItems.push('Add your annual income in profile');
      } else {
        const incomeOk = Number(profile.annual_income) <= Number(scheme.max_income);
        checks.push({
          field: 'income', label: 'Annual Income',
          passed: incomeOk,
          reason: incomeOk ? `Income ₹${Number(profile.annual_income).toLocaleString('en-IN')} within limit` : `Maximum income: ₹${Number(scheme.max_income).toLocaleString('en-IN')}. Your income: ₹${Number(profile.annual_income).toLocaleString('en-IN')}`
        });
        if (incomeOk) passedChecks++;
      }
    }

    // Disability check
    if (scheme.requires_disability) {
      totalChecks++;
      const disOk = profile.disability_status === true;
      checks.push({
        field: 'disability', label: 'Disability Status',
        passed: disOk,
        reason: disOk ? 'Disability status confirmed' : 'Scheme requires person with disability'
      });
      if (disOk) passedChecks++;

      if (scheme.min_disability_percentage && scheme.min_disability_percentage > 0) {
        totalChecks++;
        const pctOk = (profile.disability_percentage || 0) >= scheme.min_disability_percentage;
        checks.push({
          field: 'disability_percentage', label: 'Disability Percentage',
          passed: pctOk,
          reason: pctOk ? `${profile.disability_percentage}% meets minimum ${scheme.min_disability_percentage}%` : `Minimum ${scheme.min_disability_percentage}% required. Your profile: ${profile.disability_percentage || 0}%`
        });
        if (pctOk) passedChecks++;
      }
    }

    // Udyam check
    if (scheme.requires_udyam) {
      totalChecks++;
      const udyamOk = profile.udyam_registered === true;
      checks.push({
        field: 'udyam', label: 'Udyam Registration',
        passed: udyamOk,
        reason: udyamOk ? 'Udyam registration confirmed' : 'Udyam registration required'
      });
      if (udyamOk) passedChecks++;
      if (!udyamOk) {
        actionItems.push('Complete Udyam registration at udyamregistration.gov.in');
      }
    }

    // Business type check
    if (scheme.target_business_types && scheme.target_business_types.length > 0) {
      totalChecks++;
      if (!profile.business_type) {
        checks.push({ field: 'business_type', label: 'Business Type', passed: null, reason: 'Business type not specified' });
        missingReqs.push('Business type required');
      } else {
        const bizOk = scheme.target_business_types.some(bt =>
          profile.business_type.toLowerCase().includes(bt.toLowerCase()) ||
          bt.toLowerCase().includes(profile.business_type.toLowerCase())
        );
        checks.push({
          field: 'business_type', label: 'Business Type',
          passed: bizOk,
          reason: bizOk ? `Business type "${profile.business_type}" matches` : `Scheme targets: ${scheme.target_business_types.join(', ')}`
        });
        if (bizOk) passedChecks++;
      }
    }

    // Residence type check
    if (scheme.residence_type && scheme.residence_type !== 'both') {
      totalChecks++;
      if (!profile.residence_type) {
        checks.push({ field: 'residence_type', label: 'Area Type', passed: null, reason: 'Area type not specified' });
        missingReqs.push('Area type (urban/rural) required');
      } else {
        const resOk = profile.residence_type.toLowerCase() === scheme.residence_type.toLowerCase();
        checks.push({
          field: 'residence_type', label: 'Area Type',
          passed: resOk,
          reason: resOk ? `Area type "${profile.residence_type}" matches` : `Scheme is for ${scheme.residence_type} areas only`
        });
        if (resOk) passedChecks++;
      }
    }

    // Document checks
    if (scheme.required_documents && scheme.required_documents.length > 0) {
      const userDocTypes = (documents || []).map(d => d.document_type);
      scheme.required_documents.forEach(reqDoc => {
        totalChecks++;
        const hasDoc = userDocTypes.includes(reqDoc);
        checks.push({
          field: `doc_${reqDoc}`, label: this.getDocLabel(reqDoc),
          passed: hasDoc,
          reason: hasDoc ? 'Document uploaded' : 'Document required but not uploaded'
        });
        if (hasDoc) {
          passedChecks++;
        } else {
          missingDocs.push(reqDoc);
          actionItems.push(`Upload ${this.getDocLabel(reqDoc)}`);
        }
      });
    }

    // Calculate readiness
    const readiness = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    // Determine status
    const failedHardChecks = checks.filter(c => c.passed === false && !c.field.startsWith('doc_'));
    const nullChecks = checks.filter(c => c.passed === null);
    const hasHardFail = failedHardChecks.length > 0;

    let status;
    if (hasHardFail) {
      status = 'NOT_ELIGIBLE';
    } else if (nullChecks.length > 0 || missingDocs.length > 0) {
      status = missingDocs.length > 0 ? 'DOCUMENT_MISSING' : 'MORE_INFORMATION_REQUIRED';
    } else if (readiness >= 80) {
      status = 'ELIGIBLE';
    } else {
      status = 'CONDITIONALLY_ELIGIBLE';
    }

    return {
      status,
      readiness_percentage: readiness,
      checks,
      missing_documents: missingDocs,
      missing_requirements: missingReqs,
      action_items: actionItems,
    };
  }

  static calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  static getDocLabel(docType) {
    const labels = {
      aadhaar: 'Aadhaar Card',
      pan: 'PAN Card',
      community_certificate: 'Community/Caste Certificate',
      disability_certificate: 'Disability Certificate',
      income_certificate: 'Income Certificate',
      udyam_certificate: 'Udyam Certificate',
      business_registration: 'Business Registration',
      bank_statement: 'Bank Statement',
      address_proof: 'Address Proof',
      vending_certificate: 'Vending Certificate',
      business_plan: 'Business Plan',
    };
    return labels[docType] || docType;
  }

  /**
   * Calculate profile completion percentage
   */
  static calculateProfileCompletion(profile) {
    if (!profile) return 0;
    const fields = [
      'full_name', 'dob', 'gender', 'preferred_language', 'state', 'district',
      'residence_type', 'community_category', 'employment_status', 'annual_income',
      'business_status', 'business_type', 'business_category',
    ];
    const filled = fields.filter(f => profile[f] !== null && profile[f] !== '' && profile[f] !== undefined);
    return Math.round((filled.length / fields.length) * 100);
  }
}
