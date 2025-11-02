// ============================================
// REPLACE YOUR ENTIRE background.js WITH THIS
// ============================================

console.log('Background service worker loaded with AGGRESSIVE fact-checking');

// API Keys
const GEMINI_API_KEY = 'AIzaSyCuAn7aBBQcU911D9ELMRH1cIAWFD5nAPE';
const GROQ_API_KEY = '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';

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'factCheck') {
    handleFactCheck(request.text).then(sendResponse);
    return true;
  }
  if (request.action === 'factCheckMedia') {
    handleMediaFactCheck(request.imageData, request.type).then(sendResponse);
    return true;
  }
});

// ============================================
// MAIN FACT-CHECKING WITH DUAL AI CONSENSUS
// ============================================

async function handleFactCheck(text) {
  console.log('🔍 AGGRESSIVE fact-check starting:', text.substring(0, 50));
  
  try {
    // Step 1: Quick checks
    const patternAnalysis = analyzePatterns(text);
    const databaseCheck = checkFakeNewsDatabase(text);
    
    console.log('📊 Pattern score:', patternAnalysis.score);
    console.log('💾 Database match:', databaseCheck.found);
    
    // Step 2: If known fake, return immediately
    if (databaseCheck.found) {
      console.log('✅ CAUGHT BY DATABASE');
      updateStats('fake');
      return createKnownFakeResult(databaseCheck, patternAnalysis);
    }
    
    // Step 3: Run BOTH AIs in parallel
    const [geminiResult, groqResult] = await Promise.allSettled([
      analyzeWithGeminiAI(text),
      analyzeWithGroq(text)
    ]);
    
    const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : null;
    const groq = groqResult.status === 'fulfilled' ? groqResult.value : null;
    
    console.log('🤖 Gemini:', gemini);
    console.log('🤖 Groq:', groq);
    
    // Step 4: DUAL AI CONSENSUS - Both must agree for VERIFIED
    const finalResult = combineDualAI(gemini, groq, patternAnalysis);
    
    console.log('✅ FINAL VERDICT:', finalResult.verdict, finalResult.confidence);
    
    updateStats(finalResult.verdict);
    return finalResult;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return createErrorResult(error.message);
  }
}

// ============================================
// AGGRESSIVE GEMINI PROMPT
// ============================================

async function analyzeWithGeminiAI(text) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyCuAn7aBBQcU911D9ELMRH1cIAWFD5nAPE') {
    throw new Error('No Gemini API key');
  }
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a STRICT fact-checker. Your job is to catch lies and misinformation.

MESSAGE: "${text}"

CRITICAL RULES:
1. DEFAULT TO QUESTIONING - Unless you can PROVE something is true with 100% certainty, mark it QUESTIONABLE or FAKE
2. VERIFY EVERY CLAIM - Check all factual statements
3. BE SUSPICIOUS - If it sounds wrong, it probably is
4. NO BENEFIT OF DOUBT - Better to question truth than verify lies

CHECK THESE FACTS:
- Political claims (who is PM, president, minister, party in power)
- Historical facts (when something happened, who did what)
- Scientific claims (medical facts, physics, biology)
- Current events (recent news, elections, sports results)
- Statistics and numbers (percentages, dates, quantities)

VERDICT RULES:
- FAKE (85-95%): Provably FALSE, contradicts known facts, lies, conspiracies
- QUESTIONABLE (60-80%): Cannot confirm as true, unverified, suspicious, vague
- VERIFIED (75-90%): Can PROVE it's true, from credible source, well-known fact

EXAMPLES:

Input: "Rahul Gandhi is Prime Minister of India"
Output: {"verdict":"FAKE","confidence":95,"explanation":"FALSE. Narendra Modi is Prime Minister of India since 2014, not Rahul Gandhi."}

Input: "Narendra Modi is Prime Minister of India"  
Output: {"verdict":"VERIFIED","confidence":90,"explanation":"TRUE. Narendra Modi has been PM of India since May 2014."}

Input: "Government making announcement tomorrow"
Output: {"verdict":"QUESTIONABLE","confidence":70,"explanation":"Unverified future claim. Cannot confirm without official source."}

Input: "Scientists say coffee is good"
Output: {"verdict":"QUESTIONABLE","confidence":65,"explanation":"Vague claim. Which scientists? What study? Needs source."}

