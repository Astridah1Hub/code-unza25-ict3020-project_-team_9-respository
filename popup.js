// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan');
  const clearBtn = document.getElementById('clear');
  const status = document.getElementById('status');

  function sendToContent(action) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      const tab = tabs[0];
      chrome.tabs.sendMessage(tab.id, {action}, (resp) => {
        if (chrome.runtime.lastError) {
          status.textContent = 'Extension not active on this page (content script not loaded).';
          return;
        }
        if (resp) {
          if (resp.status === 'scanned') {
            status.textContent = `Scan complete — flagged ${resp.count} sentence(s).`;
          } else if (resp.status === 'cleared') {
            status.textContent = 'Highlights cleared.';
          }
        }
      });
    });
  }

  scanBtn.addEventListener('click', () => {
    status.textContent = 'Scanning...';
    sendToContent('scanPage');
  });

  clearBtn.addEventListener('click', () => {
    sendToContent('clearHighlights');
  });
});
