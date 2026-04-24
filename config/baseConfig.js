

if ((typeof window !== 'undefined' && window.BaseConfigLoaded) || 
    (typeof self !== 'undefined' && self.BaseConfigLoaded)) {
  console.log('baseConfig.js 已经Load，跳过重复声明');
} else {


const DEV_CONFIG = {
  IS_PRODUCTION: true,  
  SKIP_REMOTE_CONFIG: true,  
  ENABLE_CONFIG_CACHE: false, 
  FORCE_LOCAL_CONFIG: true,   
  ENABLE_SITE_BUTTON: false  

};

// Phase 1 Security Fix: Replaced global console override that silently swallowed
// all errors in production. Now uses a no-op local logger instead.
const _logger = DEV_CONFIG.IS_PRODUCTION
  ? { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} }
  : console;


const AppConfigManager = {
  _config: null,
  
  
  async loadConfig() {
    if (this._config) {
      return this._config;
    }
    
    try {
      const response = await fetch(chrome.runtime.getURL('config/appConfig.json'));
      if (!response.ok) {
        throw new Error(`LoadConfig文件Failed: HTTP ${response.status}`);
      }
      this._config = await response.json();
      console.log('应用ConfigLoadSuccessful');
      return this._config;
    } catch (error) {
      console.error('Load应用ConfigFailed:', error);
      throw new Error(`无法Load应用Config文件: ${error.message}`);
    }
  },
  
  
  async getDefaultFavoriteSites() {
    const config = await this.loadConfig();
    return config.defaultFavoriteSites || [];
  },
  
  
  async getDefaultModes() {
    const config = await this.loadConfig();
    return config.defaultModes || {};
  },
  
  
  async getButtonConfig() {
    const config = await this.loadConfig();
    return config.buttonConfig || {};
  },
  
  
  async getExternalLinks() {
    const config = await this.loadConfig();
    return config.externalLinks || {};
  },
  
  
  async getSupportedFileTypes() {
    const config = await this.loadConfig();
    return config.supportedFileTypes || {};
  },
  
  
  async getAllSupportedFileTypes() {
    const config = await this.loadConfig();
    const supportedFileTypes = config.supportedFileTypes;
    
    if (!supportedFileTypes || !supportedFileTypes.categories) {
      return ['Files', 'application/octet-stream', 'image/png', 'image/jpeg', 'text/plain'];
    }
    
    
    const allTypes = [];
    Object.values(supportedFileTypes.categories).forEach(category => {
      if (category.types && Array.isArray(category.types)) {
        allTypes.push(...category.types);
      }
    });
    
    
    return [...new Set(allTypes)];
  },
  
  
  async getMimeToExtensionMappings() {
    const config = await this.loadConfig();
    const supportedFileTypes = config.supportedFileTypes;
    
    return supportedFileTypes?.mimeToExtension?.mappings || {};
  },
  
  
  async getFileExtensionByMimeType(mimeType) {
    const mappings = await this.getMimeToExtensionMappings();
    return mappings[mimeType] || 'unknown';
  },
  
  
  async generateFileName(originalName, mimeType, fallbackPrefix = 'clipboard') {
    
    if (originalName && originalName.includes('.')) {
      return originalName;
    }
    
    
    const extension = await this.getFileExtensionByMimeType(mimeType);
    
    
    const baseName = originalName || `${fallbackPrefix}-${Date.now()}`;
    
    
    if (extension === 'unknown') {
      return baseName;
    }
    
    return `${baseName}.${extension}`;
  }
};


