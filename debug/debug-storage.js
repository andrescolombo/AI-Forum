


let globalData = {
    local: null,
    sync: null,
    config: null,
    remote: null,
    merged: null
};


function formatJSON(obj) {
    if (!obj) return 'null';
    try {
        return JSON.stringify(obj, null, 2);
    } catch (e) {
        return String(obj);
    }
}


function getObjectStats(obj) {
    if (!obj || typeof obj !== 'object') {
        return { 总数: 0 };
    }

    const stats = {};
    
    if (Array.isArray(obj)) {
        stats.总数 = obj.length;
        if (obj.length > 0 && obj[0].enabled !== undefined) {
            stats.启用 = obj.filter(item => item.enabled).length;
            stats.禁用 = obj.filter(item => !item.enabled).length;
        }
    } else {
        stats.键数量 = Object.keys(obj).length;
        
        
        if (obj.sites && Array.isArray(obj.sites)) {
            stats.Site总数 = obj.sites.length;
            stats.启用Site = obj.sites.filter(site => site.enabled).length;
            stats.iframe支持 = obj.sites.filter(site => site.supportIframe).length;
        }
        
        if (obj.version) {
            stats.版本 = obj.version;
        }
    }

    return stats;
}


function renderStats(stats, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = Object.entries(stats)
        .map(([key, value]) => `
            <div class="stat-item">
                <div class="stat-value">${value}</div>
                <div class="stat-label">${key}</div>
            </div>
        `).join('');
}


function renderVersionInfo(data, versionElementId) {
    const versionElement = document.getElementById(versionElementId);
    if (!versionElement) return;

    if (data && data.version) {
        versionElement.style.display = 'block';
        versionElement.innerHTML = `
            <strong>版本:</strong> ${data.version}<br>
            <strong>Update时间:</strong> ${data.lastUpdated || '未知'}
        `;
    } else {
        versionElement.style.display = 'none';
    }
}


async function loadLocalStorage() {
    const statusEl = document.getElementById('local-status');
    const contentEl = document.getElementById('local-content');
    
    try {
        console.log('开始Load Chrome Storage Local...');
        statusEl.innerHTML = '<div class="loading-spinner"></div> 正在Load...';
        statusEl.className = 'status loading';

        if (!chrome?.storage?.local) {
            throw new Error('Chrome Storage Local API 不可用');
        }

        const result = await chrome.storage.local.get(null);
        console.log('Chrome Storage Local 数据:', result);
        globalData.local = result;

        statusEl.textContent = '✅ LoadSuccessful';
        statusEl.className = 'status success';
        
        contentEl.textContent = formatJSON(result);
        
        const stats = getObjectStats(result);
        renderStats(stats, 'local-stats');
        
        
        if (result.remoteSiteHandlers) {
            renderVersionInfo(result.remoteSiteHandlers, 'local-version');
        } else if (result.siteConfigVersion) {
            renderVersionInfo({ version: result.siteConfigVersion }, 'local-version');
        }

        console.log('Chrome Storage Local LoadCompleted');

    } catch (error) {
        console.error('Load Local Storage Failed:', error);
        statusEl.textContent = `❌ LoadFailed: ${error.message}`;
        statusEl.className = 'status error';
        contentEl.innerHTML = `<div class="error-message">
            错误详情: ${error.message}<br>
            错误堆栈: ${error.stack?.slice(0, 200)}...
        </div>`;
    }
}


async function loadSyncStorage() {
    const statusEl = document.getElementById('sync-status');
    const contentEl = document.getElementById('sync-content');
    
    try {
        console.log('开始Load Chrome Storage Sync...');
        statusEl.innerHTML = '<div class="loading-spinner"></div> 正在Load...';
        statusEl.className = 'status loading';

        if (!chrome?.storage?.sync) {
            throw new Error('Chrome Storage Sync API 不可用');
        }

        const result = await chrome.storage.sync.get(null);
        console.log('Chrome Storage Sync 数据:', result);
        globalData.sync = result;

        statusEl.textContent = '✅ LoadSuccessful';
        statusEl.className = 'status success';
        
        contentEl.textContent = formatJSON(result);
        
        const stats = getObjectStats(result);
        renderStats(stats, 'sync-stats');

        console.log('Chrome Storage Sync LoadCompleted');

    } catch (error) {
        console.error('Load Sync Storage Failed:', error);
        statusEl.textContent = `❌ LoadFailed: ${error.message}`;
        statusEl.className = 'status error';
        contentEl.innerHTML = `<div class="error-message">
            错误详情: ${error.message}<br>
            错误堆栈: ${error.stack?.slice(0, 200)}...
        </div>`;
    }
}


