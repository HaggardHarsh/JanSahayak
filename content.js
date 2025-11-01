// WhatsApp Forward Killer - Content Script
// This runs directly on web.whatsapp.com

console.log('WhatsApp Forward Killer loaded!');

// Wait for WhatsApp to fully load
window.addEventListener('load', initializeExtension);

function initializeExtension() {
  console.log('Initializing fact-checker...');
  
  // Observer to detect new messages
  const observer = new MutationObserver(handleNewMessages);
  
  // Watch the chat container for changes
  const chatContainer = document.querySelector('#main');
  if (chatContainer) {
    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }
  
  // Add fact-check buttons to existing messages
  addFactCheckButtons();
}

// Add buttons to all message bubbles
function addFactCheckButtons() {
  const messages = document.querySelectorAll('div[class*="message"]');
  
  messages.forEach(message => {
    // Don't add button if it already exists
    if (message.querySelector('.fact-check-btn')) return;
    
    // Only add to received messages (not sent by user)
    const isReceived = message.querySelector('[data-pre-plain-text]');
    if (!isReceived) return;
    
    // Create the fact-check button
    const button = createFactCheckButton(message);
    
    // Add button to message
    const messageContent = message.querySelector('div[class*="copyable-text"]');
    if (messageContent) {
      messageContent.style.position = 'relative';
      messageContent.appendChild(button);
    }
  });
}

// Create a styled button
function createFactCheckButton(messageElement) {
  const button = document.createElement('button');
  button.className = 'fact-check-btn';
  button.innerHTML = '🔍 Check Fact';
  button.title = 'Verify this message';
  
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    handleFactCheck(messageElement, button);
  });
  
  return button;
}

// Extract text from message
function extractMessageText(messageElement) {
  const textElements = messageElement.querySelectorAll('span[class*="selectable-text"]');
  let fullText = '';
  
  textElements.forEach(el => {
    fullText += el.innerText + ' ';
  });
  
  return fullText.trim();
}

// Main fact-checking function
async function handleFactCheck(messageElement, button) {
  // Get message text
  const messageText = extractMessageText(messageElement);
  
  if (!messageText) {
    showResult(messageElement, 'error', 'Could not extract message text');
    return;
  }
  
  // Show loading state
  button.innerHTML = '⏳ Checking...';
  button.disabled = true;
  
  try {
    // Send to background script for fact-checking
    const response = await chrome.runtime.sendMessage({
      action: 'checkFact',
      text: messageText
    });
    
    // Display result
    if (response.success) {
      showResult(messageElement, response.verdict, response.explanation, response.sources);
    } else {
      showResult(messageElement, 'error', response.error || 'Fact check failed');
    }
    
  } catch (error) {
    console.error('Fact check error:', error);
    showResult(messageElement, 'error', 'Connection error. Please try again.');
  } finally {
    button.innerHTML = '🔍 Check Fact';
    button.disabled = false;
  }
}

// Display fact-check result
function showResult(messageElement, verdict, explanation, sources = []) {
  // Remove existing result if any
  const existingResult = messageElement.querySelector('.fact-check-result');
  if (existingResult) {
    existingResult.remove();
  }
  
  // Create result card
  const resultCard = document.createElement('div');
  resultCard.className = `fact-check-result verdict-${verdict}`;
  
  // Verdict icon and text
  const verdictIcons = {
    'true': '✅ Verified',
    'false': '❌ False Information',
    'misleading': '⚠️ Misleading',
    'unverified': '❓ Unverified',
    'error': '⚠️ Error'
  };
  
  resultCard.innerHTML = `
    <div class="verdict-header">
      <strong>${verdictIcons[verdict] || '❓ Unknown'}</strong>
    </div>
    <div class="verdict-explanation">
      ${explanation}
    </div>
    ${sources.length > 0 ? `
      <div class="verdict-sources">
        <strong>Sources:</strong>
        ${sources.map(src => `<a href="${src.url}" target="_blank">${src.title}</a>`).join(', ')}
      </div>
    ` : ''}
    <div class="verdict-footer">
      <small>Powered by WhatsApp Forward Killer</small>
    </div>
  `;
  
  // Insert result below message
  const messageContent = messageElement.querySelector('div[class*="copyable-text"]');
  if (messageContent) {
    messageContent.appendChild(resultCard);
  }
  
  // Auto-scroll to result
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Handle new messages appearing (for real-time checking)
function handleNewMessages(mutations) {
  addFactCheckButtons();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStats') {
    // Send statistics about checked messages
    const checkedCount = document.querySelectorAll('.fact-check-result').length;
    sendResponse({ checkedCount });
  }
});