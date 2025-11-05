// WhatsApp Forward Killer - Content Script
// Now supports TEXT + IMAGES + VIDEOS!

console.log('WhatsApp Forward Killer: Extension loaded with multimedia support! 🖼️');

// Wait for WhatsApp to fully load
function initializeExtension() {
  console.log('Initializing Forward Killer with multimedia...');
  
  // Create fact-check button for text
  createFactCheckButton();
  
  // Listen for text message selections
  observeMessageSelection();
  
  // NEW: Listen for image/video interactions
  observeMediaMessages();
}

// ========================================
// TEXT FACT-CHECKING (Original)
// ========================================

function createFactCheckButton() {
  const button = document.createElement('button');
  button.id = 'fact-check-btn';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
    </svg>
    <span>Check Fact</span>
  `;
  button.className = 'fact-check-button hidden';
  button.addEventListener('click', handleFactCheck);
  document.body.appendChild(button);
}

function observeMessageSelection() {
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    const button = document.getElementById('fact-check-btn');
    
    if (selectedText.length > 10) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      button.style.top = `${rect.top - 50}px`;
      button.style.left = `${rect.left}px`;
      button.classList.remove('hidden');
    } else {
      button.classList.add('hidden');
    }
  });
}

async function handleFactCheck() {
  const selectedText = window.getSelection().toString().trim();
  
  if (!selectedText) {
    alert('Please select a message to fact-check!');
    return;
  }
  
  showLoadingIndicator('Analyzing message...');
  
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'factCheck',
      text: selectedText
    });
    
    displayResult(result);
  } catch (error) {
    console.error('Fact check failed:', error);
    showError('Unable to verify. Please try again.');
  }
}

// ========================================
// MULTIMEDIA FACT-CHECKING (NEW!)
// ========================================

function observeMediaMessages() {
  console.log('👁️ Watching for images and videos...');
  
  // Add CSS for media buttons
  addMediaButtonStyles();
  
  // Watch for new images and videos being added
  const observer = new MutationObserver(() => {
    addMediaOverlayButtons();
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Initial scan
  addMediaOverlayButtons();
}

function addMediaButtonStyles() {
  if (document.getElementById('media-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'media-styles';
  style.textContent = `
    .media-factcheck-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      opacity: 0;
      transition: opacity 0.3s, transform 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .media-factcheck-overlay:hover {
      transform: scale(1.05);
    }
    
    .media-container-wrapper:hover .media-factcheck-overlay {
      opacity: 1;
    }
    
    .media-factcheck-overlay svg {
      width: 14px;
      height: 14px;
    }
  `;
  document.head.appendChild(style);
}

function addMediaOverlayButtons() {
  // Find all images in messages (WhatsApp uses specific selectors)
  const images = document.querySelectorAll('img[src*="blob:"], img[src*="https://pps.whatsapp.net"]');
  const videos = document.querySelectorAll('video[src*="blob:"]');
  
  [...images, ...videos].forEach(media => {
    if (media.dataset.factcheckButtonAdded) return;
    media.dataset.factcheckButtonAdded = 'true';
    
    // Find the container
    let container = media.closest('[data-id]') || media.closest('div');
    if (!container) return;
    
    // Make container relative positioned
    if (!container.classList.contains('media-container-wrapper')) {
      container.classList.add('media-container-wrapper');
      container.style.position = 'relative';
    }
    
    // Create verify button
    const button = document.createElement('div');
    button.className = 'media-factcheck-overlay';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="white">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      Verify
    `;
    
    button.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const mediaType = media.tagName.toLowerCase();
      handleMediaFactCheck(media, mediaType);
    };
    
    container.appendChild(button);
  });
}

