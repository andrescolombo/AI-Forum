
let isComposing = false;

function trackEvent(name, params = {}) {
    const analytics = window.AIShortcutsAnalytics;
    if (analytics && typeof analytics.logEvent === 'function') {
        analytics.logEvent(name, params);
    }
}


document.addEventListener('DOMContentLoaded', async function() {
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        
        function autoResizeTextarea() {
            searchInput.style.height = 'auto';
            const scrollHeight = searchInput.scrollHeight;
            const minHeight = 36; 
            const maxHeight = 200; 
            
            if (scrollHeight <= minHeight) {
                searchInput.style.height = minHeight + 'px';
            } else {
                const newHeight = Math.min(scrollHeight, maxHeight);
                searchInput.style.height = newHeight + 'px';
            }
        }
        
        
        searchInput.addEventListener('input', autoResizeTextarea);
        
        
        searchInput.addEventListener('paste', () => {
            setTimeout(autoResizeTextarea, 10);
        });
        
        
        searchInput.addEventListener('focus', autoResizeTextarea);
        
        
        autoResizeTextarea();
    }
    
    
    const urlParams = new URLSearchParams(window.location.search);
    const isSidePanel = urlParams.get('side_panel') === 'true';
    const hasQueryParam = urlParams.has('query');
    
    
    
    if (searchInput) {
        setTimeout(() => {
            if (isSidePanel) {
                
                
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                
                
                setTimeout(() => {
                    
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    
                    searchInput.focus({ preventScroll: true });
                    
                    
                    setTimeout(() => {
                        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                        document.documentElement.scrollTop = 0;
                        document.body.scrollTop = 0;
                    }, 50);
                }, 50);
            } else {
                
                window.scrollTo(0, 0);
                searchInput.focus({ preventScroll: true });
            }
        }, isSidePanel ? 200 : 100); 
    }
    
    if (hasQueryParam) {
        
        const query = urlParams.get('query');
        if (query && query !== 'true') {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = query;
                
                searchInput.dispatchEvent(new Event('input'));
            }
        }
    }
    
    
    initializeI18n();
    
    
    await checkAndShowPinGuide();
    
    
    await initializeQuerySuggestions();
    
    
    await initializeSitesList();
    
    
    initializeSaveSitesButton();
    
    
    initializeActionLinks();
});


function initializeI18n() {
    
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            if ((element.tagName.toLowerCase() === 'input' && 
                element.type === 'text') || 
                element.tagName.toLowerCase() === 'textarea') {
                
                element.placeholder = message;
            } else {
                
                element.textContent = message;
            }
        }
    });
    
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const placeholderMessage = chrome.i18n.getMessage('inputPlaceholder');
        if (placeholderMessage) {
            searchInput.placeholder = placeholderMessage;
        }
    }
}


async function initializeQuerySuggestions() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        showQuerySuggestions(query);
    });
    
    
    searchInput.addEventListener('focus', (e) => {
        const query = e.target.value.trim();
        if (query) {
            showQuerySuggestions(query);
        }
    });
    
    
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            const querySuggestions = document.getElementById('querySuggestions');
            if (querySuggestions) {
                querySuggestions.style.display = 'none';
            }
        }, 200);
    });
}


async function showQuerySuggestions(query) {
    const querySuggestions = document.getElementById('querySuggestions');
    
    if (!query || query.trim() === '') {
        querySuggestions.style.display = 'none';
        return;
    }

    try {
        
        const { promptTemplates = [] } = await chrome.storage.sync.get('promptTemplates');
        
        
        const sortedTemplates = promptTemplates
            .filter(template => template.name && template.query)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        
        const recommendedQueries = sortedTemplates.map(template => ({
            name: template.name,
            query: template.query.replace('{query}', query)
        }));

        
        querySuggestions.innerHTML = '';

        
        recommendedQueries.forEach(recommendedQuery => {
            const suggestionItem = document.createElement('div');
            suggestionItem.textContent = recommendedQuery.name;
            suggestionItem.classList.add('query-suggestion-item');
            suggestionItem.addEventListener('click', () => {
                document.getElementById('searchInput').value = recommendedQuery.query;
                querySuggestions.style.display = 'none';
                
                document.getElementById('searchInput').dispatchEvent(new Event('input'));
            });
            querySuggestions.appendChild(suggestionItem);
        });
        
        
        const settingsIcon = document.createElement('img');
        settingsIcon.src = '../icons/edit.png';
        settingsIcon.alt = 'Settings模板';
        settingsIcon.title = '编辑提示词模板';
        settingsIcon.classList.add('query-suggestion-settings-icon');
        settingsIcon.style.cursor = 'pointer';
        settingsIcon.style.width = '20px';
        settingsIcon.style.height = '20px';
        settingsIcon.style.marginLeft = '8px';
        settingsIcon.style.verticalAlign = 'middle';

        
        settingsIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            
            trackEvent('homepage_prompt_templates_settings_click');
            window.open(chrome.runtime.getURL('options/options.html#prompt-templates'), '_blank');
        });

        
        querySuggestions.appendChild(settingsIcon);

        
        querySuggestions.style.display = 'flex';
        
    } catch (error) {
        console.error('Load提示词模板Failed:', error);
        querySuggestions.style.display = 'none';
    }
}