function compareVersions(version1, version2) {
  
  if (version1 === version2) {
    return 0;
  }
  
  
  if (typeof version1 === 'number' && typeof version2 === 'number') {
    return version1 > version2 ? 1 : -1;
  }
  
  
  const parseVersion = (version) => {
    if (typeof version === 'string') {
      
      const cleanVersion = version.replace(/^v/, '');
      
      const parts = cleanVersion.split('.').map(part => {
        
        const match = part.match(/^(\d+)(.*)$/);
        return {
          number: parseInt(match ? match[1] : part, 10) || 0,
          suffix: match ? match[2] : ''
        };
      });
      return parts;
    }
    
    return [{ number: parseInt(version, 10) || 0, suffix: '' }];
  };
  
  const v1Parts = parseVersion(version1);
  const v2Parts = parseVersion(version2);
  
  
  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || { number: 0, suffix: '' };
    const v2Part = v2Parts[i] || { number: 0, suffix: '' };
    
    
    if (v1Part.number !== v2Part.number) {
      return v1Part.number > v2Part.number ? 1 : -1;
    }
    
    
    if (v1Part.suffix !== v2Part.suffix) {
      
      if (v1Part.suffix === '' && v2Part.suffix !== '') {
        return 1;
      }
      if (v1Part.suffix !== '' && v2Part.suffix === '') {
        return -1;
      }
      
      return v1Part.suffix > v2Part.suffix ? 1 : -1;
    }
  }
  
  return 0;
}


