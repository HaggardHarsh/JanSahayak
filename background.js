// ============================================
// SIMPLE FACT-CHECKER - TRUE OR FALSE
// Replace your background.js with this
// ============================================

console.log('Simple TRUE/FALSE fact-checker loaded');

const GEMINI_API_KEY = 'AIzaSyCuAn7aBBQcU911D9ELMRH1cIAWFD5nAPE';
const GROQ_API_KEY = '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';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'factCheck') {
    simpleFactCheck(request.text).then(sendResponse);
    return true;
  }
  if (request.action === 'factCheckMedia') {
    handleMediaFactCheck(request.imageData, request.type).then(sendResponse);
    return true;
  }
});

// ============================================
// SIMPLE FACT-CHECKING - IS IT TRUE OR FALSE?
// ============================================

async function simpleFactCheck(text) {
  console.log('🔍 Checking if TRUE or FALSE:', text.substring(0, 50));
  
  try {
    // Quick check for known false claims
    const knownFake = checkKnownFakes(text);
    if (knownFake) {
      console.log('✅ CAUGHT: Known false claim');
      updateStats('fake');
      return knownFake;
    }
    
    // Ask AI: Is this TRUE or FALSE?
    const result = await askAITrueOrFalse(text);
    
    console.log('✅ Result:', result.verdict);
    updateStats(result.verdict);
    return result;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return {
      verdict: 'questionable',
      confidence: 50,
      explanation: 'Unable to verify. Please check from trusted sources.',
      sources: getRelevantSources(text)
    };
  }
}

// ============================================
// ASK AI: IS THIS TRUE OR FALSE?
// ============================================

async function askAITrueOrFalse(text) {
  let geminiResult = null;
  let groqResult = null;
  
  // Try Gemini
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'AIzaSyCuAn7aBBQcU911D9ELMRH1cIAWFD5nAPE') {
    try {
      geminiResult = await askGemini(text);
      console.log('🤖 Gemini:', geminiResult.verdict);
    } catch (e) {
      console.log('⚠️ Gemini failed');
    }
  }
  
  // Try Groq
  if (GROQ_API_KEY && GROQ_API_KEY !== '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') {
    try {
      groqResult = await askGroq(text);
      console.log('🤖 Groq:', groqResult.verdict);
    } catch (e) {
      console.log('⚠️ Groq failed');
    }
  }
  
  // Combine results
  if (geminiResult && groqResult) {
    return combineTwoAIs(geminiResult, groqResult, text);
  } else if (geminiResult) {
    return geminiResult;
  } else if (groqResult) {
    return groqResult;
  } else {
    throw new Error('Both AIs failed');
  }
}