async function checkAndShowPinGuide() {
    try {
        
        const { pinGuideShown } = await chrome.storage.local.get(['pinGuideShown']);
        
        
        if (pinGuideShown === true) {
            return;
        }
        
        
        showPinGuide();
    } catch (error) {
        console.error('Check pin 引导Failed:', error);
    }
}


function showPinGuide() {
    const pinGuideBanner = document.getElementById('pinGuideBanner');
    if (!pinGuideBanner) {
        return;
    }
    
    pinGuideBanner.style.display = 'block';
    
    
    const pinGuideImage = document.getElementById('pinGuideImage');
    if (pinGuideImage) {
        pinGuideImage.src = chrome.runtime.getURL('icons/pin.png');
    }
    
    
    const closeButton = document.getElementById('pinGuideClose');
    if (closeButton) {
        closeButton.addEventListener('click', async () => {
            pinGuideBanner.style.display = 'none';
            
            await chrome.storage.local.set({ pinGuideShown: true });
        });
    }
}

function handleQuery(query) {
    
    const processedQuery = query.replace(/^ai\s+/, '').trim();
    
    
    const selectedSites = getSelectedSites();
    
    
    const urlParams = new URLSearchParams(window.location.search);
    const isSidePanel = urlParams.get('side_panel') === 'true';
    
    
    const params = new URLSearchParams();
    if (processedQuery) {
        params.set('query', processedQuery);
    }
    if (selectedSites.length > 0) {
        
        params.set('sites', selectedSites.join(','));
    }
    
    if (isSidePanel) {
        params.set('side_panel', 'true');
    }

    trackEvent('homepage_search_submit', {
        query_length: processedQuery.length,
        selected_sites_count: selectedSites.length,
        selected_sites: selectedSites,
        side_panel: isSidePanel,
        has_query: Boolean(processedQuery)
    });
    
    
    let searchUrl = chrome.runtime.getURL('iframe/iframe.html');
    if (params.toString()) {
        searchUrl += '?' + params.toString();
    }
    
    
    window.location.href = searchUrl;
}


function getSelectedSites() {
    const checkboxes = document.querySelectorAll('#sitesList .site-checkbox:checked');
    return Array.from(checkboxes).map(checkbox => checkbox.id.replace('site-', ''));
}


async function initializeSitesList() {
    const sitesList = document.getElementById('sitesList');
    if (!sitesList) {
        console.error('Site列表容器未找到');
        return;
    }
    
    try {
        
        const sites = await getDefaultSites();
        
        
        const supportedSites = sites.filter(site => 
            site.supportIframe === true && !site.hidden
        );
        
        console.log('从getDefaultSites() 获取的可以使用的Site:', supportedSites.map(site => ({ name: site.name, enabled: site.enabled })));
        
        sitesList.innerHTML = '';
        
        
        const fragment = document.createDocumentFragment();
        
        supportedSites.forEach(site => {
            const div = document.createElement('div');
            div.className = 'site-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'site-checkbox';
            checkbox.id = `site-${site.name}`;
            
            
            checkbox.checked = site.enabled === true;
            
            if (site.name === 'ChatGPT') {
                console.log('ChatGPT enabled 值:', site.enabled, '类型:', typeof site.enabled, '严格等于true:', site.enabled === true, 'checkbox.checked:', checkbox.checked);
            }

            checkbox.addEventListener('change', () => {
                trackEvent('homepage_site_toggle', {
                    site_name: site.name,
                    enabled: checkbox.checked
                });
            });
            
            const nameLabel = document.createElement('label');
            nameLabel.textContent = site.name;
            nameLabel.htmlFor = `site-${site.name}`;
            
            
            div.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== nameLabel) {
                    checkbox.click();
                }
            });
            
            div.appendChild(checkbox);
            div.appendChild(nameLabel);
            fragment.appendChild(div);
        });
        
        sitesList.appendChild(fragment);
        
    } catch (error) {
        console.error('获取SiteConfigFailed:', error);
        if (sitesList) {
            sitesList.innerHTML = '<div style="padding: 20px; color: #666; text-align: center;">LoadSiteConfigFailed，请刷新页面重试</div>';
        }
    }
}