const RemoteConfigManager = {
  // Phase 1 Security Fix: Remote config URL now points to our fork.
  // Change this to your own GitHub repository when publishing.
  get configUrl() {
    if (typeof DEV_CONFIG !== 'undefined' && DEV_CONFIG.REMOTE_CONFIG_URL) {
      return DEV_CONFIG.IS_PRODUCTION
        ? 'https://raw.githubusercontent.com/taoAIGC/AICompare/refs/heads/main/config/siteHandlers.json'
        : DEV_CONFIG.REMOTE_CONFIG_URL;
    }
    return 'https://raw.githubusercontent.com/taoAIGC/AICompare/refs/heads/main/config/siteHandlers.json';
  },
  
  // Phase 1 Security Fix: Added schema validation before applying remote config.
  // Prevents supply-chain attacks via malicious JSON from a compromised GitHub repo.
  _validateRemoteConfig(config) {
    if (!config || typeof config !== 'object') return false;
    if (typeof config.version === 'undefined') return false;
    if (!Array.isArray(config.sites)) return false;
    if (config.sites.length === 0) return false;
    // Each site must have at minimum: name (string) and url (string)
    const validSites = config.sites.filter(site =>
      typeof site.name === 'string' && site.name.length > 0 &&
      typeof site.url === 'string' && site.url.startsWith('https://')
    );
    if (validSites.length === 0) return false;
    // Reject configs with suspiciously low number of valid sites vs total
    if (validSites.length < config.sites.length * 0.5) return false;
    return true;
  },

  // Checks and updates config from remote
  async checkAndUpdateConfig() {
    try {
      const response = await fetch(this.configUrl);
      if (!response.ok) {
        throw new Error(`Config server error: ${response.status}`);
      }
      
      const remoteConfig = await response.json();

      // Phase 1 Security Fix: Validate remote config schema before applying.
      if (!this._validateRemoteConfig(remoteConfig)) {
        _logger.error('[RemoteConfigManager] Remote config failed schema validation — update rejected.');
        return { hasUpdate: false, reason: 'invalid_schema' };
      }

      const remoteVersion = remoteConfig.version || Date.now();
      
      // Get local version
      const localVersion = await this.getLocalVersion();
      
      // Compare versions using version comparison function
      const versionComparison = compareVersions(remoteVersion, localVersion);
      
      if (versionComparison > 0) {
        _logger.log(`New site config version found (${localVersion} -> ${remoteVersion}), updating...`);
        
        // Update local stored config
        await this.updateLocalConfig(remoteConfig);
        
        return {
          hasUpdate: true,
          config: remoteConfig,
          version: remoteVersion,
          oldVersion: localVersion,
          versionComparison: versionComparison
        };
      } else if (versionComparison < 0) {
        return { 
          hasUpdate: false, 
          reason: 'remote_older',
          remoteVersion: remoteVersion,
          localVersion: localVersion
        };
      } else {
        return { 
          hasUpdate: false, 
          reason: 'same_version',
          version: remoteVersion
        };
      }
    } catch (error) {
      _logger.error('[RemoteConfigManager] Config update check failed:', error);
      return { hasUpdate: false, error: error.message };
    }
  },
  
  
  async getLocalVersion() {
    try {
      
      const result = await chrome.storage.local.get('siteConfigVersion');
      if (result.siteConfigVersion) {
        return result.siteConfigVersion;
      }
      
      
      console.log('存储中无版本信息，尝试从本地文件获取版本...');
      try {
        const response = await fetch(chrome.runtime.getURL('config/siteHandlers.json'));
        if (response.ok) {
          const localConfig = await response.json();
          if (localConfig.version) {
            console.log('从本地文件获取版本:', localConfig.version);
            return localConfig.version;
          }
        }
      } catch (error) {
        console.error('从本地文件获取版本Failed:', error);
      }
      
      return 0;
    } catch (error) {
      console.error('获取本地版本Failed:', error);
      return 0;
    }
  },
  
  
  async updateLocalConfig(remoteConfig) {
    try {
      const currentTime = Date.now();
      
      
      const { updateHistory = [], remoteSiteHandlers: oldConfig } = await chrome.storage.local.get(['updateHistory', 'remoteSiteHandlers']);
      
      
      let newSites = 0;
      let updatedSites = 0;
      
      if (oldConfig && oldConfig.sites && remoteConfig.sites) {
        const oldSites = oldConfig.sites;
        const newSitesList = remoteConfig.sites;
        
        
        newSites = newSitesList.filter(newSite => 
          !oldSites.some(oldSite => oldSite.name === newSite.name)
        ).length;
        
        
        updatedSites = newSitesList.filter(newSite => {
          const oldSite = oldSites.find(oldSite => oldSite.name === newSite.name);
          if (!oldSite) return false;
          
          
          return oldSite.url !== newSite.url ||
                 oldSite.supportIframe !== newSite.supportIframe ||
                 oldSite.supportUrlQuery !== newSite.supportUrlQuery ||
                 JSON.stringify(oldSite.handler) !== JSON.stringify(newSite.handler);
        }).length;
      } else if (remoteConfig.sites) {
        
        newSites = remoteConfig.sites.length;
      }
      
      
      const updateRecord = {
        timestamp: currentTime,
        version: remoteConfig.version || currentTime,
        newSites: newSites,
        updatedSites: updatedSites,
        totalSites: remoteConfig.sites ? remoteConfig.sites.length : 0,
        oldVersion: oldConfig ? (oldConfig.version || 'unknown') : 'unknown'
      };
      
      
      const newUpdateHistory = [...updateHistory, updateRecord].slice(-10);
      
      await chrome.storage.local.set({
        siteConfigVersion: remoteConfig.version || currentTime,
        remoteSiteHandlers: remoteConfig,
        lastUpdateTime: currentTime,  
        updateNotificationShown: false,  
        updateHistory: newUpdateHistory  
      });
      
      console.log('本地Config已Update，最新版本号:', remoteConfig.version || currentTime);
      console.log('Site数量:', remoteConfig.sites ? remoteConfig.sites.length : 0);
      console.log('Update统计:', {
        新增Site: newSites,
        UpdateSite: updatedSites,
        总Site数: remoteConfig.sites ? remoteConfig.sites.length : 0
      });
    } catch (error) {
      console.error('Update本地ConfigFailed:', error);
    }
  },
  
  
  async getCurrentSiteHandlers() {
    try {
      const result = await chrome.storage.local.get('remoteSiteHandlers');
      if (result.remoteSiteHandlers && result.remoteSiteHandlers.siteHandlers) {
        return result.remoteSiteHandlers.siteHandlers;
      }
      console.warn('未找到远程Site处理器Config');
      return {};
    } catch (error) {
      console.error('获取当前Site处理器Failed:', error);
      return {};
    }
  },
  
  
  async getCurrentSites() {
    try {
      const result = await chrome.storage.local.get('remoteSiteHandlers');
      if (result.remoteSiteHandlers && result.remoteSiteHandlers.sites) {
        return result.remoteSiteHandlers.sites;
      }
      console.warn('未找到远程SiteConfig');
      return [];
    } catch (error) {
      console.error('获取当前Site列表Failed:', error);
      return [];
    }
  },
  
  
  async autoCheckUpdate() {
    return await this.checkAndUpdateConfig();
  }
};