async function handleMediaFactCheck(mediaElement, mediaType) {
  console.log(`🖼️ Fact-checking ${mediaType}:`, mediaElement.src);
  
  showLoadingIndicator(`Analyzing ${mediaType === 'img' ? 'image' : 'video'}...`);
  
  try {
    let imageData;
    
    if (mediaType === 'img') {
      imageData = await extractImageData(mediaElement);
    } else if (mediaType === 'video') {
      // Extract frame from video
      imageData = await extractVideoFrame(mediaElement);
    }
    
    // Send to background for analysis
    const result = await chrome.runtime.sendMessage({
      action: 'factCheckMedia',
      type: mediaType === 'img' ? 'image' : 'video',
      imageData: imageData
    });
    
    displayMediaResult(result, mediaType);
    
  } catch (error) {
    console.error('Media fact-check error:', error);
    showError(`Unable to analyze ${mediaType === 'img' ? 'image' : 'video'}. ${error.message}`);
  }
}

function extractImageData(img) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to image size
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 600;
      
      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(base64);
    } catch (error) {
      reject(error);
    }
  });
}

function extractVideoFrame(video) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth || 800;
      canvas.height = video.videoHeight || 600;
      
      // Capture current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(base64);
    } catch (error) {
      reject(error);
    }
  });
}

// ========================================
// DISPLAY RESULTS
// ========================================

