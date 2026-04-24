
let allFavoriteItems = [];


document.addEventListener('DOMContentLoaded', async () => {
    await loadFavorites();
    
    
    const clearBtn = document.getElementById('clearFavoritesBtn');
    clearBtn.addEventListener('click', async () => {
        if (confirm('确定要清空所有Favorites记录吗？')) {
            await clearAllFavorites();
            await loadFavorites();
        }
    });
    
    
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        filterFavorites(e.target.value);
    });
});


async function loadFavorites() {
    try {
        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        
        
        const favoriteItems = pkHistory
            .filter(item => item.sites && item.sites.some(site => site.isFavorite === true))
            .map(item => ({
                ...item,
                sites: item.sites.filter(site => site.isFavorite === true)
            }));
        
        
        allFavoriteItems = favoriteItems;
        
        const favoritesList = document.getElementById('favoritesList');
        const emptyState = document.getElementById('emptyState');
        const noResultsState = document.getElementById('noResultsState');
        const searchInput = document.getElementById('searchInput');
        
        
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        
        
        const filteredItems = filterItemsBySearch(favoriteItems, searchTerm);
        
        if (favoriteItems.length === 0) {
            favoritesList.style.display = 'none';
            emptyState.style.display = 'block';
            noResultsState.style.display = 'none';
            return;
        }
        
        if (filteredItems.length === 0 && searchTerm) {
            favoritesList.style.display = 'none';
            emptyState.style.display = 'none';
            noResultsState.style.display = 'block';
            return;
        }
        
        favoritesList.style.display = 'flex';
        emptyState.style.display = 'none';
        noResultsState.style.display = 'none';
        
        
        favoritesList.innerHTML = '';
        
        
        filteredItems.forEach(item => {
            const favoriteItem = createFavoriteItem(item);
            favoritesList.appendChild(favoriteItem);
        });
        
    } catch (error) {
        console.error('LoadFavorites记录Failed:', error);
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


function filterFavorites(searchTerm) {
    const filteredItems = filterItemsBySearch(allFavoriteItems, searchTerm.toLowerCase());
    
    const favoritesList = document.getElementById('favoritesList');
    const emptyState = document.getElementById('emptyState');
    const noResultsState = document.getElementById('noResultsState');
    
    if (allFavoriteItems.length === 0) {
        favoritesList.style.display = 'none';
        emptyState.style.display = 'block';
        noResultsState.style.display = 'none';
        return;
    }
    
    if (filteredItems.length === 0 && searchTerm.trim()) {
        favoritesList.style.display = 'none';
        emptyState.style.display = 'none';
        noResultsState.style.display = 'block';
        return;
    }
    
    favoritesList.style.display = 'flex';
    emptyState.style.display = 'none';
    noResultsState.style.display = 'none';
    
    
    favoritesList.innerHTML = '';
    
    
    filteredItems.forEach(item => {
        const favoriteItem = createFavoriteItem(item);
        favoritesList.appendChild(favoriteItem);
    });
}


function createFavoriteItem(item) {
    const div = document.createElement('div');
    div.className = 'favorite-item';
    
    
    const header = document.createElement('div');
    header.className = 'favorite-item-header';
    
    const queryDiv = document.createElement('div');
    queryDiv.className = 'favorite-query';
    queryDiv.textContent = item.query;
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'favorite-date';
    dateDiv.textContent = item.date || formatDate(item.timestamp);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'favorite-item-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这条Favorites记录吗？')) {
            await deleteFavoriteItem(item.id);
            await loadFavorites();
        }
    });
    
    actionsDiv.appendChild(deleteBtn);
    
    header.appendChild(queryDiv);
    header.appendChild(dateDiv);
    header.appendChild(actionsDiv);
    
    
    const sitesDiv = document.createElement('div');
    sitesDiv.className = 'favorite-sites';
    
    item.sites.forEach(site => {
        const tag = document.createElement('span');
        tag.className = 'site-tag favorite-tag';
        tag.textContent = site.name;
        sitesDiv.appendChild(tag);
    });
    
    
    div.appendChild(header);
    div.appendChild(sitesDiv);
    
    
    div.addEventListener('click', (e) => {
        
        if (e.target === deleteBtn || deleteBtn.contains(e.target)) {
            return;
        }
        
        openFavoriteItem(item);
    });
    
    return div;
}


async function openFavoriteItem(item) {
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
                            sites: item.sites
                        });
                    } catch (error) {
                        console.error('发送消息Failed:', error);
                        
                        
                    }
                }
            }
        }, 1000);
        
    } catch (error) {
        console.error('打开Favorites记录Failed:', error);
        alert('打开Favorites记录Failed，请重试');
    }
}


async function deleteFavoriteItem(id) {
    try {
        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        const historyIndex = pkHistory.findIndex(item => item.id === id);
        
        if (historyIndex === -1) {
            console.warn('未找到History');
            return;
        }
        
        
        const historyItem = pkHistory[historyIndex];
        if (historyItem.sites) {
            historyItem.sites.forEach(site => {
                site.isFavorite = false;
            });
        }
        
        await chrome.storage.local.set({ pkHistory: pkHistory });
        
        await loadFavorites();
    } catch (error) {
        console.error('删除Favorites记录Failed:', error);
    }
}


async function clearAllFavorites() {
    try {
        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        
        
        pkHistory.forEach(item => {
            if (item.sites) {
                item.sites.forEach(site => {
                    site.isFavorite = false;
                });
            }
        });
        
        await chrome.storage.local.set({ pkHistory: pkHistory });
    } catch (error) {
        console.error('清空Favorites记录Failed:', error);
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
