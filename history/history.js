
let allHistoryItems = [];


document.addEventListener('DOMContentLoaded', async () => {
    await loadHistory();
    
    
    const clearBtn = document.getElementById('clearHistoryBtn');
    clearBtn.addEventListener('click', async () => {
        if (confirm('确定要清空所有History吗？')) {
            await clearHistory();
            await loadHistory();
        }
    });
    
    
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        filterHistory(e.target.value);
    });
});


async function loadHistory() {
    try {
        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        
        
        allHistoryItems = pkHistory;
        
        const historyList = document.getElementById('historyList');
        const emptyState = document.getElementById('emptyState');
        const noResultsState = document.getElementById('noResultsState');
        const searchInput = document.getElementById('searchInput');
        
        
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        
        
        const filteredItems = filterItemsBySearch(pkHistory, searchTerm);
        
        if (pkHistory.length === 0) {
            historyList.style.display = 'none';
            emptyState.style.display = 'block';
            noResultsState.style.display = 'none';
            return;
        }
        
        if (filteredItems.length === 0 && searchTerm) {
            historyList.style.display = 'none';
            emptyState.style.display = 'none';
            noResultsState.style.display = 'block';
            return;
        }
        
        historyList.style.display = 'flex';
        emptyState.style.display = 'none';
        noResultsState.style.display = 'none';
        
        
        historyList.innerHTML = '';
        
        
        filteredItems.forEach(item => {
            const historyItem = createHistoryItem(item);
            historyList.appendChild(historyItem);
        });
        
    } catch (error) {
        console.error('LoadHistoryFailed:', error);
    }
}


function filterItemsBySearch(items, searchTerm) {
    if (!searchTerm) {
        return items;
    }
    
    return items.filter(item => {
        
        const queryMatch = item.query && item.query.toLowerCase().includes(searchTerm);
        
        
        const siteMatch = item.sites && item.sites.some(site => 
            site.name && site.name.toLowerCase().includes(searchTerm)
        );
        
        return queryMatch || siteMatch;
    });
}


function filterHistory(searchTerm) {
    const filteredItems = filterItemsBySearch(allHistoryItems, searchTerm.toLowerCase());
    
    const historyList = document.getElementById('historyList');
    const emptyState = document.getElementById('emptyState');
    const noResultsState = document.getElementById('noResultsState');
    
    if (allHistoryItems.length === 0) {
        historyList.style.display = 'none';
        emptyState.style.display = 'block';
        noResultsState.style.display = 'none';
        return;
    }
    
    if (filteredItems.length === 0 && searchTerm.trim()) {
        historyList.style.display = 'none';
        emptyState.style.display = 'none';
        noResultsState.style.display = 'block';
        return;
    }
    
    historyList.style.display = 'flex';
    emptyState.style.display = 'none';
    noResultsState.style.display = 'none';
    
    
    historyList.innerHTML = '';
    
    
    filteredItems.forEach(item => {
        const historyItem = createHistoryItem(item);
        historyList.appendChild(historyItem);
    });
}


function createHistoryItem(item) {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    
    const header = document.createElement('div');
    header.className = 'history-item-header';
    
    const queryDiv = document.createElement('div');
    queryDiv.className = 'history-query';
    queryDiv.textContent = item.query;
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'history-date';
    dateDiv.textContent = item.date || formatDate(item.timestamp);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'history-item-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这条History吗？')) {
            await deleteHistoryItem(item.id);
            await loadHistory();
        }
    });
    
    actionsDiv.appendChild(deleteBtn);
    
    header.appendChild(queryDiv);
    header.appendChild(dateDiv);
    header.appendChild(actionsDiv);
    
    
    const sitesDiv = document.createElement('div');
    sitesDiv.className = 'history-sites';
    
    item.sites.forEach(site => {
        const tag = document.createElement('span');
        tag.className = 'site-tag';
        tag.textContent = site.name;
        sitesDiv.appendChild(tag);
    });
    
    
    div.appendChild(header);
    div.appendChild(sitesDiv);
    
    
    div.addEventListener('click', (e) => {
        
        if (e.target === deleteBtn || deleteBtn.contains(e.target)) {
            return;
        }
        
        openHistoryItem(item);
    });
    
    return div;
}


async function openHistoryItem(item) {
    try {
        
        const params = new URLSearchParams();
        params.set('query', item.query);
        
        
        const siteNames = item.sites.map(site => site.name);
        if (siteNames.length > 0) {
            params.set('sites', siteNames.join(','));
        }
        
        
        const iframeUrl = chrome.runtime.getURL(`iframe/iframe.html?${params.toString()}`);
        
        
        await chrome.tabs.create({
            url: iframeUrl,
            active: true
        });
        
        
        
        
        setTimeout(async () => {
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                const currentTab = tabs[0];
                if (currentTab.url && currentTab.url.includes('iframe.html')) {
                    
                    try {
                        await chrome.tabs.sendMessage(currentTab.id, {
                            type: 'loadHistoryIframes',
                            sites: item.sites,
                            historyId: item.id  
                        });
                    } catch (error) {
                        console.error('发送消息Failed:', error);
                        
                        
                    }
                }
            }
        }, 1000);
        
    } catch (error) {
        console.error('打开HistoryFailed:', error);
        alert('打开HistoryFailed，请重试');
    }
}


async function deleteHistoryItem(id) {
    try {
        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        const updatedHistory = pkHistory.filter(item => item.id !== id);
        await chrome.storage.local.set({ pkHistory: updatedHistory });
        
        allHistoryItems = updatedHistory;
    } catch (error) {
        console.error('删除HistoryFailed:', error);
    }
}


async function clearHistory() {
    try {
        await chrome.storage.local.set({ pkHistory: [] });
    } catch (error) {
        console.error('清空HistoryFailed:', error);
    }
}


function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
