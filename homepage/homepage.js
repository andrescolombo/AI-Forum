// 跟踪输入法组合输入状态（用于中文输入法）
let isComposing = false;

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 初始化自动调整高度的输入框
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // 自动调整输入框高度
        function autoResizeTextarea() {
            searchInput.style.height = 'auto';
            const scrollHeight = searchInput.scrollHeight;
            const minHeight = 36; // 最小高度
            const maxHeight = 200; // 最大高度
            
            if (scrollHeight <= minHeight) {
                searchInput.style.height = minHeight + 'px';
            } else {
                const newHeight = Math.min(scrollHeight, maxHeight);
                searchInput.style.height = newHeight + 'px';
            }
        }
        
        // 监听输入事件
        searchInput.addEventListener('input', autoResizeTextarea);
        
        // 监听粘贴事件
        searchInput.addEventListener('paste', () => {
            setTimeout(autoResizeTextarea, 10);
        });
        
        // 监听聚焦事件
        searchInput.addEventListener('focus', autoResizeTextarea);
        
        // 初始调整
        autoResizeTextarea();
    }
    
    // 检查 URL 参数，判断是否有预填充的查询和是否在侧边栏中
    const urlParams = new URLSearchParams(window.location.search);
    const isSidePanel = urlParams.get('side_panel') === 'true';
    const hasQueryParam = urlParams.has('query');
    
    // 延迟设置焦点，防止页面自动滚动
    // 使用 setTimeout 确保页面完全加载后再聚焦
    if (searchInput) {
        setTimeout(() => {
            if (isSidePanel) {
                // 在侧边栏中：更积极的防止滚动
                // 1. 立即滚动到顶部
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                
                // 2. 等待一下，确保滚动完成
                setTimeout(() => {
                    // 3. 再次确保在顶部
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    // 4. 使用 preventScroll 设置焦点
                    searchInput.focus({ preventScroll: true });
                    
                    // 5. 设置焦点后再次确保滚动位置
                    setTimeout(() => {
                        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                        document.documentElement.scrollTop = 0;
                        document.body.scrollTop = 0;
                    }, 50);
                }, 50);
            } else {
                // 在新标签页中：正常处理
                window.scrollTo(0, 0);
                searchInput.focus({ preventScroll: true });
            }
        }, isSidePanel ? 200 : 100); // 侧边栏需要更长的延迟
    }
    
    if (hasQueryParam) {
        // 从 URL 参数中获取查询内容并填入搜索框
        const query = urlParams.get('query');
        if (query && query !== 'true') {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = query;
                // 触发自动调整高度
                searchInput.dispatchEvent(new Event('input'));
            }
        }
    }
    
    // 初始化国际化
    initializeI18n();
    
    // 检查是否需要显示 pin 引导提示（仅首次安装时）
    await checkAndShowPinGuide();
    
    // 加载提示词模板建议
    await initializeQuerySuggestions();
    
    // 初始化站点列表
    await initializeSitesList();
});

// 初始化国际化
function initializeI18n() {
    // 处理所有带有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            if ((element.tagName.toLowerCase() === 'input' && 
                element.type === 'text') || 
                element.tagName.toLowerCase() === 'textarea') {
                // 对于输入框和文本域，设置 placeholder
                element.placeholder = message;
            } else {
                // 对于其他元素，设置文本内容
                element.textContent = message;
            }
        }
    });
    
    // 手动设置输入框的占位符
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const placeholderMessage = chrome.i18n.getMessage('inputPlaceholder');
        if (placeholderMessage) {
            searchInput.placeholder = placeholderMessage;
        }
    }
}

// 初始化查询建议
async function initializeQuerySuggestions() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    // 添加输入监听器，当searchInput有内容时显示建议
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        showQuerySuggestions(query);
    });
    
    // 添加焦点事件监听器
    searchInput.addEventListener('focus', (e) => {
        const query = e.target.value.trim();
        if (query) {
            showQuerySuggestions(query);
        }
    });
    
    // 失焦时隐藏建议
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            const querySuggestions = document.getElementById('querySuggestions');
            if (querySuggestions) {
                querySuggestions.style.display = 'none';
            }
        }, 200);
    });
}

