


function getI18nMessage(key, fallback) {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      return message || fallback;
    }
  } catch (error) {
    console.warn('国际化函数调用Failed:', error);
  }
  return fallback;
}

 

function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 400px;
    text-align: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);
  
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 300);
  }, duration);
}


function showExportModal() {
  console.log('🎯 开始显示导出模态框');
  
  
  try {
    showToast('导出功能正在Load...', 1000);
  } catch (error) {
    console.error('showToast 函数测试Failed:', error);
  }
  
  
  const modal = document.createElement('div');
  modal.className = 'export-modal';
  modal.innerHTML = `
    <div class="export-modal-content">
      <div class="export-modal-header">
        <h3 class="export-modal-title">📄 ${getI18nMessage('exportModalTitle', '导出AI回答')}</h3>
        <button class="export-close-btn" id="exportCloseBtn">×</button>
      </div>
      
        <div class="export-dev-notice">
          <div class="export-dev-notice-content">
            ⚠️ ${getI18nMessage('devNotice', '功能在开发中，可能会有错误或不足')}
          </div>
        </div>
      
      <div class="export-options">
        <div class="export-option-group">
          <label class="export-option-label">${getI18nMessage('exportFormat', '导出格式')}</label>
          <div class="export-format-buttons">
            <button class="export-format-btn active" data-format="markdown">📝 Markdown</button>
            <button class="export-format-btn" data-format="txt">📄 纯文本</button>
            <button class="export-format-btn" data-format="html">🌐 HTML</button>
          </div>
        </div>
        
        <div class="export-option-group">
          <label class="export-option-label">${getI18nMessage('selectSites', '选择Site')}</label>
          <div class="export-site-selection" id="exportSiteSelection">
            <!-- Site选项将动态生成 -->
          </div>
        </div>
      </div>
      
      <div class="export-preview">
        <div class="export-preview-title">📋 ${getI18nMessage('preview', '预览')}</div>
        <div class="export-preview-content" id="exportPreviewContent">
          选择Site和格式后将显示预览...
        </div>
      </div>
      
      <div class="export-actions">
        <button class="export-btn export-btn-secondary" id="exportCancelBtn">${getI18nMessage('cancel', '取消')}</button>
        <button class="export-btn export-btn-primary" id="exportConfirmBtn">${getI18nMessage('export', '导出')}</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  console.log('🎯 导出模态框已添加到页面');
  
  
  initializeExportModal(modal);
}


function initializeExportModal(modal) {
  const closeBtn = modal.querySelector('#exportCloseBtn');
  const cancelBtn = modal.querySelector('#exportCancelBtn');
  const confirmBtn = modal.querySelector('#exportConfirmBtn');
  const formatButtons = modal.querySelectorAll('.export-format-btn');
  const siteSelection = modal.querySelector('#exportSiteSelection');
  const previewContent = modal.querySelector('#exportPreviewContent');
  
  let selectedFormat = 'markdown';
  let selectedSites = new Set();
  
  
  const closeModal = () => {
    modal.style.animation = 'fadeIn 0.3s ease-out reverse';
    setTimeout(() => {
      if (modal.parentElement) {
        modal.remove();
      }
    }, 300);
  };
  
  
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  
  formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formatButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFormat = btn.dataset.format;
      updatePreview();
    });
  });
  
  
  loadExportSites(siteSelection, modal);
  
  
  function updatePreview() {
    if (!modal.selectedSites || modal.selectedSites.size === 0) {
      previewContent.textContent = '请选择要导出的Site...';
      return;
    }
    
    
    previewContent.innerHTML = `
      <div class="loading-indicator">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在提取内容...</div>
        <div class="loading-progress">准备中...</div>
      </div>
    `;
    
    
    collectResponses(modal.selectedSites, true).then(responses => {
      const preview = generatePreview(responses, selectedFormat);
      previewContent.textContent = preview;
    }).catch(error => {
      previewContent.innerHTML = `
        <div class="error-message">
          <div class="error-icon">❌</div>
          <div class="error-text">预览生成Failed: ${error.message}</div>
          <div class="error-hint">请尝试刷新后重试</div>
        </div>
      `;
    });
  }
  
  
  confirmBtn.addEventListener('click', async () => {
    console.log('导出按钮被Click，当前选中的Site:', Array.from(modal.selectedSites || new Set()));
    
    if (!modal.selectedSites || modal.selectedSites.size === 0) {
      showToast(getI18nMessage('selectSitesToExport', '请选择要导出的Site'));
      return;
    }
    
    try {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `
        <div class="button-loading">
          <div class="button-spinner"></div>
          <span>导出中...</span>
        </div>
      `;
      
      
      const responses = await collectResponses(modal.selectedSites, false);
      
      
      const exportContent = generateExportContent(responses, selectedFormat);
      
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileExt =
        selectedFormat === 'markdown' ? 'md' :
        selectedFormat === 'txt' ? 'txt' :
        selectedFormat === 'html' ? 'html' :
        selectedFormat;
      const filename = `ai-responses-${timestamp}.${fileExt}`;
      const mimeType = selectedFormat === 'html' ? 'text/html' : 
                      selectedFormat === 'txt' ? 'text/plain' : 'text/markdown';
      
      downloadFile(exportContent, filename, mimeType);
      
      showToast(getI18nMessage('exportSuccess', '导出Successful！'));
      closeModal();
      
    } catch (error) {
      console.error('导出Failed:', error);
      showToast(getI18nMessage('exportFailed', '导出Failed') + ': ' + error.message);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = getI18nMessage('export', '导出');
    }
  });
}


function loadExportSites(container, modal) {
  const iframes = document.querySelectorAll('.ai-iframe');
  const selectedSites = new Set();
  
  iframes.forEach(iframe => {
    const siteName = iframe.getAttribute('data-site');
    if (!siteName) return;
    
    const siteItem = document.createElement('div');
    siteItem.className = 'export-site-item';
    siteItem.innerHTML = `
      <input type="checkbox" class="export-site-checkbox" id="site-${siteName}" checked>
      <label class="export-site-name" for="site-${siteName}">${siteName}</label>
    `;
    
    
    selectedSites.add(siteName);
    
    
    const checkbox = siteItem.querySelector('.export-site-checkbox');
    checkbox.addEventListener('change', (e) => {
      console.log(`Site ${siteName} 选择状态改变:`, e.target.checked);
      
      if (e.target.checked) {
        selectedSites.add(siteName);
      } else {
        selectedSites.delete(siteName);
      }
      
      console.log('当前选中的Site:', Array.from(selectedSites));
      
      
      const previewContent = modal.querySelector('#exportPreviewContent');
      if (selectedSites.size === 0) {
        previewContent.textContent = '请选择要导出的Site...';
      } else {
        collectResponses(selectedSites).then(responses => {
          const formatButtons = modal.querySelectorAll('.export-format-btn');
          const activeFormat = modal.querySelector('.export-format-btn.active').dataset.format;
          const preview = generatePreview(responses, activeFormat);
          previewContent.textContent = preview;
        }).catch(error => {
          previewContent.textContent = `预览生成Failed: ${error.message}`;
        });
      }
    });
    
    container.appendChild(siteItem);
  });
  
  
  modal.selectedSites = selectedSites;
  
  console.log('初始选中的Site:', Array.from(selectedSites));
  
  
  setTimeout(() => {
    const previewContent = modal.querySelector('#exportPreviewContent');
    if (selectedSites.size > 0) {
      collectResponses(selectedSites).then(responses => {
        const formatButtons = modal.querySelectorAll('.export-format-btn');
        const activeFormat = modal.querySelector('.export-format-btn.active').dataset.format;
        const preview = generatePreview(responses, activeFormat);
        previewContent.textContent = preview;
      }).catch(error => {
        previewContent.textContent = `预览生成Failed: ${error.message}`;
      });
    }
  }, 100);
}




async function extractAlternateUrl(siteName) {
  try {
    console.log(`🔍 开始为 ${siteName} 提取URL...`);
    
    
    if (window.siteDetector && window.siteDetector.clearCache) {
      console.log('🧹 清除Config缓存...');
      window.siteDetector.clearCache();
    }
    
    
    const siteConfig = await getSiteContentExtractorConfig(siteName);
    console.log(`📋 ${siteName} Config:`, siteConfig);
    
    if (!siteConfig || !siteConfig.urlExtractor) {
      console.log(`⚠️ ${siteName} 未ConfigURL提取器`);
      console.log(`🔍 调试信息 - siteConfig:`, siteConfig);
      console.log(`🔍 调试信息 - urlExtractor:`, siteConfig?.urlExtractor);
      return null;
    }
    
    const { alternateLinkSelector, urlPattern, removeParams } = siteConfig.urlExtractor;
    console.log(`🎯 使用选择器: ${alternateLinkSelector}, 模式: ${urlPattern}, 删除参数: ${removeParams}`);
    
    
    const alternateLinks = document.querySelectorAll(alternateLinkSelector);
    console.log(`🔍 找到 ${alternateLinks.length} 个alternate链接`);
    
    for (const link of alternateLinks) {
      const href = link.getAttribute('href');
      console.log(`🔗 Check链接: ${href}`);
      
      if (href && href.includes(urlPattern)) {
        
        const url = new URL(href);
        console.log(`🧹 原始URL参数:`, Array.from(url.searchParams.keys()));
        
        removeParams.forEach(param => {
          url.searchParams.delete(param);
        });
        
        const cleanUrl = url.toString();
        console.log(`🔗 从alternate标签提取到${siteName} URL: ${cleanUrl}`);
        return cleanUrl;
      }
    }
    
    console.log(`⚠️ 未找到${siteName}的alternate链接`);
    return null;
  } catch (error) {
    console.error(`❌ 提取${siteName} alternate URL时出错:`, error);
    return null;
  }
}


async function collectResponses(selectedSites) {
  console.log('🎯 开始收集回答内容，选择的Site:', selectedSites);
  
  const responses = [];
  
  
  const startTime = performance.now();
  let successCount = 0;
  let errorCount = 0;
  
  
  const extractPromises = Array.from(selectedSites).map(async (siteName) => {
    try {
      const iframe = document.querySelector(`[data-site="${siteName}"]`);
      if (!iframe) {
        console.log(`⚠️ 未找到 ${siteName} 的iframe`);
        return null;
      }
      
      const iframeUrl = iframe.src || 'unknown';
      console.log(`🔍 [DEBUG] ${siteName} iframeUrl:`, iframeUrl);
      
      
      let finalUrl = iframeUrl;
      console.log(`🔍 准备调用 extractAlternateUrl(${siteName})...`);
      const alternateUrl = await extractAlternateUrl(siteName);
      console.log(`🔍 extractAlternateUrl 返回:`, alternateUrl);
      if (alternateUrl) {
        finalUrl = alternateUrl;
        console.log(`🔄 ${siteName} URLUpdate: ${iframeUrl} → ${finalUrl}`);
      } else {
        console.log(`📝 ${siteName} 使用原始URL: ${finalUrl}`);
      }
      
      
      
      console.log(`🎯 开始提取 ${siteName} 的内容...`);
      
      
      const extractResult = await extractIframeContent(iframe, siteName);
      console.log(`🔍 [DEBUG] extractResult 类型:`, typeof extractResult, extractResult);
      
      
      let content, extractionMethod, extractedUrl;
      
      
      if (typeof extractResult === 'string') {
        content = extractResult;
        extractionMethod = 'Config方法';
        extractedUrl = iframeUrl;
      } else if (extractResult && typeof extractResult === 'object') {
        content = extractResult.content || '';
        extractionMethod = extractResult.extractionMethod || 'Config方法';
        extractedUrl = extractResult.url || iframeUrl;
      } else {
        content = '';
        extractionMethod = 'failed';
        extractedUrl = iframeUrl;
      }
      
      
      if (extractedUrl && extractedUrl !== iframeUrl) {
        finalUrl = extractedUrl;
        console.log(`🔄 ${siteName} 使用iframe提取的URL: ${finalUrl}`);
      }
      
      if (content && content.trim()) {
        const responseData = {
          siteName: siteName,
          content: content.trim(),
          timestamp: new Date().toISOString(),
          extractionMethod: extractionMethod,
          length: content.length,
          url: finalUrl
        };
        
        console.log(`📋 ${siteName} 响应数据URL: ${responseData.url}`);
        
        console.log(`✅ Successful提取 ${siteName} 内容，长度: ${content.length}, 方法: ${extractionMethod}`);
        return responseData;
      } else {
        console.log(`⚠️ ${siteName} 未提取到内容`);
        return null;
      }
    } catch (error) {
      console.error(`❌ 提取 ${siteName} 内容Failed:`, error);
      return {
        siteName: siteName,
        content: `内容提取Failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        error: true
      };
    }
  });
  
  
  const results = await Promise.all(extractPromises);
  
  
  results.forEach(result => {
    if (result) {
      responses.push(result);
      if (result.error) {
        errorCount++;
      } else {
        successCount++;
      }
    }
  });
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(`🎯 收集Completed，共获得 ${responses.length} 个回答`);
  console.log(`📊 性能统计: Successful ${successCount}, Failed ${errorCount}, 耗时 ${totalTime.toFixed(2)}ms`);
  
  return responses;
}