Input: "COVID vaccines have microchips"
Output: {"verdict":"FAKE","confidence":95,"explanation":"FALSE. Debunked conspiracy theory. No microchips in vaccines."}

Respond ONLY with JSON:
{"verdict":"FAKE/QUESTIONABLE/VERIFIED","confidence":85,"explanation":"Clear explanation with facts"}

NOW ANALYZE AND BE STRICT:`
            }]
          }],
          generationConfig: {
            temperature: 0.05,
            maxOutputTokens: 400
          }
        })
      }
    );

    if (!response.ok) throw new Error('Gemini API failed');
    
    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text;
    const jsonMatch = aiText.match(/\{[^}]+\}/);
    
    if (!jsonMatch) throw new Error('No JSON in response');
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      verdict: result.verdict.toLowerCase(),
      confidence: Math.max(60, Math.min(95, result.confidence)),
      explanation: result.explanation,
      source: 'gemini'
    };
    
  } catch (error) {
    console.error('Gemini error:', error);
    throw error;
  }
}

// ============================================
// AGGRESSIVE GROQ PROMPT
// ============================================

async function analyzeWithGroq(text) {
  if (!GROQ_API_KEY || GROQ_API_KEY === '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') {
    throw new Error('No Groq API key');
  }
  
  try {
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
            content: 'You are a STRICT fact-checker. Default to QUESTIONING everything unless you can PROVE it is true. Catch lies and misinformation. Be aggressive and suspicious.'
          }, {
            role: 'user',
            content: `Fact-check this STRICTLY: "${text}"\n\nRules:\n1. If FALSE → FAKE\n2. If cannot verify → QUESTIONABLE\n3. If provably TRUE → VERIFIED\n\nRespond JSON only:\n{"verdict":"FAKE/QUESTIONABLE/VERIFIED","confidence":85,"explanation":"why"}`
          }],
          temperature: 0.1,
          max_tokens: 300
        })
      }
    );

    if (!response.ok) throw new Error('Groq API failed');
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[^}]+\}/);
    
    if (!jsonMatch) throw new Error('No JSON in response');
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      verdict: result.verdict.toLowerCase(),
      confidence: Math.max(60, Math.min(95, result.confidence)),
      explanation: result.explanation,
      source: 'groq'
    };
    
  } catch (error) {
    console.error('Groq error:', error);
    throw error;
  }
}

// ============================================
// DUAL AI CONSENSUS SYSTEM
// ============================================

function combineDualAI(gemini, groq, patterns) {
  // Both AIs failed
  if (!gemini && !groq) {
    return createPatternBasedResult(patterns);
  }
  
  // Only one AI worked
  if (!gemini) return createSingleAIResult(groq, patterns);
  if (!groq) return createSingleAIResult(gemini, patterns);
  
  // BOTH AIs worked - Use strict consensus
  console.log('🎯 DUAL AI CONSENSUS MODE');
  
  let finalVerdict = 'questionable';
  let finalConfidence = 65;
  let explanation = '';
  const warningFlags = [];
  
  // Rule 1: If EITHER says FAKE → Mark as FAKE
  if (gemini.verdict === 'fake' || groq.verdict === 'fake') {
    finalVerdict = 'fake';
    finalConfidence = Math.max(gemini.confidence, groq.confidence);
    explanation = gemini.verdict === 'fake' ? gemini.explanation : groq.explanation;
    warningFlags.push('AI detected misinformation');
    console.log('✅ At least one AI says FAKE');
  }
  
  // Rule 2: If BOTH say VERIFIED → Mark as VERIFIED (rare!)
  else if (gemini.verdict === 'verified' && groq.verdict === 'verified') {
    // BOTH must agree AND have high confidence
    if (gemini.confidence >= 75 && groq.confidence >= 75) {
      finalVerdict = 'verified';
      finalConfidence = Math.min(gemini.confidence, groq.confidence);
      explanation = gemini.explanation;
      console.log('✅ BOTH AIs agree: VERIFIED');
    } else {
      // Low confidence even if both say verified → Downgrade to questionable
      finalVerdict = 'questionable';
      finalConfidence = 65;
      explanation = 'Both AIs lean towards verified but have moderate confidence. Verify from trusted sources for important claims.';
      warningFlags.push('Moderate AI confidence');
      console.log('⚠️ Low confidence - downgraded to QUESTIONABLE');
    }
  }
  
  // Rule 3: If they DISAGREE → Mark as QUESTIONABLE
  else if (gemini.verdict !== groq.verdict) {
    finalVerdict = 'questionable';
    finalConfidence = 65;
    explanation = `Our AI models disagree on this claim. Gemini analysis suggests it's ${gemini.verdict}, while Groq analysis suggests ${groq.verdict}. Verify from multiple trusted sources.`;
    warningFlags.push('AI models disagree on verdict');
    console.log('⚠️ AIs DISAGREE - marked QUESTIONABLE');
  }
  
  // Rule 4: Both say QUESTIONABLE → Keep as QUESTIONABLE
  else {
    finalVerdict = 'questionable';
    finalConfidence = Math.min(gemini.confidence, groq.confidence);
    explanation = gemini.explanation || 'Both AI models cannot verify this claim with certainty.';
    console.log('⚠️ Both say QUESTIONABLE');
  }
  
  // Rule 5: Override with patterns if very suspicious
  if (patterns.score > 70) {
    finalVerdict = 'fake';
    finalConfidence = Math.max(finalConfidence, 80);
    explanation += ` Additionally, multiple suspicious patterns detected: ${patterns.flags.slice(0, 3).join(', ')}.`;
    warningFlags.push(`${patterns.flags.length} misinformation patterns detected`);
    console.log('🚨 HIGH PATTERN SCORE - overriding to FAKE');
  }
  
  // Add pattern flags if present
  if (patterns.flags.length > 0 && patterns.score > 30) {
    warningFlags.push(...patterns.flags.slice(0, 3));
  }
  
  return {
    verdict: finalVerdict,
    confidence: Math.round(finalConfidence),
    explanation: explanation,
    sources: getDynamicSources(finalVerdict, explanation, patterns),
    details: {
      geminiVerdict: gemini.verdict,
      geminiConfidence: gemini.confidence,
      groqVerdict: groq.verdict,
      groqConfidence: groq.confidence,
      patternScore: patterns.score,
      flags: [...new Set(warningFlags)],
      consensus: gemini.verdict === groq.verdict,
      aiVerificationUsed: true
    }
  };
}

