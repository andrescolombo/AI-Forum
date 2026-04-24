
let filePasteHandlerAdded = false;


let isComposing = false;

function trackEvent(name, params = {}) {
  const analytics = window.AIShortcutsAnalytics;
  if (analytics && typeof analytics.logEvent === 'function') {
    analytics.logEvent(name, params);
  }
}

function getOpenedSites() {
  return Array.from(document.querySelectorAll('.ai-iframe'))
    .map(iframe => iframe.getAttribute('data-site'))
    .filter(Boolean);
}


const SUPPORTED_FILE_EXTENSIONS = [
  
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'odt', 'ods', 'odp', 'rtf', 'pages', 'numbers', 'key',
  'wps', 'et', 'dps', 'vsd', 'vsdx', 'pub', 'one', 'msg', 'eml', 'mpp',
  
  'txt', 'csv', 'json', 'xml', 'html', 'css', 'js', 'md', 'yaml', 'yml',
  
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico', 'avif',
  
  'mp4', 'avi', 'mov', 'wmv', 'webm', 'mp3', 'wav', 'ogg', 'flac', 'm4a',
  
  'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'ts',
  
  'zip', 'rar', '7z', 'gz', 'tar', 'bz2', 'xz'
];


function hasValidFileExtension(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const firstLine = text.trim().split('\n')[0];
  
  
  if (firstLine.includes('http://') || firstLine.includes('https://')) {
    return false;
  }
  
  
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\//i.test(firstLine) || /www\./i.test(firstLine)) {
    return false;
  }
  
  const fileExtensionRegex = new RegExp(`\\.(${SUPPORTED_FILE_EXTENSIONS.join('|')})$`, 'i');
  return fileExtensionRegex.test(firstLine) && firstLine.length < 100;
}


async function requestClipboardPermission() {
  try {
    console.log('🔍 开始请求剪贴板权限...');
    
    
    const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' });
    console.log('当前剪贴板权限状态:', permissionStatus.state);
    console.log('权限对象详情:', permissionStatus);
    
    if (permissionStatus.state === 'granted') {
      console.log('✅ 剪贴板权限已授予');
      return true;
    } else if (permissionStatus.state === 'prompt') {
      console.log('🔄 需要用户授权剪贴板权限');
      console.log('📋 尝试读取剪贴板来Trigger权限请求...');
      
      
      try {
        const clipboardData = await navigator.clipboard.read();
        console.log('✅ 剪贴板权限请求Successful');
        console.log('剪贴板内容:', clipboardData);
        return true;
      } catch (error) {
        console.log('❌ 剪贴板权限请求Failed:', error);
        console.log('错误名称:', error.name);
        console.log('错误消息:', error.message);
        console.log('错误堆栈:', error.stack);
        return false;
      }
    } else {
      console.log('❌ 剪贴板权限被拒绝');
      console.log('💡 建议: 请Check浏览器Settings中的剪贴板权限');
      return false;
    }
  } catch (error) {
    console.log('❌ Check剪贴板权限Failed:', error);
    console.log('错误详情:', error);
    return false;
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
        
        
        searchInput.addEventListener('focus', () => {
            
            autoResizeTextarea();
        });
        
        
        searchInput.addEventListener('blur', (e) => {
            
            searchInput.style.height = '36px';
            
            
            setTimeout(() => {
                const querySuggestions = document.getElementById('querySuggestions');
                if (querySuggestions) {
                    querySuggestions.style.display = 'none';
                }
            }, 200);
        });
        
        
        autoResizeTextarea();
    }
    
    
    const columnCurrentBtn = document.getElementById('columnCurrentBtn');
    const columnDropdown = document.getElementById('columnDropdown');
    const columnOptionBtns = document.querySelectorAll('.column-option-btn');
    const iframesContainer = document.getElementById('iframes-container');

    
    const isSidePanel = window.location.href.includes('side_panel') || 
                       window.location.search.includes('side_panel') ||
                       (window.top !== window); 

    
    let { preferredColumns = '3' } = await chrome.storage.sync.get('preferredColumns');
    
    
    if (isSidePanel || window.innerWidth < 500) {
       preferredColumns = '1';
    }
    
    
    setActiveColumnOption(preferredColumns);
    updateCurrentDisplay(preferredColumns);
    updateColumns(preferredColumns);

    
    const urlParams = new URLSearchParams(window.location.search);
    const hasQueryParam = urlParams.has('query');
    const hasSitesParam = urlParams.has('sites');
    
    
    let selectedSiteNames = null;
    if (hasSitesParam) {
        const sitesParam = urlParams.get('sites');
        if (sitesParam) {
            selectedSiteNames = sitesParam.split(',').map(name => name.trim()).filter(name => name);
            console.log('从 URL 参数获取指定的Site列表:', selectedSiteNames);
        }
    }
    
    if (hasQueryParam) {
        
        const query = urlParams.get('query');
        console.log('从 URL 参数获取查询内容:', query);
        
        if (query && query !== 'true') {
            
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = query;
            }
            
            
            getDefaultSites().then((sites) => {
                if (sites && sites.length > 0) {
                    
                    if (selectedSiteNames && selectedSiteNames.length > 0) {
                        let availableSites = sites.filter(site => 
                            selectedSiteNames.includes(site.name) &&
                            site.supportIframe !== false && 
                            !site.hidden
                        );
                        console.log('根据选中的Site列表过滤:', selectedSiteNames, availableSites);
                        
                        if (availableSites.length > 0) {
                            console.log('使用查询内容创建 iframes:', query, availableSites);
                            createIframes(query, availableSites);
                        } else {
                            console.log('没有可用的Site');
                        }
                    } else {
                        
                        let availableSites = sites.filter(site => 
                            site.enabled && 
                            site.supportIframe !== false && 
                            !site.hidden
                        );

                        if (availableSites.length > 0) {
                            console.log('使用查询内容创建 iframes:', query, availableSites);
                            createIframes(query, availableSites);
                        } else {
                            console.log('没有可用的Site');
                        }
                    }
                }
            });
        } else {
            
            console.log('URL 参数 query=true，按直接打开处理');
            getDefaultSites().then((sites) => {
                if (sites && sites.length > 0) {
                    
                    if (selectedSiteNames && selectedSiteNames.length > 0) {
                        let availableSites = sites.filter(site => 
                            selectedSiteNames.includes(site.name) &&
                            site.supportIframe !== false && 
                            !site.hidden
                        );
                        console.log('根据选中的Site列表过滤:', selectedSiteNames, availableSites);
                        
                        if (availableSites.length > 0) {
                            console.log('初始化可用Site:', availableSites);
                            createIframes('', availableSites);
                        } else {
                            console.log('没有可用的Site');
                        }
                    } else {
                        
                        let availableSites = sites.filter(site => 
                            site.enabled && 
                            site.supportIframe !== false && 
                            !site.hidden
                        );

                        if (availableSites.length > 0) {
                            console.log('初始化可用Site:', availableSites);
                            createIframes('', availableSites);
                        } else {
                            console.log('没有可用的Site');
                        }
                    }
                }
            });
        }
    } else {
        
        getDefaultSites().then((sites) => {
            if (sites && sites.length > 0) {
                
                if (selectedSiteNames && selectedSiteNames.length > 0) {
                    let availableSites = sites.filter(site => 
                        selectedSiteNames.includes(site.name) &&
                        site.supportIframe !== false && 
                        !site.hidden
                    );
                    console.log('根据选中的Site列表过滤:', selectedSiteNames, availableSites);
                    
                    if (availableSites.length > 0) {
                        console.log('初始化可用Site:', availableSites);
                        createIframes('', availableSites);
                    } else {
                        console.log('没有可用的Site');
                    }
                } else {
                    
                    let availableSites = sites.filter(site => 
                        site.enabled && 
                        site.supportIframe !== false && 
                        !site.hidden
                    );

                    if (availableSites.length > 0) {
                        console.log('初始化可用Site:', availableSites);
                        createIframes('', availableSites);
                    } else {
                        console.log('没有可用的Site');
                    }
                }
            }
        });
    }

    
    columnCurrentBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleDropdown();
    });

    
    columnOptionBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const columns = e.currentTarget.getAttribute('data-columns');
            selectColumnOption(columns);
        });
    });

    
    document.addEventListener('click', function(e) {
        if (!columnDropdown.contains(e.target) && !columnCurrentBtn.contains(e.target)) {
            closeDropdown();
        }
    });

    
    if (!filePasteHandlerAdded) {
        document.addEventListener('paste', handleUnifiedFilePaste);
        filePasteHandlerAdded = true;
        console.log('🎯 统一文件粘贴监听器已添加');
    }

    
    initializeFileUpload();
    
    
    initializeExportResponses();
    
    
    
    if (urlParams.get('upload') === 'true') {
        
        showToast('页面Load后，ClickInput box的🔗图标', 8000); 
    }

});


function showLocalFileWarning(fileName, fileExtension) {
  const warning = document.createElement('div');
  warning.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    color: white;
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 480px;
    width: 90%;
    text-align: left;
    line-height: 1.6;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
    animation: slideInScale 0.3s ease-out;
  `;
  
  
  const icon = '📁';
  
  
  const localFileDetected = chrome.i18n.getMessage('localFileDetected');
  const browserSecurityRestriction = chrome.i18n.getMessage('browserSecurityRestriction');
  const localFileSecurityMessage = chrome.i18n.getMessage('localFileSecurityMessage');
  const suggestedActions = chrome.i18n.getMessage('suggestedActions');
  const uploadFileAction = chrome.i18n.getMessage('uploadFileAction');
  const dismissWarning = chrome.i18n.getMessage('dismissWarning');
  
  warning.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
      <span style="font-size: 32px;">${icon}</span>
      <div>
        <div style="font-weight: 600; font-size: 16px;">${localFileDetected}</div>
        <div style="font-size: 12px; opacity: 0.9;">${fileName}</div>
      </div>
    </div>
    
    <div style="background: rgba(238, 199, 199, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
      <div style="font-size: 13px; margin-bottom: 8px;">🚫 <strong>${browserSecurityRestriction}</strong></div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${localFileSecurityMessage}
      </div>
    </div>
    
    <div style="font-size: 13px; margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 8px;">💡 ${suggestedActions}</div>
      <div style="margin-left: 16px;">
        <div style="margin-bottom: 4px;">• ${uploadFileAction}</div>
      </div>
    </div>
    
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button id="dismissWarning" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      ">${dismissWarning}</button>
    </div>
  `;
  
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInScale {
      from { 
        transform: translate(-50%, -50%) scale(0.8); 
        opacity: 0; 
      }
      to { 
        transform: translate(-50%, -50%) scale(1); 
        opacity: 1; 
      }
    }
    #dismissWarning:hover {
      background: rgba(255,255,255,0.3) !important;
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(warning);
  
  
  const dismissBtn = warning.querySelector('#dismissWarning');
  dismissBtn.addEventListener('click', () => {
    warning.style.animation = 'slideInScale 0.3s ease-out reverse';
    setTimeout(() => {
      if (warning.parentElement) {
        warning.remove();
        style.remove();
      }
    }, 300);
  });
  
  
  setTimeout(() => {
    if (warning.parentElement) {
      dismissBtn.click();
    }
  }, 8000);
}


