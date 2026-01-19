// ============================================
// ROBUST FACT-CHECKER - WORKS EVEN IF APIs FAIL
// Replace your ENTIRE background.js with this
// ============================================

console.log('🚀 Background service worker loaded - ROBUST VERSION');

// API Keys - REPLACE THESE!
const GEMINI_API_KEY = 'AIzaSyBo2XP9W6dSi9Hh0egkn8N0gpDTGBphqvs';
const GROQ_API_KEY = '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';

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'factCheck') {
    factCheckMain(request.text).then(sendResponse);
    return true;
  }
  if (request.action === 'factCheckMedia') {
    // Media handling placeholder
    sendResponse({
      verdict: 'questionable',
      confidence: 50,
      explanation: 'Media fact-checking coming soon',
      sources: getDefaultSources()
    });
    return true;
  }
});

// ============================================
// MAIN FACT-CHECKING FUNCTION
// ============================================

async function factCheckMain(text) {
  console.log('🔍 Starting fact-check for:', text.substring(0, 100));
  
  try {
    // Step 1: Check known false claims (instant)
    const knownFake = checkKnownFalseClaims(text);
    if (knownFake) {
      console.log('✅ Caught by database!');
      updateStats('fake');
      return knownFake;
    }
    
    // Step 2: Try AI fact-checking
    console.log('🤖 Trying AI verification...');
    const aiResult = await tryAIFactCheck(text);
    
    if (aiResult) {
      console.log('✅ AI verification succeeded:', aiResult.verdict);
      updateStats(aiResult.verdict);
      return aiResult;
    }
    
    // Step 3: Fallback to pattern analysis
    console.log('⚠️ AI failed, using pattern analysis');
    const patternResult = patternBasedCheck(text);
    updateStats(patternResult.verdict);
    return patternResult;
    
  } catch (error) {
    console.error('❌ Critical error:', error);
    return {
      verdict: 'questionable',
      confidence: 50,
      explanation: 'Unable to verify. Please check from trusted sources like Alt News, PIB Fact Check, or WHO.',
      sources: getDefaultSources(),
      details: { error: true, message: error.message }
    };
  }
}

// ============================================
// KNOWN FALSE CLAIMS DATABASE
// ============================================

function checkKnownFalseClaims(text) {
  const textLower = text.toLowerCase();
  
  const falseClaims = [
    {
      keywords: ['rahul', 'gandhi', 'prime minister'],
      truth: 'FALSE: Narendra Modi is the Prime Minister of India since 2014, not Rahul Gandhi.'
    },
    {
      keywords: ['rahul', 'gandhi', 'pm'],
      truth: 'FALSE: Modi is PM of India, not Rahul Gandhi.'
    },
    {
      keywords: ['congress', 'power', 'india'],
      truth: 'FALSE: BJP is in power in India since 2014, not Congress.'
    },
    {
      keywords: ['covid', 'hoax'],
      truth: 'FALSE: COVID-19 is a real disease, recognized by WHO and scientific community worldwide.'
    },
    {
      keywords: ['vaccine', 'microchip'],
      truth: 'FALSE: Vaccines do not contain microchips. This is a debunked conspiracy theory.'
    },
    {
      keywords: ['vaccine', 'autism'],
      truth: 'FALSE: No scientific link between vaccines and autism. Multiple studies have debunked this.'
    },
    {
      keywords: ['earth', 'flat'],
      truth: 'FALSE: Earth is spherical (oblate spheroid), proven by science and observable evidence.'
    },
    {
      keywords: ['5g', 'coronavirus'],
      truth: 'FALSE: 5G does not spread COVID-19. Viruses cannot travel on radio waves.'
    },
    {
      keywords: ['5g', 'covid'],
      truth: 'FALSE: 5G technology does not cause or spread COVID-19.'
    },
    {
      keywords: ['bill gates', 'microchip'],
      truth: 'FALSE: Bill Gates microchip conspiracy theory is completely false.'
    },
    {
      keywords: ['hot water', 'kills', 'coronavirus'],
      truth: 'FALSE: Hot water does not kill coronavirus. Follow WHO guidelines for prevention.'
    },
    {
      keywords: ['cow urine', 'corona'],
      truth: 'FALSE: Cow urine does not cure or prevent COVID-19. No scientific evidence.'
    }
  ];
  
  for (const claim of falseClaims) {
    const allMatch = claim.keywords.every(kw => textLower.includes(kw));
    if (allMatch) {
      return {
        verdict: 'fake',
        confidence: 95,
        explanation: claim.truth,
        sources: getDynamicSources(text),
        details: {
          databaseMatch: true,
          matchedKeywords: claim.keywords,
          flags: ['Known false claim']
        }
      };
    }
  }
  
  return null;
}

// ============================================
// TRY AI FACT-CHECKING (WITH FALLBACK)
// ============================================