async function extractIframeContent(iframe, siteName) {
  
  try {
    console.log(`尝试通过消息通信获取 ${siteName} 内容...`);
    const result = await requestIframeContent(iframe, siteName);
    
    
    if (result && typeof result === 'object' && result.content) {
      console.log(`✅ Successful通过消息通信获取 ${siteName} 内容`);
      return result;
    } else if (result && typeof result === 'string' && result.trim()) {
      console.log(`✅ Successful通过消息通信获取 ${siteName} 内容（字符串格式）`);
      return result;
    }
  } catch (error) {
    console.log(`消息通信获取 ${siteName} 内容Failed:`, error.message);
  }
  
  
  try {
    console.log(`尝试直接访问 ${siteName} iframe内容...`);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    if (iframeDoc) {
      const result = await extractContentFromDocument(iframeDoc, siteName);
      if (result && result.trim()) {
        console.log(`✅ Successful直接访问 ${siteName} 内容`);
        return result;
      }
    }
  } catch (error) {
    console.log(`无法直接访问 ${siteName} iframe内容 (跨域限制):`, error.message);
  }
  
  
  console.log(`⚠️ 无法自动提取 ${siteName} 内容，请手动复制`);
  return `无法自动提取 ${siteName} 的详细内容，请手动复制。\n\n提示：您可以：\n1. 在 ${siteName} 页面中手动选择并复制内容\n2. 或者尝试刷新页面后再次导出`;
}


