// WhatsApp Forward Killer - Popup Script

// Load statistics when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  setupEventListeners();
});

// Load and display statistics
function loadStats() {
  chrome.storage.local.get(['stats'], (result) => {
    if (result.stats) {
      document.getElementById('total-checks').textContent = result.stats.totalChecks || 0;
      document.getElementById('fake-detected').textContent = result.stats.fakeDetected || 0;
      document.getElementById('verified-messages').textContent = result.stats.verifiedMessages || 0;
    } else {
      // Initialize with zeros if no stats exist
      document.getElementById('total-checks').textContent = '0';
      document.getElementById('fake-detected').textContent = '0';
      document.getElementById('verified-messages').textContent = '0';
    }
  });
}

// Setup event listeners for buttons
function setupEventListeners() {
  // Open WhatsApp Web button
  const whatsappBtn = document.getElementById('visit-whatsapp');
  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://web.whatsapp.com' });
    });
  }
  
  // Reset statistics button
  const resetBtn = document.getElementById('reset-stats');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all statistics?')) {
        chrome.storage.local.set({ 
          stats: {
            totalChecks: 0,
            fakeDetected: 0,
            verifiedMessages: 0
          }
        }, () => {
          loadStats();
          alert('Statistics reset successfully!');
        });
      }
    });
  }
}

// Auto-refresh stats every 2 seconds if popup is open
setInterval(loadStats, 2000);