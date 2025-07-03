chrome.runtime.onInstalled.addListener(() => {
  const defaultConfig = {
    blockedSites: [
      "tiktok.com",
      "instagram.com",
      "youtube.com",
      "discord.com",
      "linkedin.com",
      "facebook.com",
      "x.com"
    ],
    requiredPhrase: "I'm an addict",
    requiredLevel: 25
  };

  chrome.storage.local.get(Object.keys(defaultConfig), (result) => {
    const toSet = {};
    for (const key in defaultConfig) {
      if (result[key] === undefined) {
        toSet[key] = defaultConfig[key];
      }
    }
    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get(['blockedSites'], (data) => {
      const { blockedSites } = data;
      if (!blockedSites) return;

      const url = new URL(tab.url);
      const hostname = url.hostname.startsWith('www.') ? url.hostname.substring(4) : url.hostname;

      if (blockedSites.includes(hostname)) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).catch(err => console.log("Mindful Blocker: Error injecting content script.", err));
        chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['styles.css']
        }).catch(err => console.log("Mindful Blocker: Error injecting CSS.", err));
      }
    });
  }
});
