
class SiteDetector {
  constructor() {
    this.sitesCache = null;
    this.cacheTimestamp = 0;
    this.cacheTimeout = 5 * 60 * 1000; // 5 min cache
    this.domainMappingsCache = null;

    this.performanceStats = {
      cacheHits: 0,
      cacheMisses: 0,
      storageReads: 0,
      fallbackReads: 0,
      totalRequests: 0,
      averageResponseTime: 0
    };

    this.adaptiveCacheTimeout = this.cacheTimeout;
    this.lastUpdateTime = 0;
  }

  async getSites() {
    const startTime = performance.now();
    this.performanceStats.totalRequests++;
    
    const now = Date.now();
    
    // Check if cache is valid
    if (this.sitesCache && (now - this.cacheTimestamp) < this.adaptiveCacheTimeout) {
      this.performanceStats.cacheHits++;
      const responseTime = performance.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      console.log(`✅ Cache hit, response time: ${responseTime.toFixed(2)}ms`);
      return this.sitesCache;
    }
    
    this.performanceStats.cacheMisses++;

    try {
      let sites = [];

      // Prefer getDefaultSites() which merges local JSON (structural truth) + remote cache
      // (rich handlers) + user prefs. This ensures local fixes (e.g. ProseMirror for Claude)
      // are never overwritten by a stale upstream remote config.
      if (typeof window !== 'undefined' && window.getDefaultSites) {
        try {
          this.performanceStats.fallbackReads++;
          sites = await window.getDefaultSites();
          if (sites.length > 0) {
            console.log('✅ 从 getDefaultSites LoadSiteConfigSuccessful，数量:', sites.length);
          }
        } catch (error) {
          console.warn('❌ 从 getDefaultSites 读取ConfigFailed:', error);
        }
      } else if (typeof self !== 'undefined' && self.getDefaultSites) {
        try {
          this.performanceStats.fallbackReads++;
          sites = await self.getDefaultSites();
          if (sites.length > 0) {
            console.log('✅ 从 Service Worker getDefaultSites LoadSiteConfigSuccessful，数量:', sites.length);
          }
        } catch (error) {
          console.warn('❌ 从 Service Worker getDefaultSites 读取ConfigFailed:', error);
        }
      }

      // Fallback: read raw from chrome.storage.local if getDefaultSites is unavailable
      if (!sites || sites.length === 0) {
        try {
          this.performanceStats.storageReads++;
          const result = await chrome.storage.local.get('remoteSiteHandlers');
          sites = result.remoteSiteHandlers?.sites || [];
          if (sites.length > 0) {
            console.log('✅ 从 chrome.storage.local LoadSiteConfigSuccessful，数量:', sites.length);
          } else {
            console.log('⚠️ chrome.storage.local 中的SiteConfig为空');
          }
        } catch (storageError) {
          console.warn('❌ 从 chrome.storage.local 读取ConfigFailed:', storageError);
          console.warn('💡 可能的原因: 存储权限问题、数据损坏或首次使用');
        }
      }

      
      this.sitesCache = sites;
      this.cacheTimestamp = now;
      this.lastUpdateTime = now;
      
      
      const responseTime = performance.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      console.log('✅ SiteConfigLoadCompleted，总数量:', sites.length, `响应时间: ${responseTime.toFixed(2)}ms`);
      return sites;
    } catch (error) {
      console.error('❌ 获取SiteConfigFailed:', error);
      const responseTime = performance.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      return this.sitesCache || []; 
    }
  }

  
  updateAverageResponseTime(responseTime) {
    const totalRequests = this.performanceStats.totalRequests;
    if (totalRequests === 1) {
      this.performanceStats.averageResponseTime = responseTime;
    } else {
      this.performanceStats.averageResponseTime = 
        (this.performanceStats.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    }
  }

  
  getPerformanceStats() {
    const cacheHitRate = this.performanceStats.totalRequests > 0 
      ? (this.performanceStats.cacheHits / this.performanceStats.totalRequests * 100).toFixed(2)
      : 0;
    
    return {
      ...this.performanceStats,
      cacheHitRate: `${cacheHitRate}%`,
      adaptiveCacheTimeout: this.adaptiveCacheTimeout,
      cacheAge: this.sitesCache ? Date.now() - this.cacheTimestamp : 0
    };
  }

  
  adjustCacheTimeout() {
    const hitRate = this.performanceStats.cacheHits / this.performanceStats.totalRequests;
    
    if (hitRate > 0.8) {
      
      this.adaptiveCacheTimeout = Math.min(this.cacheTimeout * 2, 30 * 60 * 1000); 
      console.log(`📈 缓存命中率高(${(hitRate * 100).toFixed(1)}%)，增加缓存时间到 ${this.adaptiveCacheTimeout / 1000 / 60} 分钟`);
    } else if (hitRate < 0.3) {
      
      this.adaptiveCacheTimeout = Math.max(this.cacheTimeout / 2, 1 * 60 * 1000); 
      console.log(`📉 缓存命中率低(${(hitRate * 100).toFixed(1)}%)，减少缓存时间到 ${this.adaptiveCacheTimeout / 1000 / 60} 分钟`);
    }
  }

  
  async buildDomainMappings() {
    if (this.domainMappingsCache) {
      return this.domainMappingsCache;
    }

    try {
      const sites = await this.getSites();
      const mappings = {};
      
      for (const site of sites) {
        if (site.url && site.name) {
          try {
            const siteUrl = new URL(site.url);
            const domain = this.normalizeDomain(siteUrl.hostname);
            mappings[domain] = site.name;
          } catch (urlError) {
            console.warn('URL 解析Failed:', site.url, urlError);
          }
        }
      }
      
      this.domainMappingsCache = mappings;
      console.log('✅ 动态构建域名映射Completed，数量:', Object.keys(mappings).length);
      return mappings;
    } catch (error) {
      console.error('❌ 构建域名映射Failed:', error);
      return {};
    }
  }

  
  normalizeDomain(domain) {
    if (!domain) return '';
    
    
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    
    return domain.toLowerCase();
  }

  
  isDomainMatch(currentDomain, targetDomain) {
    const normalizedCurrent = this.normalizeDomain(currentDomain);
    const normalizedTarget = this.normalizeDomain(targetDomain);
    
    
    if (normalizedCurrent === normalizedTarget) {
      return { match: true, type: 'exact' };
    }
    
    
    if (normalizedCurrent.includes(normalizedTarget) && 
        normalizedTarget.length > 3) { 
      return { match: true, type: 'contains' };
    }
    
    return { match: false, type: 'none' };
  }

  
  async findSiteByDomain(domain) {
    try {
      const sites = await this.getSites();
      const normalizedDomain = this.normalizeDomain(domain);
      
      
      const matches = [];
      
      for (const site of sites) {
        if (!site.url || site.hidden) continue;
        
        try {
          const siteUrl = new URL(site.url);
          const siteDomain = siteUrl.hostname;
          const matchResult = this.isDomainMatch(normalizedDomain, siteDomain);
          
          if (matchResult.match) {
            matches.push({
              site,
              matchType: matchResult.type,
              priority: matchResult.type === 'exact' ? 1 : 2
            });
          }
        } catch (urlError) {
          console.warn('URL 解析Failed:', site.url, urlError);
          continue;
        }
      }
      
      
      if (matches.length > 0) {
        matches.sort((a, b) => a.priority - b.priority);
        const bestMatch = matches[0];
        
        console.log(`✅ 找到Site匹配: ${bestMatch.site.name} (${bestMatch.matchType})`);
        return {
          ...bestMatch.site,
          matchType: bestMatch.matchType
        };
      }
      
      console.warn('⚠️ 未找到匹配的SiteConfig:', domain);
      return null;
    } catch (error) {
      console.error('❌ Site查找Failed:', error);
      return null;
    }
  }

  
  async getSiteNameFromDomain(domain) {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      const domainMappings = await this.buildDomainMappings();
      
      
      if (domainMappings[normalizedDomain]) {
        return domainMappings[normalizedDomain];
      }
      
      
      for (const [key, value] of Object.entries(domainMappings)) {
        if (normalizedDomain.includes(key)) {
          return value;
        }
      }
      
      
      return normalizedDomain.charAt(0).toUpperCase() + normalizedDomain.slice(1);
    } catch (error) {
      console.error('❌ 获取Site名称Failed:', error);
      
      const normalizedDomain = this.normalizeDomain(domain);
      return normalizedDomain.charAt(0).toUpperCase() + normalizedDomain.slice(1);
    }
  }

  
  async isAISite(domain = null) {
    try {
      const targetDomain = domain || window.location.hostname;
      const site = await this.findSiteByDomain(targetDomain);
      return !!site;
    } catch (error) {
      console.error('❌ AI SiteCheckFailed:', error);
      return false;
    }
  }

  
  async getSiteHandler(domain) {
    try {
      const site = await this.findSiteByDomain(domain);
      
      if (!site) {
        return null;
      }
      
      console.log(`✅ 获取Site处理器: ${site.name}`);
      return {
        name: site.name,
        searchHandler: site.searchHandler,
        fileUploadHandler: site.fileUploadHandler,
        contentExtractor: site.contentExtractor,
        historyHandler: site.historyHandler,
        supportUrlQuery: site.supportUrlQuery,
        matchType: site.matchType
      };
    } catch (error) {
      console.error('❌ 获取Site处理器Failed:', error);
      return null;
    }
  }

  
  clearCache() {
    this.sitesCache = null;
    this.domainMappingsCache = null;
    this.cacheTimestamp = 0;
    this.lastUpdateTime = 0;
    this.adaptiveCacheTimeout = this.cacheTimeout; 
    console.log('🗑️ SiteConfig和域名映射缓存已清除');
  }

  
  resetPerformanceStats() {
    this.performanceStats = {
      cacheHits: 0,
      cacheMisses: 0,
      storageReads: 0,
      fallbackReads: 0,
      totalRequests: 0,
      averageResponseTime: 0
    };
    console.log('📊 性能统计已重置');
  }

  
  getCacheStatus() {
    const now = Date.now();
    const isExpired = (now - this.cacheTimestamp) >= this.cacheTimeout;
    
    return {
      hasCache: !!this.sitesCache,
      timestamp: this.cacheTimestamp,
      isExpired,
      age: now - this.cacheTimestamp
    };
  }
}


const siteDetector = new SiteDetector();


if (typeof window !== 'undefined') {
  window.siteDetector = siteDetector;
  window.getSiteHandler = (domain) => siteDetector.getSiteHandler(domain);
  window.isAISite = (domain) => siteDetector.isAISite(domain);
  window.getSiteNameFromDomain = (domain) => siteDetector.getSiteNameFromDomain(domain);
} else if (typeof self !== 'undefined') {
  self.siteDetector = siteDetector;
  self.getSiteHandler = (domain) => siteDetector.getSiteHandler(domain);
  self.isAISite = (domain) => siteDetector.isAISite(domain);
  self.getSiteNameFromDomain = (domain) => siteDetector.getSiteNameFromDomain(domain);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SiteDetector, siteDetector };
}