async function extractContentWithThinkingFilter(element, thinkingBlockFilters, siteName = 'Unknown') {
  try {
    console.log(`🎯 ${siteName} 思考块过滤开始`);
    
    
    const clonedElement = element.cloneNode(true);
    
    
    if (thinkingBlockFilters && thinkingBlockFilters.length > 0) {
      for (const filter of thinkingBlockFilters) {
        const thinkingBlocks = clonedElement.querySelectorAll(filter);
        console.log(`🎯 找到 ${thinkingBlocks.length} 个思考块元素 (${filter})`);
        
        thinkingBlocks.forEach(block => {
          
          const blockText = block.textContent || '';
          const isThinkingBlock = isThinkingContent(blockText, block);
          
          if (isThinkingBlock) {
            console.log(`🎯 移除${siteName}思考块:`, blockText.substring(0, 100));
            block.remove();
          }
        });
      }
    }
    
    
    const content = await extractElementContent(clonedElement);
    console.log(`🎯 ${siteName} 过滤后内容长度:`, content.length);
    
    return content;
  } catch (error) {
    console.error(`❌ ${siteName} 思考块过滤Failed:`, error);
    
    return await extractElementContent(element);
  }
}


function isThinkingContent(text, element) {
  
  const thinkingKeywords = [
    
    'thinking', 'thought', 'consider', 'analysis', 'reasoning', 'pondering',
    'reflecting', 'deliberating', 'contemplating', 'processing',
    
    
    '思考', '考虑', '分析', '推理', '反思', '琢磨', '思量', '深思',
    '分析中', '思考中', '处理中', '推理过程',
    
    
    'réflexion', 'pensée', 'análisis', 'pensamiento', 
    'nachdenken', 'überlegung', 'analisi', 'riflessione' 
  ];
  
  
  const lowerText = text.toLowerCase();
  const hasThinkingKeyword = thinkingKeywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  
  const hasThinkingDOMFeatures = 
    element.querySelector('button[aria-expanded]') || 
    element.classList.contains('transition-all') || 
    element.classList.contains('thinking') ||
    element.classList.contains('reasoning') ||
    element.querySelector('.thinking') ||
    element.querySelector('.reasoning') ||
    element.querySelector('[class*="thinking"]') ||
    element.querySelector('[class*="reasoning"]') ||
    element.querySelector('[class*="analysis"]');
  
  
  const hasThinkingPatterns = 
    lowerText.match(/^(thinking|thought|考虑|思考)[:：]?\s*/) || 
    lowerText.match(/(let me think|让我想想|我来思考)/) || 
    lowerText.match(/\[thinking\]/i) || 
    lowerText.match(/\*thinking\*/i) || 
    element.hasAttribute('data-thinking') || 
    element.hasAttribute('data-internal'); 
  
  return hasThinkingKeyword || hasThinkingDOMFeatures || hasThinkingPatterns;
}