function isLocalFile(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const firstLine = text.trim().split('\n')[0];
  
  
  if (firstLine.includes('http://') || firstLine.includes('https://')) {
    return false;
  }
  
  
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(firstLine) || /www\./i.test(firstLine)) {
    return false;
  }
  
  
  const filePathPatterns = [
    
    /^[A-Za-z]:\\[^<>:"|?*\n]+\.[a-zA-Z0-9]+$/,
    
    /^[~\/][^<>:"|?*\n]*\.[a-zA-Z0-9]+$/,
    
    /^\\\\[^<>:"|?*\n]+\\[^<>:"|?*\n]*\.[a-zA-Z0-9]+$/
  ];
  
  
  const hasPathSeparator = firstLine.includes('/') || firstLine.includes('\\');
  const matchesPattern = filePathPatterns.some(pattern => pattern.test(firstLine));
  
  
  const isAutoGeneratedName = /^(clipboard|screenshot|download|image|file)-\d+\./i.test(firstLine);
  
  const isRealFilePath = (matchesPattern || hasPathSeparator) && !isAutoGeneratedName;
  
  if (isRealFilePath) {
    console.log('🎯 检测到真正的文件路径:', firstLine);
  }
  
  return isRealFilePath;
}


async function handleUnifiedFilePaste(event) {
  console.log('🎯 检测到粘贴事件，开始处理');
  
  try {
    
    const hasPermission = await requestClipboardPermission();
    if (!hasPermission) {
      console.log('❌ 无法访问剪贴板，权限不足，允许默认行为');
      return;
    }
    
    
    const clipboardData = await navigator.clipboard.read();
    console.log('剪贴板内容:', clipboardData);
    
    let hasImage = false;
    let hasText = false;
    
    for (const item of clipboardData) {
      console.log('剪贴板项目类型:', item.types);
      console.log('剪贴板项目详情:', item);
      
      
      if (item.types.some(type => type.startsWith('image/'))) {
        hasImage = true;
        console.log('🎯 检测到图片内容');
      }
      
      
      if (item.types.includes('text/plain')) {
        hasText = true;
        console.log('🎯 检测到纯文字内容');
      }
    }
    
    console.log('🎯 内容分析结果:', {
      hasText,
      hasImage
    });
    
    
    
    if (hasText && !hasImage) {
      console.log('🎯 纯文字内容，允许默认粘贴行为');
      return;
    }
    
    
    if (hasImage) {
      console.log('🎯 检测到图片，开始处理图片数据');
      
      for (const item of clipboardData) {
        if (item.types.some(type => type.startsWith('image/'))) {
          try {
            
            const imageType = item.types.find(type => type.startsWith('image/'));
            const imageData = await item.getType(imageType);
            
            console.log('🎯 图片数据获取Successful:', {
              type: imageType,
              size: imageData.size
            });
            
            
            const fileObj = {
              name: `clipboard_image_${Date.now()}.${imageType.split('/')[1] || 'png'}`,
              type: imageType,
              size: imageData.size || 0,
              blob: imageData,
              data: imageData
            };
            
            
            await sendFileToAllIframes(fileObj);
            console.log('🎯 图片已发送到所有iframe');
            
          } catch (imageError) {
            console.log('🎯 处理图片Failed:', imageError);
          }
        }
      }
      
      
      console.log('🎯 图片处理Completed，阻止默认粘贴行为');
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    
    console.log('🎯 非纯文本非图片内容，阻止粘贴行为');
    event.preventDefault();
    event.stopPropagation();
    return;
    
    
    console.log('🎯 默认情况，允许粘贴行为');
    
  } catch (error) {
    console.error('🎯 粘贴处理出错:', error);
    
  }
}


async function sendFileToAllIframes(fileObj) {
  const iframes = document.querySelectorAll('.ai-iframe');
  console.log(`🎯 开始向 ${iframes.length} 个iframe发送文件`);
  console.log('🎯 文件对象详情:', {
    name: fileObj.name,
    type: fileObj.type,
    size: fileObj.size
  });
  
  
  await executeFileUploadSequentially(iframes, fileObj);
  
  console.log('🎯 所有iframe文件发送Completed');
}


async function executeFileUploadSequentially(iframes, fileData, fallbackMode = false) {
  const totalIframes = iframes.length;
  let successCount = 0;
  let failureCount = 0;
  
  console.log(`开始逐个Execute文件粘贴，共 ${totalIframes} 个 iframe`);
  
  
  showFileUploadProgress(0, totalIframes, 'starting');
  
  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i];
    
    try {
      const domain = new URL(iframe.src).hostname;
      const siteName = iframe.getAttribute('data-site');
      
      console.log(`🎯 处理第 ${i + 1}/${totalIframes} 个 iframe: ${siteName} (${domain})`);
      
      
      showFileUploadProgress(i + 1, totalIframes, 'processing', siteName);
      
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Phase 1 Security Fix: Use specific iframe origin instead of wildcard '*'.
      // This prevents other pages from intercepting these postMessages.
      const iframeOrigin = new URL(iframe.src).origin;

      if (fallbackMode) {
        // Fallback mode: let the iframe try to read the clipboard itself
        iframe.contentWindow.postMessage({
          type: 'TRIGGER_PASTE',
          domain: domain,
          source: 'iframe-parent',
          global: true,
          fallback: true,
          index: i + 1,
          total: totalIframes
        }, iframeOrigin);
      } else {
        // Priority mode: use site-specific file upload handler
        iframe.contentWindow.postMessage({
          type: 'TRIGGER_PASTE',
          domain: domain,
          source: 'iframe-parent',
          global: true,
          fileData: fileData,
          useSiteHandler: true,
          index: i + 1,
          total: totalIframes
        }, iframeOrigin);
      }
      
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      successCount++;
      console.log(`✅ 第 ${i + 1} 个 iframe 处理Completed`);
      
    } catch (error) {
      console.error(`❌ 第 ${i + 1} 个 iframe 处理Failed:`, error);
      failureCount++;
    }
    
    
    if (i < iframes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  console.log(`🎯 逐个文件粘贴ExecuteCompleted: Successful ${successCount}/${totalIframes}, Failed ${failureCount}`);
  
  
  showFileUploadProgress(totalIframes, totalIframes, 'completed', null, { successCount, failureCount });
  
  
  setTimeout(() => {
    hideFileUploadProgress();
  }, 3000);
}


function showFileUploadProgress(current, total, status, siteName = null, result = null) {
  let progressElement = document.getElementById('file-upload-progress');
  
  if (!progressElement) {
    progressElement = document.createElement('div');
    progressElement.id = 'file-upload-progress';
    progressElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      min-width: 200px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(progressElement);
  }
  
  let message = '';
  let emoji = '';
  
  switch (status) {
    case 'starting':
      emoji = '🚀';
      message = '开始文件粘贴...';
      break;
    case 'processing':
      emoji = '⏳';
      message = `正在处理 ${current}/${total}`;
      if (siteName) {
        message += `<br><small style="opacity: 0.8;">${siteName}</small>`;
      }
      break;
    case 'completed':
      emoji = '✅';
      if (result) {
        if (result.failureCount === 0) {
          message = `文件粘贴Completed<br><small>Successful: ${result.successCount}/${total}</small>`;
        } else {
          message = `文件粘贴Completed<br><small>Successful: ${result.successCount}, Failed: ${result.failureCount}</small>`;
        }
      } else {
        message = '文件粘贴Completed';
      }
      break;
  }
  
  progressElement.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">${emoji}</span>
      <div>${message}</div>
    </div>
  `;
}


function hideFileUploadProgress() {
  const progressElement = document.getElementById('file-upload-progress');
  if (progressElement) {
    progressElement.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => {
      if (progressElement.parentElement) {
        progressElement.remove();
      }
    }, 300);
  }
}


function toggleDropdown() {
    const columnDropdown = document.getElementById('columnDropdown');
    const isOpen = columnDropdown.classList.contains('show');
    
    if (isOpen) {
        closeDropdown();
    } else {
        openDropdown();
    }
}


function openDropdown() {
    const columnDropdown = document.getElementById('columnDropdown');
    columnDropdown.classList.add('show');
}


function closeDropdown() {
    const columnDropdown = document.getElementById('columnDropdown');
    columnDropdown.classList.remove('show');
}


function selectColumnOption(columns) {
    
    setActiveColumnOption(columns);
    
    
    updateCurrentDisplay(columns);
    
    
    updateColumns(columns);
    
    
    chrome.storage.sync.set({ 'preferredColumns': columns });
    
    
    closeDropdown();
}


function setActiveColumnOption(columns) {
    const columnOptionBtns = document.querySelectorAll('.column-option-btn');
    columnOptionBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-columns') === columns) {
            btn.classList.add('active');
        }
    });
}


function updateCurrentDisplay(columns) {
    const columnCurrentBtn = document.getElementById('columnCurrentBtn');
    const svg = columnCurrentBtn.querySelector('svg');
    
    
    const svgTemplates = {
        '1': `<rect x="6" y="3" width="8" height="14" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>`,
        '2': `<rect x="2" y="3" width="6" height="14" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>
              <rect x="12" y="3" width="6" height="14" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>`,
        '3': `<rect x="1" y="3" width="4" height="14" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>
              <rect x="8" y="3" width="4" height="14" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>
              <rect x="15" y="3" width="4" height="14" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>`,
        '4': `<rect x="1" y="3" width="3" height="14" rx="1" stroke="currentColor" stroke-width="1.8" fill="none"/>
              <rect x="6" y="3" width="3" height="14" rx="1" stroke="currentColor" stroke-width="1.8" fill="none"/>
              <rect x="11" y="3" width="3" height="14" rx="1" stroke="currentColor" stroke-width="1.8" fill="none"/>
              <rect x="16" y="3" width="3" height="14" rx="1" stroke="currentColor" stroke-width="1.8" fill="none"/>`
    };
    
    if (svgTemplates[columns]) {
        svg.innerHTML = svgTemplates[columns];
    }
}


function updateColumns(columns) {
    const iframesContainer = document.getElementById('iframes-container');
    iframesContainer.dataset.columns = columns;
    document.documentElement.style.setProperty('--columns', columns);
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('iframe.js 收到消息:', message);
  if (message.type === 'loadIframes') {
    console.log('开始Load iframes, 查询词:', message.query);
    const searchInput = document.getElementById('searchInput');
    searchInput.value = message.query;
    createIframes(message.query, message.sites);
  } else if (message.type === 'loadHistoryIframes') {
    console.log('开始LoadHistory iframes:', message.sites);
    
    if (message.historyId) {
      window._currentHistoryId = message.historyId;
      console.log('Settings当前History ID:', message.historyId);
    }
    loadHistoryIframes(message.sites);
  }
});


async function createIframes(query, sites) {
    
  const enabledSites = sites;
    
  console.log('过滤后的Site:', enabledSites);
    
    
  const container = document.getElementById('iframes-container');
  if (!container) {
    console.error('未找到 iframes 容器');
    return;
  }
  
  
  
    
  try {
    if (query) {
      
      
      container.innerHTML = '';
      console.log("清空iframe")

    } 
    
    container.style.marginLeft = '72px';
    
    enabledSites.forEach(site => {
      
      let url;
      if (!query) {
        try {
          url = new URL(site.url).hostname;
          url = 'https://' + url;
        } catch (e) {
          console.error('URL解析Failed:', site.url);
          url = site.url;
        }
      } else {
        url = site.supportUrlQuery 
        ? site.url.replace('{query}', encodeURIComponent(query))
        : site.url;
      }
        
      console.log("即将开始调用创建单个 iframe",site.name, url)
      createSingleIframe(site.name, url, container, query);
    });
  } catch (error) {
    console.error('创建 iframes Failed:', error);
  }
 
  
  
  const nav = document.createElement('nav');
  nav.className = 'nav';

  
  const navList = document.createElement('ul');
  navList.className = 'nav-list';

  
  enabledSites.forEach((site, index) => {
    const navItem = document.createElement('li');
    navItem.className = 'nav-item';
    navItem.textContent = site.name;
    navItem.draggable = true;
    navItem.dataset.siteName = site.name;
    navItem.dataset.originalIndex = index;
    


    
    window.addEventListener('scroll', () => {
      
      const iframes = container.querySelectorAll('.iframe-container');
      
      const navItems = navList.querySelectorAll('li');
      
      
      iframes.forEach((iframe, idx) => {
        const rect = iframe.getBoundingClientRect();
        
        if (rect.top <= window.innerHeight / 2) {
          
          navItems.forEach(item => {
            item.style.backgroundColor = '';
            item.classList.remove('active');
          });
          
          
          navItems[idx].style.backgroundColor = '#e0e0e0';
          navItems[idx].classList.add('active');
        }
      });
    });

    
    navItem.addEventListener('click', () => {
      
      navList.querySelectorAll('li').forEach(item => {
        item.style.backgroundColor = '';
        item.classList.remove('active');
      });
      
      
      navItem.style.backgroundColor = '#e0e0e0';
      navItem.classList.add('active');
      
      
      const iframes = container.querySelectorAll('.iframe-container');
      if(iframes[index]) {
        iframes[index].scrollIntoView({ behavior: 'smooth' });
      }
    });
    
    navList.appendChild(navItem);
  });

  
  addDragAndDropToNavList(navList, enabledSites);

  nav.appendChild(navList);
  document.body.insertBefore(nav, container);

  
  if (query && query.trim() !== '') {
    
    savePKHistory(query);
  }
}







async function getIframeLatestUrl(iframe, siteName, historyId = null) {
  try {
    
    try {
      const currentUrl = iframe.contentWindow.location.href;
      if (currentUrl && currentUrl !== 'about:blank') {
        console.log(`从 iframe.contentWindow 获取 ${siteName} 的 URL:`, currentUrl);
        return currentUrl;
      }
    } catch (e) {
      
      console.log(`无法直接访问 ${siteName} iframe 的 location（可能跨域）`);
    }
    
    
    try {
      const urlFromMessage = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          reject(new Error('获取 URL 超时'));
        }, 1000); 
        
        const messageHandler = (event) => {
          
          if (event.source === iframe.contentWindow && 
              event.data.type === 'GET_CURRENT_URL_RESPONSE' &&
              event.data.siteName === siteName) {
            clearTimeout(timeout);
            window.removeEventListener('message', messageHandler);
            resolve(event.data.url);
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        
        try {
          iframe.contentWindow.postMessage({
            type: 'GET_CURRENT_URL',
            siteName: siteName
          }, '*');
        } catch (postError) {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          reject(postError);
        }
      });
      
      if (urlFromMessage && urlFromMessage !== 'about:blank') {
        console.log(`通过 postMessage 获取 ${siteName} 的 URL:`, urlFromMessage);
        return urlFromMessage;
      }
    } catch (e) {
      console.log(`无法通过 postMessage 获取 ${siteName} 的 URL:`, e.message);
    }
    
    
    const targetHistoryId = historyId || window._currentHistoryId;
    if (targetHistoryId) {
      const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
      const historyItem = pkHistory.find(item => item.id === targetHistoryId);
      if (historyItem && historyItem.sites) {
        const siteItem = historyItem.sites.find(s => s.name === siteName);
        if (siteItem && siteItem.url) {
          console.log(`从History获取 ${siteName} 的 URL:`, siteItem.url);
          return siteItem.url;
        }
      }
    }
    
    
    const srcUrl = iframe.src;
    if (srcUrl && srcUrl !== 'about:blank') {
      console.log(`使用 iframe.src 作为 ${siteName} 的 URL:`, srcUrl);
      return srcUrl;
    }
    
    console.warn(`无法获取 ${siteName} 的 URL`);
    return null;
  } catch (error) {
    console.error(`获取 ${siteName} 的 URL Failed:`, error);
    
    return iframe.src || null;
  }
}


function createSingleIframe(siteName, url, container, query) {
  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'iframe-container';
  
  
  
  const iframe = document.createElement('iframe');
  iframe.className = 'ai-iframe';
  iframe.setAttribute('data-site', siteName);
  
  
  // iframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation';
  
  iframe.allow = 'clipboard-read; clipboard-write; microphone; camera; geolocation; autoplay; fullscreen; picture-in-picture; storage-access; web-share';
  
  
  let clickHandlerAdded = false;
  
  iframe.addEventListener('load', () => {
    if (clickHandlerAdded) return; 
    
    try {
      
      iframe.contentWindow.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
          e.preventDefault();
          window.open(link.href, '_blank');
           console.log("iframe 内Click事件处理Successful")
        }
      });

      
      clickHandlerAdded = true;
    } catch (error) {
      console.log('无法直接添加监听器，将通过 inject.js 处理');
      
      
      if (!clickHandlerAdded) {
        iframe.contentWindow.postMessage({
          type: 'INJECT_CLICK_HANDLER',
          source: 'iframe-parent'
        }, '*');
        clickHandlerAdded = true;
      }
    }
    
    
    if (query) {
      console.log("iframe onload LoadCompleted，查询内容:", query);
      
      
      (async () => {
        const sites = await window.getDefaultSites();
        const site = sites.find(s => s.url === url || url.startsWith(s.url));
        if (site && !site.supportUrlQuery) {
          
          const handler = await getIframeHandler(url);
          if (handler) {
            console.log('Execute动态 iframe 处理函数:', site.name);
            await handler(iframe, query);
          } else {
            console.log('未找到对应的处理函数', site.name);
          }
        }
      })();
    }
    
    
    document.getElementById('searchInput').focus();
  });
  
  
  const messageHandler = (event) => {
    if (event.data.type === 'LINK_CLICK' && event.data.href) {
      window.open(event.data.href, '_blank');
    }
    
    
    if (event.data.type === 'HISTORY_URL_UPDATE' && event.data.source === 'inject-script') {
      
      if (iframe.contentWindow && event.source === iframe.contentWindow) {
        const siteName = event.data.siteName;
        const url = event.data.url;
        const historyId = event.data.historyId || window._currentHistoryId;
        
        if (siteName && url && historyId) {
          console.log(`📝 收到 ${siteName} 的 URL Update: ${url}，History ID: ${historyId}`);
          updateHistorySiteUrl(siteName, url, historyId);
        } else {
          console.warn('History URL Update消息缺少必要参数:', { siteName, url, historyId });
        }
      }
    }
  };
  
  window.removeEventListener('message', messageHandler); 
  window.addEventListener('message', messageHandler);
  
  
  iframe.addEventListener('load', () => {
    const searchInput = document.getElementById('searchInput');
    
    
    iframe.setAttribute('tabindex', '-1');
    
    
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.documentElement.setAttribute('tabindex', '-1');
      doc.body.setAttribute('tabindex', '-1');
      
      
      doc.addEventListener('focus', (e) => {
        e.preventDefault();
        e.stopPropagation();
        searchInput.focus();
      }, true);
    } catch (error) {
      console.log('无法直接访问 iframe 内容，将通过消息通信处理');
      iframe.contentWindow.postMessage({
        type: 'PREVENT_FOCUS',
        source: 'iframe-parent'
      }, '*');
    }
    
    
    setTimeout(() => {
      searchInput.focus();
    }, 100);
  });

  
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'IFRAME') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
  }, true);
  
  if (!query) {
    try {
      const urlObj = new URL(url);
      url = 'https://' + urlObj.hostname;
    } catch (e) {
      console.error('URL解析Failed:', url);
    }
  }
  iframe.src = url;

  
  /*
  iframe.addEventListener('load', () => {
    window.scrollTo(0, 0);
  });*/
  
  
  const header = document.createElement('div');
  header.className = 'iframe-header';
  header.innerHTML = `
    <span class="site-name">${siteName}</span>
    <div class="iframe-controls">
      <button class="open-page-btn" title="在新标签页打开"></button>
      <button class="close-btn"></button>
    </div>
  `;
  
  
  iframe.setAttribute('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  
  iframe.setAttribute('accept-language', 'zh-CN,zh;q=0.9,en;q=0.8');
  iframe.setAttribute('sec-ch-ua', '"Chromium";v="122", "Google Chrome";v="122"');
  iframe.setAttribute('sec-ch-ua-mobile', '?0');
  iframe.setAttribute('sec-ch-ua-platform', '"Macintosh"');
  
  
  
  iframeContainer.appendChild(header);
  iframeContainer.appendChild(iframe);
  container.appendChild(iframeContainer);
  
  
  addFavoriteButtonToIframe(iframeContainer, siteName, false);
  
  
  const openPageBtn = header.querySelector('.open-page-btn');
  const closeBtn = header.querySelector('.close-btn');
  
  
  const openInNewTabTitle = chrome.i18n.getMessage('openInNewTab');
  if (openInNewTabTitle) {
    openPageBtn.title = openInNewTabTitle;
  }
  
  
  openPageBtn.onclick = async (e) => {
    e.stopPropagation();
    
    const historyId = window._currentHistoryId || null;
    const iframeUrl = await getIframeLatestUrl(iframe, siteName, historyId);
    if (iframeUrl) {
      
      chrome.tabs.create({ url: iframeUrl });
    } else {
      console.warn(`无法获取 ${siteName} 的 URL，尝试使用 iframe.src`);
      
      if (iframe.src && iframe.src !== 'about:blank') {
        chrome.tabs.create({ url: iframe.src });
      }
    }
  };
  
  closeBtn.onclick = () => {
    
    iframeContainer.remove();
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      if (item.textContent.trim() === siteName) {
        item.remove();
      }
    });
    
  };

}


export { createIframes }; 



function getHandlerForUrl(url) {
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
      
      
      for (const [domain, handler] of Object.entries(siteHandlers)) {
        if (hostname.includes(domain)) {
          console.log('找到处理函数:', domain);
          console.log('处理函数:', handler);
          return handler;
        }
      }
      
      console.log('未找到对应的处理函数');
      return null;
    } catch (error) {
      console.error('URL 解析Failed:', error, 'URL:', url);
      return null;
    }
  }


async function getIframeHandler(iframeUrl) {
  try {
    
    let domain;
    try {
      const urlObj = new URL(iframeUrl);
      domain = urlObj.hostname;
    } catch (e) {
      console.error('URL解析Failed:', iframeUrl);
      return null;
    }
    
    
    let sites = [];
    try {
      sites = await getDefaultSites();
    } catch (error) {
      console.error('获取SiteConfigFailed:', error);
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
        
        
        if (domain === siteDomain || domain.includes(siteDomain) || siteDomain.includes(domain)) {
          
          return async function(iframe, query, historyId) {
            try {
              
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              
              iframe.contentWindow.postMessage({
                type: 'search',
                query: query,
                domain: domain,
                historyId: historyId || null
              }, '*');
              
              console.log(`已向 ${domain} 发送搜索消息`);
            } catch (error) {
              console.error(`${domain} iframe 处理Failed:`, error);
            }
          };
        }
      } catch (urlError) {
        continue;
      }
    }
    
    console.warn('未找到匹配的SiteConfig:', domain);
    return null;
  } catch (error) {
    console.error('获取 iframe 处理函数Failed:', error);
    return null;
  }
}

document.getElementById('searchButton').addEventListener('click', () => {
  const query = document.getElementById('searchInput').value.trim();
  if (query) {
    const openedSites = getOpenedSites();
    trackEvent('iframe_search_submit', {
      query_length: query.length,
      selected_sites_count: openedSites.length,
      selected_sites: openedSites,
      trigger: 'button'
    });
    shanshuo();
    iframeFresh(query);
  }
});


document.getElementById('searchInput').addEventListener('compositionstart', () => {
    isComposing = true;
    console.log('🎯 输入法组合输入开始');
});

document.getElementById('searchInput').addEventListener('compositionend', () => {
    isComposing = false;
    console.log('🎯 输入法组合输入结束');
});


document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        
        if (isComposing) {
            console.log('🎯 输入法组合输入中，不Trigger查询');
            return; 
        }
        
        e.preventDefault();
        const query = document.getElementById('searchInput').value.trim();
        if (query) {
            const openedSites = getOpenedSites();
            trackEvent('iframe_search_submit', {
                query_length: query.length,
                selected_sites_count: openedSites.length,
                selected_sites: openedSites,
                trigger: 'enter'
            });
            shanshuo();
            iframeFresh(query);
        }
    }
});   


document.getElementById('searchInput').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    showQuerySuggestions(query);
    updateFavoriteButtonVisibility(query);
});


document.getElementById('searchInput').addEventListener('focus', (e) => {
    const query = e.target.value.trim();
    if (query) {
        showQuerySuggestions(query);
    }
});




document.addEventListener('DOMContentLoaded', () => {
    
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        
        const buttonText = chrome.i18n.getMessage('startCompare');
        searchButton.textContent = buttonText;
        
        
        console.log('按钮文案Settings:', {
            当前语言: chrome.i18n.getUILanguage(),
            文案: buttonText
        });
    }
});


async function initializeSiteSettings() {    
    const siteList = document.querySelector('.site-list');
    const saveButton = document.querySelector('.save-settings-btn');
    
    
    saveButton.title = chrome.i18n.getMessage('saveSettingsTitle');
    
    siteList.innerHTML = '';
    
    const openedSites = Array.from(document.querySelectorAll('.ai-iframe'))
        .map(iframe => iframe.getAttribute('data-site'));
    
    try {
        
        const sites = await getDefaultSites();
        
        
        const supportedSites = sites.filter(site => 
            site.supportIframe === true && !site.hidden
        );

        const fragment = document.createDocumentFragment();

        supportedSites.forEach(site => {
            const div = document.createElement('div');
            div.className = 'site-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'site-checkbox';
            checkbox.id = `site-${site.name}`; 
            checkbox.checked = openedSites.includes(site.name);
            
    
            const nameLabel = document.createElement('label');
            nameLabel.textContent = site.name;
            nameLabel.htmlFor = `site-${site.name}`; 
            
            checkbox.addEventListener('change', (e) => {
               console.log("用户Click新建iframe", site.name, site.url);

                if (e.target.checked) {
                    trackEvent('iframe_site_toggle', {
                        site_name: site.name,
                        enabled: true
                    });
                    const container = document.getElementById('iframes-container');
                    if (!container) {
                      console.error('未找到 iframes 容器');
                      return;
                    }
                    createSingleIframe(site.name, site.url, container);
                    
                    const nav = document.querySelector('.nav-list');
                    if (nav) {
                        const navItem = document.createElement('li');
                        navItem.className = 'nav-item';
                        navItem.textContent = site.name;

                        
                        navItem.addEventListener('click', () => {
                            
                            nav.querySelectorAll('li').forEach(item => {
                                item.style.backgroundColor = '';
                                item.classList.remove('active');
                            });
                            
                            
                            navItem.style.backgroundColor = '#e0e0e0';
                            navItem.classList.add('active');
                            
                            
                            const iframeContainer = document.querySelector(`[data-site="${site.name}"]`).closest('.iframe-container');
                            if(iframeContainer) {
                                iframeContainer.scrollIntoView({ behavior: 'smooth' });
                            }
                        });

                        nav.appendChild(navItem);
                    }

                } else {
                    trackEvent('iframe_site_toggle', {
                        site_name: site.name,
                        enabled: false
                    });
                    const iframeToRemove = document.querySelector(`[data-site="${site.name}"]`);
                    if (iframeToRemove) {
                        iframeToRemove.closest('.iframe-container').remove();
                        
                        const navItems = document.querySelectorAll('.nav-item');
                        navItems.forEach(item => {
                          if (item.textContent.trim() === site.name) {
                            item.remove();
                          }
                        });

                    }
                }
            });
            
            div.appendChild(checkbox);
            div.appendChild(nameLabel);
            fragment.appendChild(div);
        });
        
        siteList.appendChild(fragment);
        
        
        saveButton.addEventListener('click', async () => {
            try {
                
                const checkboxes = document.querySelectorAll('.site-checkbox');
                
                
                const { sites: existingUserSettings = {} } = await chrome.storage.sync.get('sites');
                
                
                const updatedUserSettings = { ...existingUserSettings };
                
                
                checkboxes.forEach(checkbox => {
                    
                    const siteName = checkbox.id.replace('site-', '');
                    if (siteName) {
                        
                        if (!updatedUserSettings[siteName]) {
                            updatedUserSettings[siteName] = {};
                        }
                        
                        updatedUserSettings[siteName].enabled = checkbox.checked;
                    }
                });
                
                
                await chrome.storage.sync.set({ sites: updatedUserSettings });
                
                
                showToast(chrome.i18n.getMessage('saveSuccess') || 'Settings已Save');
                
                console.log('SiteSettings已Update:', updatedUserSettings);
                
            } catch (error) {
                console.error('SaveSiteSettingsFailed:', error);
                showToast(chrome.i18n.getMessage('saveFailed') || 'SaveSettingsFailed');
            }
        });
        
    } catch (error) {
        console.error('获取SiteConfigFailed:', error);
        if (siteList) {
            siteList.innerHTML = '<div class="error-message">LoadSiteConfigFailed，请刷新页面重试</div>';
        }
    }
}


function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}


const settingsIcon = document.querySelector('.settings-icon');
const settingsDialog = document.querySelector('.settings-dialog');

if (settingsIcon && settingsDialog) {
    
    settingsIcon.addEventListener('click', async () => {
        try {
            await initializeSiteSettings();
            settingsDialog.style.display = 'block';
        } catch (error) {
            console.error('初始化SiteSettingsFailed:', error);
        }
    });

    
    document.addEventListener('click', (event) => {
        if (!settingsDialog.contains(event.target) && 
            !settingsIcon.contains(event.target)) {
            settingsDialog.style.display = 'none';
        }
    });
}


async function favoriteAllIframes() {
    try {
        const historyId = window._currentHistoryId;
        if (!historyId) {
            console.warn('没有当前History ID，无法Favorites');
            return;
        }
        
        
        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        const historyIndex = pkHistory.findIndex(item => item.id === historyId);
        
        if (historyIndex === -1) {
            console.warn(`未找到History ID: ${historyId}`);
            return;
        }
        
        const historyItem = pkHistory[historyIndex];
        
        
        if (!historyItem.sites) {
            historyItem.sites = [];
        }
        
        
        historyItem.sites.forEach(site => {
            site.isFavorite = true;
        });
        
        
        trackEvent('iframe_favorite_all_iframes', {
            history_id: historyId,
            sites_count: historyItem.sites.length
        });
        
        
        await chrome.storage.local.set({ pkHistory: pkHistory });
        
        
        updateAllIframeFavoriteButtons(true);
        
        console.log('✅ 已Favorites当前记录的所有 iframe');
    } catch (error) {
        console.error('Favorites所有 iframe Failed:', error);
    }
}


function updateAllIframeFavoriteButtons(isFavorite) {
    const favoriteButtons = document.querySelectorAll('.iframe-favorite-btn');
    favoriteButtons.forEach(btn => {
        const icon = btn.querySelector('.iframe-favorite-icon');
        if (icon) {
            icon.src = isFavorite ? '../icons/star_saved.png' : '../icons/star_unsaved.png';
        }
        btn.dataset.favorite = isFavorite ? 'true' : 'false';
        btn.title = isFavorite ? '取消Favorites' : 'Favorites';
    });
}


function addFavoriteButtonToIframe(iframeContainer, siteName, isFavorite = false) {
    
    if (iframeContainer.querySelector('.iframe-favorite-btn')) {
        return;
    }
    
    
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'iframe-favorite-btn';
    favoriteBtn.dataset.siteName = siteName;
    favoriteBtn.dataset.favorite = isFavorite ? 'true' : 'false';
    favoriteBtn.title = isFavorite ? '取消Favorites' : 'Favorites';
    
    const favoriteIcon = document.createElement('img');
    favoriteIcon.className = 'iframe-favorite-icon';
    favoriteIcon.src = isFavorite ? '../icons/star_saved.png' : '../icons/star_unsaved.png';
    favoriteIcon.alt = 'Favorites';
    
    favoriteBtn.appendChild(favoriteIcon);
    
    
    favoriteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await toggleIframeFavorite(siteName, favoriteBtn);
    });
    
    
    iframeContainer.appendChild(favoriteBtn);
}


async function toggleIframeFavorite(siteName, favoriteBtn) {
    try {
        const historyId = window._currentHistoryId;
        if (!historyId) {
            console.warn('没有当前History ID，无法Favorites');
            return;
        }
        
        
        const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
        const historyIndex = pkHistory.findIndex(item => item.id === historyId);
        
        if (historyIndex === -1) {
            console.warn(`未找到History ID: ${historyId}`);
            return;
        }
        
        const historyItem = pkHistory[historyIndex];
        
        
        if (!historyItem.sites) {
            historyItem.sites = [];
        }
        
        
        const siteItem = historyItem.sites.find(s => s.name === siteName);
        if (!siteItem) {
            console.warn(`未找到Site: ${siteName}`);
            return;
        }
        
        
        const currentFavorite = siteItem.isFavorite || false;
        siteItem.isFavorite = !currentFavorite;
        
        
        await chrome.storage.local.set({ pkHistory: pkHistory });
        
        
        const icon = favoriteBtn.querySelector('.iframe-favorite-icon');
        if (icon) {
            icon.src = siteItem.isFavorite ? '../icons/star_saved.png' : '../icons/star_unsaved.png';
        }
        favoriteBtn.dataset.favorite = siteItem.isFavorite ? 'true' : 'false';
        favoriteBtn.title = siteItem.isFavorite ? '取消Favorites' : 'Favorites';
        
        
        trackEvent('iframe_site_favorite_toggle', {
            site_name: siteName,
            is_favorite: siteItem.isFavorite
        });
        
        console.log(`✅ ${siteItem.isFavorite ? '已Favorites' : '已取消Favorites'} iframe: ${siteName}`);
    } catch (error) {
        console.error('切换 iframe Favorites状态Failed:', error);
    }
}


const favoriteIcon = document.querySelector('.favorite-icon');
if (favoriteIcon) {
    
    const favoriteAllSitesTitle = chrome.i18n.getMessage('favoriteAllSites');
    if (favoriteAllSitesTitle) {
        favoriteIcon.title = favoriteAllSitesTitle;
    }
    
    favoriteIcon.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        await favoriteAllIframes();
    });
}


function initializeI18n() {
    
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            if ((element.tagName.toLowerCase() === 'input' && 
                element.type === 'text') || 
                element.tagName.toLowerCase() === 'textarea') {
                
                element.placeholder = message;
            } else if (element.tagName.toLowerCase() === 'button' || 
                       element.tagName.toLowerCase() === 'img') {
                
                element.title = message;
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
      
      window.open(chrome.runtime.getURL('options/options.html#prompt-templates'), '_blank');
    });

    
    querySuggestions.appendChild(settingsIcon);

    
    querySuggestions.style.display = 'flex';
    
  } catch (error) {
    console.error('Load提示词模板Failed:', error);
    
    querySuggestions.style.display = 'none';
  }
}



function shakeToggleIcon() {
  const toggleIcon = document.getElementById('toggleIcon');
  if (toggleIcon) {
    
    toggleIcon.classList.add('toggle-icon-shake');
    
    
    setTimeout(() => {
      toggleIcon.classList.remove('toggle-icon-shake');
    }, 500); 
  }
}


document.getElementById('favoriteButton').addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleFavorite();
  
  shakeToggleIcon();
});


document.getElementById('toggleIcon').addEventListener('click', () => {
  const queryList = document.getElementById('queryList');
  if (queryList.style.display === 'none') {
      
       const toggleIcon = document.getElementById('toggleIcon');
       toggleIcon.src = '../icons/up.png'; 
      queryList.style.display = 'block'; 
      
      
      showFavorites();
  } else {
      queryList.style.display = 'none'; 
      document.getElementById('toggleIcon').src = '../icons/down.png'; 
  }
});


document.addEventListener('click', (e) => {
  const queryList = document.getElementById('queryList');
  const toggleIcon = document.getElementById('toggleIcon');
  const favoriteIconContainer = document.querySelector('.favorite-icon-container');
  
  
  if (queryList && queryList.style.display === 'block') {
    
    const isClickInsideFavorites = queryList.contains(e.target);
    const isClickOnToggleIcon = toggleIcon && toggleIcon.contains(e.target);
    const isClickOnFavoriteIcon = favoriteIconContainer && favoriteIconContainer.contains(e.target);
    
    
    if (!isClickInsideFavorites && !isClickOnToggleIcon && !isClickOnFavoriteIcon) {
      
      queryList.style.display = 'none';
      
      if (toggleIcon) {
        toggleIcon.src = '../icons/down.png';
      }
    }
  }
});



function shanshuo() {
  
  const searchButton = document.getElementById('searchButton');
      searchButton.classList.add('active');
      
      
      setTimeout(() => {
          searchButton.classList.remove('active');
      }, 200);
}



async function iframeFresh(query) {    
      
      
      let historyId = null;
      try {
        historyId = await savePKHistory(query);
      } catch (error) {
        console.error('立即Save PK HistoryFailed（将继续Execute PK）:', error);
      }
        
      
      const iframes = document.querySelectorAll('iframe');
          
     
      let sites = [];
      try {
        sites = await getDefaultSites();
      } catch (error) {
        console.error('getDefaultSites 获取Failed（将继续Execute PK）:', error);
        sites = [];
      }

        
      iframes.forEach(iframe => {
        try {
            
            const url = new URL(iframe.src);
            const domain = url.hostname;
            console.log('当前iframe网站hostname:', domain);
            
            const siteName = iframe.getAttribute('data-site');

            const siteConfig = sites.find(site => site.name === siteName);
            
            if (siteConfig && siteConfig.supportUrlQuery) {
                
                const url = siteConfig.url;
                
                const newUrl = url.replace('{query}', encodeURIComponent(query));
                console.log(`为 ${siteName} iframe 生成新的 URL: ${newUrl}`);
                
                if (historyId) {
                  const onLoadSendHistoryContext = () => {
                    try {
                      iframe.removeEventListener('load', onLoadSendHistoryContext);
                      iframe.contentWindow?.postMessage({
                        type: 'SET_HISTORY_CONTEXT',
                        historyId,
                        siteName
                      }, '*');
                    } catch (e) {
                      // ignore
                    }
                  };
                  iframe.addEventListener('load', onLoadSendHistoryContext);
                }
                
                iframe.src = newUrl;
            }
            else{
              
              getIframeHandler(iframe.src).then(handler => {
                if (handler) {
                  console.log(`重新处理 ${domain} iframe`, {
                      时间: new Date().toISOString(),
                      query: query
                  });
                  
                  if (historyId) {
                    try {
                      iframe.contentWindow?.postMessage({
                        type: 'SET_HISTORY_CONTEXT',
                        historyId,
                        siteName
                      }, '*');
                    } catch (e) {
                      // ignore
                    }
                  }
                  
                  handler(iframe, query, historyId);
                } else {
                  console.log('没有找到处理函数');
                }
              }).catch(error => {
                console.error('获取处理函数Failed:', error);
              });
          }
        } catch (error) {
            console.error('处理 iframe Failed:', error);
        }
    });
}




async function loadHistoryIframes(sites) {
  try {
    const container = document.getElementById('iframes-container');
    if (!container) {
      console.error('未找到 iframes 容器');
      return;
    }
    
    
    container.innerHTML = '';
    
    
    const existingNav = document.querySelector('.nav');
    if (existingNav) {
      existingNav.remove();
    }
    
    
    container.style.marginLeft = '72px';
    
    
    sites.forEach(site => {
      const siteName = site.name;
      const url = site.url; 
      
      
      if (site.isFavorite === undefined) {
        site.isFavorite = false;
      }
      
      console.log('从History创建 iframe:', siteName, url);
      
      
      const iframeContainer = document.createElement('div');
      iframeContainer.className = 'iframe-container';
      
      const iframe = document.createElement('iframe');
      iframe.className = 'ai-iframe';
      iframe.setAttribute('data-site', siteName);
      iframe.allow = 'clipboard-read; clipboard-write; microphone; camera; geolocation; autoplay; fullscreen; picture-in-picture; storage-access; web-share';
      iframe.src = url; 
      
      
      const header = document.createElement('div');
      header.className = 'iframe-header';
      header.innerHTML = `
        <span class="site-name">${siteName}</span>
        <div class="iframe-controls">
          <button class="open-page-btn" title="在新标签页打开"></button>
          <button class="close-btn"></button>
        </div>
      `;
      
      
      const openPageBtn = header.querySelector('.open-page-btn');
      const closeBtn = header.querySelector('.close-btn');
      
      
      const openInNewTabTitle = chrome.i18n.getMessage('openInNewTab');
      if (openInNewTabTitle) {
        openPageBtn.title = openInNewTabTitle;
      }
      
      
      openPageBtn.onclick = async (e) => {
        e.stopPropagation();
        
        const historyId = window._currentHistoryId || null;
        const iframeUrl = await getIframeLatestUrl(iframe, siteName, historyId);
        if (iframeUrl) {
          
          chrome.tabs.create({ url: iframeUrl });
        } else {
          console.warn(`无法获取 ${siteName} 的 URL，尝试使用 iframe.src`);
          
          if (iframe.src && iframe.src !== 'about:blank') {
            chrome.tabs.create({ url: iframe.src });
          }
        }
      };
      
      
      closeBtn.onclick = () => {
        iframeContainer.remove();
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
          if (item.textContent.trim() === siteName) {
            item.remove();
          }
        });
      };
      
      
      iframeContainer.appendChild(header);
      iframeContainer.appendChild(iframe);
      container.appendChild(iframeContainer);
      
      
      const isFavorite = site.isFavorite || false;
      addFavoriteButtonToIframe(iframeContainer, siteName, isFavorite);
    });
    
    
    const nav = document.createElement('nav');
    nav.className = 'nav';
    
    const navList = document.createElement('ul');
    navList.className = 'nav-list';
    
    sites.forEach((site, index) => {
      const navItem = document.createElement('li');
      navItem.className = 'nav-item';
      navItem.textContent = site.name;
      navItem.dataset.siteName = site.name;
      navItem.dataset.originalIndex = index;
      
      
      navItem.addEventListener('click', () => {
        navList.querySelectorAll('li').forEach(item => {
          item.style.backgroundColor = '';
          item.classList.remove('active');
        });
        
        navItem.style.backgroundColor = '#e0e0e0';
        navItem.classList.add('active');
        
        const iframes = container.querySelectorAll('.iframe-container');
        if (iframes[index]) {
          iframes[index].scrollIntoView({ behavior: 'smooth' });
        }
      });
      
      navList.appendChild(navItem);
    });
    
    nav.appendChild(navList);
    document.body.insertBefore(nav, container);
    
    
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    if (query) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = query;
      }
    }
    
  } catch (error) {
    console.error('LoadHistory iframe Failed:', error);
  }
}


async function isHistoryDuplicate(newItem, existingItem) {
  try {
    
    if (newItem.query.trim() !== existingItem.query.trim()) {
      return false;
    }
    
    
    let siteConfigs = [];
    try {
      if (window.getDefaultSites) {
        siteConfigs = await window.getDefaultSites();
      } else if (window.siteDetector) {
        
        siteConfigs = await window.siteDetector.getSites();
      }
    } catch (error) {
      console.warn('获取SiteConfigFailed，跳过 urlFeature 对比:', error);
      return false;
    }
    
    
    const newSites = newItem.sites || [];
    const existingSites = existingItem.sites || [];
    
    
    if (newSites.length !== existingSites.length) {
      return false;
    }
    
    
    for (const newSite of newSites) {
      const existingSite = existingSites.find(s => s.name === newSite.name);
      if (!existingSite) {
        return false; 
      }
      
      
      const siteConfig = siteConfigs.find(s => s.name === newSite.name);
      if (siteConfig && siteConfig.historyHandler && siteConfig.historyHandler.urlFeature) {
        
        const urlFeature = siteConfig.historyHandler.urlFeature;
        
        
        let newPathname = '';
        let existingPathname = '';
        
        try {
          if (newSite.url) {
            const newUrlObj = new URL(newSite.url);
            newPathname = newUrlObj.pathname;
          }
        } catch (e) {
          
        }
        
        try {
          if (existingSite.url) {
            const existingUrlObj = new URL(existingSite.url);
            existingPathname = existingUrlObj.pathname;
          }
        } catch (e) {
          
        }
        
        
        if (newPathname && existingPathname) {
          const newHasFeature = newPathname.includes(urlFeature);
          const existingHasFeature = existingPathname.includes(urlFeature);
          
          
          if (newHasFeature && existingHasFeature) {
            continue; 
          }
          
          
          if (!newHasFeature && !existingHasFeature) {
            continue; 
          }
          
          
          return false;
        } else if (!newPathname && !existingPathname) {
          
          continue;
        } else {
          
          return false;
        }
      } else {
        
        
        continue;
      }
    }
    
    
    return true;
  } catch (error) {
    console.error('CheckHistory重复Failed:', error);
    return false;
  }
}


async function savePKHistory(query) {
  try {
    if (!query || query.trim() === '') {
      return null; 
    }
    
    
    const iframes = document.querySelectorAll('.ai-iframe');
    if (iframes.length === 0) {
      return null; 
    }
    
    
    let siteConfigs = [];
    try {
      if (window.getDefaultSites) {
        siteConfigs = await window.getDefaultSites();
      } else if (window.siteDetector) {
        siteConfigs = await window.siteDetector.getSites();
      }
    } catch (error) {
      console.warn('获取SiteConfigFailed:', error);
    }
    
    
    
    const sites = [];
    for (const iframe of iframes) {
      const siteName = iframe.getAttribute('data-site');
      if (siteName) {
        
        const url = await getIframeLatestUrl(iframe, siteName);
        
        
        const siteConfig = siteConfigs.find(s => s.name === siteName);
        
        
        if (siteConfig && siteConfig.historyHandler && siteConfig.historyHandler.urlFeature) {
          const urlFeature = siteConfig.historyHandler.urlFeature;
          
          
          if (url) {
            try {
              const urlObj = new URL(url);
              const pathname = urlObj.pathname;
              
              
              if (!pathname.includes(urlFeature)) {
                console.log(`⚠️ ${siteName} 的 URL 不包含 urlFeature "${urlFeature}"，不Save该 URL（Wait后续Update）: ${url}`);
                sites.push({
                  name: siteName,
                  url: '', 
                  isFavorite: false
                });
                continue;
              }
            } catch (e) {
              console.warn(`解析 ${siteName} 的 URL Failed: ${url}`, e);
              
              sites.push({
                name: siteName,
                url: '',
                isFavorite: false
              });
              continue;
            }
          } else {
            
            sites.push({
              name: siteName,
              url: '',
              isFavorite: false
            });
            continue;
          }
        }
        
        
        sites.push({
          name: siteName,
          url: url || '', 
          isFavorite: false
        });
      }
    }
    
    if (sites.length === 0) {
      return null; 
    }
    
    
    let historyId = Date.now().toString();
    const historyItem = {
      id: historyId,
      query: query.trim(),
      sites: sites, 
      timestamp: Date.now(),
      date: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    
    
    const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
    
    
    let existingHistoryId = null;
    for (const existingItem of pkHistory) {
      const isDuplicate = await isHistoryDuplicate(historyItem, existingItem);
      if (isDuplicate) {
        existingHistoryId = existingItem.id;
        console.log('发现重复的History，将Update现有记录:', existingItem.id);
        break;
      }
    }
    
    let updatedHistory;
    if (existingHistoryId) {
      
      updatedHistory = pkHistory.map(item => {
        if (item.id === existingHistoryId) {
          
          return {
            ...item,
            timestamp: Date.now(),
            date: new Date().toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }),
            
            sites: item.sites.map(existingSite => {
              const newSite = historyItem.sites.find(s => s.name === existingSite.name);
              if (newSite && newSite.url && (!existingSite.url || existingSite.url === '')) {
                return { ...existingSite, url: newSite.url };
              }
              return existingSite;
            })
          };
        }
        return item;
      });
      
      const updatedItem = updatedHistory.find(item => item.id === existingHistoryId);
      updatedHistory = updatedHistory.filter(item => item.id !== existingHistoryId);
      updatedHistory = [updatedItem, ...updatedHistory];
      historyId = existingHistoryId; 
    } else {
      
      updatedHistory = [historyItem, ...pkHistory];
    }
    
    
    let maxHistory = 100; 
    try {
      if (window.AppConfigManager) {
        const appConfig = await window.AppConfigManager.loadConfig();
        if (appConfig && appConfig.history && appConfig.history.maxCount) {
          maxHistory = appConfig.history.maxCount;
        }
      }
    } catch (error) {
      console.warn('读取History数量ConfigFailed，使用默认值 100:', error);
    }
    const limitedHistory = updatedHistory.slice(0, maxHistory);
    
    
    await chrome.storage.local.set({ pkHistory: limitedHistory });
    
    
    window._currentHistoryId = historyId;
    
    if (existingHistoryId) {
      console.log('PK History已Update（待 iframe Update URL）:', historyItem);
    } else {
      console.log('PK History已创建（待 iframe Update URL）:', historyItem);
    }
    return historyId;
  } catch (error) {
    console.error('Save PK HistoryFailed:', error);
    return null;
  }
}


async function updateHistorySiteUrl(siteName, url, historyId) {
  try {
    
    let siteConfigs = [];
    try {
      if (window.getDefaultSites) {
        siteConfigs = await window.getDefaultSites();
      } else if (window.siteDetector) {
        siteConfigs = await window.siteDetector.getSites();
      }
    } catch (error) {
      console.warn('获取SiteConfigFailed:', error);
    }
    
    
    const siteConfig = siteConfigs.find(s => s.name === siteName);
    
    
    if (siteConfig && siteConfig.historyHandler && siteConfig.historyHandler.urlFeature) {
      const urlFeature = siteConfig.historyHandler.urlFeature;
      
      if (!url) {
        
        console.log(`⚠️ ${siteName} Config了 urlFeature "${urlFeature}" 但 URL 为空，不UpdateHistory`);
        return;
      }
      
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        
        if (!pathname.includes(urlFeature)) {
          console.log(`⚠️ ${siteName} 的 URL 不包含 urlFeature "${urlFeature}"，不UpdateHistory: ${url}`);
          return;
        }
      } catch (e) {
        console.warn(`解析 ${siteName} 的 URL Failed: ${url}`, e);
        
        return;
      }
    }
    
    
    const { pkHistory = [] } = await chrome.storage.local.get('pkHistory');
    
    
    const historyIndex = pkHistory.findIndex(item => item.id === historyId);
    if (historyIndex === -1) {
      console.warn(`未找到History ID: ${historyId}`);
      return;
    }
    
    const historyItem = pkHistory[historyIndex];
    
    
    if (!historyItem.sites) {
      historyItem.sites = [];
    }
    
    
    let siteItem = historyItem.sites.find(s => s.name === siteName);
    if (siteItem) {
      
      siteItem.url = url;
      
      if (siteItem.isFavorite === undefined) {
        siteItem.isFavorite = false;
      }
    } else {
      
      siteItem = { name: siteName, url: url, isFavorite: false };
      historyItem.sites.push(siteItem);
    }
    
    
    
    let hasValidUrl = false;
    for (const site of historyItem.sites) {
      const siteCfg = siteConfigs.find(s => s.name === site.name);
      if (siteCfg && siteCfg.historyHandler && siteCfg.historyHandler.urlFeature) {
        const urlFeature = siteCfg.historyHandler.urlFeature;
        if (site.url) {
          try {
            const urlObj = new URL(site.url);
            if (urlObj.pathname.includes(urlFeature)) {
              hasValidUrl = true;
              break;
            }
          } catch (e) {
            
          }
        }
      } else {
        
        hasValidUrl = true;
        break;
      }
    }
    
    
    if (!hasValidUrl && historyItem.sites.length > 0) {
      
      const allSitesHaveUrlFeature = historyItem.sites.every(site => {
        const siteCfg = siteConfigs.find(s => s.name === site.name);
        return siteCfg && siteCfg.historyHandler && siteCfg.historyHandler.urlFeature;
      });
      
      if (allSitesHaveUrlFeature) {
        
        pkHistory.splice(historyIndex, 1);
        console.log(`🗑️ History ${historyId} 的所有Site URL 都不包含 urlFeature，删除整条记录`);
        await chrome.storage.local.set({ pkHistory: pkHistory });
        return;
      }
    }
    
    
    await chrome.storage.local.set({ pkHistory: pkHistory });
    
    console.log(`✅ UpdateHistory ${historyId} 中 ${siteName} 的 URL:`, url);
  } catch (error) {
    console.error('UpdateHistorySite URL Failed:', error);
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  initializeI18n();
  await initializeFavorites();
  checkForSiteConfigUpdates();
  
  
  checkClipboardPermissionStatus();
  
  
});



async function checkClipboardPermissionStatus() {
  try {
    
    if (!navigator.clipboard) {
      console.log('❌ 浏览器不支持剪贴板API');
      return;
    }
    
    const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' });
    console.log('剪贴板权限状态:', permissionStatus.state);
    
    
    if (permissionStatus.state === 'denied') {
      console.log('❌ 剪贴板权限被拒绝，文件粘贴功能将不可用');
      
      setTimeout(() => {
        showClipboardDeniedMessage();
      }, 3000);
    } else if (permissionStatus.state === 'granted') {
      console.log('✅ 剪贴板权限已授予');
    } else {
      console.log('🔄 剪贴板权限状态: prompt，将在用户粘贴时请求');
    }
  } catch (error) {
    console.log('❌ Check剪贴板权限Failed:', error);
  }
}


function showClipboardDeniedMessage() {
  const message = document.createElement('div');
  message.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #f44336;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
    text-align: center;
  `;
  
  message.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <span>🚫</span>
      <span style="font-weight: 600;">剪贴板权限被拒绝</span>
    </div>
    <div style="font-size: 12px; opacity: 0.9;">
      请在浏览器Settings中允许剪贴板访问权限，或Click地址栏左侧的锁图标进行Settings
    </div>
  `;
  
  document.body.appendChild(message);
  
  
  setTimeout(() => {
    if (message.parentNode) {
      message.remove();
    }
  }, 5000);
}



async function checkForSiteConfigUpdates() {
  try {
    if (window.RemoteConfigManager) {
      
      const { siteConfigVersion, lastUpdateTime, updateNotificationShown } = await chrome.storage.local.get(['siteConfigVersion', 'lastUpdateTime', 'updateNotificationShown']);
      
      
      if (lastUpdateTime && !updateNotificationShown) {
        console.log('检测到ConfigUpdate，显示提示');
        showUpdateNotification();
        
        await chrome.storage.local.set({ updateNotificationShown: true });
        return;
      }
      
      
      const updateInfo = await window.RemoteConfigManager.autoCheckUpdate();
      if (updateInfo && updateInfo.hasUpdate) {
        console.log('发现新版本SiteConfig，自动Update');
        
        await window.RemoteConfigManager.updateLocalConfig(updateInfo.config);
        
        showUpdateNotification();
      }
    }
  } catch (error) {
    console.error('CheckSiteConfigUpdateFailed:', error);
  }
}


async function showUpdateNotification() {
  try {
    
    const { siteConfigVersion, lastUpdateTime, updateHistory } = await chrome.storage.local.get(['siteConfigVersion', 'lastUpdateTime', 'updateHistory']);
    
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
      background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    z-index: 10000;
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
      line-height: 1.5;
    cursor: pointer;
      border: 1px solid rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
      animation: slideInRight 0.3s ease-out;
    `;
    
    
    const formatUpdateTime = (timestamp) => {
      if (!timestamp) return '刚刚';
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (minutes < 1) return '刚刚';
      if (minutes < 60) return `${minutes}分钟前`;
      if (hours < 24) return `${hours}小时前`;
      return `${days}天前`;
    };
    
    
    let updateInfo = '';
    if (updateHistory && updateHistory.length > 0) {
      const latestUpdate = updateHistory[updateHistory.length - 1];
      updateInfo = `
        <div style="font-size: 12px; opacity: 0.9; margin-top: 8px;">
          <div>V ${latestUpdate.version || siteConfigVersion || '未知'}</div>
          <div>${formatUpdateTime(latestUpdate.timestamp || lastUpdateTime)}</div>
          ${latestUpdate.newSites ? `<div>新增Site: ${latestUpdate.newSites}个</div>` : ''}
          ${latestUpdate.updatedSites ? `<div>UpdateSite: ${latestUpdate.updatedSites}个</div>` : ''}
        </div>
      `;
    } else {
      updateInfo = `
        <div style="font-size: 12px; opacity: 0.9; margin-top: 8px;">
          <div>V ${siteConfigVersion || '未知'}</div>
          <div>${formatUpdateTime(lastUpdateTime)}</div>
        </div>
      `;
    }
  
  notification.innerHTML = `
     
      <div style="font-size: 13px; opacity: 0.95; margin-bottom: 8px;">
        🆕AISite处理规则已自动Update到最新版本
      </div>
      ${updateInfo}
      <div style="font-size: 11px; opacity: 0.8; margin-top: 12px; text-align: center; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
        🔎
      </div>
    `;
    
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    
    
  notification.addEventListener('click', () => {
      showDetailedUpdateInfo();
    notification.remove();
      style.remove();
    });
    
    
    notification.addEventListener('mouseenter', () => {
      notification.style.transform = 'translateY(-2px)';
      notification.style.boxShadow = '0 8px 25px rgba(0,0,0,0.4)';
    });
    
    notification.addEventListener('mouseleave', () => {
      notification.style.transform = 'translateY(0)';
      notification.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
  });
  
  document.body.appendChild(notification);
  
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
            style.remove();
          }
        }, 300);
      }
    }, 10000);
    
  } catch (error) {
    console.error('显示Update通知Failed:', error);
    
    showToast('Config已Update，但无法显示详细信息');
  }
}


