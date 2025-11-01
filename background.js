// WhatsApp Forward Killer - Background Service Worker
// Updated with FREE API integrations (No API keys needed!)

console.log('Background service worker loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'factCheck') {
    handleFactCheck(request.text).then(sendResponse);
    return true; // Required for async response
  }
});

// Main fact-checking function
async function handleFactCheck(text) {
  console.log('Fact-checking with Gemini AI:', text.substring(0, 50));
  
  try {
    // Step 1: Quick local checks (instant)
    const patternAnalysis = analyzePatterns(text);
    const databaseCheck = checkFakeNewsDatabase(text);
    
    // If database has a match, return immediately (most reliable)
    if (databaseCheck.found) {
      updateStats('fake');
      return {
        verdict: 'fake',
        confidence: 90,
        explanation: `⚠️ Known Fake News: This matches debunked claim about "${databaseCheck.matches[0]}". Multiple fact-checkers have verified this is false.`,
        sources: [
          { title: 'Alt News - Fact Check', url: 'https://www.altnews.in/' },
          { title: 'Boom Live', url: 'https://www.boomlive.in/fact-check' }
        ],
        details: {
          patternScore: patternAnalysis.score,
          flags: patternAnalysis.flags,
          databaseMatch: true,
          aiUsed: false
        }
      };
    }
    
    // Step 2: Use Gemini AI for intelligent analysis
    const aiResult = await analyzeWithGeminiAI(text);
    
    // Step 3: Combine AI with pattern analysis for final verdict
    const finalResult = combineAIAndPatterns(aiResult, patternAnalysis);
    
    updateStats(finalResult.verdict);
    return finalResult;
    
  } catch (error) {
    console.error('Fact check error:', error);
    return {
      verdict: 'error',
      confidence: 0,
      explanation: 'Unable to complete verification. Please check your internet connection and try again.',
      sources: []
    };
  }
}