async function extractContentFromDocument(doc, siteName) {
  try {
    
    const siteConfig = await getSiteContentExtractorConfig(siteName);
    console.log(`📋 ${siteName} 使用Config:`, siteConfig);
    
    let responses = [];
    
    
    if (siteConfig && siteConfig.messageContainer) {
      
      responses = await extractMessagesWithContainer(doc, siteName, siteConfig);
    } else if (siteConfig && siteConfig.contentSelectors) {
      
      const content = await extractWithSelectors(doc, siteConfig.contentSelectors, siteConfig.excludeSelectors, siteName);
      if (content.trim()) {
        responses.push({
          siteName: siteName,
          content: content.trim(),
          extractionMethod: 'contentSelectors'
        });
      }
    } else if (siteConfig && siteConfig.selectors) {
      
      const content = await extractWithSelectors(doc, siteConfig.selectors, siteConfig.excludeSelectors, siteName);
      if (content.trim()) {
        responses.push({
          siteName: siteName,
          content: content.trim(),
          extractionMethod: 'legacy'
        });
      }
    }
    
    
    if (responses.length === 0) {
      const fallbackSelectors = siteConfig?.fallbackSelectors || [
        '[data-message-author-role="assistant"]',
        '.markdown',
        '.prose',
        '[class*="message"]',
        '[class*="response"]',
        '[class*="answer"]',
        '[class*="content"]',
        'main',
        'article',
        '.container'
      ];
      
      const content = await extractWithSelectors(doc, fallbackSelectors, siteConfig?.excludeSelectors, siteName);
      if (content.trim()) {
        responses.push({
          siteName: siteName,
          content: content.trim(),
          extractionMethod: 'fallback'
        });
      }
    }
    
    
    if (responses.length === 0) {
      const pageText = doc.body ? (doc.body.textContent || doc.body.innerText || '').trim() : '';
      if (pageText) {
        responses.push({
          siteName: siteName,
          content: pageText.slice(0, 1000) + (pageText.length > 1000 ? '...' : ''),
          extractionMethod: 'page_text'
        });
      }
    }
    
    
    if (responses.length > 0) {
      const mainContent = responses.map(r => r.content).join('\n\n---\n\n');
      
      return {
        content: mainContent,
        extractionMethod: responses[0].extractionMethod,
        messageCount: responses.length
      };
    }
    
    return `无法从 ${siteName} 提取内容`;
  } catch (error) {
    console.error(`提取 ${siteName} 内容时出错:`, error);
    return `提取 ${siteName} 内容时出错: ${error.message}`;
  }
}