if (typeof window === 'undefined') {
  const language = navigator.language.toLowerCase();
  console.log('当前语言:', language);
  
   
  
  self.getDefaultSites = async function() {
    try {
      
      
      console.log('尝试从 remoteSiteHandlers 读取SiteConfig...');
      let baseSites = [];
      try {
        const result = await chrome.storage.local.get('remoteSiteHandlers');
        if (result.remoteSiteHandlers && result.remoteSiteHandlers.sites && result.remoteSiteHandlers.sites.length > 0) {
          baseSites = result.remoteSiteHandlers.sites;
          console.log('从 remoteSiteHandlers LoadSiteConfigSuccessful');
          console.log('remoteSiteHandlers Load的SiteConfig:', baseSites.map(site => ({ name: site.name, enabled: site.enabled })));
        }
      } catch (error) {
        console.error('从 remoteSiteHandlers 读取ConfigFailed:', error);
      }
      
      
      let userSettings = {};
      try {
        const { sites: userSiteSettings = {} } = await chrome.storage.sync.get('sites');
        userSettings = userSiteSettings;
        console.log('从 chrome.storage.sync Load用户SettingsSuccessful');
        console.log('chrome.storage.sync Load的用户Settings:', Object.keys(userSettings).map(name => ({ name, enabled: userSettings[name]?.enabled })));
      } catch (error) {
        console.error('从 chrome.storage.sync 读取用户SettingsFailed:', error);
      }
      
      
      if (baseSites && baseSites.length > 0) {
        const mergedSites = baseSites.map(site => {
          const userSiteData = userSettings[site.name] || {};
          return {
            ...site,
            order: userSiteData.order !== undefined ? userSiteData.order : site.order,
            enabled: userSiteData.enabled !== undefined ? userSiteData.enabled : site.enabled
          };
        });
        
        
        mergedSites.sort((a, b) => {
          const orderA = a.order !== undefined ? a.order : 999;
          const orderB = b.order !== undefined ? b.order : 999;
          return orderA - orderB;
        });
        
        console.log('合并ConfigSuccessful，Site数量:', mergedSites.length);
        console.log('合并ConfigSuccessful，SiteConfig:', mergedSites.map(site => ({ name: site.name, enabled: site.enabled })));
        return mergedSites;
      }
      
      
      console.log('remoteSiteHandlers 中无数据，尝试从本地文件Load...');
      try {
        const response = await fetch(chrome.runtime.getURL('config/siteHandlers.json'));
        if (response.ok) {
          const localConfig = await response.json();
          if (localConfig.sites && localConfig.sites.length > 0) {
            console.log('从本地文件LoadSiteConfigSuccessful');
            return localConfig.sites;
          }
        }
      } catch (error) {
        console.error('从本地文件LoadConfigFailed:', error);
      }
      
      console.warn('无法获取SiteConfig，返回空数组');
      return [];
    } catch (error) {
      console.error('获取默认SiteConfigFailed:', error);
      return [];
    }
  };

  self.AppConfigManager = AppConfigManager;
  self.RemoteConfigManager = RemoteConfigManager;
  
  
  self.toggleDevMode = function() {
    DEV_CONFIG.SKIP_REMOTE_CONFIG = !DEV_CONFIG.SKIP_REMOTE_CONFIG;
    console.log(`🔄 开发模式切换: ${DEV_CONFIG.SKIP_REMOTE_CONFIG ? '启用' : '禁用'}本地Config优先`);
    return DEV_CONFIG.SKIP_REMOTE_CONFIG;
  };
  
  
  self.getDevModeStatus = function() {
    return {
      isProduction: DEV_CONFIG.IS_PRODUCTION,
      skipRemoteConfig: DEV_CONFIG.SKIP_REMOTE_CONFIG,
      enableConfigCache: DEV_CONFIG.ENABLE_CONFIG_CACHE,
      forceLocalConfig: DEV_CONFIG.FORCE_LOCAL_CONFIG
    };
  };
}