async function showDetailedUpdateInfo() {
  try {
    const { updateHistory, siteConfigVersion, lastUpdateTime } = await chrome.storage.local.get(['updateHistory', 'siteConfigVersion', 'lastUpdateTime']);
    
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease-out;
    `;
    
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideInUp 0.3s ease-out;
    `;
    
    
    const formatTime = (timestamp) => {
      if (!timestamp) return chrome.i18n.getMessage('unknownTime');
      const date = new Date(timestamp);
      return date.toLocaleString(chrome.i18n.getUILanguage(), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };
    
    
    let historyContent = '';
    if (updateHistory && updateHistory.length > 0) {
      
      const uniqueHistory = updateHistory.filter((update, index, arr) => {
        
        if (index === arr.length - 1 && update.version === siteConfigVersion) {
          return false;
        }
        return true;
      });
      
      historyContent = uniqueHistory.slice(-5).reverse().map((update, index) => `
        <div style="padding: 12px; border-left: 3px solid #4CAF50; margin-bottom: 12px; background: #f8f9fa; border-radius: 0 8px 8px 0;">
          <div style="font-weight: 600; color: #333; margin-bottom: 4px;">
            V${update.version} - ${formatTime(update.timestamp)}
          </div>
          <div style="font-size: 13px; color: #666;">
            ${(() => {
              const parts = [];
              if (update.newSites > 0) {
                parts.push(chrome.i18n.getMessage('newSitesCount', [update.newSites]));
              }
              if (update.updatedSites > 0) {
                parts.push(chrome.i18n.getMessage('updatedSitesCount', [update.updatedSites]));
              }
              if (update.totalSites > 0) {
                parts.push(chrome.i18n.getMessage('totalSitesCount', [update.totalSites]));
              }
              return parts.join('，');
            })()}
          </div>
        </div>
      `).join('');
      
      
      if (historyContent === '') {
        historyContent = `
          <div style="padding: 20px; text-align: center; color: #666;">
            <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
            <div>${chrome.i18n.getMessage('noUpdateHistory')}</div>
          </div>
        `;
      }
    } else {
      historyContent = `
        <div style="padding: 20px; text-align: center; color: #666;">
          <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
          <div>${chrome.i18n.getMessage('noUpdateHistory')}</div>
        </div>
      `;
    }
    
    modal.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; color: #333; font-size: 16px; font-weight: 600;">📈 ${chrome.i18n.getMessage('recentUpdateRecords')}</h3>
          <button id="closeModal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;">
            ×
          </button>
        </div>
        <div style="max-height: 300px; overflow-y: auto;">
          ${historyContent}
        </div>
      </div>
      
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="viewGitHub" style="background: #f5f5f5; border: 1px solid #ddd; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; color: #333; transition: all 0.2s;">
          📖 ${chrome.i18n.getMessage('participateAISiteRuleDev')}
        </button>
        <button id="refreshConfig" style="background: #f5f5f5; border: 1px solid #ddd; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; color: #333; transition: all 0.2s;">
          🔄 ${chrome.i18n.getMessage('checkUpdates')}
        </button>
      </div>
    `;
    
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideInUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    
    const closeModal = () => {
      overlay.style.animation = 'fadeIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (overlay.parentElement) {
          overlay.remove();
          style.remove();
        }
      }, 300);
    };
    
    
    modal.querySelector('#closeModal').addEventListener('click', closeModal);
    
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
    
    
    modal.querySelector('#viewGitHub').addEventListener('click', () => {
      window.open('https://github.com/taoAIGC/AI-Shortcuts/blob/main/config/siteHandlers.json', '_blank');
    });
    
    
    modal.querySelector('#refreshConfig').addEventListener('click', async () => {
      const button = modal.querySelector('#refreshConfig');
      const originalText = button.textContent;
      button.textContent = '🔄 Check中...';
      button.disabled = true;
      
      try {
        if (window.RemoteConfigManager) {
          const updateInfo = await window.RemoteConfigManager.autoCheckUpdate();
          if (updateInfo && updateInfo.hasUpdate) {
            await window.RemoteConfigManager.updateLocalConfig(updateInfo.config);
            showToast('Config已Update到最新版本！');
            closeModal();
            
            setTimeout(() => showUpdateNotification(), 500);
          } else {
            showToast('已是最新版本');
          }
        } else {
          showToast('UpdateCheck功能不可用');
        }
      } catch (error) {
        console.error('CheckUpdateFailed:', error);
        showToast('CheckUpdateFailed');
      } finally {
        button.textContent = originalText;
        button.disabled = false;
      }
    });
    
    
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
  } catch (error) {
    console.error('显示详细Update信息Failed:', error);
    showToast('显示Update信息Failed');
  }
}



let favoritePrompts = [];


async function initializeFavorites() {
  try {
    const { favoritePrompts: savedFavorites = [] } = await chrome.storage.sync.get('favoritePrompts');
    favoritePrompts = savedFavorites;
    console.log('Load的Favorites提示词:', favoritePrompts);
  } catch (error) {
    console.error('LoadFavorites提示词Failed:', error);
  }
}


function updateFavoriteButtonVisibility(query) {
  const favoriteButton = document.getElementById('favoriteButton');
  const favoriteIcon = document.getElementById('favoriteIcon');
  
  if (query) {
    favoriteButton.style.display = 'block';
    
    const isFavorited = favoritePrompts.includes(query);
    favoriteIcon.src = isFavorited ? '../icons/star_saved.png' : '../icons/star_unsaved.png';
  } else {
    favoriteButton.style.display = 'none';
  }
}


async function toggleFavorite() {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput.value.trim();
  const favoriteIcon = document.getElementById('favoriteIcon');
  
  if (!query) return;
  
  try {
    const index = favoritePrompts.indexOf(query);
    
    if (index > -1) {
      
      favoritePrompts.splice(index, 1);
      favoriteIcon.src = '../icons/star_unsaved.png';
      console.log('取消Favorites:', query);
      
      trackEvent('iframe_prompt_favorite_toggle', {
        query_length: query.length,
        is_favorite: false
      });
    } else {
      
      favoritePrompts.push(query);
      favoriteIcon.src = '../icons/star_saved.png';
      console.log('添加Favorites:', query);
      
      trackEvent('iframe_prompt_favorite_toggle', {
        query_length: query.length,
        is_favorite: true
      });
    }
    
    
    await chrome.storage.sync.set({ favoritePrompts: favoritePrompts });
    console.log('Favorites列表已Update:', favoritePrompts);
    
  } catch (error) {
    console.error('SaveFavoritesFailed:', error);
  }
}


function showFavorites() {
  const queryList = document.getElementById('queryList');
  
  if (favoritePrompts.length === 0) {
    const favoritesTitle = chrome.i18n.getMessage('favoritesTitle');
    const noFavoritesMessage = chrome.i18n.getMessage('noFavorites');
    queryList.innerHTML = `<div class="favorites-section"><div class="favorites-title">${favoritesTitle}</div><div style="padding: 10px; color: #666; text-align: center;">${noFavoritesMessage}</div></div>`;
  } else {
    const favoritesTitle = chrome.i18n.getMessage('favoritesTitle');
    let html = `<div class="favorites-section"><div class="favorites-title">${favoritesTitle}</div>`;
    
    favoritePrompts.forEach((prompt, index) => {
      html += `
        <div class="favorite-item" data-prompt="${prompt.replace(/"/g, '&quot;')}" data-index="${index}">
          <div class="favorite-item-content">${prompt}</div>
          <div class="favorite-item-actions">
          
           <!--
            <button class="favorite-item-edit" title="编辑">
              <img src="../icons/edit.png" alt="编辑">
            </button>
            -->

            <button class="favorite-item-delete" title="删除">
              <img src="../icons/close.png" alt="删除">
            </button>
           
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    queryList.innerHTML = html;
    
    
    queryList.querySelectorAll('.favorite-item').forEach(item => {
      const content = item.querySelector('.favorite-item-content');
      const editBtn = item.querySelector('.favorite-item-edit');
      const deleteBtn = item.querySelector('.favorite-item-delete');
      
      
      content.addEventListener('click', (e) => {
        e.stopPropagation();
        const prompt = item.getAttribute('data-prompt');
        document.getElementById('searchInput').value = prompt;
        queryList.style.display = 'none';
        document.getElementById('toggleIcon').src = '../icons/down.png';
        
        
        updateFavoriteButtonVisibility(prompt);

        
        trackEvent('iframe_prompt_favorite_select', {
          query_length: prompt.length
        });
      });
      
      
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          editFavoriteItem(item);
        });
      }
      
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log('删除按钮被Click');
          deleteFavoriteItem(item);
        });
      }
    });
  }
  
  
  trackEvent('iframe_prompt_favorites_open', {
    favorites_count: favoritePrompts.length
  });

  queryList.style.display = 'block';
}


