// WhatsApp Forward Killer - Background Service Worker
// Handles fact-checking logic and API calls

console.log('Background service worker initialized');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkFact') {
    handleFactCheck(request.text)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        success: false,
        error: error.message
      }));
    return true; // Keep channel open for async response
  }
});

// Main fact-checking function
async function handleFactCheck(text) {
  console.log('Checking fact for:', text.substring(0, 100) + '...');
  
  try {
    // Step 1: Check cache first
    const cachedResult = await checkCache(text);
    if (cachedResult) {
      console.log('Returning cached result');
      return cachedResult;
    }
    
    // Step 2: Check against known patterns (common Indian fake forwards)
    const patternResult = checkCommonPatterns(text);
    if (patternResult) {
      await saveToCache(text, patternResult);
      return patternResult;
    }
    
    // Step 3: Call fact-checking APIs
    const apiResult = await checkFactAPIs(text);
    if (apiResult) {
      await saveToCache(text, apiResult);
      return apiResult;
    }
    
    // Step 4: Use AI for content analysis (if API key available)
    const aiResult = await analyzeWithAI(text);
    if (aiResult) {
      await saveToCache(text, aiResult);
      return aiResult;
    }
    
    // If nothing found, mark as unverified
    return {
      success: true,
      verdict: 'unverified',
      explanation: 'Could not find reliable sources to verify this claim. Please verify manually from trusted news sources.',
      sources: []
    };
    
  } catch (error) {
    console.error('Fact check error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Check cache for previous results
async function checkCache(text) {
  const textHash = simpleHash(text);
  const result = await chrome.storage.local.get(['cache']);
  const cache = result.cache || {};
  
  if (cache[textHash] && Date.now() - cache[textHash].timestamp < 7 * 24 * 60 * 60 * 1000) {
    // Return if cached and less than 7 days old
    return cache[textHash].result;
  }
  return null;
}

// Save to cache
async function saveToCache(text, result) {
  const textHash = simpleHash(text);
  const cacheResult = await chrome.storage.local.get(['cache']);
  const cache = cacheResult.cache || {};
  
  cache[textHash] = {
    result: result,
    timestamp: Date.now()
  };
  
  await chrome.storage.local.set({ cache });
}

// Simple hash function for caching
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Check against common fake news patterns
function checkCommonPatterns(text) {
  const lowerText = text.toLowerCase();
  
  // Pattern 1: Urgent forward messages
  const urgentPatterns = [
    /forward.*urgent/i,
    /share.*immediately/i,
    /send.*all.*groups/i,
    /भेजें.*सभी/i, // Hindi: send to all
    /आगे.*भेजें/i // Hindi: forward
  ];
  
  // Pattern 2: Suspicious claims
  const suspiciousPatterns = [
    /nasa.*confirmed/i,
    /whatsapp.*will.*delete/i,
    /government.*hiding/i,
    /doctors.*don't.*want.*you.*to.*know/i,
    /cure.*cancer.*forwarded/i,
    /₹.*lakh.*free/i,
    /अगर.*फॉरवर्ड.*नहीं/i // Hindi: if don't forward
  ];
  
  // Pattern 3: Fake medical advice
  const medicalPatterns = [
    /drink.*hot.*water.*corona/i,
    /garlic.*cure.*covid/i,
    /alcohol.*kills.*virus/i,
    /गर्म.*पानी.*कोरोना/i // Hindi: hot water corona
  ];
  
  // Check if text matches known fake patterns
  const isUrgent = urgentPatterns.some(pattern => pattern.test(lowerText));
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(lowerText));
  const isFakeMedical = medicalPatterns.some(pattern => pattern.test(lowerText));
  
  if (isUrgent && (isSuspicious || isFakeMedical)) {
    return {
      success: true,
      verdict: 'false',
      explanation: 'This message matches common fake news patterns: urgent forwarding requests + unverified claims. Be cautious!',
      sources: [{
        title: 'Pattern-based detection',
        url: 'https://www.altnews.in'
      }]
    };
  }
  
  return null;
}

// Check fact-checking APIs
async function checkFactAPIs(text) {
  // Google Fact Check API
  const googleResult = await checkGoogleFactCheck(text);
  if (googleResult) return googleResult;
  
  // Check Indian fact-checkers (web scraping approach)
  const indianFactCheckers = await checkIndianFactCheckers(text);
  if (indianFactCheckers) return indianFactCheckers;
  
  return null;
}

// Google Fact Check Tools API
async function checkGoogleFactCheck(text) {
  // Note: You'll need an API key from Google Cloud Console
  const API_KEY = 'YOUR_GOOGLE_API_KEY'; // Replace with actual key
  
  if (!API_KEY || API_KEY === 'YOUR_GOOGLE_API_KEY') {
    console.log('Google API key not configured');
    return null;
  }
  
  try {
    const query = encodeURIComponent(text.substring(0, 200));
    const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${query}&key=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.claims && data.claims.length > 0) {
      const claim = data.claims[0];
      const rating = claim.claimReview[0].textualRating.toLowerCase();
      
      let verdict = 'unverified';
      if (rating.includes('false') || rating.includes('fake')) {
        verdict = 'false';
      } else if (rating.includes('true') || rating.includes('correct')) {
        verdict = 'true';
      } else if (rating.includes('misleading') || rating.includes('partly')) {
        verdict = 'misleading';
      }
      
      return {
        success: true,
        verdict: verdict,
        explanation: claim.claimReview[0].textualRating,
        sources: [{
          title: claim.claimReview[0].publisher.name,
          url: claim.claimReview[0].url
        }]
      };
    }
  } catch (error) {
    console.error('Google Fact Check API error:', error);
  }
  
  return null;
}

// Check Indian fact-checkers
async function checkIndianFactCheckers(text) {
  // This is a simplified version
  // In production, you'd implement proper web scraping or use their APIs
  
  const factCheckers = [
    { name: 'Alt News', searchUrl: 'https://www.altnews.in/?s=' },
    { name: 'Boom Live', searchUrl: 'https://www.boomlive.in/search?q=' },
    { name: 'Factly', searchUrl: 'https://factly.in/?s=' }
  ];
  
  // For now, return null (you'd implement actual checking here)
  // This requires either API access or web scraping
  console.log('Indian fact-checker check not yet implemented');
  return null;
}

// AI-based analysis (using free AI services)
async function analyzeWithAI(text) {
  // This is a placeholder for AI analysis
  // You can integrate with OpenAI, Gemini, or other AI APIs
  
  // For the hackathon, you could use Gemini API (Google's free tier)
  console.log('AI analysis not yet implemented');
  return null;
}

// Statistics tracking
chrome.storage.local.get(['stats'], (result) => {
  if (!result.stats) {
    chrome.storage.local.set({
      stats: {
        totalChecks: 0,
        trueCount: 0,
        falseCount: 0,
        misleadingCount: 0,
        unverifiedCount: 0
      }
    });
  }
});