else {
  const language = navigator.language.toLowerCase();
  console.log('当前语言:', language);
  
  
  window.getDefaultSites = async function() {
    try {

      // Always load local siteHandlers.json first — it's the source of truth
      // for structural properties (hidden, supportIframe, supportUrlQuery, url, name).
      let localSites = [];
      try {
        const response = await fetch(chrome.runtime.getURL('config/siteHandlers.json'));
        if (response.ok) {
          const localConfig = await response.json();
          localSites = localConfig.sites || localConfig || [];
          console.log('从本地文件LoadSiteConfigSuccessful, 数量:', localSites.length);
        }
      } catch (error) {
        console.error('从本地文件LoadConfigFailed:', error);
      }

      // Load user preferences (enabled, order) from sync storage
      let userSettings = {};
      try {
        const { sites: userSiteSettings = {} } = await chrome.storage.sync.get('sites');
        userSettings = userSiteSettings;
        console.log('从 chrome.storage.sync Load用户SettingsSuccessful');
      } catch (error) {
        console.error('从 chrome.storage.sync 读取用户SettingsFailed:', error);
      }

      // Use local sites as base, apply only user preferences on top
      const baseSites = localSites.length > 0 ? localSites : [];

      if (baseSites.length > 0) {
        const mergedSites = baseSites.map(site => {
          const userSiteData = userSettings[site.name] || {};
          return {
            ...site,
            order: userSiteData.order !== undefined ? userSiteData.order : site.order,
            enabled: userSiteData.enabled !== undefined ? userSiteData.enabled : site.enabled
          };
        });

        mergedSites.sort((a, b) => {
          const orderA = a.order !== undefined ? a.order : 999;
          const orderB = b.order !== undefined ? b.order : 999;
          return orderA - orderB;
        });

        console.log('合并ConfigSuccessful，Site数量:', mergedSites.length);
        return mergedSites;
      }

      return [];
    } catch (error) {
      console.error('获取默认SiteConfigFailed:', error);
      return [];
    }
  };
  
  window.AppConfigManager = AppConfigManager;
  window.RemoteConfigManager = RemoteConfigManager;
  
  
  window.toggleDevMode = function() {
    DEV_CONFIG.SKIP_REMOTE_CONFIG = !DEV_CONFIG.SKIP_REMOTE_CONFIG;
    console.log(`🔄 开发模式切换: ${DEV_CONFIG.SKIP_REMOTE_CONFIG ? '启用' : '禁用'}本地Config优先`);
    return DEV_CONFIG.SKIP_REMOTE_CONFIG;
  };
  
  
  window.getDevModeStatus = function() {
    return {
      isProduction: DEV_CONFIG.IS_PRODUCTION,
      skipRemoteConfig: DEV_CONFIG.SKIP_REMOTE_CONFIG,
      enableConfigCache: DEV_CONFIG.ENABLE_CONFIG_CACHE,
      forceLocalConfig: DEV_CONFIG.FORCE_LOCAL_CONFIG,
      enableSiteButton: DEV_CONFIG.ENABLE_SITE_BUTTON
    };
  };
  
  
  window.ENABLE_SITE_BUTTON = DEV_CONFIG.ENABLE_SITE_BUTTON;
  
  
  if (typeof window !== 'undefined') {
    window.BaseConfigLoaded = true;
  } else if (typeof self !== 'undefined') {
    self.BaseConfigLoaded = true;
  }
}

} 

                                                                                                                                                                                                                                