// 显示查询建议
async function showQuerySuggestions(query) {
    const querySuggestions = document.getElementById('querySuggestions');
    
    if (!query || query.trim() === '') {
        querySuggestions.style.display = 'none';
        return;
    }

    try {
        // 从存储中获取提示词模板
        const { promptTemplates = [] } = await chrome.storage.sync.get('promptTemplates');
        
        // 按order排序并过滤出有效的模板
        const sortedTemplates = promptTemplates
            .filter(template => template.name && template.query)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        // 使用用户自定义模板生成建议
        const recommendedQueries = sortedTemplates.map(template => ({
            name: template.name,
            query: template.query.replace('{query}', query)
        }));

        // 清空之前的内容
        querySuggestions.innerHTML = '';

        // 创建建议项
        recommendedQueries.forEach(recommendedQuery => {
            const suggestionItem = document.createElement('div');
            suggestionItem.textContent = recommendedQuery.name;
            suggestionItem.classList.add('query-suggestion-item');
            suggestionItem.addEventListener('click', () => {
                document.getElementById('searchInput').value = recommendedQuery.query;
                querySuggestions.style.display = 'none';
                // 触发自动调整高度
                document.getElementById('searchInput').dispatchEvent(new Event('input'));
            });
            querySuggestions.appendChild(suggestionItem);
        });
        
        // 添加设置图标到 querySuggestions 区域
        const settingsIcon = document.createElement('img');
        settingsIcon.src = '../icons/edit.png';
        settingsIcon.alt = '设置模板';
        settingsIcon.title = '编辑提示词模板';
        settingsIcon.classList.add('query-suggestion-settings-icon');
        settingsIcon.style.cursor = 'pointer';
        settingsIcon.style.width = '20px';
        settingsIcon.style.height = '20px';
        settingsIcon.style.marginLeft = '8px';
        settingsIcon.style.verticalAlign = 'middle';

        // 点击后在新标签页打开设置页面并跳转到模板编辑区域
        settingsIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(chrome.runtime.getURL('options/options.html#prompt-templates'), '_blank');
        });

        // 将设置图标添加到 querySuggestions 区域
        querySuggestions.appendChild(settingsIcon);

        // 显示建议
        querySuggestions.style.display = 'flex';
        
    } catch (error) {
        console.error('加载提示词模板失败:', error);
        querySuggestions.style.display = 'none';
    }
}

// 检查并显示 pin 引导提示（仅首次安装时）
async function checkAndShowPinGuide() {
    try {
        // 检查是否已经显示过引导
        const { pinGuideShown } = await chrome.storage.local.get(['pinGuideShown']);
        
        // 如果已经显示过，不显示
        if (pinGuideShown === true) {
            return;
        }
        
        // 如果是首次安装（pinGuideShown 为 false 或 undefined），显示引导
        showPinGuide();
    } catch (error) {
        console.error('检查 pin 引导失败:', error);
    }
}

// 显示 pin 引导提示
function showPinGuide() {
    const pinGuideBanner = document.getElementById('pinGuideBanner');
    if (!pinGuideBanner) {
        return;
    }
    
    pinGuideBanner.style.display = 'block';
    
    // 设置 pin 图片路径
    const pinGuideImage = document.getElementById('pinGuideImage');
    if (pinGuideImage) {
        pinGuideImage.src = chrome.runtime.getURL('icons/pin.png');
    }
    
    // 绑定关闭按钮事件
    const closeButton = document.getElementById('pinGuideClose');
    if (closeButton) {
        closeButton.addEventListener('click', async () => {
            pinGuideBanner.style.display = 'none';
            // 标记为已显示，以后不再显示
            await chrome.storage.local.set({ pinGuideShown: true });
        });
    }
}