function initializeSaveSitesButton() {
    const saveBtn = document.getElementById('saveSitesBtn');
    
    if (!saveBtn) {
        console.error('Save按钮未找到: saveSitesBtn');
        return;
    }
    
    console.log('Save按钮已找到，开始绑定事件');
    
    
    const saveTitle = chrome.i18n.getMessage('saveFavoriteSitesTitle') || 
        chrome.i18n.getMessage('saveFavoriteSites') || 
        'Save当前选中的Site为常用Site';
    saveBtn.title = saveTitle;
    
    
    saveBtn.addEventListener('click', async (e) => {
        console.log('Save按钮被Click');
        e.preventDefault();
        e.stopPropagation();
        
        try {
            
            const selectedSites = getSelectedSites();
            console.log('选中的Site:', selectedSites);
            
            if (selectedSites.length === 0) {
                showToast(chrome.i18n.getMessage('noSitesSelected') || '请至少选择一个Site');
                return;
            }
            
            
            const { sites: existingUserSettings = {} } = await chrome.storage.sync.get('sites');
            console.log('现有的用户Settings:', existingUserSettings);
            
            
            const allSites = await getDefaultSites();
            console.log('所有可用Site数量:', allSites.length);
            
            if (!allSites || allSites.length === 0) {
                console.error('无法获取Site列表，SaveFailed');
                showToast(chrome.i18n.getMessage('saveFailed') || 'SaveFailed，请重试');
                return;
            }
            
            const allSiteNames = allSites.map(site => site.name);
            console.log('所有Site名称:', allSiteNames);
            
            
            const updatedUserSettings = { ...existingUserSettings };
            allSiteNames.forEach(siteName => {
                if (!updatedUserSettings[siteName]) {
                    updatedUserSettings[siteName] = {};
                }
                
                updatedUserSettings[siteName].enabled = selectedSites.includes(siteName);
            });
            
            console.log('Update后的用户Settings:', updatedUserSettings);
            
            
            await chrome.storage.sync.set({ sites: updatedUserSettings });
            console.log('已Save到 chrome.storage.sync.sites');
            
            
            trackEvent('homepage_save_favorite_sites', {
                sites_count: selectedSites.length,
                sites: selectedSites
            });
            
            
            showToast(chrome.i18n.getMessage('saveSuccess') || 'Config已Save');
            
            console.log('常用Site已Save到 sites:', updatedUserSettings);
        } catch (error) {
            console.error('Save常用SiteFailed:', error);
            showToast(chrome.i18n.getMessage('saveFailed') || 'SaveFailed，请重试');
        }
    });
    
    console.log('Save按钮事件绑定Completed');
}


document.getElementById('fileUploadButton').addEventListener('click', () => {
    
    const urlParams = new URLSearchParams();
    urlParams.set('upload', 'true');
    
    
    const selectedSites = getSelectedSites();
    if (selectedSites.length > 0) {
        urlParams.set('sites', selectedSites.join(','));
    }
    
    
    const currentUrlParams = new URLSearchParams(window.location.search);
    const isSidePanel = currentUrlParams.get('side_panel') === 'true';
    if (isSidePanel) {
        urlParams.set('side_panel', 'true');
    }

    trackEvent('homepage_upload_click', {
        selected_sites_count: selectedSites.length,
        side_panel: isSidePanel
    });
    
    
    const iframeUrl = chrome.runtime.getURL(`iframe/iframe.html?${urlParams.toString()}`);
    
    
    window.location.href = iframeUrl;
});