async function tryAIFactCheck(text) {
  let geminiResult = null;
  let groqResult = null;
  
  // Try Gemini
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'AIzaSyBo2XP9W6dSi9Hh0egkn8N0gpDTGBphqvs') {
    try {
      console.log('📡 Calling Gemini API...');
      geminiResult = await callGeminiAPI(text);
      console.log('✅ Gemini succeeded:', geminiResult.verdict, geminiResult.confidence);
    } catch (error) {
      console.error('❌ Gemini failed:', error.message);
    }
  } else {
    console.log('⚠️ No Gemini API key configured');
  }
  
  // Try Groq
  if (GROQ_API_KEY && GROQ_API_KEY !== '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') {
    try {
      console.log('📡 Calling Groq API...');
      groqResult = await callGroqAPI(text);
      console.log('✅ Groq succeeded:', groqResult.verdict, groqResult.confidence);
    } catch (error) {
      console.error('❌ Groq failed:', error.message);
    }
  } else {
    console.log('⚠️ No Groq API key configured');
  }
  
  // Combine results
  if (geminiResult && groqResult) {
    console.log('🎯 Both AIs responded, combining...');
    return combineAIResults(geminiResult, groqResult, text);
  } else if (geminiResult) {
    console.log('🎯 Only Gemini responded');
    return formatSingleAIResult(geminiResult, text);
  } else if (groqResult) {
    console.log('🎯 Only Groq responded');
    return formatSingleAIResult(groqResult, text);
  } else {
    console.log('❌ Both AIs failed');
    return null;
  }
}

// ============================================
// GEMINI API CALL
// ============================================

