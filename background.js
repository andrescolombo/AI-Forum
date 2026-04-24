importScripts('./config/baseConfig.js');     // Load base configuration (includes dev environment config)


function logExtensionIdForDevelopment() {
  const extensionId = chrome.runtime.id;
  console.log('='.repeat(60));
  console.log('🔧 Dev Debug Info');
  console.log('Current Extension ID:', extensionId);
  console.log('search_url should be set to:');
  console.log(`chrome-extension://${extensionId}/iframe/iframe.html?query={searchTerms}`);
  console.log('='.repeat(60));
  
  
  try {
    const searchUrl = `chrome-extension://${extensionId}/iframe/iframe.html?query={searchTerms}`;
    
    chrome.storage.local.set({ 
      developmentSearchUrl: searchUrl,
      currentExtensionId: extensionId 
    });
  } catch (error) {
    console.log('无法自动复制URL，请手动复制上面的search_url');
  }
}


async function initializeLocalConfig() {
  try {
    console.log('Starting local config initialization...');
    
    // Check if remoteSiteHandlers data already exists
    const existingData = await chrome.storage.local.get('remoteSiteHandlers');
    if (existingData.remoteSiteHandlers && existingData.remoteSiteHandlers.sites) {
      console.log('remoteSiteHandlers already exists, skipping local initialization');
      return;
    }
    
    
    const response = await fetch(chrome.runtime.getURL('config/siteHandlers.json'));
    if (!response.ok) {
      throw new Error(`无法读取本地Config文件: ${response.status}`);
    }
    
    const localConfig = await response.json();
    if (!localConfig.sites || localConfig.sites.length === 0) {
      throw new Error('本地Config文件中没有Site数据');
    }
    
    
    await chrome.storage.local.set({
      siteConfigVersion: localConfig.version || Date.now(),
      remoteSiteHandlers: localConfig
    });
    
    console.log('本地ConfigInitialization successful，Site数量:', localConfig.sites.length);
    console.log('Config版本:', localConfig.version || Date.now());
    
  } catch (error) {
    console.error('本地Config初始化Failed:', error);
  }
}


async function initializeDefaultPromptTemplates() {
  try {
    const { promptTemplates } = await chrome.storage.sync.get('promptTemplates');
    
    
    if (!promptTemplates || promptTemplates.length === 0) {
      const defaultTemplates = [
        {
          id: 'risk_analysis_cn',
          name: '风险分析',
          query: '导致Failed的原因:「{query}」',
          order: 1,
          isDefault: true
        },
        {
          id: 'risk_analysis',
          name: 'RiskAnalysis',
          query: 'Root cause of the failure:「{query}」',
          order: 2,
          isDefault: true
        },
        {
          id: 'best_practice_cn',
          name: '最佳实践',
          query: '写一份这件事做Successful的回顾报告:「{query}」',
          order: 3,
          isDefault: true
        },
        {
          id: 'best_practice',
          name: 'BestPractice',
          query: 'Write a success retrospective report on this project:「{query}」',
          order: 4,
          isDefault: true
        }
      ];
      
      await chrome.storage.sync.set({ promptTemplates: defaultTemplates });
      console.log('Default prompt templates initialized');
    } else {
      console.log('Prompt templates already exist, skipping initialization');
    }
  } catch (error) {
    console.error('初始化默认提示词模板Failed:', error);
  }
}


chrome.runtime.onStartup.addListener(async () => {
  try {
    
    logExtensionIdForDevelopment();
    
    console.log('扩展启动，CheckSiteConfigUpdate...');
    if (self.RemoteConfigManager) {
      const updateInfo = await self.RemoteConfigManager.autoCheckUpdate();
      console.log('启动时SiteConfigCheck结果:', updateInfo);
      if (updateInfo && updateInfo.hasUpdate) {
        console.log('发现新版本SiteConfig，自动Update');
        
        await self.RemoteConfigManager.updateLocalConfig(updateInfo.config);
        console.log('启动时SiteConfigUpdateCompleted');
      } else {
        console.log('启动时SiteConfig无需Update，原因:', updateInfo?.reason || 'unknown');
      }
    } else {
      console.error('RemoteConfigManager 未Load');
    }
  } catch (error) {
    console.error('启动时CheckUpdateFailed:', error);
  }
});


chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    console.log('扩展事件Trigger:', details.reason, '版本:', details.previousVersion, '->', chrome.runtime.getManifest().version);
    
    
    logExtensionIdForDevelopment();
    
    
    await initializeDefaultPromptTemplates();
    
    
    if (self.RemoteConfigManager) {
      
      if (details.reason === 'install') {
        console.log('首次安装，从本地文件初始化Config');
        await initializeLocalConfig();
      }
      
      
      console.log('开始CheckSiteConfigUpdate...');
      const updateInfo = await self.RemoteConfigManager.autoCheckUpdate();
      console.log('SiteConfigCheck结果:', updateInfo);
      
      if (updateInfo && updateInfo.hasUpdate) {
        if (details.reason === 'install') {
          console.log('首次安装，获取远程最新Config');
        } else if (details.reason === 'update') {
          console.log('扩展Update，自动UpdateSiteConfig');
        }
        console.log('开始UpdateSiteConfig...');
        await self.RemoteConfigManager.updateLocalConfig(updateInfo.config);
        console.log('SiteConfigUpdateCompleted');
      } else {
        if (details.reason === 'install') {
          console.log('首次安装，Config已是最新');
        } else if (details.reason === 'update') {
          console.log('扩展Update，Config无需Update，原因:', updateInfo?.reason || 'unknown');
        }
      }
    }
    
    
    const { favoriteSites, buttonConfig } = await chrome.storage.sync.get(['favoriteSites', 'buttonConfig']);
    const { siteSettings } = await chrome.storage.sync.get(['siteSettings']);
    
    
    console.log('开始初始化SiteConfig');
    const defaultSites = await self.getDefaultSites();
    console.log('获取到的默认Site:', defaultSites);
    
    if (defaultSites && defaultSites.length > 0) {
      console.log('SiteConfig已Load，数量:', defaultSites.length);
      
      
      if (siteSettings && Object.keys(siteSettings).length > 0) {
        console.log('已Load用户Settings');
      }
    } else {
      console.error('无法获取默认SiteConfig');
    }
    
    
    if (details.reason === 'install') {
      console.log('首次安装，初始化用户Settings');
      
      
      await chrome.storage.local.set({ 
        pinGuideShown: false 
      });
      console.log('已标记为新用户（pinGuideShown: false）');
      
      
      if (!favoriteSites || !favoriteSites.length) {
        const defaultFavoriteSites = await self.AppConfigManager.getDefaultFavoriteSites();
        await chrome.storage.sync.set({ 
          favoriteSites: defaultFavoriteSites 
        });
        console.log('已初始化 favoriteSites:', defaultFavoriteSites);
      }

      
      if (!buttonConfig) {
        const defaultButtonConfig = await self.AppConfigManager.getButtonConfig();
        await chrome.storage.sync.set({ buttonConfig: defaultButtonConfig });
        console.log('已初始化 buttonConfig:', defaultButtonConfig);
      }
    } else if (details.reason === 'update') {
      console.log('扩展Update，保持用户Settings不变');
      
      
      if (buttonConfig) {
        const defaultButtonConfig = await self.AppConfigManager.getButtonConfig();
        
        const hasNewConfig = Object.keys(defaultButtonConfig).some(key => !(key in buttonConfig));
        if (hasNewConfig) {
          const mergedButtonConfig = {
            ...defaultButtonConfig,  
            ...buttonConfig          
          };
          await chrome.storage.sync.set({ buttonConfig: mergedButtonConfig });
          console.log('已合并新Config项到 buttonConfig:', mergedButtonConfig);
        }
      }
    }
    
    
    createContextMenu();
    
    console.log('Extension installed');
  } catch (error) {
    console.error('初始化Failed:', error);
  }
});


chrome.declarativeNetRequest.getSessionRules().then(rules => {
  console.log('当前生效的规则:', rules);
});


// Phase 1 Security Fix: Session rule now restricted to AI platform domains only.
// Previously used urlFilter: "*://*/*" which stripped security headers from ALL websites.
const AI_PLATFORM_DOMAINS = [
  'chatgpt.com', 'gemini.google.com', 'grok.com', 'claude.ai',
  'aistudio.google.com', 'chat.deepseek.com', 'doubao.com',
  'copilot.microsoft.com', 'kimi.moonshot.cn', 'yuanbao.tencent.com',
  'tiangong.cn', 'metaso.cn', 'perplexity.ai', 'you.com', 'poe.com',
  'character.ai', 'hailuoai.com', 'chat.qianwen.com', 'tongyi.aliyun.com',
  'abacus.ai', 'huggingface.co', 'coze.com', 'coze.cn',
  'open.bigmodel.cn', 'chat.mistral.ai', 'phind.com', 'groq.com',
  'lepton.ai', 'kling.kuaishou.com', 'xinghuo.xfyun.cn'
];

chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [999],
  addRules: [{
    "id": 999,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "header": "Sec-Fetch-Dest",
          "operation": "set",
          "value": "document"
        },
        {
          "header": "Sec-Fetch-Site",
          "operation": "set",
          "value": "same-origin"
        },
        {
          "header": "Sec-Fetch-Mode",
          "operation": "set",
          "value": "navigate"
        },
        {
          "header": "Sec-Fetch-User",
          "operation": "set",
          "value": "?1"
        },
        {
          "header": "content-security-policy",
          "operation": "remove"
        },
        {
          "header": "x-frame-options",
          "operation": "remove"
        },
        {
          "header": "cross-origin-resource-policy",
          "operation": "remove"
        },
        {
          "header": "cross-origin-opener-policy",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "requestDomains": AI_PLATFORM_DOMAINS,
      "resourceTypes": ["main_frame", "sub_frame"]
    }
  }]
}).then(() => {
  return chrome.declarativeNetRequest.getSessionRules();
}).then(rules => {
  // Session rules updated — restricted to AI platform domains only
  void rules;
});






chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "searchWithMultiAI" && info.selectionText) {
    openSearchTabs(info.selectionText);
  } else if (info.menuItemId === "openOptions") {
    
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
  } else if (info.menuItemId === "openHistory") {
    
    chrome.tabs.create({
      url: chrome.runtime.getURL('history/history.html')
    });
  } else if (info.menuItemId === "openFavorites") {
    
    chrome.tabs.create({
      url: chrome.runtime.getURL('favorites/favorites.html')
    });
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  if (message.action === 'createComparisonPage') {
    console.log('createComparisonPage-opensearchtab:', message.query);
    openSearchTabs(message.query).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('创建对比页面Failed:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; 
  } 
  else if (message.action === 'processQuery') {
    
    console.log('processQuery:', message.query, message.sites);
    openSearchTabs(message.query, message.sites).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('处理查询Failed:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; 
  }
  else if (message.action === 'singleSiteSearch') {
    console.log('singleSiteSearch:', message.query, message.siteName);
    handleSingleSiteSearch(message.query, message.siteName).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('单Site搜索Failed:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; 
  }
  else if (message.action === 'openOptionsPage') {
    
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
    sendResponse({ success: true });
  }
  else if (message.action === 'initializeDefaultTemplates') {
    
    initializeDefaultPromptTemplates().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('手动初始化默认模板Failed:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; 
  }
  else if (message.type === 'TOGGLE_SIDE_PANEL') {
    
    const windowId = sender.tab.windowId;
    console.log('🔍 收到TOGGLE_SIDE_PANEL消息，windowId:', windowId);
    
    
    
    if (chrome.sidePanel && chrome.sidePanel.setOptions) {
      try {
        chrome.sidePanel.setOptions({
          path: 'homepage/homepage.html?side_panel=true',
          enabled: true
        });
        console.log('✅ 已Settings侧边栏路径（带 side_panel 参数）');
      } catch (setOptionsError) {
        console.warn('⚠️ Settings侧边栏路径Failed，使用默认路径:', setOptionsError);
      }
    }
    
    
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ windowId }).then(() => {
        sidePanelOpenState.set(windowId, true);
        console.log('✅ 侧边栏已打开');
      }).catch((error) => {
        console.error('❌ 打开侧边栏Failed:', error);
        sidePanelOpenState.set(windowId, false);
      });
    } else {
      console.error('❌ 当前浏览器不支持 sidePanel API');
    }
    
    
    sendResponse({ success: true });
    return true; 
  }
});


chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'executeHandler') {
    const siteHandler = await getHandlerForUrl(message.url);
    if (siteHandler && siteHandler.searchHandler) {
      executeSiteHandler(sender.tab.id, message.query, siteHandler).catch(error => {
        console.error('Site处理Failed:', error);
      });
    }
  }
});









async function executeSiteHandler(tabId, query, siteHandler) {
  try {
    console.log(`开始处理 ${siteHandler.name} Site, tabId:`, tabId);
    console.log('待发送的查询:', query);
    
    
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    console.log('标签页状态:', {
      id: tab.id,
      url: tab.url,
      status: tab.status,
      active: tab.active
    });

    try {
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      
      await chrome.tabs.sendMessage(tabId, {
        type: 'search',
        query: query,
        domain: new URL(tab.url).hostname
      });
      
      console.log('已发送Config化处理消息到页面');
    } catch (scriptError) {
      console.error('发送Config化处理消息Failed:', scriptError);
      throw scriptError;
    }
  } catch (error) {
    console.error(`${siteHandler.name} 处理过程出错:`, error);
    throw error;
  }
}


