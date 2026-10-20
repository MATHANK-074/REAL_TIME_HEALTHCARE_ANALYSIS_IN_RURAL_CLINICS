/**
 * RuralCare AI - Patient Portal Bilingual Translations (English & Tamil)
 * Supports rural patients with accessible terminology.
 */

export const TRANSLATIONS = {
  en: {
    // Nav & Common
    appTitle: "RuralCare AI",
    patientPortal: "Patient Health Portal",
    dashboard: "Dashboard",
    myHealth: "My Health",
    history: "Visit History",
    aiPredictions: "AI Health Risk",
    followups: "Follow-ups",
    notifications: "Notifications",
    profile: "My Profile",
    logout: "Logout",
    loading: "Loading your health records...",
    offlineNotice: "Viewing Offline Cached Record",
    offlineSubtext: "Saved on this device. Reconnect to internet for the latest clinical updates.",
    lastSynced: "Last updated",
    refresh: "Refresh",
    close: "Close",
    langEn: "English",
    langTa: "தமிழ்",

    // Dashboard
    welcome: "Welcome",
    healthOverview: "Your health summary and care team updates.",
    latestVitalsSnapshot: "Latest Vitals Snapshot",
    noVitalsYet: "No vitals recorded yet. Please visit your village clinic or field nurse.",
    assessmentStatus: "Latest Assessment",
    healthAttention: "Health Attention",
    nextFollowup: "Next Follow-up",
    lastVisit: "Last Visit",
    doctorNotesTitle: "Doctor's Recommendation & Clinical Review",
    doctorNotesEmpty: "Your health readings are currently pending doctor review.",
    careTeam: "Your Care Team",
    assignedNurse: "Field Nurse",
    assignedDoctor: "Assigned Doctor",
    facility: "Primary Health Center",

    // Vitals
    bp: "Blood Pressure",
    glucose: "Blood Glucose",
    heartRate: "Pulse / Heart Rate",
    temperature: "Temperature",
    weight: "Weight",
    height: "Height",
    bmi: "BMI (Body Mass Index)",
    symptoms: "Symptoms",
    noSymptoms: "No specific symptoms reported.",
    vitalNormal: "Normal",
    vitalHigh: "Elevated",
    vitalLow: "Low",
    vitalCritical: "Needs Attention",
    measuredOn: "Recorded on",

    // Trends
    trendsTitle: "Health Trends Over Time",
    trendsSubtext: "Track changes in your vital parameters across visits.",
    noTrendsYet: "At least two recorded visits are required to generate trend charts.",

    // AI Predictions
    aiTitle: "AI Health Risk Assessments",
    aiAdvisoryTitle: "Important Medical Notice",
    aiAdvisoryBody: "AI risk assessments are screening tools created to support your doctors and nurses. They are NOT a confirmed diagnosis. Your physician makes all clinical and treatment decisions.",
    riskLow: "LOW RISK",
    riskMedium: "MODERATE RISK",
    riskHigh: "HIGH RISK",
    riskInsufficient: "INSUFFICIENT DATA",
    assessedOn: "Assessed on",
    contributingFactors: "Key Contributing Factors",

    // Follow-ups
    upcomingFollowups: "Scheduled Follow-ups",
    noFollowups: "No upcoming follow-up appointments scheduled.",
    purpose: "Purpose",
    scheduledDate: "Scheduled Date",
    status: "Status",
    priority: "Priority",
    statusPending: "PENDING",
    statusCompleted: "COMPLETED",
    priorityUrgent: "URGENT",
    priorityRoutine: "ROUTINE",

    // Notifications
    allNotifications: "All Notifications",
    unreadOnly: "Unread Only",
    markAllRead: "Mark All Read",
    noNotifications: "No notifications at this time.",
    noNotificationsSub: "Updates regarding your visits, test results, and doctor reviews will appear here.",
    unread: "Unread",
    read: "Read",

    // Profile
    demographics: "Personal Information",
    patientCode: "Patient ID",
    age: "Age",
    gender: "Gender",
    phone: "Mobile Phone",
    address: "Home Address",
    village: "Village",
    area: "Healthcare Area",
    subdistrict: "Subdistrict / Taluk",
    bloodGroup: "Blood Group",
    emergencyContact: "Emergency Contact",
    assignedLocation: "Assigned Village & Region",
    knownAllergies: "Known Allergies",
    medicalConditions: "Existing Conditions",
    registeredOn: "Registered On",
    notProvided: "Not provided"
  },

  ta: {
    // Nav & Common
    appTitle: "ரூரல்கேர் AI",
    patientPortal: "நோயாளி சுகாதார தளம்",
    dashboard: "முகப்பு",
    myHealth: "என் உடல்நலம்",
    history: "மருத்துவ வரலாறு",
    aiPredictions: "AI உடல்நல ஆபத்து",
    followups: "பின்தொடர்தல்",
    notifications: "அறிவிப்புகள்",
    profile: "சுயவிவரம்",
    logout: "வெளியேறு",
    loading: "உங்கள் மருத்துவ பதிவுகள் ஏற்றப்படுகின்றன...",
    offlineNotice: "ஆஃப்லைன் பதிவு பார்க்கப்படுகிறது",
    offlineSubtext: "இந்த சாதனத்தில் சேமிக்கப்பட்டது. புதிய தகவல்களுக்கு இணையத்துடன் இணையவும்.",
    lastSynced: "கடைசியாக புதுப்பிக்கப்பட்டது",
    refresh: "புதுப்பி",
    close: "மூடு",
    langEn: "English",
    langTa: "தமிழ்",

    // Dashboard
    welcome: "வணக்கம்",
    healthOverview: "உங்கள் உடல்நல சுருக்கம் மற்றும் மருத்துவக் குழுவின் வழிகாட்டுதல்.",
    latestVitalsSnapshot: "சமீபத்திய உடல் அளவீடுகள்",
    noVitalsYet: "இதுவரை உடல் அளவீடுகள் எதுவும் பதிவு செய்யப்படவில்லை. உங்கள் கிராம செவிலியரை அணுகவும்.",
    assessmentStatus: "சமீபத்திய மதிப்பீடு",
    healthAttention: "கவனிக்க வேண்டியவை",
    nextFollowup: "அடுத்த பரிசோதனை நாள்",
    lastVisit: "கடைசி வருகை",
    doctorNotesTitle: "மருத்துவரின் ஆலோசனை மற்றும் மதிப்பீடு",
    doctorNotesEmpty: "உங்கள் அளவீடுகள் மருத்துவரின் மதிப்பாய்வுக்காக காத்திருக்கின்றன.",
    careTeam: "உங்கள் மருத்துவக் குழு",
    assignedNurse: "கிராம செவிலியர்",
    assignedDoctor: "நியமிக்கப்பட்ட மருத்துவர்",
    facility: "ஆரம்ப சுகாதார நிலையம்",

    // Vitals
    bp: "இரத்த அழுத்தம்",
    glucose: "இரத்த சர்க்கரை",
    heartRate: "இதய துடிப்பு",
    temperature: "உடல் வெப்பநிலை",
    weight: "எடை",
    height: "உயரம்",
    bmi: "உடல் நிறை குறியீடு (BMI)",
    symptoms: "அறிகுறிகள்",
    noSymptoms: "குறிப்பிட்ட அறிகுறிகள் எதுவும் இல்லை.",
    vitalNormal: "இயல்பானது",
    vitalHigh: "அதிகம்",
    vitalLow: "குறைவு",
    vitalCritical: "கவனம் தேவை",
    measuredOn: "பதிவு செய்யப்பட்ட நாள்",

    // Trends
    trendsTitle: "உடல்நல முன்னேற்ற வரைபடம்",
    trendsSubtext: "ஒவ்வொரு வருகையிலும் உங்கள் உடல் அளவீடுகளின் மாற்றங்கள்.",
    noTrendsYet: "வரைபடம் காட்ட குறைந்தது இரண்டு வருகைகள் பதிவு செய்யப்பட வேண்டும்.",

    // AI Predictions
    aiTitle: "AI உடல்நல ஆபத்து மதிப்பீடுகள்",
    aiAdvisoryTitle: "முக்கிய மருத்துவ அறிவிப்பு",
    aiAdvisoryBody: "செயற்கை நுண்ணறிவு (AI) மதிப்பீடு மருத்துவர்களுக்கு உதவும் ஒரு ஆரம்பநிலை பரிசோதனை மட்டுமே. இது இறுதி நோயறிதல் அல்ல. உங்கள் மருத்துவ ஊட்டச்சத்து மற்றும் சிகிச்சை முடிவுகளை மருத்துவரே தீர்மானிப்பார்.",
    riskLow: "குறைந்த ஆபத்து",
    riskMedium: "மிதமான ஆபத்து",
    riskHigh: "அதிக ஆபத்து",
    riskInsufficient: "போதுமான தரவு இல்லை",
    assessedOn: "மதிப்பிடப்பட்ட நாள்",
    contributingFactors: "காரணிகள்",

    // Follow-ups
    upcomingFollowups: "திட்டமிடப்பட்ட பின்தொடர்தல்",
    noFollowups: "வரவிருக்கும் பரிசோதனை எதுவும் இல்லை.",
    purpose: "காரணம்",
    scheduledDate: "திட்டமிடப்பட்ட தேதி",
    status: "நிலை",
    priority: "முன்னுரிமை",
    statusPending: "நிலுவையில் உள்ளது",
    statusCompleted: "முடிந்தது",
    priorityUrgent: "அவசரம்",
    priorityRoutine: "வழக்கமானது",

    // Notifications
    allNotifications: "அனைத்து அறிவிப்புகள்",
    unreadOnly: "படிக்காதவை மட்டும்",
    markAllRead: "அனைத்தையும் படித்ததாக குறிக்கவும்",
    noNotifications: "தற்போது அறிவிப்புகள் எதுவும் இல்லை.",
    noNotificationsSub: "உங்கள் பரிசோதனைகள், முடிவுகள் மற்றும் மருத்துவர் ஆலோசனைகள் குறித்த அறிவிப்புகள் இங்கே தோன்றும்.",
    unread: "படிக்காதவை",
    read: "படித்தவை",

    // Profile
    demographics: "தனிப்பட்ட விவரங்கள்",
    patientCode: "நோயாளி அடையாள எண்",
    age: "வயது",
    gender: "பாலினம்",
    phone: "கைபேசி எண்",
    address: "முகவரி",
    village: "கிராமம்",
    area: "சுகாதார பகுதி",
    subdistrict: "வட்டம் / தாலுகா",
    bloodGroup: "இரத்த வகை",
    emergencyContact: "அவசர தொடர்பு எண்",
    assignedLocation: "நியமிக்கப்பட்ட பகுதி",
    knownAllergies: "ஒவ்வாமைகள்",
    medicalConditions: "முந்தைய நோய்கள்",
    registeredOn: "பதிவு செய்யப்பட்ட தேதி",
    notProvided: "வழங்கப்படவில்லை"
  }
};

export const getLanguage = () => {
  try {
    return localStorage.getItem('ruralcare_patient_lang') || 'en';
  } catch {
    return 'en';
  }
};

export const setLanguage = (lang) => {
  try {
    localStorage.setItem('ruralcare_patient_lang', lang);
  } catch {}
};

export const useTranslation = (lang) => {
  return TRANSLATIONS[lang] || TRANSLATIONS.en;
};