function editFavoriteItem(item) {
  console.log('进入编辑Favorites项');
  
  try {
    const prompt = item.getAttribute('data-prompt');
    trackEvent('iframe_prompt_favorite_edit_click', {
      query_length: prompt ? prompt.length : 0
    });
  } catch (e) {
    
    console.warn('记录编辑Favorites埋点Failed:', e);
  }
  showToast('coming soon');
}


async function deleteFavoriteItem(item) {
  console.log('deleteFavoriteItem 函数被调用');
  const index = parseInt(item.getAttribute('data-index'));
  const prompt = item.getAttribute('data-prompt');
  console.log('删除索引:', index, '提示词:', prompt);
  
  const deleteConfirmMessage = chrome.i18n.getMessage('deleteConfirm');
  if (confirm(deleteConfirmMessage)) {
    try {
      
      favoritePrompts.splice(index, 1);
      
      
      await chrome.storage.sync.set({ favoritePrompts: favoritePrompts });
      
      
      showFavorites();
      
      console.log('删除Favorites提示词:', prompt);
      
      trackEvent('iframe_prompt_favorite_delete', {
        query_length: prompt ? prompt.length : 0
      });
    } catch (error) {
      console.error('删除FavoritesFailed:', error);
    }
  }
}


function addDragAndDropToNavList(navList, enabledSites) {
  let draggedElement = null;
  let draggedIndex = null;

  
  navList.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('nav-item')) {
      draggedElement = e.target;
      draggedIndex = Array.from(navList.children).indexOf(e.target);
      e.target.classList.add('dragging');
      navList.classList.add('drag-active');
      
      
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', e.target.outerHTML);
    }
  });

  
  navList.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('nav-item')) {
      e.target.classList.remove('dragging');
      navList.classList.remove('drag-active');
      
      
      navList.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('drag-over');
      });
      
      draggedElement = null;
      draggedIndex = null;
    }
  });

  
  navList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = getDragAfterElement(navList, e.clientY);
    const dragging = navList.querySelector('.dragging');
    
    if (afterElement == null) {
      navList.appendChild(dragging);
    } else {
      navList.insertBefore(dragging, afterElement);
    }
  });

  
  navList.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (e.target.classList.contains('nav-item') && e.target !== draggedElement) {
      e.target.classList.add('drag-over');
    }
  });

  
  navList.addEventListener('dragleave', (e) => {
    if (e.target.classList.contains('nav-item')) {
      e.target.classList.remove('drag-over');
    }
  });

  
  navList.addEventListener('drop', async (e) => {
    e.preventDefault();
    
    if (draggedElement) {
      const newIndex = Array.from(navList.children).indexOf(draggedElement);
      
      if (newIndex !== draggedIndex) {
        
        await updateSitesOrder(enabledSites, draggedIndex, newIndex);
        
        
        await reorderIframes(draggedIndex, newIndex);
        
        console.log('导航项顺序已Update');
      }
    }
  });
}