function createSingleAIResult(ai, patterns) {
  let verdict = ai.verdict;
  let confidence = ai.confidence;
  
  // If patterns are very suspicious, override
  if (patterns.score > 70 && ai.verdict !== 'fake') {
    verdict = 'fake';
    confidence = 80;
  }
  
  return {
    verdict: verdict,
    confidence: confidence,
    explanation: ai.explanation,
    sources: getFactCheckSources(),
    details: {
      patternScore: patterns.score,
      flags: patterns.flags,
      aiSource: ai.source
    }
  };
}

// ============================================
// PATTERN ANALYSIS (More Aggressive)
// ============================================

function analyzePatterns(text) {
  let suspicionScore = 0;
  const flags = [];
  
  const patterns = [
    { pattern: /rahul gandhi.*(?:pm|prime minister)/i, score: 50, flag: 'FALSE: Wrong PM claim' },
    { pattern: /congress.*(?:power|government)/i, score: 40, flag: 'SUSPICIOUS: Congress not in power' },
    { pattern: /modi.*(?:dictator|fascist)/i, score: 25, flag: 'Political propaganda' },
    { pattern: /whatsapp.*university/i, score: 40, flag: 'WhatsApp University source' },
    { pattern: /forward.*urgent/i, score: 30, flag: 'Urgency manipulation' },
    { pattern: /share.*everyone/i, score: 25, flag: 'Viral spreading tactic' },
    { pattern: /government.*hiding/i, score: 35, flag: 'Conspiracy language' },
    { pattern: /doctors.*don't.*want/i, score: 40, flag: 'Medical conspiracy' },
    { pattern: /100%.*(?:cure|proven)/i, score: 40, flag: 'Unrealistic claim' },
    { pattern: /miracle.*cure/i, score: 40, flag: 'Miracle cure claim' },
    { pattern: /vaccine.*(?:dangerous|poison|kill)/i, score: 45, flag: 'Vaccine misinformation' },
    { pattern: /5g.*(?:corona|covid)/i, score: 50, flag: '5G conspiracy' },
    { pattern: /bill gates.*(?:microchip|control)/i, score: 45, flag: 'Bill Gates conspiracy' },
    { pattern: /covid.*hoax/i, score: 50, flag: 'COVID denial' },
    { pattern: /earth.*flat/i, score: 50, flag: 'Flat earth conspiracy' },
    { pattern: /!!!+/g, score: 15, flag: 'Excessive punctuation' },
    { pattern: /before.*(?:deleted|removed)/i, score: 25, flag: 'Deletion urgency' }
  ];
  
  patterns.forEach(({ pattern, score, flag }) => {
    if (pattern.test(text)) {
      suspicionScore += score;
      flags.push(flag);
    }
  });
  
  // ALL CAPS check
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.3) {
    suspicionScore += 20;
    flags.push('Excessive capitalization');
  }
  
  return {
    score: Math.min(suspicionScore, 100),
    flags: [...new Set(flags)]
  };
}

