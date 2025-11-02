// WhatsApp Forward Killer - Background Service Worker
// Enhanced with Gemini AI for 90%+ Accuracy

console.log('Background service worker loaded with AI');

// ========================================
// CONFIGURATION - ADD YOUR API KEY HERE
// ========================================

// Get FREE Gemini API key from: https://makersuite.google.com/app/apikey
const GEMINI_API_KEY = 'AIzaSyCFYH6Wu4DvQIwd8kkTasqDCtAQE5c5_dE'; // Replace with your key

// Optional: Add Groq for multi-AI consensus (https://console.groq.com/)
const GROQ_API_KEY = ''; // Optional - leave empty to use Gemini only

// ========================================
// MAIN FACT-CHECKING FUNCTION
// ========================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'factCheck') {
    handleFactCheck(request.text).then(sendResponse);
    return true;
  }
});

async function handleFactCheck(text) {
  console.log('🔍 Starting fact-check for:', text.substring(0, 50) + '...');
  
  try {
    // Step 1: Quick local checks (instant)
    const patternAnalysis = analyzePatterns(text);
    console.log('📊 Pattern analysis:', patternAnalysis);
    
    const databaseCheck = checkFakeNewsDatabase(text);
    console.log('💾 Database check:', databaseCheck);
    
    // Step 2: If known fake, return immediately (highest confidence)
    if (databaseCheck.found) {
      console.log('✅ Known fake news found in database');
      updateStats('fake');
      return createKnownFakeResult(databaseCheck, patternAnalysis);
    }
    
    // Step 3: Use AI for intelligent analysis
    let aiResult = null;
    let usingAI = false;
    
    if (GEMINI_API_KEY) {
      console.log('🤖 Attempting Gemini AI analysis...');
      try {
        aiResult = await analyzeWithGeminiAI(text);
        usingAI = true;
        console.log('✅ Gemini AI result:', aiResult);
      } catch (error) {
        console.error('❌ Gemini AI failed:', error.message);
        aiResult = null;
      }
    }
    
    // If Gemini failed, try Groq
    if (!aiResult && GROQ_API_KEY) {
      console.log('🤖 Attempting Groq AI analysis...');
      try {
        aiResult = await analyzeWithGroq(text);
        usingAI = true;
        console.log('✅ Groq AI result:', aiResult);
      } catch (error) {
        console.error('❌ Groq AI failed:', error.message);
        aiResult = null;
      }
    }
    
    // Step 4: If no AI available or failed, use pattern-based analysis
    if (!aiResult) {
      console.log('⚠️ No AI available, using pattern-based analysis');
      aiResult = createPatternBasedResult(patternAnalysis);
    }
    
    // Step 5: Combine AI with pattern analysis for final verdict
    console.log('🔄 Combining AI and pattern analysis...');
    const finalResult = combineAIAndPatterns(aiResult, patternAnalysis);
    
    console.log('✅ Final result:', {
      verdict: finalResult.verdict,
      confidence: finalResult.confidence,
      usingAI: usingAI
    });
    
    updateStats(finalResult.verdict);
    return finalResult;
    
  } catch (error) {
    console.error('❌ Critical error in handleFactCheck:', error);
    return createErrorResult(error.message);
  }
}

// ========================================
// GEMINI AI INTEGRATION (FREE!)
// ========================================

async function analyzeWithGeminiAI(text) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a STRICT fact-checker specialized in detecting misinformation. Be skeptical and conservative in your judgments.

MESSAGE TO ANALYZE:
"${text}"

CLASSIFICATION RULES (Apply rigorously):

1. FAKE (85-95% confidence):
   - Known conspiracy theories (5G, microchips, Bill Gates, Illuminati)
   - Medical misinformation (miracle cures, fake treatments)
   - Debunked viral claims (onion cures, hot water kills virus)
   - False statistics or made-up numbers without credible sources
   - Manipulative urgency ("forward urgent", "before deleted")
   - Claims that contradict established science

2. QUESTIONABLE (60-75% confidence):
   - Claims without verifiable sources or citations
   - Vague "breaking news" or "experts say" without naming sources
   - Unverified health advice or medical claims
   - Political claims without attribution
   - Sensational headlines without context
   - Anonymous authority ("doctors don't want you to know")
   - Personal anecdotes presented as universal facts
   - ANY claim that requires verification but provides no source