async function extractMessagesWithContainer(doc, siteName, siteConfig) {
  const responses = [];
  
  try {
    console.log(`🔍 ${siteName} 开始查找消息容器:`, siteConfig.messageContainer);
    
    
    let searchRoot = doc;
    if (siteConfig.containerSelector) {
      const container = doc.querySelector(siteConfig.containerSelector);
      if (container) {
        searchRoot = container;
        console.log(`📍 ${siteName} 使用容器范围:`, siteConfig.containerSelector);
      } else {
        console.log(`⚠️ ${siteName} 未找到指定容器:`, siteConfig.containerSelector);
      }
    }
    
    
    if (siteConfig.editModeCheck) {
      const editElements = searchRoot.querySelectorAll(siteConfig.editModeCheck);
      if (editElements.length > 0) {
        console.log(`⏸️ ${siteName} 检测到编辑模式，跳过内容提取`);
        return responses;
      }
    }
    
    
    const messageContainers = searchRoot.querySelectorAll(siteConfig.messageContainer);
    console.log(`📝 ${siteName} 找到 ${messageContainers.length} 个消息容器`);
    
    if (messageContainers.length === 0) {
      console.log(`⚠️ ${siteName} 未找到消息容器，使用fallback`);
      return responses;
    }
    
    for (const [index, container] of messageContainers.entries()) {
      
      const shouldExclude = siteConfig.excludeSelectors && siteConfig.excludeSelectors.some(excludeSelector => {
        try {
          return container.matches(excludeSelector) || container.closest(excludeSelector);
        } catch (e) {
          return false;
        }
      });
      
      if (shouldExclude) {
        console.log(`⏭️ ${siteName} 跳过被排除的容器 ${index + 1}`);
        continue;
      }
      
      
      if (siteConfig.userMessageSelector) {
        const userMessageElement = container.querySelector(siteConfig.userMessageSelector);
        if (userMessageElement) {
          console.log(`👤 ${siteName} 容器 ${index + 1} 包含用户消息，跳过`);
          continue;
        }
      }
      
      let mainContent = '';
      
      
      if (siteConfig.contentSelectors && siteConfig.contentSelectors.length > 0) {
        for (const contentSelector of siteConfig.contentSelectors) {
          const contentElements = container.querySelectorAll(contentSelector);
          if (contentElements.length > 0) {
            for (const element of contentElements) {
              
              if (siteConfig.thinkingBlockFilters && siteConfig.thinkingBlockFilters.length > 0) {
                const filteredContent = await extractContentWithThinkingFilter(
                  element, 
                  siteConfig.thinkingBlockFilters, 
                  siteName
                );
                if (filteredContent.trim()) {
                  mainContent += (mainContent ? '\n\n' : '') + filteredContent.trim();
                  break;
                }
              } else {
                const text = await extractElementContent(element);
                if (text.trim()) {
                  mainContent += (mainContent ? '\n\n' : '') + text.trim();
                  break; 
                }
              }
            }
            if (mainContent) break; 
          }
        }
      }
      
      
      if (!mainContent) {
        mainContent = await extractElementContent(container);
      }
      
      
      
      if (mainContent && mainContent.trim()) {
        responses.push({
          siteName: siteName,
          content: mainContent.trim(),
          extractionMethod: 'messageContainer',
          position: index
        });
        
        console.log(`✅ ${siteName} Successful提取消息 ${index + 1}`);
      }
    }
    
    
    responses.sort((a, b) => a.position - b.position);
    
    console.log(`🎯 ${siteName} 共提取到 ${responses.length} 条有效回答`);
    return responses;
  } catch (error) {
    console.error(`${siteName} extractMessagesWithContainer 出错:`, error);
    return responses;
  }
}