// ============================================
// DATABASE WITH MORE FALSE CLAIMS
// ============================================

function checkFakeNewsDatabase(text) {
  const textLower = text.toLowerCase();
  
  const falseClaims = [
    { keywords: ['rahul', 'gandhi', 'prime minister'], truth: 'FALSE: Narendra Modi is PM of India since 2014' },
    { keywords: ['rahul', 'gandhi', 'pm'], truth: 'FALSE: Narendra Modi is PM, not Rahul Gandhi' },
    { keywords: ['congress', 'power', 'india'], truth: 'FALSE: BJP is in power, not Congress' },
    { keywords: ['india', 'won', 'world cup', '2023'], truth: 'FALSE: Australia won Cricket World Cup 2023' },
    { keywords: ['covid', 'hoax'], truth: 'FALSE: COVID-19 is real, recognized by WHO' },
    { keywords: ['vaccine', 'microchip'], truth: 'FALSE: No microchips in vaccines' },
    { keywords: ['vaccine', 'autism'], truth: 'FALSE: No link between vaccines and autism' },
    { keywords: ['earth', 'flat'], truth: 'FALSE: Earth is spherical' },
    { keywords: ['5g', 'coronavirus'], truth: 'FALSE: 5G does not spread COVID' },
    { keywords: ['bill gates', 'microchip'], truth: 'FALSE: Bill Gates conspiracy theory' },
    { keywords: ['onion', 'bed', 'covid'], truth: 'FALSE: Onion does not cure COVID' },
    { keywords: ['cow urine', 'corona'], truth: 'FALSE: Cow urine does not cure COVID' },
    { keywords: ['hot water', 'kills', 'virus'], truth: 'FALSE: Hot water does not kill COVID' }
  ];
  
  for (const claim of falseClaims) {
    const allMatch = claim.keywords.every(kw => textLower.includes(kw));
    if (allMatch) {
      return {
        found: true,
        matches: [claim.truth],
        confidence: 95,
        type: 'factual_error'
      };
    }
  }
  
  return { found: false, matches: [], confidence: 0 };
}

function createKnownFakeResult(databaseCheck, patternAnalysis) {
  return {
    verdict: 'fake',
    confidence: 95,
    explanation: `❌ ${databaseCheck.matches[0]}`,
    sources: getFactCheckSources(),
    details: {
      patternScore: patternAnalysis.score,
      flags: patternAnalysis.flags,
      databaseMatch: true
    }
  };
}

function createPatternBasedResult(patterns) {
  let verdict = 'questionable';
  let confidence = 65;
  let explanation = 'Cannot verify with AI. Based on pattern analysis, this message needs verification.';
  
  if (patterns.score > 70) {
    verdict = 'fake';
    confidence = 80;
    explanation = `HIGH SUSPICION: ${patterns.flags.slice(0, 3).join(', ')}. Likely misinformation.`;
  } else if (patterns.score > 40) {
    verdict = 'questionable';
    confidence = 70;
    explanation = `WARNING SIGNS: ${patterns.flags.slice(0, 2).join(', ')}. Verify before sharing.`;
  } else {
    verdict = 'questionable';
    confidence = 60;
    explanation = 'No AI available. Cannot verify. Check from trusted sources.';
  }
  
  return {
    verdict,
    confidence,
    explanation,
    sources: getFactCheckSources(),
    details: { patternScore: patterns.score, flags: patterns.flags }
  };
}

function createErrorResult(message) {
  return {
    verdict: 'error',
    confidence: 0,
    explanation: `Error: ${message}. Cannot verify.`,
    sources: getFactCheckSources()
  };
}