document.getElementById('searchButton').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim();
    handleQuery(query);
});


document.getElementById('searchInput').addEventListener('compositionstart', () => {
    isComposing = true;
});

document.getElementById('searchInput').addEventListener('compositionend', () => {
    isComposing = false;
});


document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        
        if (isComposing) {
            return;
        }
        
        e.preventDefault();
        const query = document.getElementById('searchInput').value.trim();
        handleQuery(query);
    }
});


async function initializeActionLinks() {
    try {
        
        const config = await AppConfigManager.loadConfig();
        const externalLinks = config.externalLinks || {};
        
        
        const historyLink = document.getElementById('historyLink');
        if (historyLink) {
            historyLink.addEventListener('click', (e) => {
                e.preventDefault();
                trackEvent('homepage_history_click');
                chrome.tabs.create({ 
                    url: chrome.runtime.getURL('history/history.html')
                });
            });
        }
        
        
        const favoritesLink = document.getElementById('favoritesLink');
        if (favoritesLink) {
            favoritesLink.addEventListener('click', (e) => {
                e.preventDefault();
                trackEvent('homepage_favorites_click');
                chrome.tabs.create({ 
                    url: chrome.runtime.getURL('favorites/favorites.html')
                });
            });
        }
        
        
        const settingsLink = document.getElementById('settingsLink');
        if (settingsLink) {
            settingsLink.addEventListener('click', (e) => {
                e.preventDefault();
                trackEvent('homepage_settings_click');
                
                window.location.href = chrome.runtime.getURL('options/options.html');
            });
        }
        
        
        const feedbackLink = document.getElementById('feedbackLink');
        if (feedbackLink) {
            feedbackLink.addEventListener('click', (e) => {
                e.preventDefault();
                
                const feedbackUrl = externalLinks.feedbackSurvey || 
                    'https://wenjuan.feishu.cn/m/cfm?t=sTFPGe4oetOi-9m3a';
                trackEvent('homepage_feedback_click', {
                    has_feedback_link: Boolean(externalLinks.feedbackSurvey)
                });
                chrome.tabs.create({ url: feedbackUrl });
            });
        }
        
        
        const reviewLink = document.getElementById('reviewLink');
        if (reviewLink) {
            reviewLink.addEventListener('click', (e) => {
                e.preventDefault();
                
                const reviewUrl = externalLinks.reviewLink || 
                    'https://chromewebstore.google.com/detail/ai-compare-oneclick-to-co/dkhpgbbhlnmjbkihoeniojpkggkabbbl/reviews';
                trackEvent('homepage_review_click', {
                    has_review_link: Boolean(externalLinks.reviewLink)
                });
                chrome.tabs.create({ url: reviewUrl });
            });
        }
    } catch (error) {
        console.error('LoadConfigFailed:', error);
        
        const historyLink = document.getElementById('historyLink');
        if (historyLink) {
            historyLink.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ 
                    url: chrome.runtime.getURL('history/history.html')
                });
            });
        }
        
        const favoritesLink = document.getElementById('favoritesLink');
        if (favoritesLink) {
            favoritesLink.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ 
                    url: chrome.runtime.getURL('favorites/favorites.html')
                });
            });
        }
        
        const settingsLink = document.getElementById('settingsLink');
        if (settingsLink) {
            settingsLink.addEventListener('click', (e) => {
                e.preventDefault();
                
                window.location.href = chrome.runtime.getURL('options/options.html');
            });
        }
        
        const feedbackLink = document.getElementById('feedbackLink');
        if (feedbackLink) {
            feedbackLink.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ 
                    url: 'https://wenjuan.feishu.cn/m/cfm?t=sTFPGe4oetOi-9m3a' 
                });
            });
        }
        
        const reviewLink = document.getElementById('reviewLink');
        if (reviewLink) {
            reviewLink.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ 
                    url: 'https://chromewebstore.google.com/detail/ai-compare-oneclick-to-co/dkhpgbbhlnmjbkihoeniojpkggkabbbl/reviews'
                });
            });
        }
    }
}


function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        animation: slideInUp 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInUp 0.3s ease-out reverse';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