// Combine AI analysis with pattern detection
function combineAIAndPatterns(aiResult, patternAnalysis) {
  let finalVerdict = aiResult.verdict;
  let finalConfidence = aiResult.confidence;
  
  // If both AI and patterns say fake, increase confidence
  if (aiResult.verdict === 'fake' && patternAnalysis.score > 60) {
    finalConfidence = Math.min(95, aiResult.confidence + 10);
  }
  
  // If AI says verified but patterns are suspicious, downgrade to questionable
  if (aiResult.verdict === 'verified' && patternAnalysis.score > 50) {
    finalVerdict = 'questionable';
    finalConfidence = 65;
  }
  
  const sources = [
    { title: 'Alt News - Indian Fact-Checking', url: 'https://www.altnews.in/' },
    { title: 'Boom Live - Fact Check', url: 'https://www.boomlive.in/fact-check' },
    { title: 'PIB Fact Check (Govt)', url: 'https://factcheck.pib.gov.in/' },
    { title: 'WHO Myth Busters', url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters' }
  ];
  
  return {
    verdict: finalVerdict,
    confidence: finalConfidence,
    explanation: aiResult.explanation,
    sources: sources.slice(0, 4),
    details: {
      patternScore: patternAnalysis.score,
      flags: [...new Set([...patternAnalysis.flags, ...(aiResult.redFlags || [])])],
      databaseMatch: false,
      aiUsed: true,
      aiConfidence: aiResult.confidence,
      recommendation: aiResult.recommendation
    }
  };
}

// Pattern-based analysis (heuristics)
function analyzePatterns(text) {
  let suspicionScore = 0;
  const flags = [];
  
  // Common fake news indicators (expanded list)
  const fakeNewsPatterns = [
    { pattern: /forward.*urgent/i, score: 20, flag: 'Urgency manipulation' },
    { pattern: /whatsapp.*university/i, score: 30, flag: 'Known fake news source' },
    { pattern: /share.*everyone/i, score: 15, flag: 'Viral spreading tactic' },
    { pattern: /government.*hiding/i, score: 25, flag: 'Conspiracy language' },
    { pattern: /doctors.*don't.*want/i, score: 25, flag: 'Medical misinformation' },
    { pattern: /100%.*cure/i, score: 30, flag: 'Unrealistic claims' },
    { pattern: /!!!+/g, score: 10, flag: 'Multiple exclamations' },
    { pattern: /nasa.*said/i, score: 20, flag: 'Unverified authority claim' },
    { pattern: /breaking.*news/i, score: 15, flag: 'Breaking news claim' },
    { pattern: /vaccine.*dangerous/i, score: 35, flag: 'Vaccine misinformation' },
    { pattern: /5g.*corona/i, score: 40, flag: 'Known conspiracy theory' },
    { pattern: /bill gates/i, score: 20, flag: 'Common conspiracy target' },
    { pattern: /microchip/i, score: 30, flag: 'Microchip conspiracy' },
    { pattern: /new world order/i, score: 35, flag: 'Conspiracy theory' },
    { pattern: /mainstream media.*hiding/i, score: 25, flag: 'Media conspiracy' },
    { pattern: /they don't want you to know/i, score: 30, flag: 'Conspiracy rhetoric' },
    { pattern: /miracle.*cure/i, score: 35, flag: 'Miracle cure claim' },
    { pattern: /big pharma/i, score: 20, flag: 'Anti-pharma rhetoric' },
    { pattern: /wake up.*sheep/i, score: 30, flag: 'Condescending conspiracy language' },
    { pattern: /do your own research/i, score: 15, flag: 'Pseudo-research appeal' }
  ];
  
  // Check each pattern
  fakeNewsPatterns.forEach(({ pattern, score, flag }) => {
    if (pattern.test(text)) {
      suspicionScore += score;
      flags.push(flag);
    }
  });
  
  // Check for ALL CAPS (common in forwards)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.3) {
    suspicionScore += 15;
    flags.push('Excessive capitalization');
  }
  
  // Check text length and structure
  if (text.length > 500 && text.split('\n').length < 3) {
    suspicionScore += 10;
    flags.push('Long unformatted text block');
  }
  
  // Check for excessive punctuation
  const punctuationRatio = (text.match(/[!?.,;:]/g) || []).length / text.length;
  if (punctuationRatio > 0.1) {
    suspicionScore += 10;
    flags.push('Excessive punctuation');
  }
  
  return {
    score: Math.min(suspicionScore, 100),
    flags: flags,
    method: 'pattern_analysis'
  };
}

// Check against known fake news database
function checkFakeNewsDatabase(text) {
  const knownFakeNewsKeywords = [
    'nasa planet alignment',
    'onion under bed',
    'garlic covid cure',
    'microchip vaccine',
    'himalayan salt lamp ions',
    'banana spider eggs',
    'facebook shutting down',
    'mark zuckerberg giving money',
    '5g coronavirus',
    'bill gates population control',
    'drinking bleach',
    'cow urine corona',
    'hot water kills virus',
    'holding breath covid test',
    'garlic prevents coronavirus',
    'drinking alcohol kills virus',
    'sun exposure cures covid',
    'plastic rice china',
    'fake eggs china',
    'chicken contains plastic',
    'cabbage wax cancer'
  ];
  
  const textLower = text.toLowerCase();
  const matches = knownFakeNewsKeywords.filter(keyword => 
    textLower.includes(keyword)
  );
  
  if (matches.length > 0) {
    return {
      found: true,
      matches: matches,
      confidence: 90,
      method: 'database_check'
    };
  }
  
  return {
    found: false,
    confidence: 0,
    method: 'database_check'
  };
}

async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  return {
    title: data.title,
    extract: data.extract,
    url: data.content_urls.desktop.page
  };
}
/*async function getChatGptResponse(text) {
  // Your OpenAI API key (NEVER expose this in client-side code like an extension)
  // See the security warning below.
  const API_TOKEN = 'sk-xxxxxxxxxxxxx'; 
  const API_URL = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(
    API_URL,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Specify the model you want to use
        model: 'gpt-3.5-turbo', 
        
        // 'messages' is an array of objects
        messages: [
          {
            role: 'user', // This is the prompt from the user
            content: text 
          }
        ]
        // You can add other parameters here, like 'max_tokens' or 'temperature'
      })
    }
  );

  return await response.json();
}
*/
// Add at the top of background.js
const GEMINI_API_KEY = 'AIzaSyCFYH6Wu4DvQIwd8kkTasqDCtAQE5c5_dE'; // Paste your key

// Replace the analyzeWithFreeAI function with this enhanced version
async function analyzeWithGeminiAI(text) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a fact-checking expert for Indian WhatsApp forwards. Analyze this message and determine if it's FAKE, QUESTIONABLE, or VERIFIED.

Message: "${text}"

Provide your analysis in this exact JSON format:
{
  "verdict": "FAKE or QUESTIONABLE or VERIFIED",
  "confidence": 0-100,
  "explanation": "Clear explanation in simple English",
  "redFlags": ["flag1", "flag2"],
  "recommendation": "What user should do"
}

Consider:
- Known fake news patterns in India
- Medical misinformation
- Political propaganda
- Conspiracy theories
- Urgency manipulation
- Unverified claims`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      }
    );

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('Invalid API response');
    }

    const aiText = data.candidates[0].content.parts[0].text;
    
    // Parse JSON response
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      verdict: result.verdict.toLowerCase(),
      confidence: result.confidence,
      explanation: result.explanation,
      redFlags: result.redFlags || [],
      recommendation: result.recommendation,
      method: 'gemini_ai'
    };
    
  } catch (error) {
    console.error('Gemini AI error:', error);
    // Fallback to pattern analysis
    return fallbackAnalysis(text);
  }
}

// Fallback if API fails
function fallbackAnalysis(text) {
  const patterns = analyzePatterns(text);
  return {
    verdict: patterns.score > 60 ? 'fake' : 'questionable',
    confidence: Math.min(patterns.score, 75),
    explanation: 'AI analysis unavailable. Using pattern detection.',
    redFlags: patterns.flags,
    recommendation: 'Verify from trusted sources',
    method: 'fallback'
  };
}

// FREE API #1: DuckDuckGo Instant Answer API (No key required!)
async function searchWeb(text) {
  try {
    // Extract key claim from text (first 100 chars)
    const query = text.substring(0, 100).trim();
    
    // DuckDuckGo Instant Answer API is free and doesn't require auth
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Search API failed');
    }
    
    const data = await response.json();
    
    return {
      hasResults: data.AbstractText && data.AbstractText.length > 0,
      abstract: data.AbstractText || '',
      source: data.AbstractSource || '',
      url: data.AbstractURL || '',
      relatedTopics: data.RelatedTopics || []
    };
    
  } catch (error) {
    console.error('Web search error:', error);
    return {
      hasResults: false,
      abstract: '',
      source: '',
      url: '',
      relatedTopics: []
    };
  }
}

// FREE API #2: HuggingFace Inference API (Free tier available!)
async function analyzeWithFreeAI(text, searchResults) {
  // For MVP, we'll use intelligent heuristics based on search results
  // In production, you can integrate HuggingFace's free inference API
  
  const textLower = text.toLowerCase();
  let verdict = 'questionable';
  let confidence = 50;
  let explanation = 'This message contains claims that require verification.';
  
  // If web search found no results for the claim
  if (!searchResults.hasResults) {
    if (analyzePatterns(text).score > 50) {
      verdict = 'fake';
      confidence = 70;
      explanation = 'No credible sources found for these claims, and multiple warning signs detected. This appears to be misinformation.';
    } else {
      verdict = 'questionable';
      confidence = 60;
      explanation = 'Could not find reliable sources to verify this claim. Exercise caution and verify from trusted sources.';
    }
  } else {
    // We have search results, analyze them
    const abstract = searchResults.abstract.toLowerCase();
    
    // Check if the search results contradict common fake news themes
    if (abstract.includes('false') || abstract.includes('hoax') || abstract.includes('debunk')) {
      verdict = 'fake';
      confidence = 85;
      explanation = `This claim has been debunked. Source: ${searchResults.source}`;
    } else if (searchResults.source && isCredibleSource(searchResults.source)) {
      verdict = 'verified';
      confidence = 75;
      explanation = `Information verified from credible source: ${searchResults.source}`;
    }
  }
  
  // Enhanced heuristic analysis
  if (textLower.includes('cure') || textLower.includes('miracle')) {
    verdict = 'fake';
    confidence = 75;
    explanation = 'Medical claims without credible sources are typically unreliable. Always consult healthcare professionals.';
  } else if (textLower.includes('government') && textLower.includes('secret')) {
    verdict = 'fake';
    confidence = 80;
    explanation = 'Unverified government conspiracy claims. No credible evidence found.';
  } else if (textLower.includes('forward') && textLower.includes('urgent')) {
    verdict = 'fake';
    confidence = 70;
    explanation = 'Messages urging urgent forwarding are common misinformation tactics.';
  } else if (textLower.includes('whatsapp university')) {
    verdict = 'fake';
    confidence = 95;
    explanation = 'This message self-identifies as coming from "WhatsApp University" - a known source of misinformation.';
  }
  
  return {
    verdict: verdict,
    confidence: confidence,
    explanation: explanation,
    searchData: searchResults,
    method: 'ai_analysis'
  };
}

// Check if source is credible
function isCredibleSource(source) {
  const credibleSources = [
    'wikipedia',
    'britannica',
    'who.int',
    'cdc.gov',
    'nih.gov',
    'bbc',
    'reuters',
    'associated press',
    'pib.gov.in',
    'mohfw.gov.in',
    'snopes',
    'factcheck.org',
    'altnews',
    'boomlive'
  ];
  
  const sourceLower = source.toLowerCase();
  return credibleSources.some(credible => sourceLower.includes(credible));
}

// Combine all analyses into final verdict
function combineAnalyses(patternAnalysis, databaseCheck, aiAnalysis, webSearch) {
  let finalVerdict = 'verified';
  let finalConfidence = 100;
  let explanation = '';
  const sources = [];
  
  // Database check has highest priority (known fake news)
  if (databaseCheck.found) {
    finalVerdict = 'fake';
    finalConfidence = databaseCheck.confidence;
    explanation = `This message matches known fake news: "${databaseCheck.matches.join(', ')}". `;
    sources.push({
      title: 'Known Fake News Database',
      url: 'https://www.altnews.in/'
    });
  }
  // Pattern analysis
  else if (patternAnalysis.score > 60) {
    finalVerdict = 'fake';
    finalConfidence = patternAnalysis.score;
    explanation = `Suspicious patterns detected: ${patternAnalysis.flags.join(', ')}. `;
  }
  else if (patternAnalysis.score > 30) {
    finalVerdict = 'questionable';
    finalConfidence = 60;
    explanation = `Some warning signs detected: ${patternAnalysis.flags.join(', ')}. Verify before sharing. `;
  }
  
  // Add AI analysis
  if (aiAnalysis.verdict === 'fake' && finalVerdict !== 'fake') {
    finalVerdict = 'questionable';
  }
  
  // Override with AI if it has strong evidence
  if (aiAnalysis.confidence > 80) {
    finalVerdict = aiAnalysis.verdict;
    finalConfidence = aiAnalysis.confidence;
    explanation = aiAnalysis.explanation + ' ';
  } else {
    explanation += aiAnalysis.explanation;
  }
  
  // Add web search results to sources
  if (webSearch.hasResults && webSearch.url) {
    sources.push({
      title: webSearch.source || 'Web Search Result',
      url: webSearch.url
    });
  }
  
  // If no red flags found
  if (finalVerdict === 'verified' && patternAnalysis.score < 20) {
    explanation = 'No immediate red flags detected, but always verify important information from credible sources.';
    finalConfidence = 70;
  }
  
  // Add standard fact-checking sources
  sources.push(
    { title: 'Alt News - Fact Checking', url: 'https://www.altnews.in/' },
    { title: 'Boom Live - Fact Check', url: 'https://www.boomlive.in/fact-check' },
    { title: 'PIB Fact Check', url: 'https://factcheck.pib.gov.in/' }
  );
  
  return {
    verdict: finalVerdict,
    confidence: finalConfidence,
    explanation: explanation,
    sources: sources.slice(0, 4), // Top 4 sources
    details: {
      patternScore: patternAnalysis.score,
      flags: patternAnalysis.flags,
      databaseMatch: databaseCheck.found,
      webSearchFound: webSearch.hasResults
    }
  };
}

// Statistics tracking
let statsData = {
  totalChecks: 0,
  fakeDetected: 0,
  verifiedMessages: 0
};

chrome.storage.local.get(['stats'], (result) => {
  if (result.stats) {
    statsData = result.stats;
  }
});

// Update stats after each check
function updateStats(verdict) {
  statsData.totalChecks++;
  if (verdict === 'fake') statsData.fakeDetected++;
  if (verdict === 'verified') statsData.verifiedMessages++;
  
  chrome.storage.local.set({ stats: statsData });
}

// Optional: HuggingFace API integration (if you want to use it later)
// Sign up at huggingface.co for FREE API access
async function analyzeWithHuggingFace(text) {
  // This is a placeholder for future integration
  // You can get a free API token from huggingface.co
  
  const API_TOKEN = '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'; // Get from huggingface.co
  
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/microsoft/deberta-v3-base',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          parameters: { candidate_labels: ['fake news', 'real news', 'satire'] }
        })
      }
    );
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('HuggingFace API error:', error);
    return null;
  }
}
  