function getDynamicSources(verdict, explanation, patterns) {
  const sources = [];
  const explanationLower = explanation.toLowerCase();
  
  // Medical/Health related
  if (explanationLower.includes('covid') || explanationLower.includes('vaccine') || 
      explanationLower.includes('health') || explanationLower.includes('disease') ||
      explanationLower.includes('medical')) {
    sources.push(
      { title: 'WHO - COVID-19 Mythbusters', url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters' },
      { title: 'Ministry of Health - India', url: 'https://www.mohfw.gov.in/' },
      { title: 'CDC - Vaccine Facts', url: 'https://www.cdc.gov/vaccines/index.html' }
    );
  }
  
  // Political claims
  if (explanationLower.includes('prime minister') || explanationLower.includes('modi') || 
      explanationLower.includes('rahul') || explanationLower.includes('government') ||
      explanationLower.includes('election') || explanationLower.includes('congress') ||
      explanationLower.includes('bjp')) {
    sources.push(
      { title: 'PIB Fact Check (Govt of India)', url: 'https://factcheck.pib.gov.in/' },
      { title: 'Election Commission of India', url: 'https://eci.gov.in/' },
      { title: 'Alt News - Political Fact Checks', url: 'https://www.altnews.in/category/fact-check/' }
    );
  }
  
  // Conspiracy theories
  if (explanationLower.includes('conspiracy') || explanationLower.includes('bill gates') ||
      explanationLower.includes('5g') || explanationLower.includes('microchip') ||
      explanationLower.includes('hoax')) {
    sources.push(
      { title: 'Snopes - Fact Checking', url: 'https://www.snopes.com/' },
      { title: 'Reuters Fact Check', url: 'https://www.reuters.com/fact-check' },
      { title: 'Alt News - Debunked Claims', url: 'https://www.altnews.in/' }
    );
  }
  
  // Science related
  if (explanationLower.includes('earth') || explanationLower.includes('space') ||
      explanationLower.includes('nasa') || explanationLower.includes('scientific')) {
    sources.push(
      { title: 'NASA Official Website', url: 'https://www.nasa.gov/' },
      { title: 'National Geographic', url: 'https://www.nationalgeographic.com/' },
      { title: 'Science Magazine', url: 'https://www.science.org/' }
    );
  }
  
  // Financial/Economic
  if (explanationLower.includes('money') || explanationLower.includes('scheme') ||
      explanationLower.includes('investment') || explanationLower.includes('rupee')) {
    sources.push(
      { title: 'Reserve Bank of India', url: 'https://www.rbi.org.in/' },
      { title: 'PIB - Financial Schemes', url: 'https://pib.gov.in/' }
    );
  }
  
  // Check pattern flags for more context
  if (patterns.flags.length > 0) {
    const flagsLower = patterns.flags.join(' ').toLowerCase();
    
    if (flagsLower.includes('whatsapp university')) {
      sources.push({ title: 'Boom Live - WhatsApp Fake News', url: 'https://www.boomlive.in/fake-news' });
    }
    
    if (flagsLower.includes('forward') || flagsLower.includes('urgent')) {
      sources.push({ title: 'Viral Misinformation Database', url: 'https://www.altnews.in/' });
    }
  }
  
  // Always add general fact-checking sources
  if (sources.length === 0 || sources.length < 3) {
    sources.push(
      { title: 'Alt News - Indian Fact-Checking', url: 'https://www.altnews.in/' },
      { title: 'Boom Live - Fact Check', url: 'https://www.boomlive.in/fact-check' },
      { title: 'PIB Fact Check', url: 'https://factcheck.pib.gov.in/' }
    );
  }
  
  // Remove duplicates and return top 4
  const uniqueSources = sources.filter((source, index, self) =>
    index === self.findIndex((s) => s.url === source.url)
  );
  
  return uniqueSources.slice(0, 4);
}

function getFactCheckSources() {
  // Fallback for when dynamic sources aren't used
  return [
    { title: 'Alt News - Indian Fact-Checking', url: 'https://www.altnews.in/' },
    { title: 'Boom Live - Fact Check', url: 'https://www.boomlive.in/fact-check' },
    { title: 'PIB Fact Check (Govt)', url: 'https://factcheck.pib.gov.in/' }
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