async function extractWithSelectors(doc, selectors, excludeSelectors = [], siteName = '') {
  let content = '';
  
  
  const extractionPromises = selectors.map(async (selector) => {
    try {
      const elements = doc.querySelectorAll(selector);
      
      if (elements.length === 0) return '';
      
      let selectorContent = '';
      
      for (const [elementIndex, element] of elements.entries()) {
        
        const shouldExclude = excludeSelectors && excludeSelectors.some(excludeSelector => {
          try {
            return element.matches(excludeSelector) || element.closest(excludeSelector);
          } catch (e) {
            return false;
          }
        });
        
        if (shouldExclude) continue;
        
        
        await waitForContentLoad(element);
        
        
        let text = await extractElementContent(element);
        
        if (text.trim()) {
          
          if (siteName) {
            selectorContent += `\n\n## ${siteName} 回答 ${elementIndex + 1}\n\n${text.trim()}\n`;
            
          } else {
            selectorContent += (selectorContent ? '\n\n' : '') + text.trim();
          }
        }
      }
      
      return selectorContent;
    } catch (error) {
      console.warn(`选择器 ${selector} 提取Failed:`, error);
      return '';
    }
  });
  
  
  const results = await Promise.all(extractionPromises);
  
  
  for (const result of results) {
    if (result.trim()) {
      content = result.trim();
      break; 
    }
  }
  
  return content;
}


async function waitForContentLoad(element, timeout = 300) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    
    const initialContent = element.textContent || element.innerText || '';
    if (initialContent.trim().length > 20) {
      resolve();
      return;
    }
    
    const checkContent = () => {
      const currentContent = element.textContent || element.innerText || '';
      const hasContent = currentContent.trim().length > 10;
      const isTimeout = Date.now() - startTime > timeout;
      
      
      if (hasContent || isTimeout) {
        if (isTimeout) {
          console.log(`⏰ DOMWait超时(${timeout}ms)，当前内容长度: ${currentContent.length}`);
        }
        resolve();
      } else {
        
        setTimeout(checkContent, 100);
      }
    };
    
    checkContent();
  });
}


async function extractElementContent(element) {
  let text = '';
  
  try {
    
    if (element.classList.contains('markdown') || 
        element.classList.contains('response-content-markdown') ||
        element.classList.contains('prose')) {
      
      const html = element.innerHTML || '';
      if (html.trim()) {
        text = convertHtmlToMarkdown(html);
      } else {
        text = element.textContent || element.innerText || '';
      }
    } else if (element.dataset.markdown) {
      
      text = element.dataset.markdown;
    } else if (element.getAttribute('data-markdown')) {
      text = element.getAttribute('data-markdown');
    } else {
      
      const html = element.innerHTML || '';
      if (html.trim()) {
        text = convertHtmlToMarkdown(html);
      } else {
        
        text = element.textContent || element.innerText || '';
      }
    }
    
    
    text = cleanExtractedText(text);
    
  } catch (error) {
    console.warn('提取元素内容Failed:', error);
    text = element.textContent || element.innerText || '';
  }
  
  return text;
}


function cleanExtractedText(text) {
  if (!text) return '';
  
  
  text = text.replace(/\s+/g, ' ').trim();
  
  
  const unwantedPatterns = [
    /^Loading\.\.\.$/i,
    /^Please wait\.\.\.$/i,
    /^Generating\.\.\.$/i,
    /^Thinking\.\.\.$/i,
    /^Processing\.\.\.$/i
  ];
  
  for (const pattern of unwantedPatterns) {
    text = text.replace(pattern, '');
  }
  
  return text.trim();
}