function handleQuery(query) {
    // 解析输入文本（如果有前缀，去掉前缀）
    const processedQuery = query.replace(/^ai\s+/, '').trim();
    
    // 获取选中的站点列表
    const selectedSites = getSelectedSites();
    
    // 检查当前页面是否在侧边栏中
    const urlParams = new URLSearchParams(window.location.search);
    const isSidePanel = urlParams.get('side_panel') === 'true';
    
    // 构建 URL 参数
    const params = new URLSearchParams();
    if (processedQuery) {
        params.set('query', processedQuery);
    }
    if (selectedSites.length > 0) {
        // 传递选中的站点名称列表
        params.set('sites', selectedSites.join(','));
    }
    // 如果当前页面在侧边栏中，也传递 side_panel 参数
    if (isSidePanel) {
        params.set('side_panel', 'true');
    }
    
    // 构建 URL（使用相对路径，在当前页面跳转）
    let searchUrl = chrome.runtime.getURL('iframe/iframe.html');
    if (params.toString()) {
        searchUrl += '?' + params.toString();
    }
    
    // 在当前页面跳转，而不是打开新标签页
    window.location.href = searchUrl;
}

// 获取选中的站点名称列表
function getSelectedSites() {
    const checkboxes = document.querySelectorAll('#sitesList .site-checkbox:checked');
    return Array.from(checkboxes).map(checkbox => checkbox.id.replace('site-', ''));
}

// 初始化站点列表
async function initializeSitesList() {
    const sitesList = document.getElementById('sitesList');
    if (!sitesList) {
        console.error('站点列表容器未找到');
        return;
    }
    
    try {
        // 使用 getDefaultSites 获取合并后的站点配置
        const sites = await getDefaultSites();
        
        // 过滤支持 iframe 的站点
        const supportedSites = sites.filter(site => 
            site.supportIframe === true && !site.hidden
        );
        
        console.log('从getDefaultSites() 获取的可以使用的站点:', supportedSites.map(site => ({ name: site.name, enabled: site.enabled })));
        // 清空列表
        sitesList.innerHTML = '';
        
        // 创建站点项
        const fragment = document.createDocumentFragment();
        
        supportedSites.forEach(site => {
            const div = document.createElement('div');
            div.className = 'site-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'site-checkbox';
            checkbox.id = `site-${site.name}`;
            
            // 直接使用 getDefaultSites() 返回的 site.enabled 值（已合并用户设置和基础配置）
            checkbox.checked = site.enabled === true;
            // 调试日志
            if (site.name === 'ChatGPT') {
                console.log('ChatGPT enabled 值:', site.enabled, '类型:', typeof site.enabled, '严格等于true:', site.enabled === true, 'checkbox.checked:', checkbox.checked);
            }
            
            const nameLabel = document.createElement('label');
            nameLabel.textContent = site.name;
            nameLabel.htmlFor = `site-${site.name}`;
            
            // 点击整个 item 也能切换复选框
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
        console.error('获取站点配置失败:', error);
        if (sitesList) {
            sitesList.innerHTML = '<div style="padding: 20px; color: #666; text-align: center;">加载站点配置失败，请刷新页面重试</div>';
        }
    }
}

// 添加搜索按钮点击事件
document.getElementById('searchButton').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim();
    handleQuery(query);
});

// 监听输入法组合输入事件
document.getElementById('searchInput').addEventListener('compositionstart', () => {
    isComposing = true;
});

document.getElementById('searchInput').addEventListener('compositionend', () => {
    isComposing = false;
});

// 处理回车键
document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        // 如果正在使用输入法组合输入，不触发查询操作
        if (isComposing) {
            return;
        }
        
        e.preventDefault();
        const query = document.getElementById('searchInput').value.trim();
        handleQuery(query);
    }
});

// Toast 提示函数
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

