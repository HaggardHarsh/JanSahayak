// WhatsApp Forward Killer - Content Script
// This runs directly on web.whatsapp.com

console.log('WhatsApp Forward Killer: Extension loaded!');

// Wait for WhatsApp to fully load
function initializeExtension() {
  console.log('Initializing Forward Killer...');
  
  // Create a floating button to check messages
  createFactCheckButton();
  
  // Listen for message selections
  observeMessageSelection();
}

// Create a floating "Check Fact" button
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

// Observe when user selects/highlights messages
function observeMessageSelection() {
  // Listen for text selection
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    const button = document.getElementById('fact-check-btn');
    
    if (selectedText.length > 10) {
      // Show button near selection
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      button.style.top = `${rect.top - 50}px`;
      button.style.left = `${rect.left}px`;
      button.classList.remove('hidden');
    } else {
      button.classList.add('hidden');
    }
  });
  
  // Also add right-click context menu functionality
  document.addEventListener('contextmenu', (e) => {
    const selection = window.getSelection().toString().trim();
    if (selection.length > 10) {
      storeSelectedText(selection);
    }
  });
}

// Store selected text for fact-checking
let currentSelectedText = '';

function storeSelectedText(text) {
  currentSelectedText = text;
}

// Main fact-checking function
async function handleFactCheck() {
  const selectedText = window.getSelection().toString().trim();
  
  if (!selectedText) {
    alert('Please select a message to fact-check!');
    return;
  }
  
  // Show loading state
  showLoadingIndicator();
  
  try {
    // Send message to background script for API call
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

// Show loading indicator
function showLoadingIndicator() {
  const existing = document.getElementById('fact-check-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'fact-check-modal';
  modal.className = 'fact-check-modal';
  modal.innerHTML = `
    <div class="fact-check-content">
      <div class="loader"></div>
      <p>Analyzing message for fake news...</p>
    </div>
  `;
  document.body.appendChild(modal);
}

// Display fact-check result
function displayResult(result) {
  const modal = document.getElementById('fact-check-modal');
  
  let statusClass = '';
  let statusIcon = '';
  let statusText = '';
  
  // Determine result type
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
  
  modal.innerHTML = `
    <div class="fact-check-content ${statusClass}">
      <button class="close-btn" id="modal-close-btn">×</button>
      <div class="status-icon">${statusIcon}</div>
      <h2>${statusText}</h2>
      <div class="confidence">Confidence: ${result.confidence}%</div>
      <div class="explanation">
        <h3>Analysis:</h3>
        <p>${result.explanation}</p>
      </div>
      ${result.details && result.details.flags && result.details.flags.length > 0 ? `
        <div class="warning-flags">
          <h3>Warning Signs Detected:</h3>
          <ul>
            ${result.details.flags.map(flag => `<li>${flag}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${result.sources ? `
        <div class="sources">
          <h3>Verify Further:</h3>
          <ul>
            ${result.sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}</a></li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="disclaimer">
        <small>⚠️ This is an automated analysis. Always verify important information from multiple credible sources.</small>
      </div>
    </div>
  `;
  
  // Add event listener to close button
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  // Also allow clicking outside modal to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// Close modal function
function closeModal() {
  const modal = document.getElementById('fact-check-modal');
  if (modal) {
    modal.remove();
  }
}

// Show error message
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
        <br>• WhatsApp Web update
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
  
  // Add event listeners
  const closeBtn = document.getElementById('modal-close-btn-error');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  const retryBtn = document.getElementById('retry-check-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      closeModal();
      handleFactCheck();
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Also re-initialize if WhatsApp does a navigation
const observer = new MutationObserver((mutations) => {
  const button = document.getElementById('fact-check-btn');
  if (!button) {
    initializeExtension();
  }
});

observer.observe(document.body, { childList: true, subtree: true });