async function getSiteContentExtractorConfig(siteName) {
  try {
    console.log(`🔍 开始获取 ${siteName} 的Config...`);
    
    
    if (window.siteDetector) {
      console.log('📡 使用 siteDetector 获取Config...');
      const sites = await window.siteDetector.getSites();
      console.log(`📋 获取到 ${sites.length} 个SiteConfig`);
      
      const site = sites.find(s => s.name === siteName);
      console.log(`🎯 查找 ${siteName}:`, site ? '找到' : '未找到');
      
      if (site && site.contentExtractor) {
        console.log(`✅ 使用新检测器找到 ${siteName} 的内容提取Config:`, site.contentExtractor);
        return site.contentExtractor;
      } else if (site) {
        console.log(`⚠️ ${siteName} Site存在但无 contentExtractor:`, site);
      }
    }
    
    
    if (typeof window.getDefaultSites === 'function') {
      console.log('📡 使用 getDefaultSites 获取Config...');
      const sites = await window.getDefaultSites();
      console.log(`📋 获取到 ${sites.length} 个SiteConfig`);
      
      const site = sites.find(s => s.name === siteName);
      console.log(`🎯 查找 ${siteName}:`, site ? '找到' : '未找到');
      
      if (site && site.contentExtractor) {
        console.log(`✅ 使用 getDefaultSites 找到 ${siteName} 的内容提取Config:`, site.contentExtractor);
        return site.contentExtractor;
      } else if (site) {
        console.log(`⚠️ ${siteName} Site存在但无 contentExtractor:`, site);
      }
      
      return site?.contentExtractor || null;
    } else {
      console.warn('window.getDefaultSites 函数不可用');
      return null;
    }
  } catch (error) {
    console.error('获取SiteConfigFailed:', error);
    return null;
  }
}


function requestIframeContent(iframe, siteName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 5000);
    
    const messageHandler = (event) => {
      if (event.data.type === 'EXTRACTED_CONTENT' && event.data.siteName === siteName) {
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        
        resolve({
          content: event.data.content,
          url: event.data.url || iframe.src
        });
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    
    iframe.contentWindow.postMessage({
      type: 'EXTRACT_CONTENT',
      siteName: siteName
    }, '*');
  });
}


function generatePreview(responses, format) {
  if (responses.length === 0) {
    return '没有找到可导出的内容';
  }
  
  let preview = '';
  const maxPreviewLength = 150; 
  
  responses.forEach((response) => {
      if (format === 'markdown') {
        preview += `## ${response.siteName}\n\n`;
        
        
        if (response.url && response.url !== 'unknown') {
          preview += `**URL:** ${response.url}\n\n`;
        }
        
        const contentPreview = response.content.substring(0, maxPreviewLength);
        preview += contentPreview;
      if (response.content.length > maxPreviewLength) {
        preview += '...';
      }
      preview += '\n\n---\n\n';
      } else if (format === 'html') {
        preview += `<h3>${response.siteName}</h3>\n`;
        
        
        if (response.url && response.url !== 'unknown') {
          preview += `<p><strong>URL:</strong> <a href="${response.url}" target="_blank">${response.url}</a></p>\n`;
        }
        
        const contentPreview = response.content.substring(0, maxPreviewLength);
        preview += `<p>${contentPreview}`;
      if (response.content.length > maxPreviewLength) {
        preview += '...</p>\n';
      } else {
        preview += '</p>\n';
      }
      preview += '<hr>\n\n';
      } else { // txt format
        preview += `${response.siteName}:\n`;
        
        
        if (response.url && response.url !== 'unknown') {
          preview += `URL: ${response.url}\n\n`;
        }
        
        const contentPreview = response.content.substring(0, maxPreviewLength);
        preview += contentPreview;
      if (response.content.length > maxPreviewLength) {
        preview += '...';
      }
      preview += '\n\n' + '='.repeat(30) + '\n\n';
    }
  });
  
  return preview;
}