function showLoadingIndicator(message = 'Analyzing...') {
  const existing = document.getElementById('fact-check-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'fact-check-modal';
  modal.className = 'fact-check-modal';
  modal.innerHTML = `
    <div class="fact-check-content">
      <div class="loader"></div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(modal);
}

function displayResult(result) {
  const modal = document.getElementById('fact-check-modal');
  
  let statusClass = '';
  let statusIcon = '';
  let statusText = '';
  
  if (result.verdict === 'verified') {
    statusClass = 'verified';
    statusIcon = '✓';
    statusText = 'VERIFIED';
  } else if (result.verdict === 'questionable') {
    statusClass = 'questionable';
    statusIcon = '⚠️';
    statusText = 'QUESTIONABLE';
  } else if (result.verdict === 'fake') {
    statusClass = 'fake';
    statusIcon = '❌';
    statusText = 'LIKELY FAKE';
  } else {
    statusClass = 'error';
    statusIcon = '⚠️';
    statusText = 'ERROR';
  }
  
  // Prepare warning signs section
  let warningSignsHTML = '';
  if (result.details && result.details.flags && result.details.flags.length > 0) {
    warningSignsHTML = `
      <div class="warning-flags">
        <h3>Warning Signs Detected:</h3>
        <ul>
          ${result.details.flags.slice(0, 5).map(flag => `<li>${flag}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  // Prepare AI verification notice
  let aiNoticeHTML = '';
  if (result.details && result.details.aiVerificationUsed) {
    const consensus = result.details.consensus ? '✓ Both AIs agree' : '⚠️ AI models disagree';
    aiNoticeHTML = `
      <div class="ai-verification-notice">
        <small>
          🤖 Verified by dual AI: Gemini (${result.details.geminiVerdict}, ${result.details.geminiConfidence}%) 
          & Groq (${result.details.groqVerdict}, ${result.details.groqConfidence}%)
          <br>${consensus}
        </small>
      </div>
    `;
  } else if (result.details && result.details.patternScore > 0) {
    aiNoticeHTML = `
      <div class="ai-verification-notice pattern-only">
        <small>⚠️ Analysis based on pattern detection (AI verification unavailable)</small>
      </div>
    `;
  }
  
  modal.innerHTML = `
    <div class="fact-check-content ${statusClass}">
      <button class="close-btn" id="modal-close-btn">×</button>
      <div class="status-icon">${statusIcon}</div>
      <h2>${statusText}</h2>
      <div class="confidence">Confidence: ${result.confidence}%</div>
      
      ${aiNoticeHTML}
      
      <div class="explanation">
        <h3>Analysis:</h3>
        <p>${result.explanation}</p>
      </div>
      
      ${warningSignsHTML}
      
      ${result.sources && result.sources.length > 0 ? `
        <div class="sources">
          <h3>Verify Further:</h3>
          <ul>
            ${result.sources.slice(0, 4).map(s => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}</a></li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <div class="disclaimer">
        <small>⚠️ This is an automated analysis using AI and pattern detection. Always verify important information from multiple credible sources.</small>
      </div>
    </div>
  `;
  
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

function displayMediaResult(result, mediaType) {
  const modal = document.getElementById('fact-check-modal');
  
  let statusClass = '';
  let statusIcon = '';
  let statusText = '';
  
  if (result.verdict === 'verified') {
    statusClass = 'verified';
    statusIcon = '✓';
    statusText = 'VERIFIED';
  } else if (result.verdict === 'questionable') {
    statusClass = 'questionable';
    statusIcon = '⚠️';
    statusText = 'QUESTIONABLE';
  } else if (result.verdict === 'fake') {
    statusClass = 'fake';
    statusIcon = '❌';
    statusText = 'LIKELY FAKE';
  } else {
    statusClass = 'error';
    statusIcon = '⚠️';
    statusText = 'ANALYSIS COMPLETE';
  }
  
  const mediaLabel = mediaType === 'video' ? 'VIDEO' : 'IMAGE';
  
  modal.innerHTML = `
    <div class="fact-check-content ${statusClass}">
      <button class="close-btn" id="modal-close-btn">×</button>
      <div class="status-icon">${statusIcon}</div>
      <h2>${mediaLabel} ANALYSIS</h2>
      <h3>${statusText}</h3>
      <div class="confidence">Confidence: ${result.confidence}%</div>
      
      ${result.textFound ? `
        <div class="extracted-text">
          <h3>📝 Text Found in ${mediaLabel}:</h3>
          <p class="extracted-text-content">"${result.extractedText.substring(0, 200)}${result.extractedText.length > 200 ? '...' : ''}"</p>
        </div>
      ` : ''}
      
      <div class="explanation">
        <h3>🔍 Analysis:</h3>
        <p>${result.explanation}</p>
      </div>
      
      ${result.imageAnalysis && result.imageAnalysis.length > 0 ? `
        <div class="image-details">
          <h3>🖼️ Details Detected:</h3>
          <ul>
            ${result.imageAnalysis.slice(0, 5).map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${result.manipulationDetected ? `
        <div class="manipulation-warning">
          <h3>⚠️ Possible Manipulation Detected!</h3>
          <p>${result.manipulationDetails}</p>
        </div>
      ` : ''}
      
      ${result.sources ? `
        <div class="sources">
          <h3>Verify Further:</h3>
          <ul>
            ${result.sources.slice(0, 3).map(s => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}</a></li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <div class="disclaimer">
        <small>⚠️ ${mediaType === 'video' ? 'Video analysis based on extracted frame. ' : ''}Always verify important visual content from multiple credible sources.</small>
      </div>
    </div>
  `;
  
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function showError(message) {
  const modal = document.getElementById('fact-check-modal');
  if (!modal) return;
  
  modal.innerHTML = `
    <div class="fact-check-content error">
      <button class="close-btn" id="modal-close-btn-error">×</button>
      <div class="status-icon">⚠️</div>
      <h2>Unable to Verify</h2>
      <p>${message}</p>
      <p style="margin-top: 15px; font-size: 13px;">
        Possible reasons:
        <br>• Network connection issue
        <br>• Extension needs reload
        <br>• API quota exceeded
      </p>
      <div style="margin-top: 20px;">
        <button class="retry-btn" id="retry-check-btn" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        ">Try Again</button>
      </div>
    </div>
  `;
  
  const closeBtn = document.getElementById('modal-close-btn-error');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  const retryBtn = document.getElementById('retry-check-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      closeModal();
    });
  }
}

function closeModal() {
  const modal = document.getElementById('fact-check-modal');
  if (modal) {
    modal.remove();
  }
  
  // Also hide text check button
  const button = document.getElementById('fact-check-btn');
  if (button) {
    button.classList.add('hidden');
  }
}

// ========================================
// INITIALIZE
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

const observer = new MutationObserver((mutations) => {
  const button = document.getElementById('fact-check-btn');
  if (!button) {
    initializeExtension();
  }
});

observer.observe(document.body, { childList: true, subtree: true });