3. VERIFIED (75-85% confidence):
   - Contains specific citations to credible sources (WHO, CDC, peer-reviewed journals)
   - Well-established scientific facts with broad consensus
   - Official government announcements with verification links
   - Historical facts that are widely documented
   - Basic educational content that's uncontroversial
   - MUST have clear attribution or be universally accepted knowledge

CRITICAL RULES:
- DEFAULT to QUESTIONABLE if unsure or if sources are vague
- ONLY mark as VERIFIED if information is clearly sourced or universally accepted
- Be EXTRA skeptical of health/medical claims without specific sources
- ANY urgency language ("share now", "before removed") = automatic red flag
- Generic statements need specific evidence to be verified
- Claims about "studies" without naming the study = QUESTIONABLE at minimum

Respond ONLY with this JSON format:
{
  "verdict": "FAKE or QUESTIONABLE or VERIFIED",
  "confidence": 75,
  "explanation": "Clear 2-3 sentence explanation citing specific issues",
  "redFlags": ["specific issue 1", "specific issue 2"],
  "recommendation": "Clear advice"
}

EXAMPLES:
Input: "According to WHO guidelines published in 2024, washing hands with soap prevents disease transmission"
Output: {"verdict":"VERIFIED","confidence":82,"explanation":"This cites WHO specifically and reflects established medical consensus on hand hygiene","redFlags":[],"recommendation":"Accurate health information"}

Input: "Doctors say eating garlic cures cancer"
Output: {"verdict":"QUESTIONABLE","confidence":65,"explanation":"Vague attribution ('doctors say') without naming sources. Medical claims require specific evidence","redFlags":["No source citation","Unverified medical claim"],"recommendation":"Verify from credible medical sources before believing"}

Input: "Bill Gates microchipping vaccines!!!"
Output: {"verdict":"FAKE","confidence":95,"explanation":"This is a thoroughly debunked conspiracy theory with no factual basis","redFlags":["Conspiracy theory","Excessive punctuation","Unverified claim"],"recommendation":"Do not share"}

Input: "Forward urgent! NASA says planet alignment will cause 6 days of darkness!"
Output: {"verdict":"FAKE","confidence":92,"explanation":"Classic viral hoax. NASA has repeatedly debunked planetary alignment darkness claims","redFlags":["Urgency manipulation","False NASA attribution","Debunked claim"],"recommendation":"Do not forward"}