async function getHandlerForUrl(url) {
  try {
    
    if (!url) {
      console.error('URL 为空');
      return null;
    }

    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    console.log('处理URL:', url);
    const hostname = new URL(url).hostname;
    console.log('当前网站:', hostname);
    
    
    if (self.siteDetector) {
      const siteHandler = await self.siteDetector.getSiteHandler(hostname);
      if (siteHandler) {
        console.log(`✅ 使用新检测器找到SiteConfig: ${siteHandler.name}`);
        return {
          name: siteHandler.name,
          searchHandler: siteHandler.searchHandler,
          supportUrlQuery: siteHandler.supportUrlQuery
        };
      }
    }
    
    
    let sites = [];
    try {
      const result = await chrome.storage.local.get('remoteSiteHandlers');
      sites = result.remoteSiteHandlers?.sites || [];
    } catch (error) {
      console.error('从 remoteSiteHandlers 读取ConfigFailed:', error);
    }
    
    
    if (!sites || sites.length === 0) {
      console.log('remoteSiteHandlers 中无数据，尝试从远程Config获取...');
      if (self.RemoteConfigManager) {
        sites = await self.RemoteConfigManager.getCurrentSites();
      }
    }
    
    if (!sites || sites.length === 0) {
      console.warn('没有找到SiteConfig');
      return null;
    }
    
    
    for (const site of sites) {
      if (!site.url) continue;
      
      try {
        const siteUrl = new URL(site.url);
        const siteDomain = siteUrl.hostname;
        
        
        if (hostname === siteDomain) {
          console.log('找到匹配Site:', site.name);
          return {
            name: site.name,
            searchHandler: site.searchHandler,
            supportUrlQuery: site.supportUrlQuery
          };
        }
        
        
        if (hostname.includes(siteDomain) || siteDomain.includes(hostname)) {
          console.log('找到匹配Site:', site.name);
          return {
            name: site.name,
            searchHandler: site.searchHandler,
            supportUrlQuery: site.supportUrlQuery
          };
        }
      } catch (urlError) {
        
        continue;
      }
    }
    
    console.log('未找到对应的处理函数');
    return null;
  } catch (error) {
    console.error('URL 解析Failed:', error, 'URL:', url);
    return null;
  }
}

  
  async function handleSingleSiteSearch(query, siteName) {
    console.log('开始处理单Site搜索:', query, siteName);

  try {
    console.log('handleSingleSiteSearch处理单Site搜索:', query, siteName);
    const sites = await self.getDefaultSites();
    if (!sites || !sites.length) {
      console.error('未找到SiteConfig');
      return;
    }
    const siteConfig = sites.find(site => site.name === siteName);
    if (!siteConfig) {
      console.error('未找到SiteConfig:', siteName);
      return;
    }
    
    
    if (siteConfig.hidden) {
      console.error('Site已被隐藏，无法使用:', siteName);
      return;
    }

      
      if (siteConfig.supportUrlQuery) {
        
      const url = siteConfig.url.replace('{query}', encodeURIComponent(query));
        console.log('使用URL拼接方式打开:', url);
      await chrome.tabs.create({ url, active: true });
      } else {
        
        console.log('使用脚本控制方式打开:', siteConfig.url);
        const tab = await chrome.tabs.create({ url: siteConfig.url, active: true });
        
        
        await new Promise((resolve) => {
          const listener = (tabId, info) => {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
        
        
        await executeSiteHandler(tab.id, query, {
          name: siteConfig.name,
          searchHandler: siteConfig.searchHandler,
          supportUrlQuery: siteConfig.supportUrlQuery
        });
      }
  } catch (error) {
    console.error('单Site搜索Failed:', error);
  }
}


async function openSearchTabs(query, checkedSites = null) {
  console.log('开始Execute多AI查询 查询词:', query);
  const sites = await self.getDefaultSites();
  
  if (!sites || !sites.length) {
    console.error('未找到AISiteConfig');
    return;
  }
  
  

  const result = checkedSites 
    ? sites.filter(site => checkedSites.includes(site.name) && !site.hidden)
    : sites.filter(site => site.enabled && !site.hidden);
    
  console.log('符合条件的Site:', result);

  
  const iframeSites = result.filter(site => 
      site.supportIframe === true
  );

  if (iframeSites.length > 0) {
      console.log('找到支持 iframe 的启用Site:', iframeSites);
      
      const newTab = await chrome.tabs.create({
          url: chrome.runtime.getURL(`iframe/iframe.html?query=${encodeURIComponent(query)}`),
          active: true
      });

      
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === newTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              
              
              chrome.tabs.sendMessage(newTab.id, {
                  type: 'loadIframes',
                  query: query,
                  sites: iframeSites
              });
          }
      });
  }
}


function getBaseDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  //  const parts = hostname.split('.');
  //  return parts.slice(-2).join('.');
  } catch (e) {
    console.error('URL解析Failed:', url);
    return url;
  }
}


function findExistingTab(tabs, targetDomain) {
  return tabs.find(tab => {
    try {
      return getBaseDomain(tab.url) === targetDomain;
    } catch (e) {
      return false;
    }
  });
} 


chrome.action.onClicked.addListener((tab) => {
  
  chrome.tabs.create({
    url: chrome.runtime.getURL('homepage/homepage.html')
  });
});





self.addEventListener('install', (event) => {
    console.log('Service Worker 安装');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker 激活');
});


self.addEventListener('error', (error) => {
    console.error('Service Worker 错误:', error);
});


self.addEventListener('unhandledrejection', (event) => {
    
    if (event.reason && event.reason.message && event.reason.message.includes('No SW')) {
        
        event.preventDefault();
        return;
    }
    console.error('未处理的 Promise rejection:', event.reason);
    event.preventDefault(); 
});



let contextMenuTimeout = null;


async function createContextMenu() {
  
  if (contextMenuTimeout) {
    clearTimeout(contextMenuTimeout);
  }
  
  
  contextMenuTimeout = setTimeout(async () => {
    try {
      
      
      await chrome.contextMenus.removeAll();
      
      
      chrome.contextMenus.create({
        id: "openOptions",
        title: chrome.i18n.getMessage("settingsLink") || "选项",
        contexts: ["action"]  
      });
      
      chrome.contextMenus.create({
        id: "openHistory",
        title: chrome.i18n.getMessage("historyLink") || "History",
        contexts: ["action"]  
      });
      
      chrome.contextMenus.create({
        id: "openFavorites",
        title: chrome.i18n.getMessage("favoritesLink") || "Favorites记录",
        contexts: ["action"]  
      });
      
      
      const { buttonConfig } = await chrome.storage.sync.get('buttonConfig');
      
      
      if (buttonConfig && buttonConfig.contextMenu) {
        
        chrome.contextMenus.create({
          id: "searchWithMultiAI",
          title: chrome.i18n.getMessage("searchWithMultiAI"),
          contexts: ["selection"]  
        });
        console.log('页面右键菜单已创建');
      }
      
      console.log('扩展图标右键菜单已创建');
    } catch (error) {
      console.error('创建右键菜单Failed:', error);
    }
  }, 100); 
}


chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.buttonConfig) {
    createContextMenu();
  }
});




chrome.runtime.setUninstallURL(self.externalLinks?.uninstallSurvey || '', () => {
  if (chrome.runtime.lastError) {
    console.error('Settings卸载 URL Failed:', chrome.runtime.lastError);
  }
});


let sidePanelOpenState = new Map();


function resetSidePanelState(windowId) {
  console.log('重置侧边栏状态，windowId:', windowId);
  sidePanelOpenState.set(windowId, false);
}




chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  console.log('Omnibox 输入变化:', text);
  
  
  const suggestions = [
    {
      content: `ai ${text}`,
      description: `🔍 使用AI快捷键搜索: ${text}`
    }
  ];
  
  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  console.log('Omnibox 输入确认:', text, disposition);
  
  
  const query = text.replace(/^ai\s+/, '').trim();
  
  if (query) {
    
    const searchUrl = chrome.runtime.getURL(`iframe/iframe.html?query=${encodeURIComponent(query)}`);
    
    if (disposition === 'currentTab') {
      
      chrome.tabs.update({ url: searchUrl });
    } else {
      
      chrome.tabs.create({ url: searchUrl });
    }
  } else {
    
    const defaultUrl = chrome.runtime.getURL('iframe/iframe.html');
    
    if (disposition === 'currentTab') {
      chrome.tabs.update({ url: defaultUrl });
    } else {
      chrome.tabs.create({ url: defaultUrl });
    }
  }
});