function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.nav-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}


async function updateSitesOrder(enabledSites, fromIndex, toIndex) {
  
  const movedSite = enabledSites.splice(fromIndex, 1)[0];
  enabledSites.splice(toIndex, 0, movedSite);
  
  try {
    
    const { sites: existingUserSettings = {} } = await chrome.storage.sync.get('sites');
    
    
    const updatedUserSettings = { ...existingUserSettings };
    enabledSites.forEach((site, index) => {
      if (!updatedUserSettings[site.name]) {
        updatedUserSettings[site.name] = {};
      }
      updatedUserSettings[site.name].order = index;
    });
    
    
    await chrome.storage.sync.set({ sites: updatedUserSettings });
    
    console.log('iframe侧边栏Site顺序已Save到 sync 存储');
  } catch (error) {
    console.error('SaveSite顺序Failed:', error);
  }
}


async function reorderIframes(fromIndex, toIndex) {
  const container = document.getElementById('iframes-container');
  const iframeContainers = Array.from(container.querySelectorAll('.iframe-container'));
  
  if (iframeContainers.length > 0) {
    
    const navList = document.querySelector('.nav-list');
    const navItems = Array.from(navList.children);
    
    
    navItems.forEach((navItem, index) => {
      const siteName = navItem.textContent;
      const iframeContainer = iframeContainers.find(container => {
        const iframe = container.querySelector('iframe');
        return iframe && iframe.getAttribute('data-site') === siteName;
      });
      
      if (iframeContainer) {
        
        iframeContainer.style.order = index;
      }
    });
    
    
    
    console.log('iframe顺序已Update，使用CSS order属性');
  }
}