async function callGeminiAPI(text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Is this statement TRUE or FALSE? Be direct and factual.

STATEMENT: "${text}"

Examples:
- "Modi is PM of India" → TRUE (He is PM since 2014)
- "Rahul Gandhi is PM" → FALSE (Modi is PM, not Rahul)
- "Water boils at 100°C" → TRUE (Scientific fact)
- "Earth is flat" → FALSE (Earth is spherical)

Respond with JSON only:
{"verdict":"TRUE","confidence":90,"explanation":"Modi has been PM since 2014"}

Your response:`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300
        }
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0]) {
    throw new Error('No response from Gemini');
  }
  
  const textResponse = data.candidates[0].content.parts[0].text;
  console.log('📝 Gemini response:', textResponse.substring(0, 200));
  
  // Parse JSON
  const jsonMatch = textResponse.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Gemini response');
  }
  
  const result = JSON.parse(jsonMatch[0]);
  
  // Convert to our format
  return {
    verdict: result.verdict === 'TRUE' ? 'verified' : result.verdict === 'FALSE' ? 'fake' : 'questionable',
    confidence: Math.max(60, Math.min(95, result.confidence || 70)),
    explanation: result.explanation || 'Gemini analysis completed'
  };
}

// ============================================
// GROQ API CALL
// ============================================

async function callGroqAPI(text) {
  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [{
          role: 'system',
          content: 'You are a fact-checker. Respond with TRUE if factually correct, FALSE if factually incorrect.'
        }, {
          role: 'user',
          content: `Is this TRUE or FALSE?\n"${text}"\n\nRespond JSON: {"verdict":"TRUE","confidence":85,"explanation":"why"}`
        }],
        temperature: 0.1,
        max_tokens: 250
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Groq API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  
  if (!data.choices || !data.choices[0]) {
    throw new Error('No response from Groq');
  }
  
  const textResponse = data.choices[0].message.content;
  console.log('📝 Groq response:', textResponse.substring(0, 200));
  
  // Parse JSON
  const jsonMatch = textResponse.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Groq response');
  }
  
  const result = JSON.parse(jsonMatch[0]);
  
  // Convert to our format
  return {
    verdict: result.verdict === 'TRUE' ? 'verified' : result.verdict === 'FALSE' ? 'fake' : 'questionable',
    confidence: Math.max(60, Math.min(95, result.confidence || 70)),
    explanation: result.explanation || 'Groq analysis completed'
  };
}

// ============================================
// COMBINE AI RESULTS
// ============================================

function combineAIResults(gemini, groq, text) {
  console.log('🔄 Combining: Gemini =', gemini.verdict, gemini.confidence, '| Groq =', groq.verdict, groq.confidence);
  
  let finalVerdict = 'questionable';
  let finalConfidence = 65;
  let explanation = '';
  
  // Both say FAKE → FAKE
  if (gemini.verdict === 'fake' && groq.verdict === 'fake') {
    finalVerdict = 'fake';
    finalConfidence = Math.max(gemini.confidence, groq.confidence);
    explanation = gemini.explanation;
  }
  // Both say VERIFIED → VERIFIED
  else if (gemini.verdict === 'verified' && groq.verdict === 'verified') {
    finalVerdict = 'verified';
    finalConfidence = Math.min(gemini.confidence, groq.confidence);
    explanation = gemini.explanation;
  }
  // One says FAKE → FAKE (better safe)
  else if (gemini.verdict === 'fake' || groq.verdict === 'fake') {
    finalVerdict = 'fake';
    const fakeAI = gemini.verdict === 'fake' ? gemini : groq;
    finalConfidence = fakeAI.confidence;
    explanation = fakeAI.explanation;
  }
  // One says VERIFIED with high confidence → VERIFIED
  else if ((gemini.verdict === 'verified' && gemini.confidence >= 75) ||
           (groq.verdict === 'verified' && groq.confidence >= 75)) {
    finalVerdict = 'verified';
    const verifiedAI = gemini.verdict === 'verified' ? gemini : groq;
    finalConfidence = verifiedAI.confidence;
    explanation = verifiedAI.explanation;
  }
  // Uncertain → QUESTIONABLE
  else {
    finalVerdict = 'questionable';
    finalConfidence = 65;
    explanation = gemini.explanation || groq.explanation || 'Cannot verify with certainty.';
  }
  
  console.log('🎯 Final decision:', finalVerdict, finalConfidence);
  
  return {
    verdict: finalVerdict,
    confidence: finalConfidence,
    explanation: explanation,
    sources: getDynamicSources(text),
    details: {
      geminiVerdict: gemini.verdict,
      geminiConfidence: gemini.confidence,
      groqVerdict: groq.verdict,
      groqConfidence: groq.confidence,
      aiVerificationUsed: true
    }
  };
}

function formatSingleAIResult(ai, text) {
  return {
    verdict: ai.verdict,
    confidence: ai.confidence,
    explanation: ai.explanation,
    sources: getDynamicSources(text),
    details: {
      aiVerificationUsed: true,
      singleAI: true
    }
  };
}

// ============================================
// PATTERN-BASED FALLBACK
// ============================================

function patternBasedCheck(text) {
  const textLower = text.toLowerCase();
  let score = 0;
  const flags = [];
  
  // Suspicious patterns
  const patterns = [
    { pattern: /forward.*urgent/i, score: 30, flag: 'Urgency manipulation' },
    { pattern: /share.*everyone/i, score: 25, flag: 'Viral spreading' },
    { pattern: /whatsapp.*university/i, score: 40, flag: 'WhatsApp University' },
    { pattern: /government.*hiding/i, score: 35, flag: 'Conspiracy language' },
    { pattern: /doctors.*don't.*want/i, score: 35, flag: 'Medical conspiracy' },
    { pattern: /100%.*(?:cure|proven)/i, score: 40, flag: 'Unrealistic claim' },
    { pattern: /!!!+/g, score: 15, flag: 'Excessive exclamation' },
    { pattern: /before.*deleted/i, score: 25, flag: 'Deletion urgency' }
  ];
  
  patterns.forEach(({ pattern, score: s, flag }) => {
    if (pattern.test(textLower)) {
      score += s;
      flags.push(flag);
    }
  });
  
  // Determine verdict based on score
  let verdict = 'questionable';
  let confidence = 60;
  let explanation = '';
  
  if (score >= 70) {
    verdict = 'fake';
    confidence = 80;
    explanation = `High suspicion based on patterns: ${flags.slice(0, 3).join(', ')}. This message shows multiple signs of misinformation.`;
  } else if (score >= 40) {
    verdict = 'questionable';
    confidence = 65;
    explanation = `Warning signs detected: ${flags.slice(0, 2).join(', ')}. Verify from trusted sources before sharing.`;
  } else {
    verdict = 'questionable';
    confidence = 60;
    explanation = 'Cannot verify without AI. Please check from trusted sources like Alt News, PIB, or WHO.';
  }
  
  return {
    verdict,
    confidence,
    explanation,
    sources: getDynamicSources(text),
    details: {
      patternScore: score,
      flags: flags,
      patternOnly: true
    }
  };
}

// ============================================
// DYNAMIC SOURCES
// ============================================

function getDynamicSources(text) {
  const sources = [];
  const textLower = text.toLowerCase();
  
  // Health
  if (textLower.includes('covid') || textLower.includes('vaccine') || textLower.includes('health')) {
    sources.push({ title: 'WHO - Health Info', url: 'https://www.who.int/' });
    sources.push({ title: 'Ministry of Health India', url: 'https://www.mohfw.gov.in/' });
  }
  
  // Political
  if (textLower.includes('modi') || textLower.includes('gandhi') || textLower.includes('pm') || textLower.includes('government')) {
    sources.push({ title: 'PIB Fact Check', url: 'https://factcheck.pib.gov.in/' });
  }
  
  // Always add general sources
  sources.push({ title: 'Alt News', url: 'https://www.altnews.in/' });
  sources.push({ title: 'Boom Live', url: 'https://www.boomlive.in/fact-check' });
  
  return sources.slice(0, 4);
}

function getDefaultSources() {
  return [
    { title: 'Alt News', url: 'https://www.altnews.in/' },
    { title: 'Boom Live', url: 'https://www.boomlive.in/fact-check' },
    { title: 'PIB Fact Check', url: 'https://factcheck.pib.gov.in/' }
  ];
}

// ============================================
// STATISTICS
// ============================================

let statsData = { totalChecks: 0, fakeDetected: 0, verifiedMessages: 0 };

chrome.storage.local.get(['stats'], (result) => {
  if (result.stats) statsData = result.stats;
});

function updateStats(verdict) {
  statsData.totalChecks++;
  if (verdict === 'fake') statsData.fakeDetected++;
  if (verdict === 'verified') statsData.verifiedMessages++;
  chrome.storage.local.set({ stats: statsData });
}