async function loadLocalConfig() {
    const statusEl = document.getElementById('config-status');
    const contentEl = document.getElementById('config-content');
    
    try {
        console.log('开始Load本地 siteHandlers.json...');
        statusEl.innerHTML = '<div class="loading-spinner"></div> 正在Load...';
        statusEl.className = 'status loading';

        if (!chrome?.runtime?.getURL) {
            throw new Error('Chrome Runtime API 不可用');
        }

        const configUrl = chrome.runtime.getURL('config/siteHandlers.json');
        console.log('Config文件URL:', configUrl);
        
        const response = await fetch(configUrl);
        console.log('Fetch响应:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('本地Config数据:', data);
        globalData.config = data;

        statusEl.textContent = '✅ LoadSuccessful';
        statusEl.className = 'status success';
        
        contentEl.textContent = formatJSON(data);
        
        const stats = getObjectStats(data);
        renderStats(stats, 'config-stats');
        
        renderVersionInfo(data, 'config-version');

        console.log('本地ConfigLoadCompleted');

    } catch (error) {
        console.error('Load本地ConfigFailed:', error);
        statusEl.textContent = `❌ LoadFailed: ${error.message}`;
        statusEl.className = 'status error';
        contentEl.innerHTML = `<div class="error-message">
            错误详情: ${error.message}<br>
            错误堆栈: ${error.stack?.slice(0, 200)}...
        </div>`;
    }
}


async function loadMergedSites() {
    const statusEl = document.getElementById('merged-status');
    const contentEl = document.getElementById('merged-content');
    
    try {
        console.log('开始Load合并后的Site...');
        statusEl.innerHTML = '<div class="loading-spinner"></div> 正在Load...';
        statusEl.className = 'status loading';

        if (!window.getDefaultSites) {
            throw new Error('getDefaultSites 函数未找到 - 请确保 baseConfig.js 已正确Load');
        }

        const mergedSites = await window.getDefaultSites();
        console.log('合并后的Site数据:', mergedSites);
        globalData.merged = mergedSites;

        statusEl.textContent = '✅ LoadSuccessful';
        statusEl.className = 'status success';
        
        
        if (Array.isArray(mergedSites) && mergedSites.length > 0) {
            const tableHTML = `
                <table class="sites-table">
                    <thead>
                        <tr>
                            <th>Site名称</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mergedSites.map(site => `
                            <tr>
                                <td>${site.name || '未知Site'}</td>
                                <td>
                                    <span class="status-badge ${site.enabled ? 'enabled' : 'disabled'}">
                                        ${site.enabled ? '✓ 启用' : '✗ 禁用'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            contentEl.innerHTML = tableHTML;
        } else {
            contentEl.innerHTML = '<div class="error-message">暂无Site数据</div>';
        }
        
        const stats = getObjectStats(mergedSites);
        renderStats(stats, 'merged-stats');

        console.log('合并后的SiteLoadCompleted');

    } catch (error) {
        console.error('Load合并后的SiteFailed:', error);
        statusEl.textContent = `❌ LoadFailed: ${error.message}`;
        statusEl.className = 'status error';
        contentEl.innerHTML = `<div class="error-message">
            错误详情: ${error.message}<br>
            错误堆栈: ${error.stack?.slice(0, 200)}...
        </div>`;
    }
}


async function loadRemoteConfig() {
    const statusEl = document.getElementById('remote-status');
    const contentEl = document.getElementById('remote-content');
    
    try {
        console.log('开始Load远程Config...');
        statusEl.innerHTML = '<div class="loading-spinner"></div> 正在CheckUpdate...';
        statusEl.className = 'status loading';

        if (!window.RemoteConfigManager) {
            throw new Error('RemoteConfigManager 未找到 - 请确保 baseConfig.js 已正确Load');
        }

        console.log('RemoteConfigManager URL:', window.RemoteConfigManager.configUrl);
        const updateInfo = await window.RemoteConfigManager.checkAndUpdateConfig();
        console.log('远程ConfigCheck结果:', updateInfo);
        
        if (updateInfo.hasUpdate) {
            statusEl.textContent = '🆕 发现新版本Config';
            statusEl.className = 'status success';
            globalData.remote = updateInfo.config;
            contentEl.textContent = formatJSON(updateInfo.config);
            
            const stats = getObjectStats(updateInfo.config);
            renderStats(stats, 'remote-stats');
            
            renderVersionInfo(updateInfo.config, 'remote-version');
        } else {
            statusEl.textContent = '✅ 当前已是最新版本';
            statusEl.className = 'status success';
            
            
            try {
                console.log('尝试获取远程Config内容...');
                const response = await fetch(window.RemoteConfigManager.configUrl);
                console.log('远程Config响应:', response.status, response.statusText);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const remoteData = await response.json();
                console.log('远程Config数据:', remoteData);
                globalData.remote = remoteData;
                contentEl.textContent = formatJSON(remoteData);
                
                const stats = getObjectStats(remoteData);
                renderStats(stats, 'remote-stats');
                
                renderVersionInfo(remoteData, 'remote-version');
            } catch (fetchError) {
                console.error('获取远程Config内容Failed:', fetchError);
                contentEl.innerHTML = `<div class="error-message">
                    无法获取远程Config内容<br>
                    错误: ${fetchError.message}
                </div>`;
            }
        }

        console.log('远程Config处理Completed');

    } catch (error) {
        console.error('Load远程ConfigFailed:', error);
        statusEl.textContent = `❌ LoadFailed: ${error.message}`;
        statusEl.className = 'status error';
        contentEl.innerHTML = `<div class="error-message">
            错误详情: ${error.message}<br>
            错误堆栈: ${error.stack?.slice(0, 200)}...
        </div>`;
    }
}


async function loadHistory() {
    const statusEl = document.getElementById('history-status');
    const contentEl = document.getElementById('history-content');
    
    try {
        console.log('开始LoadHistory...');
        statusEl.innerHTML = '<div class="loading-spinner"></div> 正在Load...';
        statusEl.className = 'status loading';

        if (!chrome?.storage?.local) {
            throw new Error('Chrome Storage Local API 不可用');
        }

        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        console.log('History数据:', pkHistory);

        statusEl.textContent = '✅ LoadSuccessful';
        statusEl.className = 'status success';
        
        contentEl.textContent = formatJSON(pkHistory);
        
        
        const stats = {};
        if (pkHistory.length > 0) {
            stats.总数 = pkHistory.length;
            const latestDate = new Date(pkHistory[0].timestamp);
            const oldestDate = new Date(pkHistory[pkHistory.length - 1].timestamp);
            stats.最新记录 = latestDate.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            stats.最旧记录 = oldestDate.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            stats.总数 = 0;
        }
        renderStats(stats, 'history-stats');

        console.log('HistoryLoadCompleted');

    } catch (error) {
        console.error('LoadHistoryFailed:', error);
        statusEl.textContent = `❌ LoadFailed: ${error.message}`;
        statusEl.className = 'status error';
        contentEl.innerHTML = `<div class="error-message">
            错误详情: ${error.message}<br>
            错误堆栈: ${error.stack?.slice(0, 200)}...
        </div>`;
    }
}


async function loadFavorites() {
    const statusEl = document.getElementById('favorites-status');
    const contentEl = document.getElementById('favorites-content');
    
    try {
        console.log('开始LoadFavorites记录...');
        statusEl.innerHTML = '<div class="loading-spinner"></div> 正在Load...';
        statusEl.className = 'status loading';

        if (!chrome?.storage?.local) {
            throw new Error('Chrome Storage Local API 不可用');
        }

        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        const favoriteItems = pkHistory
            .filter(item => item.sites && item.sites.some(site => site.isFavorite === true))
            .map(item => ({
                ...item,
                sites: item.sites.filter(site => site.isFavorite === true)
            }));
        console.log('Favorites记录数据:', favoriteItems);

        statusEl.textContent = '✅ LoadSuccessful';
        statusEl.className = 'status success';
        
        contentEl.textContent = formatJSON(favoriteItems);
        
        
        const stats = {};
        if (favoriteItems.length > 0) {
            stats.总数 = favoriteItems.length;
            const latestDate = new Date(favoriteItems[0].timestamp);
            const oldestDate = new Date(favoriteItems[favoriteItems.length - 1].timestamp);
            stats.最新记录 = latestDate.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            stats.最旧记录 = oldestDate.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            stats.总数 = 0;
        }
        renderStats(stats, 'favorites-stats');

        console.log('Favorites记录LoadCompleted');

    } catch (error) {
        console.error('LoadFavorites记录Failed:', error);
        statusEl.textContent = `❌ LoadFailed: ${error.message}`;
        statusEl.className = 'status error';
        contentEl.innerHTML = `<div class="error-message">
            错误详情: ${error.message}<br>
            错误堆栈: ${error.stack?.slice(0, 200)}...
        </div>`;
    }
}


async function refreshAll() {
    console.log('开始刷新全部数据...');
    await Promise.all([
        loadHistory(),
        loadFavorites(),
        loadLocalStorage(),
        loadSyncStorage(),
        loadLocalConfig(),
        loadRemoteConfig(),
        loadMergedSites()
    ]);
    console.log('全部数据刷新Completed');
}


async function clearAll() {
    if (!confirm('⚠️ 确定要清空所有存储数据吗？这个操作不可恢复！')) {
        return;
    }

    try {
        await chrome.storage.local.clear();
        await chrome.storage.sync.clear();
        alert('✅ 存储数据已清空');
        await refreshAll();
    } catch (error) {
        alert(`❌ 清空Failed: ${error.message}`);
    }
}


function exportAll() {
    const exportData = {
        timestamp: new Date().toISOString(),
        local: globalData.local,
        sync: globalData.sync,
        config: globalData.config,
        remote: globalData.remote,
        merged: globalData.merged
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-shortcuts-storage-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


function checkExtensionEnvironment() {
    console.log('Check扩展环境...');
    console.log('chrome对象:', typeof chrome);
    console.log('chrome.storage:', typeof chrome?.storage);
    console.log('chrome.runtime:', typeof chrome?.runtime);
    
    if (typeof chrome === 'undefined') {
        throw new Error('Chrome API 不可用');
    }
    
    if (!chrome.storage) {
        throw new Error('Chrome Storage API 不可用');
    }
    
    if (!chrome.runtime) {
        throw new Error('Chrome Runtime API 不可用');
    }
    
    console.log('✅ Chrome扩展环境Check通过');
}


window.addEventListener('load', () => {
    console.log('页面LoadCompleted，开始自动Load数据...');
    
    try {
        checkExtensionEnvironment();
        
        
        setTimeout(() => {
            console.log('开始Load数据...');
            refreshAll();
        }, 1000);
        
    } catch (error) {
        console.error('环境CheckFailed:', error);
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #dc3545;">
                <h2>❌ Chrome Extension API 不可用</h2>
                <p>错误: ${error.message}</p>
                <p style="margin-top: 20px; color: #6c757d;">
                    请确保此页面在Chrome扩展环境中运行<br>
                    可以尝试：chrome-extension:
                </p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; border: none; background: #007bff; color: white; border-radius: 5px; cursor: pointer;">
                    重新Load
                </button>
            </div>
        `;
    }
});


document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'r':
                e.preventDefault();
                refreshAll();
                break;
            case 'e':
                e.preventDefault();
                exportAll();
                break;
        }
    }
});


window.addEventListener('error', (e) => {
    console.error('页面错误:', e.error);
});


if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        console.log('存储发生变化:', namespace, changes);
        
        if (namespace === 'local') {
            loadLocalStorage();
            loadHistory();
            loadFavorites();
        } else if (namespace === 'sync') {
            loadSyncStorage();
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    
    document.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        
        if (action) {
            e.preventDefault(); 
            
            switch(action) {
                case 'refreshAll':
                    refreshAll();
                    break;
                case 'clearAll':
                    clearAll();
                    break;
                case 'exportAll':
                    exportAll();
                    break;
                case 'loadLocalStorage':
                    loadLocalStorage();
                    break;
                case 'loadSyncStorage':
                    loadSyncStorage();
                    break;
                case 'loadLocalConfig':
                    loadLocalConfig();
                    break;
                case 'loadRemoteConfig':
                    loadRemoteConfig();
                    break;
                case 'loadMergedSites':
                    loadMergedSites();
                    break;
                case 'loadHistory':
                    loadHistory();
                    break;
                case 'loadFavorites':
                    loadFavorites();
                    break;
            }
        }
        
        
        if (e.target.textContent === '刷新' || e.target.classList.contains('refresh-btn')) {
            const column = e.target.closest('.column');
            const columnClass = column ? column.classList[1] : '';
            const action = e.target.getAttribute('data-action');
            if (action) {
                
            } else switch(columnClass) {
                case 'column-1':
                    loadLocalStorage();
                    break;
                case 'column-2':
                    loadSyncStorage();
                    break;
                case 'column-3':
                    loadLocalConfig();
                    break;
                case 'column-4':
                    loadRemoteConfig();
                    break;
                case 'column-5':
                    loadMergedSites();
                    break;
                case 'column-6':
                    loadHistory();
                    break;
                case 'column-7':
                    loadFavorites();
                    break;
            }
        }
    });
});


window.refreshAll = refreshAll;
window.clearAll = clearAll;
window.exportAll = exportAll;
window.loadLocalStorage = loadLocalStorage;
window.loadSyncStorage = loadSyncStorage;
window.loadLocalConfig = loadLocalConfig;
window.loadRemoteConfig = loadRemoteConfig;
window.loadMergedSites = loadMergedSites;
window.loadHistory = loadHistory;
window.loadFavorites = loadFavorites;