function initializeFileUpload() {
  const fileUploadButton = document.getElementById('fileUploadButton');
  const fileInput = document.getElementById('fileInput');
  
  if (!fileUploadButton || !fileInput) {
    console.warn('文件上传元素未找到');
    return;
  }
  
  
  fileUploadButton.addEventListener('click', () => {
    trackEvent('iframe_upload_click', {
      trigger: 'button'
    });
    fileInput.click();
  });
  
  
  fileInput.addEventListener('change', handleFileSelection);
  
  console.log('🎯 文件上传功能已初始化');
}


function initializeExportResponses() {
  const exportButton = document.getElementById('exportResponsesButton');
  
  if (!exportButton) {
    console.warn('导出回答按钮未找到');
    return;
  }
  
  
  exportButton.addEventListener('click', () => {
    console.log('🎯 导出按钮被Click');
    trackEvent('iframe_export_click', {
      trigger: 'button'
    });
    showExportModal();
  });
  
  console.log('🎯 导出回答功能已初始化');
}


async function handleFileSelection(event) {
  const files = event.target.files;
  
  if (!files || files.length === 0) {
    console.log('未选择文件');
    return;
  }
  
  console.log('🎯 用户选择了文件:', files.length, '个');
  
  
  const file = files[0];
  await processUploadedFile(file);
  
  
  event.target.value = '';
}


