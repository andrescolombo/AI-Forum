// analytics.js

const ANALYTICS_EVENTS = {
  HOMEPAGE_SEARCH_SUBMIT: 'homepage_search_submit',
  HOMEPAGE_UPLOAD_CLICK: 'homepage_upload_click',
  HOMEPAGE_SITE_TOGGLE: 'homepage_site_toggle',
  HOMEPAGE_REVIEW_CLICK: 'homepage_review_click',
  HOMEPAGE_FEEDBACK_CLICK: 'homepage_feedback_click',
  IFRAME_SEARCH_SUBMIT: 'iframe_search_submit',
  IFRAME_UPLOAD_CLICK: 'iframe_upload_click',
  IFRAME_EXPORT_CLICK: 'iframe_export_click',
  IFRAME_SITE_TOGGLE: 'iframe_site_toggle'
};

let analyticsConfigCache = null;
let hasWarnedMissingConfig = false;

async function loadAnalyticsConfig() {
  if (analyticsConfigCache) {
    return analyticsConfigCache;
  }

  try {
    if (typeof AppConfigManager !== 'undefined' && AppConfigManager?.loadConfig) {
      const config = await AppConfigManager.loadConfig();
      analyticsConfigCache = config?.analytics || null;
      return analyticsConfigCache;
    }

    const response = await fetch(chrome.runtime.getURL('config/appConfig.json'));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const config = await response.json();
    analyticsConfigCache = config?.analytics || null;
    return analyticsConfigCache;
  } catch (error) {
    if (!hasWarnedMissingConfig) {
      console.warn('Analytics 配置加载失败:', error);
      hasWarnedMissingConfig = true;
    }
    return null;
  }
}

// 获取或生成唯一的 Client ID (保证同一个用户的数据连贯)
async function getOrCreateClientId() {
  const result = await chrome.storage.local.get('clientId');
  let clientId = result.clientId;
  if (!clientId) {
    clientId = self.crypto.randomUUID();
    await chrome.storage.local.set({ clientId });
  }
  return clientId;
}

// 核心发送函数
async function logEvent(name, params = {}) {
  const analyticsConfig = await loadAnalyticsConfig();
  if (!analyticsConfig || analyticsConfig.enabled !== true) {
    return;
  }

  const measurementId = analyticsConfig.measurementId;
  const apiSecret = analyticsConfig.apiSecret;

  if (!measurementId || !apiSecret) {
    if (!hasWarnedMissingConfig) {
      console.warn('Analytics 配置不完整，请检查 measurementId 和 apiSecret');
      hasWarnedMissingConfig = true;
    }
    return;
  }

  const clientId = await getOrCreateClientId();

  // 这里的 fetch 请求是核心
  fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
    method: "POST",
    body: JSON.stringify({
      client_id: clientId,
      events: [{
        name: name,     // 事件名称 (例如: 'click_translate')
        params: params  // 额外参数 (例如: { language: 'en' })
      }]
    })
  });
}

if (typeof window !== 'undefined') {
  window.AIShortcutsAnalytics = {
    logEvent,
    EVENTS: ANALYTICS_EVENTS
  };
}