Now analyze the message above with STRICT scrutiny:`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 800
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }

    const aiText = data.candidates[0].content.parts[0].text;
    console.log('📝 Gemini raw response:', aiText);
    
    // Extract JSON from response
    const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error('Could not find JSON in response:', aiText);
      throw new Error('Could not parse Gemini response as JSON');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    // Validate and fix confidence
    let confidence = parseInt(result.confidence) || 70;
    if (confidence < 60) confidence = 60;
    if (confidence > 95) confidence = 95;
    
    // Normalize verdict
    let verdict = (result.verdict || 'questionable').toLowerCase();
    if (!['fake', 'questionable', 'verified'].includes(verdict)) {
      verdict = 'questionable';
      confidence = 65;
    }
    
    console.log('✅ Gemini result:', { verdict, confidence });
    
    return {
      verdict: verdict,
      confidence: confidence,
      explanation: result.explanation || 'AI analysis completed',
      redFlags: result.redFlags || [],
      recommendation: result.recommendation || 'Verify before sharing',
      method: 'gemini_ai'
    };
    
  } catch (error) {
    console.error('❌ Gemini AI error:', error);
    throw error;
  }
}

// ========================================
// GROQ AI INTEGRATION (OPTIONAL, FAST!)
// ========================================

async function analyzeWithGroq(text) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a fact-checking expert for Indian WhatsApp messages. Respond ONLY with valid JSON.'
          },
          {
            role: 'user',
            content: `Fact-check: "${text}"\n\nRespond ONLY with JSON:\n{"verdict":"FAKE/QUESTIONABLE/VERIFIED","confidence":0-100,"explanation":"why","redFlags":["flags"],"recommendation":"advice"}`
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return {
      verdict: result.verdict.toLowerCase(),
      confidence: result.confidence || 70,
      explanation: result.explanation,
      redFlags: result.redFlags || [],
      recommendation: result.recommendation || 'Verify before sharing',
      method: 'groq_ai'
    };
    
  } catch (error) {
    console.error('Groq AI error:', error);
    throw error;
  }
}

// ========================================
// PATTERN ANALYSIS (OFFLINE, FAST)
// ========================================

function analyzePatterns(text) {
  let suspicionScore = 0;
  const flags = [];

  const fakeNewsPatterns = [
    { pattern: /whatsapp.*university/i, score: 35, flag: 'WhatsApp University source' },
    { pattern: /forward.*urgent|forward.*now|share.*urgent/i, score: 30, flag: 'Urgency manipulation' },
    { pattern: /share.*everyone|send.*everyone|forward.*all/i, score: 25, flag: 'Viral spreading tactic' },
    { pattern: /government.*hiding|they.*hiding/i, score: 30, flag: 'Conspiracy theory language' },
    { pattern: /doctors.*don't.*want|doctors.*hiding/i, score: 35, flag: 'Medical conspiracy' },
    { pattern: /100%.*cure|cure.*100%|guaranteed.*cure/i, score: 40, flag: 'Unrealistic medical claim' },
    { pattern: /miracle.*cure|magical.*cure|instant.*cure/i, score: 40, flag: 'Miracle cure claim' },
    { pattern: /!!!+/g, score: 15, flag: 'Excessive exclamation marks' },
    { pattern: /nasa.*said|nasa.*confirm|according.*nasa/i, score: 30, flag: 'Unverified NASA claim' },
    { pattern: /breaking.*news|urgent.*news/i, score: 20, flag: 'Sensational breaking news' },
    { pattern: /vaccine.*dangerous|vaccine.*kill|vaccine.*harm/i, score: 45, flag: 'Vaccine misinformation' },
    { pattern: /5g.*corona|5g.*covid|5g.*virus/i, score: 50, flag: '5G conspiracy theory' },
    { pattern: /bill gates/i, score: 25, flag: 'Common conspiracy target' },
    { pattern: /microchip|tracking.*device|mind.*control/i, score: 40, flag: 'Microchip/control conspiracy' },
    { pattern: /new world order|illuminati|deep state/i, score: 45, flag: 'NWO/Illuminati conspiracy' },
    { pattern: /they don't want you to know|truth.*hidden/i, score: 35, flag: 'Conspiracy rhetoric' },
    { pattern: /big pharma|pharma.*corrupt/i, score: 30, flag: 'Pharmaceutical conspiracy' },
    { pattern: /wake up.*sheep|wake up.*people/i, score: 40, flag: 'Conspiracy language' },
    { pattern: /do your own research|research.*yourself/i, score: 20, flag: 'Pseudo-research appeal' },
    { pattern: /before.*deleted|before.*removed|watch.*before/i, score: 30, flag: 'Deletion urgency' },
    { pattern: /doctors say|experts say|scientists say/i, score: 15, flag: 'Vague authority attribution' },
    { pattern: /proven fact|scientifically proven/i, score: 20, flag: 'Unsubstantiated proof claim' },
    { pattern: /they.*want.*sick|keeping.*sick/i, score: 35, flag: 'Malicious intent conspiracy' },
    { pattern: /natural.*cure|herbal.*cure|home.*remedy.*cure/i, score: 25, flag: 'Unverified natural cure' },
    { pattern: /cancer.*cure|aids.*cure|diabetes.*cure/i, score: 35, flag: 'Major disease cure claim' },
    { pattern: /mainstream.*media.*lying|msm.*lying|fake.*news.*media/i, score: 30, flag: 'Media conspiracy' },
    { pattern: /chemtrails|chem trails/i, score: 45, flag: 'Chemtrails conspiracy' },
    { pattern: /flat earth/i, score: 50, flag: 'Flat earth conspiracy' },
    { pattern: /reptilian|lizard people/i, score: 50, flag: 'Reptilian conspiracy' }
  ];

  fakeNewsPatterns.forEach(({ pattern, score, flag }) => {
    if (pattern.test(text)) {
      suspicionScore += score;
      flags.push(flag);
    }
  });

  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.4 && text.length > 20) {
    suspicionScore += 25;
    flags.push('Excessive capitalization');
  }

  const punctuationRatio = (text.match(/[!?]{2,}/g) || []).length;
  if (punctuationRatio >= 3) {
    suspicionScore += 20;
    flags.push('Excessive punctuation');
  }

  if (text.length < 50 && punctuationRatio >= 2) {
    suspicionScore += 15;
    flags.push('Short message with excessive punctuation');
  }

  return {
    score: Math.min(suspicionScore, 100),
    flags: [...new Set(flags)],
    method: 'pattern_analysis'
  };
}

// ========================================
// KNOWN FAKE NEWS DATABASE
// ========================================

function checkFakeNewsDatabase(text) {
  const knownFakes = [
    'nasa planet alignment darkness',
    'onion under bed covid',
    'garlic prevents coronavirus',
    'garlic cures covid',
    'microchip vaccine',
    'himalayan salt lamp',
    'bill gates population control',
    'bill gates depopulation',
    'drinking bleach cure',
    'cow urine corona',
    'cow urine covid',
    'hot water kills virus',
    'hot water cures covid',
    'holding breath covid test',
    'drinking alcohol kills virus',
    'drinking alcohol covid',
    '5g coronavirus',
    '5g causes covid',
    '5g spreads virus',
    'plastic rice china',
    'fake eggs china',
    'cabbage wax cancer',
    'banana spider eggs',
    'facebook shutting down',
    'mark zuckerberg giving money',
    'drink warm water lemon covid',
    'ginger turmeric cures coronavirus',
    'vitamin c cures covid',
    'sun exposure kills coronavirus',
    'holding breath test coronavirus',
    'vaccine contains fetal tissue',
    'vaccine causes autism',
    'vaccine magnetism',
    'vaccine makes magnetic',
    'vaccine tracking chip',
    'covid vaccine infertility',
    'vaccine changes dna',
    'planet alignment total darkness',
    'earth six days darkness',
    'whatsapp gold invitation',
    'whatsapp expire account',
    'martinelli video virus',
    'facebook lottery winner',
    'facebook biography copy',
    'clapping sounds corona',
    'clapping balcony virus',
    'migraine headband cancer',
    'plastic bottles cancer',
    'freezing water bottles cancer',
    'banana morning weight loss'
  ];

  const textLower = text.toLowerCase();
  const matches = knownFakes.filter(fake => {
    const keywords = fake.split(' ');
    return keywords.every(keyword => textLower.includes(keyword));
  });

  return {
    found: matches.length > 0,
    matches: matches,
    confidence: matches.length > 0 ? 95 : 0
  };
}

// ========================================
// RESULT COMBINATION
// ========================================

function combineAIAndPatterns(aiResult, patternAnalysis) {
  let finalVerdict = aiResult.verdict;
  let finalConfidence = aiResult.confidence;

  if (finalConfidence === 0 || !finalConfidence) {
    finalConfidence = 50;
  }

  if (aiResult.confidence >= 80) {
    finalVerdict = aiResult.verdict;
    finalConfidence = aiResult.confidence;

    if (aiResult.verdict === 'fake' && patternAnalysis.score > 50) {
      finalConfidence = Math.min(95, finalConfidence + 5);
    }

    if (aiResult.verdict === 'verified' && patternAnalysis.score > 40) {
      finalVerdict = 'questionable';
      finalConfidence = 70;
      aiResult.explanation = `AI initially suggested verified, but ${patternAnalysis.flags.length} warning signs detected. ${aiResult.explanation}`;
    }
  }
  else if (aiResult.confidence >= 50) {
    finalVerdict = aiResult.verdict;
    finalConfidence = aiResult.confidence;

    if (aiResult.verdict === 'fake' && patternAnalysis.score > 60) {
      finalConfidence = Math.min(92, finalConfidence + 15);
    } else if (aiResult.verdict === 'verified' && patternAnalysis.score > 50) {
      finalVerdict = 'questionable';
      finalConfidence = 68;
      aiResult.explanation = `Conflicting signals: AI suggests verified but multiple warning signs detected. ${aiResult.explanation}`;
    } else if (aiResult.verdict === 'verified' && patternAnalysis.score > 25) {
      finalVerdict = 'questionable';
      finalConfidence = 65;
      aiResult.explanation = `Some warning signs detected that require caution. ${aiResult.explanation}`;
    } else if (aiResult.verdict === 'verified' && patternAnalysis.score === 0) {
      finalConfidence = Math.min(85, finalConfidence + 10);
    } else if (aiResult.verdict === 'questionable' && patternAnalysis.score > 60) {
      finalVerdict = 'fake';
      finalConfidence = 80;
      aiResult.explanation = `High pattern score (${patternAnalysis.score}) indicates likely fake news. ${aiResult.explanation}`;
    }
  }
  else {
    if (patternAnalysis.score > 70) {
      finalVerdict = 'fake';
      finalConfidence = 80;
    } else if (patternAnalysis.score > 40) {
      finalVerdict = 'questionable';
      finalConfidence = 65;
    } else {
      finalVerdict = aiResult.verdict || 'questionable';
      finalConfidence = 60;
    }
  }

  if (finalConfidence < 55) finalConfidence = 55;
  if (finalConfidence > 95) finalConfidence = 95;

  const allFlags = [...new Set([
    ...patternAnalysis.flags,
    ...(aiResult.redFlags || [])
  ])];

  return {
    verdict: finalVerdict,
    confidence: Math.round(finalConfidence),
    explanation: aiResult.explanation || 'Analysis completed based on available information.',
    sources: getFactCheckSources(),
    details: {
      patternScore: patternAnalysis.score,
      flags: allFlags,
      aiConfidence: aiResult.confidence,
      aiMethod: aiResult.method,
      recommendation: finalVerdict === 'fake' ? 'Do not share this message' : (finalVerdict === 'questionable' ? 'Verify from trusted sources before sharing' : aiResult.recommendation || 'Verify important claims independently')
    }
  };
}

function createPatternBasedResult(patternAnalysis) {
  let verdict = 'questionable';
  let confidence = 60;
  let explanation = 'Unable to verify using AI. Pattern analysis shows no major red flags, but verification from trusted sources is recommended.';

  if (patternAnalysis.score >= 70) {
    verdict = 'fake';
    confidence = Math.min(patternAnalysis.score, 85);
    explanation = `Multiple suspicious patterns detected. This message shows ${patternAnalysis.flags.length} warning signs commonly found in misinformation.`;
  } else if (patternAnalysis.score >= 35) {
    verdict = 'questionable';
    confidence = 65;
    explanation = `Warning signs detected. Verify this information from trusted sources before sharing.`;
  } else if (patternAnalysis.score === 0) {
    verdict = 'questionable';
    confidence = 55;
    explanation = 'No obvious red flags found, but without AI verification, we cannot confirm accuracy. Verify important claims independently.';
  }

  return {
    verdict,
    confidence,
    explanation,
    redFlags: patternAnalysis.flags.length > 0 ? patternAnalysis.flags : ['No AI verification available'],
    recommendation: verdict === 'fake' ? 'Do not share this message' : 'Verify from credible sources before sharing',
    method: 'pattern_only'
  };
}

function createKnownFakeResult(databaseCheck, patternAnalysis) {
  return {
    verdict: 'fake',
    confidence: 95,
    explanation: `KNOWN FAKE NEWS: This message contains the debunked claim "${databaseCheck.matches[0].replace(/-/g, ' ')}". Multiple fact-checkers have confirmed this is false information that has been circulating on social media.`,
    sources: getFactCheckSources(),
    details: {
      patternScore: patternAnalysis.score,
      flags: [...patternAnalysis.flags, 'Matches known fake news database'],
      databaseMatch: true,
      matchedClaims: databaseCheck.matches,
      aiMethod: 'database_match',
      recommendation: 'Do not share this message - it contains verified false information'
    }
  };
}

function createErrorResult(errorMessage) {
  return {
    verdict: 'error',
    confidence: 0,
    explanation: `Unable to complete verification: ${errorMessage}. Try again or verify manually from trusted sources.`,
    sources: getFactCheckSources(),
    details: { error: true }
  };
}

function getFactCheckSources() {
  return [
    { title: 'Alt News - Indian Fact-Checking', url: 'https://www.altnews.in/' },
    { title: 'Boom Live - Fact Check', url: 'https://www.boomlive.in/fact-check' },
    { title: 'PIB Fact Check (Govt of India)', url: 'https://factcheck.pib.gov.in/' },
    { title: 'WHO - COVID-19 Mythbusters', url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters' }
  ];
}

// ========================================
// STATISTICS TRACKING
// ========================================

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

function updateStats(verdict) {
  statsData.totalChecks++;
  if (verdict === 'fake') statsData.fakeDetected++;
  if (verdict === 'verified') statsData.verifiedMessages++;
  
  chrome.storage.local.set({ stats: statsData });
  console.log('📊 Stats updated:', statsData);
}

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