async function askGemini(text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a fact-checker. Your ONLY job is to determine if a statement is TRUE or FALSE.

STATEMENT: "${text}"

INSTRUCTIONS:
1. If the statement makes a FACTUAL CLAIM, verify if it's TRUE or FALSE
2. If TRUE and provable → "TRUE"
3. If FALSE or incorrect → "FALSE"  
4. Only say "UNCERTAIN" if you genuinely cannot determine (very rare)

EXAMPLES:

"Narendra Modi is Prime Minister of India" → TRUE (He is PM since 2014)
"Rahul Gandhi is Prime Minister of India" → FALSE (Modi is PM, not Rahul)
"COVID vaccines contain microchips" → FALSE (Debunked conspiracy)
"Earth is flat" → FALSE (Earth is spherical)
"Water boils at 100°C at sea level" → TRUE (Scientific fact)
"WHO recommends washing hands" → TRUE (Verified guideline)
"Government announcement tomorrow" → UNCERTAIN (Cannot verify future)

Respond ONLY with JSON:
{"verdict":"TRUE/FALSE/UNCERTAIN","confidence":90,"explanation":"Brief clear explanation with facts"}`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300
        }
      })
    }
  );

  const data = await response.json();
  const text_response = data.candidates[0].content.parts[0].text;
  const jsonMatch = text_response.match(/\{[^}]+\}/);
  const result = JSON.parse(jsonMatch[0]);
  
  // Convert to our verdict system
  let verdict = 'questionable';
  if (result.verdict === 'TRUE') verdict = 'verified';
  else if (result.verdict === 'FALSE') verdict = 'fake';
  else verdict = 'questionable';
  
  return {
    verdict: verdict,
    confidence: Math.max(60, Math.min(95, result.confidence)),
    explanation: result.explanation,
    source: 'gemini'
  };
}

async function askGroq(text) {
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
          content: 'You are a fact-checker. Determine if statements are TRUE, FALSE, or UNCERTAIN. Be direct and factual.'
        }, {
          role: 'user',
          content: `Is this TRUE or FALSE?\n"${text}"\n\nRespond JSON only: {"verdict":"TRUE/FALSE/UNCERTAIN","confidence":85,"explanation":"why"}`
        }],
        temperature: 0.1,
        max_tokens: 250
      })
    }
  );

  const data = await response.json();
  const text_response = data.choices[0].message.content;
  const jsonMatch = text_response.match(/\{[^}]+\}/);
  const result = JSON.parse(jsonMatch[0]);
  
  // Convert to our verdict system
  let verdict = 'questionable';
  if (result.verdict === 'TRUE') verdict = 'verified';
  else if (result.verdict === 'FALSE') verdict = 'fake';
  else verdict = 'questionable';
  
  return {
    verdict: verdict,
    confidence: Math.max(60, Math.min(95, result.confidence)),
    explanation: result.explanation,
    source: 'groq'
  };
}

// ============================================
// COMBINE TWO AI RESULTS
// ============================================

function combineTwoAIs(gemini, groq, text) {
  console.log('Gemini says:', gemini.verdict, gemini.confidence);
  console.log('Groq says:', groq.verdict, groq.confidence);
  
  let finalVerdict = 'questionable';
  let finalConfidence = 60;
  let explanation = '';
  
  // Both agree on FAKE → Definitely FAKE
  if (gemini.verdict === 'fake' && groq.verdict === 'fake') {
    finalVerdict = 'fake';
    finalConfidence = Math.max(gemini.confidence, groq.confidence);
    explanation = gemini.explanation;
  }
  
  // Both agree on VERIFIED → Definitely TRUE
  else if (gemini.verdict === 'verified' && groq.verdict === 'verified') {
    finalVerdict = 'verified';
    finalConfidence = Math.min(gemini.confidence, groq.confidence);
    explanation = gemini.explanation;
  }
  
  // One says FAKE, other disagrees → FAKE (better safe than sorry)
  else if (gemini.verdict === 'fake' || groq.verdict === 'fake') {
    finalVerdict = 'fake';
    const fakeAI = gemini.verdict === 'fake' ? gemini : groq;
    finalConfidence = fakeAI.confidence;
    explanation = fakeAI.explanation;
  }
  
  // One says VERIFIED, other says QUESTIONABLE → QUESTIONABLE
  else if ((gemini.verdict === 'verified' && groq.verdict === 'questionable') ||
           (groq.verdict === 'verified' && gemini.verdict === 'questionable')) {
    finalVerdict = 'questionable';
    finalConfidence = 65;
    explanation = `Cannot verify with certainty. One AI says verified, other is uncertain. ${gemini.explanation}`;
  }
  
  // Both uncertain → QUESTIONABLE
  else {
    finalVerdict = 'questionable';
    finalConfidence = 60;
    explanation = gemini.explanation || 'Cannot determine if this is true or false. Verify from trusted sources.';
  }
  
  return {
    verdict: finalVerdict,
    confidence: Math.round(finalConfidence),
    explanation: explanation,
    sources: getRelevantSources(text),
    details: {
      geminiVerdict: gemini.verdict,
      geminiConfidence: gemini.confidence,
      groqVerdict: groq.verdict,
      groqConfidence: groq.confidence,
      consensus: gemini.verdict === groq.verdict,
      aiVerificationUsed: true
    }
  };
}

// ============================================
// KNOWN FALSE CLAIMS DATABASE
// ============================================

function checkKnownFakes(text) {
  const textLower = text.toLowerCase();
  
  const knownFalse = [
    {
      keywords: ['rahul', 'gandhi', 'prime minister'],
      explanation: 'FALSE: Narendra Modi is the Prime Minister of India, not Rahul Gandhi. Modi has been PM since May 2014.'
    },
    {
      keywords: ['rahul', 'gandhi', 'pm'],
      explanation: 'FALSE: Narendra Modi is the PM of India, not Rahul Gandhi.'
    },
    {
      keywords: ['congress', 'in power'],
      explanation: 'FALSE: BJP is currently in power in India, not Congress. BJP won in 2014 and 2019.'
    },
    {
      keywords: ['covid', 'hoax'],
      explanation: 'FALSE: COVID-19 is a real disease recognized by WHO and scientific community worldwide.'
    },
    {
      keywords: ['vaccine', 'microchip'],
      explanation: 'FALSE: COVID-19 vaccines do not contain microchips. This is a debunked conspiracy theory.'
    },
    {
      keywords: ['vaccine', 'autism'],
      explanation: 'FALSE: Multiple scientific studies have found no link between vaccines and autism.'
    },
    {
      keywords: ['earth', 'flat'],
      explanation: 'FALSE: Earth is spherical (oblate spheroid). This is proven by science and observable evidence.'
    },
    {
      keywords: ['5g', 'coronavirus'],
      explanation: 'FALSE: 5G technology does not spread COVID-19. Viruses cannot travel on radio waves.'
    },
    {
      keywords: ['bill gates', 'microchip'],
      explanation: 'FALSE: Bill Gates conspiracy theory about microchipping people is completely false.'
    }
  ];
  
  for (const fake of knownFalse) {
    const allMatch = fake.keywords.every(kw => textLower.includes(kw));
    if (allMatch) {
      return {
        verdict: 'fake',
        confidence: 95,
        explanation: fake.explanation,
        sources: getRelevantSources(text),
        details: {
          databaseMatch: true,
          flags: ['Known false claim from database'],
          aiVerificationUsed: false
        }
      };
    }
  }
  
  return null;
}

// ============================================
// DYNAMIC SOURCES
// ============================================

function getRelevantSources(text) {
  const sources = [];
  const textLower = text.toLowerCase();
  
  // Health/Medical
  if (textLower.includes('covid') || textLower.includes('vaccine') || 
      textLower.includes('health') || textLower.includes('disease')) {
    sources.push(
      { title: 'WHO - World Health Organization', url: 'https://www.who.int/' },
      { title: 'CDC - Disease Control', url: 'https://www.cdc.gov/' },
      { title: 'Ministry of Health - India', url: 'https://www.mohfw.gov.in/' }
    );
  }
  
  // Political
  if (textLower.includes('modi') || textLower.includes('gandhi') || 
      textLower.includes('prime minister') || textLower.includes('government') ||
      textLower.includes('election')) {
    sources.push(
      { title: 'PIB Fact Check - Govt of India', url: 'https://factcheck.pib.gov.in/' },
      { title: 'Election Commission of India', url: 'https://eci.gov.in/' }
    );
  }
  
  // Science
  if (textLower.includes('earth') || textLower.includes('space') || 
      textLower.includes('nasa')) {
    sources.push(
      { title: 'NASA Official', url: 'https://www.nasa.gov/' },
      { title: 'National Geographic', url: 'https://www.nationalgeographic.com/' }
    );
  }
  
  // Always add general fact-checkers
  sources.push(
    { title: 'Alt News - Fact Checking', url: 'https://www.altnews.in/' },
    { title: 'Boom Live - Fact Check', url: 'https://www.boomlive.in/fact-check' }
  );
  
  // Remove duplicates, return top 4
  const unique = sources.filter((s, i, a) => a.findIndex(x => x.url === s.url) === i);
  return unique.slice(0, 4);
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

// ============================================
// MEDIA FACT-CHECKING (Keep existing code)
// ============================================

async function handleMediaFactCheck(imageData, type) {
  // Your existing media handling code here
  return {
    verdict: 'questionable',
    confidence: 50,
    explanation: 'Media fact-checking coming soon',
    sources: getRelevantSources('')
  };
}
