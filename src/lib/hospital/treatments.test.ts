import { describe, it, expect } from 'vitest';
import { 
  DEFAULT_HOSPITAL_PROFILE, 
  DEFAULT_TREATMENTS, 
  buildHospitalKnowledgeText,
  Treatment,
  HospitalProfile
} from './treatments';

describe('Hospital Profile & Treatments Engine', () => {
  it('has comprehensive default hospital profile details', () => {
    expect(DEFAULT_HOSPITAL_PROFILE.name).toBe('La Fleur Aesthetic & Wellness Clinic');
    expect(DEFAULT_HOSPITAL_PROFILE.leadDoctor).toBe('Dr. Mrinalini');
    expect(DEFAULT_HOSPITAL_PROFILE.consultationFee).toBe(500);
    expect(DEFAULT_HOSPITAL_PROFILE.advanceTokenFee).toBe(100);
    expect(DEFAULT_HOSPITAL_PROFILE.clinicBalanceFee).toBe(400);
    expect(DEFAULT_HOSPITAL_PROFILE.currency).toBe('₹');
    expect(DEFAULT_HOSPITAL_PROFILE.address).toContain('Jubilee hills');
    expect(DEFAULT_HOSPITAL_PROFILE.city).toBe('Hyderabad');
  });

  it('provides default clinical treatments covering aesthetic & dermatology domains', () => {
    expect(DEFAULT_TREATMENTS.length).toBe(11);
    
    const hydra = DEFAULT_TREATMENTS.find(t => t.id === 'trt-hydrafacial');
    expect(hydra).toBeDefined();
    expect(hydra?.category).toBe('Dermatology & Skin Care');
    expect(hydra?.price).toBe(3500);
    expect(hydra?.recommendedSittings).toBe(3);
    expect(hydra?.sittingInterval).toBe('4 weeks');

    const lhr = DEFAULT_TREATMENTS.find(t => t.id === 'trt-lhr');
    expect(lhr).toBeDefined();
    expect(lhr?.category).toBe('Laser & Aesthetics');
    expect(lhr?.price).toBe(4999);
    expect(lhr?.recommendedSittings).toBe(6);

    const botox = DEFAULT_TREATMENTS.find(t => t.id === 'trt-botox');
    expect(botox).toBeDefined();
    expect(botox?.category).toBe('Anti-Aging & Cosmetology');
    expect(botox?.price).toBe(8500);
  });

  it('builds structured hospital knowledge text for LLM ingestion', () => {
    const text = buildHospitalKnowledgeText(DEFAULT_HOSPITAL_PROFILE, DEFAULT_TREATMENTS);

    expect(text).toContain('=== CLINIC / HOSPITAL PROFILE ===');
    expect(text).toContain('Hospital Name: La Fleur Aesthetic & Wellness Clinic');
    expect(text).toContain('Sole Doctor: Dr. Mrinalini');
    expect(text).toContain('Consultation Fee: ₹500');
    expect(text).toContain('Address: Road No.11 B, Jubilee hills, 500045., Hyderabad - 500045');
    expect(text).toContain('=== ACTIVE TREATMENTS & PROCEDURES CATALOG');
    expect(text).toContain('HydraFacial Deluxe [Dermatology & Skin Care]');
    expect(text).toContain('Laser Hair Reduction [Laser & Aesthetics]');
    expect(text).toContain('PRP Hair Therapy & Scalp Restoration [Trichology & Hair Restoration]');
  });

  it('formats custom hospital profile and dynamic treatment catalog correctly', () => {
    const customProfile: HospitalProfile = {
      name: 'Apex Super Specialty Skin Center',
      tagline: 'Excellence in Clinical & Surgical Dermatology',
      leadDoctor: 'Dr. Mrinalini',
      doctorTitle: 'Chief Consultant Dermatologist',
      phone: '+91 99887 76655',
      whatsapp: '+91 99887 76655',
      email: 'contact@apexskincare.com',
      website: 'https://apexskincare.com',
      address: 'Plot 45, Sector 18',
      city: 'Gurugram',
      postalCode: '122002',
      emergencyContact: '+91 99887 00000',
      consultationFee: 1500,
      currency: '₹',
      openingHoursSummary: 'Monday - Friday: 09:00 AM - 08:00 PM',
      aboutText: 'Leading center for advanced laser dermatology.',
      updatedAt: new Date().toISOString(),
    };

    const customTreatments: Treatment[] = [
      {
        id: 'trt-custom-1',
        name: 'Tattoo Laser Removal',
        category: 'Laser',
        description: 'Picosecond laser tattoo clearance.',
        durationMinutes: 30,
        price: 4000,
        currency: '₹',
        recommendedSittings: 5,
        sittingInterval: 'Every 6 weeks',
        sittingIntervalDays: 42,
        preCareAdvice: 'Avoid sun exposure.',
        postCareAdvice: 'Apply healing ointment.',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'trt-custom-inactive',
        name: 'Discontinued Therapy',
        category: 'Other',
        description: 'Inactive service.',
        durationMinutes: 20,
        price: 1000,
        currency: '₹',
        recommendedSittings: 1,
        sittingInterval: 'Once',
        sittingIntervalDays: 0,
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    const text = buildHospitalKnowledgeText(customProfile, customTreatments);
    expect(text).toContain('Hospital Name: Apex Super Specialty Skin Center');
    expect(text).toContain('Tattoo Laser Removal [Laser]');
    expect(text).not.toContain('Discontinued Therapy'); // Inactive should be filtered out
  });
});