function generateExportContent(responses, format) {
  const timestamp = new Date().toLocaleString();
  const query = document.getElementById('searchInput').value || '未指定查询';
  
  let content = '';
  
  if (format === 'markdown') {
    content = `# AI回答汇总\n\n`;
    content += `**查询内容:** ${query}\n`;
    content += `**导出时间:** ${timestamp}\n`;
    content += `**包含Site:** ${responses.length} 个\n\n`;
    content += `---\n\n`;
    
    responses.forEach((response, responseIndex) => {
      content += `## ${response.siteName}\n\n`;
      
      
      if (response.url && response.url !== 'unknown') {
        content += `**URL:** ${response.url}\n\n`;
      }
      
      content += response.content + '\n\n';
      
      
      if (response.extractionMethod) {
        console.log(`📊 ${response.siteName} 提取方法: ${response.extractionMethod}`);
      }
      
      content += `---\n\n`;
    });
    
  } else if (format === 'html') {
    content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI回答汇总</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        h3 { color: #666; margin-top: 20px; }
        .meta { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .thinking { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0; border-radius: 4px; }
        .response-meta { font-size: 0.9em; color: #666; margin-top: 10px; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { background: #f8f9fa; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>AI回答汇总</h1>
    <div class="meta">
        <p><strong>查询内容:</strong> ${query}</p>
        <p><strong>导出时间:</strong> ${timestamp}</p>
        <p><strong>包含Site:</strong> ${responses.length} 个</p>
    </div>`;
    
    responses.forEach((response, responseIndex) => {
      content += `<h2>${response.siteName}</h2>`;
      
      
      if (response.url && response.url !== 'unknown') {
        content += `<p><strong>URL:</strong> <a href="${response.url}" target="_blank">${response.url}</a></p>`;
      }
      
      content += `<div>${response.content.replace(/\n/g, '<br>')}</div>`;
      
      
      if (response.extractionMethod) {
        console.log(`📊 ${response.siteName} 提取方法: ${response.extractionMethod}`);
      }
      
      if (responseIndex < responses.length - 1) {
        content += '<hr>';
      }
    });
    
    content += `</body></html>`;
    
  } else { // txt format
    content = `AI回答汇总\n\n`;
    content += `查询内容: ${query}\n`;
    content += `导出时间: ${timestamp}\n`;
    content += `包含Site: ${responses.length} 个\n\n`;
    content += `${'='.repeat(50)}\n\n`;
    
    responses.forEach((response, responseIndex) => {
      content += `${response.siteName}\n`;
      content += `${'-'.repeat(response.siteName.length)}\n\n`;
      
      
      if (response.url && response.url !== 'unknown') {
        content += `URL: ${response.url}\n\n`;
      }
      
      content += response.content + '\n\n';
      
      
      if (response.extractionMethod) {
        console.log(`📊 ${response.siteName} 提取方法: ${response.extractionMethod}`);
      }
      
      content += `${'='.repeat(50)}\n\n`;
    });
  }
  
  return content;
}


async function exportContent(content, format) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const query = document.getElementById('searchInput').value || 'AI回答';
  const filename = `AI回答汇总_${query}_${timestamp}`;
  
  if (format === 'markdown') {
    downloadFile(content, `${filename}.md`, 'text/markdown');
  } else if (format === 'html') {
    downloadFile(content, `${filename}.html`, 'text/html');
  } else {
    downloadFile(content, `${filename}.txt`, 'text/plain');
  }
}


function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}


function convertHtmlToMarkdown(html) {
  try {
    if (!html || typeof html !== 'string') return '';
    
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    
    tempDiv.querySelectorAll('script, style').forEach(el => el.remove());
    
    
    let markdown = tempDiv.innerHTML
      
      .replace(/<pre[^>]*><code[^>]*class="[^"]*language-([^"]*)"[^>]*>(.*?)<\/code><\/pre>/gis, '```$1\n$2\n```\n\n')
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n')
      .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n\n')
      
      
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      
      
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      
      
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      
      
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      
      
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
        const items = content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
        return items + '\n';
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
        let counter = 1;
        const items = content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. ${arguments[1]}\n`);
        return items + '\n';
      })
      
      
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
        return content.split('\n').map(line => '> ' + line.trim()).join('\n') + '\n\n';
      })
      
      
      .replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
        
        const rows = content.match(/<tr[^>]*>(.*?)<\/tr>/gi);
        if (rows && rows.length > 0) {
          let tableMarkdown = '';
          let isFirstRow = true;
          
          for (const row of rows) {
            const cells = row.match(/<t[hd][^>]*>(.*?)<\/t[hd]>/gi);
            if (cells) {
              const cellContents = cells.map(cell => 
                cell.replace(/<t[hd][^>]*>(.*?)<\/t[hd]>/gi, '$1').trim()
              );
              tableMarkdown += '| ' + cellContents.join(' | ') + ' |\n';
              
              if (isFirstRow) {
                tableMarkdown += '|' + ' --- |'.repeat(cellContents.length) + '\n';
                isFirstRow = false;
              }
            }
          }
          return tableMarkdown + '\n';
        }
        return content;
      })
      
      
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
      
      
      .replace(/<br[^>]*\/?>/gi, '\n')
      
      
      .replace(/<hr[^>]*\/?>/gi, '\n---\n\n')
      
      
      .replace(/<[^>]+>/g, '')
      
      
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      
      
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return markdown;
  } catch (error) {
    console.warn('HTML转MarkdownFailed:', error);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }
}