async function processUploadedFile(file) {
  console.log('🎯 开始处理上传的文件:', {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified
  });
  
  
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    showFileUploadError(`文件大小超过限制（${Math.round(maxSize / 1024 / 1024)}MB）`);
    return;
  }
  
  try {
    
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    
    
    const fileData = {
      type: file.type,
      blob: blob,
      fileName: file.name,
      originalName: file.name,
      size: file.size,
      lastModified: file.lastModified
    };
    
    console.log('🎯 文件数据准备Completed:', fileData);
    
    
    await processFileToAllIframes(fileData);
    
  } catch (error) {
    console.error('❌ 文件处理Failed:', error);
    showFileUploadError('文件处理Failed: ' + error.message);
  }
}


async function processFileToAllIframes(fileData) {
  console.log('🎯 开始向所有iframe发送文件');
  
  
  const iframes = document.querySelectorAll('.ai-iframe');
  console.log(`找到 ${iframes.length} 个 iframe`);
  
  if (iframes.length === 0) {
    showFileUploadError('没有找到可用的AISite');
    return;
  }
  
  
  await executeFileUploadSequentially(iframes, fileData);
}


function showFileUploadError(message) {
  const error = document.createElement('div');
  error.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
    text-align: center;
    animation: slideInScale 0.3s ease-out;
  `;
  
  error.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <span style="font-size: 18px;">❌</span>
      <span style="font-weight: 600;">文件上传Failed</span>
    </div>
    <div style="font-size: 13px; opacity: 0.9;">${message}</div>
  `;
  
  document.body.appendChild(error);
  
  
  setTimeout(() => {
    if (error.parentElement) {
      error.remove();
    }
  }, 3000);
}



