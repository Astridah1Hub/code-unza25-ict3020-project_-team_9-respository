// background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'openSearch' && msg.url) {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ok:true});
  }
  // indicate async response
  return true;
});
