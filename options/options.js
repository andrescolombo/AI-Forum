let currentButtonConfig = null;




async function loadConfig() {
  
  initializeSiteConfigs();

  chrome.storage.sync.get('buttonConfig', function(data) {
    currentButtonConfig = data.buttonConfig || window.defaultButtonConfig;
    console.log('Load的buttonConfig:', currentButtonConfig);
    initializeButtonConfigs();
  });
}


function getMessage(key, substitutions = null) {
  return chrome.i18n.getMessage(key, substitutions);
}


function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.classList.remove('show');
  void toast.offsetWidth;
  
  toast.textContent = message;
  toast.classList.add('show');
  
  if (toast.timeoutId) {
    clearTimeout(toast.timeoutId);
  }
  
  toast.timeoutId = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}


function initializeI18n() {
  
  document.title = chrome.i18n.getMessage("appName");

  
  
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      element.textContent = message;
    }
  });
}


document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM LoadCompleted');
  initializeSiteConfigs();
  initializeI18n();
  initializeRuleInfo();
  initializePromptTemplates();
});


function showMessage(message, isError = false) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${isError ? 'error' : 'success'}`;
  messageElement.textContent = message;
  
  document.body.appendChild(messageElement);
  
  setTimeout(() => {
    messageElement.remove();
  }, 3000);
}


async function initializeButtonConfigs() {
  try {
    
    let { buttonConfig } = await chrome.storage.sync.get(['buttonConfig']);
    
    
    const defaultButtonConfig = await window.AppConfigManager.getButtonConfig();
    
    let currentConfig = buttonConfig || defaultButtonConfig;

    console.log('初始Config:', currentConfig);

    
    const configItems = [
      { id: 'floatButtonSwitch', configKey: 'floatButton', name: chrome.i18n.getMessage("floatButton") },
      { id: 'selectionSearchSwitch', configKey: 'selectionSearch', name: chrome.i18n.getMessage("selectionSearch") },
      { id: 'contextMenuSwitch', configKey: 'contextMenu', name: chrome.i18n.getMessage("contextMenu") },
      { id: 'searchEngineSwitch', configKey: 'searchEngine', name: chrome.i18n.getMessage("searchEngine") }
    ];

    const buttonContainer = document.getElementById('buttonSiteConfigs');
    if (!buttonContainer) return;
    
    buttonContainer.innerHTML = '';

    configItems.forEach(item => {
      const configDiv = document.createElement('div');
      configDiv.className = 'site-config';
      configDiv.innerHTML = `
        <div class="site-header">
          <label class="switch">
            <input type="checkbox" id="${item.id}"
              ${currentConfig[item.configKey] ? 'checked' : ''}>
            <span class="slider round"></span>
          </label>
          <span class="site-name-display">${item.name}</span>
        </div>
      `;
      buttonContainer.appendChild(configDiv);

      const switchElement = configDiv.querySelector(`#${item.id}`);
      switchElement.addEventListener('change', async (e) => {
        
        const { buttonConfig: latestConfig } = await chrome.storage.sync.get(['buttonConfig']);
        const updatedConfig = {
          ...(latestConfig || currentConfig),  
          [item.configKey]: e.target.checked
        };
        
        await chrome.storage.sync.set({ buttonConfig: updatedConfig });
        
        currentConfig = updatedConfig;
        console.log(`已Update${item.name}Config:`, updatedConfig);
        if (chrome.runtime.lastError) {
          showToast(chrome.i18n.getMessage("saveFailed", [chrome.runtime.lastError.message]));
          return;
        }
        showToast(chrome.i18n.getMessage("saveSuccess"));
        
      });
    });

  } catch (error) {
    console.error('初始化按钮ConfigFailed:', error);
  }
}

async function initializeSiteConfigs() {
  try {
    
    const sites = await getDefaultSites();
    console.log('获取到的合并Site数组:', sites);

    
    const visibleSites = sites.filter(site => site.hidden === false);
    const standaloneSites = visibleSites.filter(site => !site.supportIframe);
    const collectionSites = visibleSites.filter(site => site.supportIframe);
    

    
    const standaloneContainer = document.getElementById('standaloneSiteConfigs');
    const collectionContainer = document.getElementById('collectionSiteConfigs');
    
    
    standaloneContainer.innerHTML = '';
    collectionContainer.innerHTML = '';

    
    standaloneSites.forEach((site, index) => {
      const siteDiv = document.createElement('div');
      siteDiv.className = 'site-config';
      siteDiv.setAttribute('data-site-name', site.name);
      siteDiv.innerHTML = `
        <div class="site-header">
          <div class="drag-handle" title="拖拽调整顺序">⋮⋮</div>
          <label class="switch">
            <input type="checkbox" class="enable-toggle"
              ${site.enabled ? 'checked' : ''} 
              data-index="${index}"
              data-mode="standalone">
            <span class="slider round"></span>
          </label>
          <span class="site-name-display">${site.name}</span>
        </div>
      `;
      standaloneContainer.appendChild(siteDiv);
      
      
      addDragFunctionality(siteDiv, site.name, 'standalone');
    });

    
    collectionSites.forEach((site, index) => {
      const siteDiv = document.createElement('div');
      siteDiv.className = 'site-config';
      siteDiv.setAttribute('data-site-name', site.name);
      siteDiv.innerHTML = `
        <div class="site-header">
          <div class="drag-handle" title="拖拽调整顺序">⋮⋮</div>
          <label class="switch">
            <input type="checkbox" class="enable-toggle"
              ${site.enabled ? 'checked' : ''} 
              data-index="${index}"
              data-mode="collection">
            <span class="slider round"></span>
          </label>
          <span class="site-name-display">${site.name}</span>
        </div>
      `;
      collectionContainer.appendChild(siteDiv);
      
      
      addDragFunctionality(siteDiv, site.name, 'collection');
    });

    
    document.querySelectorAll('.enable-toggle').forEach(toggle => {
      toggle.addEventListener('change', async function() {
        try {
          const siteName = this.closest('.site-config').querySelector('.site-name-display').textContent;
          
          
          const { siteSettings = {}, sites: userSiteSettings = {} } = await chrome.storage.sync.get(['siteSettings', 'sites']);
          
          
          siteSettings[siteName] = this.checked;
          
          
          if (!userSiteSettings[siteName]) {
            userSiteSettings[siteName] = {};
          }
          userSiteSettings[siteName].enabled = this.checked;
          
          
          await chrome.storage.sync.set({ 
            siteSettings,
            sites: userSiteSettings
          });
          
          console.log('Save的SiteSettings:', siteName, this.checked);

          if (chrome.runtime.lastError) {
            showToast(chrome.i18n.getMessage("saveFailed", [chrome.runtime.lastError.message]));
            return;
          }
          showToast(chrome.i18n.getMessage("saveSuccess"));
        } catch (error) {
          console.error('SaveSettingsFailed:', error);
          showToast('SaveFailed');
          
          this.checked = !this.checked;
        }
      });
    });

  } catch (error) {
    console.error('初始化SiteConfigFailed:', error);
    showToast('LoadConfigFailed');
  }
} 


document.addEventListener('DOMContentLoaded', function() {
  initializeI18n();
  loadConfig();
  initializeNavigation();
  initializeDisabledSites();
});


function addDragFunctionality(siteDiv, siteName, mode) {
  const dragHandle = siteDiv.querySelector('.drag-handle');
  let isDragging = false;
  let dragStartY = 0;
  let initialIndex = 0;
  let placeholder = null;

  
  dragHandle.style.cursor = 'grab';
  dragHandle.style.userSelect = 'none';

  
  dragHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    
    
    const rect = siteDiv.getBoundingClientRect();
    dragStartY = e.clientY;
    
    
    const offsetY = e.clientY - rect.top;
    
    
    const container = mode === 'standalone' 
      ? document.getElementById('standaloneSiteConfigs')
      : document.getElementById('collectionSiteConfigs');
    const containers = Array.from(container.children);
    initialIndex = containers.indexOf(siteDiv);
    
    
    siteDiv.classList.add('dragging');
    dragHandle.style.cursor = 'grabbing';
    
    
    placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.style.height = siteDiv.offsetHeight + 'px';
    container.insertBefore(placeholder, siteDiv.nextSibling);
    
    
    siteDiv.style.position = 'fixed';
    siteDiv.style.zIndex = '1000';
    siteDiv.style.opacity = '0.8';
    siteDiv.style.transform = 'rotate(2deg)';
    siteDiv.style.pointerEvents = 'none';
    siteDiv.style.width = siteDiv.offsetWidth + 'px';
    siteDiv.style.left = rect.left + 'px';
    siteDiv.style.top = (e.clientY - offsetY) + 'px';
    
    
    siteDiv.dataset.offsetY = offsetY;
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  });

  
  function handleDrag(e) {
    if (!isDragging) return;
    
    
    const offsetY = parseFloat(siteDiv.dataset.offsetY) || 0;
    
    
    siteDiv.style.top = (e.clientY - offsetY) + 'px';
    
    
    const container = mode === 'standalone' 
      ? document.getElementById('standaloneSiteConfigs')
      : document.getElementById('collectionSiteConfigs');
    const containers = Array.from(container.children).filter(child => 
      child !== placeholder && child.classList.contains('site-config')
    );
    
    let newIndex = initialIndex;
    for (let i = 0; i < containers.length; i++) {
      const rect = containers[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        newIndex = i;
        break;
      }
      newIndex = i + 1;
    }
    
    
    if (newIndex !== initialIndex) {
      if (newIndex >= containers.length) {
        container.appendChild(placeholder);
      } else {
        container.insertBefore(placeholder, containers[newIndex]);
      }
      initialIndex = newIndex;
    }
  }

  
  function handleDragEnd(e) {
    if (!isDragging) return;
    
    isDragging = false;
    
    
    siteDiv.classList.remove('dragging');
    dragHandle.style.cursor = 'grab';
    
    
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(siteDiv, placeholder);
    }
    
    
    siteDiv.style.position = '';
    siteDiv.style.zIndex = '';
    siteDiv.style.opacity = '';
    siteDiv.style.transform = '';
    siteDiv.style.pointerEvents = '';
    siteDiv.style.left = '';
    siteDiv.style.top = '';
    siteDiv.style.width = '';
    
    
    delete siteDiv.dataset.offsetY;
    
    
    if (placeholder) {
      placeholder.remove();
      placeholder = null;
    }
    
    
    updateSiteOrder(mode);
    
    
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
  }
}


async function updateSiteOrder(mode) {
  const container = mode === 'standalone' 
    ? document.getElementById('standaloneSiteConfigs')
    : document.getElementById('collectionSiteConfigs');
  const containers = Array.from(container.children).filter(child => 
    child.classList.contains('site-config')
  );
  
  
  const newOrder = containers.map(container => {
    return container.getAttribute('data-site-name');
  }).filter(name => name !== null);
  
  console.log(`${mode}模式新的Site顺序:`, newOrder);
  
  
  try {
    
    const { sites: existingUserSettings = {} } = await chrome.storage.sync.get('sites');
    
    
    const updatedUserSettings = { ...existingUserSettings };
    newOrder.forEach((siteName, index) => {
      if (!updatedUserSettings[siteName]) {
        updatedUserSettings[siteName] = {};
      }
      updatedUserSettings[siteName].order = index;
    });
    
    
    await chrome.storage.sync.set({ sites: updatedUserSettings });
    
    console.log(`${mode}模式Site顺序已Update`);
    
    showToast(chrome.i18n.getMessage("saveSuccess"));

    
  } catch (error) {
    console.error('UpdateSite顺序Failed:', error);
    showToast('Save顺序Failed');
  }
}


function initializeNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetSection = link.getAttribute('data-section');
      const targetElement = document.getElementById(targetSection);
      
      if (targetElement) {
        
        navLinks.forEach(navLink => {
          navLink.classList.remove('active');
        });
        
        
        link.classList.add('active');
        
        
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
  
  
  window.addEventListener('scroll', updateActiveNavigation);
}


function updateActiveNavigation() {
  const sections = document.querySelectorAll('.settings-section');
  const navLinks = document.querySelectorAll('.nav-link');
  
  let currentSection = '';
  
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    
    if (rect.top <= 100 && rect.bottom > 100) {
      currentSection = section.id;
    }
  });
  
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-section') === currentSection) {
      link.classList.add('active');
    }
  });
}


async function initializeRuleInfo() {
  try {
    let timeDisplay = chrome.i18n.getMessage('ruleUpdateTimePrefix');
    
    
    let storageTime = null;
    const { siteConfigVersion } = await chrome.storage.local.get('siteConfigVersion');
    if (siteConfigVersion) {
      try {
        const timestamp = parseInt(siteConfigVersion);
        if (!isNaN(timestamp)) {
          storageTime = new Date(timestamp);
          console.log('存储中的时间:', storageTime);
        }
      } catch (error) {
        console.error('解析存储时间Failed:', error);
      }
    }
    
    
    let localTime = null;
    try {
      const response = await fetch(chrome.runtime.getURL('config/siteHandlers.json'));
      const localConfig = await response.json();
      if (localConfig.lastUpdated) {
        localTime = new Date(localConfig.lastUpdated);
        console.log('本地Config文件时间:', localTime);
      }
    } catch (error) {
      console.error('Failed to read local config file:', error);
    }
    
    
    let latestTime = null;
    if (storageTime && localTime) {
      latestTime = storageTime > localTime ? storageTime : localTime;
      console.log('取较大时间:', latestTime);
    } else if (storageTime) {
      latestTime = storageTime;
      console.log('使用存储时间:', latestTime);
    } else if (localTime) {
      latestTime = localTime;
      console.log('使用本地时间:', latestTime);
    }
    
    
    if (latestTime) {
      const year = latestTime.getFullYear();
      const month = String(latestTime.getMonth() + 1).padStart(2, '0');
      const day = String(latestTime.getDate()).padStart(2, '0');
      const hours = String(latestTime.getHours()).padStart(2, '0');
      const minutes = String(latestTime.getMinutes()).padStart(2, '0');
      const seconds = String(latestTime.getSeconds()).padStart(2, '0');
      timeDisplay = `${chrome.i18n.getMessage('ruleUpdateTimePrefix')}${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } else {
      timeDisplay = chrome.i18n.getMessage('ruleUpdateTimeNotAvailable');
    }
    
    
    const timeElement = document.getElementById('ruleUpdateTime');
    if (timeElement) {
      timeElement.textContent = timeDisplay;
    }
    
    
    const devButton = document.getElementById('participateRuleDev');
    if (devButton) {
      devButton.addEventListener('click', () => {
        chrome.tabs.create({
          url: 'https://github.com/taoAIGC/AI-Shortcuts/blob/main/config/siteHandlers.json'
        });
      });
    }
    
  } catch (error) {
    console.error('初始化规则信息Failed:', error);
    
    
    const timeElement = document.getElementById('ruleUpdateTime');
    if (timeElement) {
      timeElement.textContent = chrome.i18n.getMessage('ruleUpdateTimeError');
    }
  }
}


async function initializeDisabledSites() {
  const container = document.getElementById('disabledSitesList');
  if (!container) return;

  try {
    const { disabledSites = [] } = await chrome.storage.sync.get('disabledSites');
    
    if (disabledSites.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="text-align: center; color: #999; padding: 40px;">
          <p>${chrome.i18n.getMessage('noDisabledSites')}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = disabledSites.map(site => `
      <div class="disabled-site-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 8px;">
        <div class="site-info">
          <span class="site-domain" style="font-weight: 500; color: #333;">${site}</span>
          <span class="site-note" style="color: #666; font-size: 12px; margin-left: 8px;">悬浮球已禁用</span>
        </div>
        <div class="site-actions">
          <button class="enable-btn" data-domain="${site}" style="padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            重新启用
          </button>
        </div>
      </div>
    `).join('');

    
    container.addEventListener('click', handleDisabledSiteAction);
    
  } catch (error) {
    console.error('Load禁用网站列表Failed:', error);
    container.innerHTML = `
      <div class="error-state" style="text-align: center; color: #f44336; padding: 40px;">
        <p>LoadFailed，请刷新页面重试</p>
      </div>
    `;
  }
}


async function handleDisabledSiteAction(event) {
  const target = event.target;
  if (!target.matches('.enable-btn')) return;
  
  const domain = target.getAttribute('data-domain');
  if (!domain) return;

  try {
    const { disabledSites = [] } = await chrome.storage.sync.get('disabledSites');
    
    
    const updatedSites = disabledSites.filter(site => site !== domain);
    await chrome.storage.sync.set({ disabledSites: updatedSites });
    
    showToast(`已重新启用 ${domain} 的悬浮球`);

    
    initializeDisabledSites();
    
  } catch (error) {
    console.error('操作Failed:', error);
    showToast('操作Failed，请重试');
  }
}

// ============================

// ============================


let currentEditingTemplateId = null;


async function initializePromptTemplates() {
  try {
    
    await ensureDefaultTemplates();
    
    
    await loadTemplatesList();
    
    
    bindTemplateEvents();
    
    console.log('提示词模板管理初始化Completed');
  } catch (error) {
    console.error('初始化提示词模板Failed:', error);
  }
}


async function ensureDefaultTemplates() {
  try {
    const { promptTemplates = [] } = await chrome.storage.sync.get('promptTemplates');
    
    
    if (promptTemplates.length === 0) {
      console.log('提示词模板为空，将依赖系统自动初始化');
      
      
      try {
        await chrome.runtime.sendMessage({ action: 'initializeDefaultTemplates' });
      } catch (error) {
        console.log('无法发送初始化消息，background 可能已处理:', error);
      }
    }
  } catch (error) {
    console.error('Check默认模板Failed:', error);
  }
}


async function loadTemplatesList() {
  try {
    const { promptTemplates = [] } = await chrome.storage.sync.get('promptTemplates');
    const container = document.getElementById('templatesList');
    
    if (!container) return;
    
    
    const sortedTemplates = promptTemplates.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    if (sortedTemplates.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #666; padding: 40px;">
          <p>暂无提示词模板</p>
          <p style="font-size: 14px;">Click上方"添加新模板"按钮开始创建</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = sortedTemplates.map(template => `
      <div class="template-item" data-template-id="${template.id}" style="
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        transition: box-shadow 0.2s ease;
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 4px 0; font-size: 16px; color: #333;">${template.name}</h4>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #666;">
              <span>顺序: ${template.order}</span>
              ${template.isDefault ? '<span style="background: #e8f5e8; color: #4caf50; padding: 2px 6px; border-radius: 3px;">默认</span>' : ''}
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="edit-template-btn" data-template-id="${template.id}" style="
              background: #f5f5f5;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 6px 12px;
              cursor: pointer;
              font-size: 12px;
              color: #666;
            " data-i18n="editButton">编辑</button>
            ${!template.isDefault ? `<button class="delete-template-btn" data-template-id="${template.id}" style="
              background: #ffebee;
              border: 1px solid #ffcdd2;
              border-radius: 4px;
              padding: 6px 12px;
              cursor: pointer;
              font-size: 12px;
              color: #d32f2f;
            " data-i18n="deleteButton">删除</button>` : ''}
          </div>
        </div>
        <div style="
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 12px;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 13px;
          color: #495057;
          word-break: break-word;
        ">${template.query}</div>
      </div>
    `).join('');
    
    
    container.querySelectorAll('.template-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.boxShadow = 'none';
      });
    });
    
  } catch (error) {
    console.error('Load模板列表Failed:', error);
  }
}


function bindTemplateEvents() {
  
  const addBtn = document.getElementById('addTemplateBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      currentEditingTemplateId = null;
      showTemplateDialog();
    });
  }
  
  
  const dialogClose = document.getElementById('dialogClose');
  const cancelBtn = document.getElementById('cancelTemplate');
  const overlay = document.getElementById('dialogOverlay');
  
  [dialogClose, cancelBtn, overlay].forEach(el => {
    if (el) {
      el.addEventListener('click', hideTemplateDialog);
    }
  });
  
  
  const saveBtn = document.getElementById('saveTemplate');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveTemplate);
  }
  
  
  const templatesList = document.getElementById('templatesList');
  if (templatesList) {
    templatesList.addEventListener('click', handleTemplateListClick);
  }
}


async function handleTemplateListClick(event) {
  const target = event.target;
  const templateId = target.getAttribute('data-template-id');
  
  if (!templateId) return;
  
  if (target.classList.contains('edit-template-btn')) {
    await editTemplate(templateId);
  } else if (target.classList.contains('delete-template-btn')) {
    await deleteTemplate(templateId);
  }
}


function showTemplateDialog(template = null) {
  const dialog = document.getElementById('templateDialog');
  const title = document.getElementById('dialogTitle');
  const nameInput = document.getElementById('templateName');
  const queryInput = document.getElementById('templateQuery');
  const orderInput = document.getElementById('templateOrder');
  
  if (!dialog) return;
  
  if (template) {
    
    title.textContent = chrome.i18n.getMessage('editTemplateTitle');
    nameInput.value = template.name;
    queryInput.value = template.query;
    orderInput.value = template.order || 1;
  } else {
    
    title.textContent = chrome.i18n.getMessage('addTemplateTitle');
    nameInput.value = '';
    queryInput.value = '';
    orderInput.value = getNextOrder();
  }
  
  dialog.style.display = 'block';
  nameInput.focus();
}


function hideTemplateDialog() {
  const dialog = document.getElementById('templateDialog');
  if (dialog) {
    dialog.style.display = 'none';
  }
  currentEditingTemplateId = null;
}


async function getNextOrder() {
  try {
    const { promptTemplates = [] } = await chrome.storage.sync.get('promptTemplates');
    const maxOrder = promptTemplates.reduce((max, template) => 
      Math.max(max, template.order || 0), 0);
    return maxOrder + 1;
  } catch (error) {
    return 1;
  }
}


async function saveTemplate() {
  const nameInput = document.getElementById('templateName');
  const queryInput = document.getElementById('templateQuery');
  const orderInput = document.getElementById('templateOrder');
  
  const name = nameInput.value.trim();
  const query = queryInput.value.trim();
  const order = parseInt(orderInput.value) || 1;
  
  
  if (!name) {
    showToast(chrome.i18n.getMessage('templateNameRequired'));
    nameInput.focus();
    return;
  }
  
  if (!query) {
    showToast(chrome.i18n.getMessage('templateQueryRequired'));
    queryInput.focus();
    return;
  }
  
  try {
    const { promptTemplates = [] } = await chrome.storage.sync.get('promptTemplates');
    
    if (currentEditingTemplateId) {
      
      const index = promptTemplates.findIndex(t => t.id === currentEditingTemplateId);
      if (index !== -1) {
        promptTemplates[index] = {
          ...promptTemplates[index],
          name,
          query,
          order
        };
      }
    } else {
      
      const newTemplate = {
        id: generateTemplateId(),
        name,
        query,
        order,
        isDefault: false
      };
      promptTemplates.push(newTemplate);
    }
    
    await chrome.storage.sync.set({ promptTemplates });
    hideTemplateDialog();
    await loadTemplatesList();
    showToast(chrome.i18n.getMessage('templateSavedSuccess'));
    
  } catch (error) {
    console.error('Save模板Failed:', error);
    showToast('SaveFailed，请重试');
  }
}


async function editTemplate(templateId) {
  try {
    const { promptTemplates = [] } = await chrome.storage.sync.get('promptTemplates');
    const template = promptTemplates.find(t => t.id === templateId);
    
    if (template) {
      currentEditingTemplateId = templateId;
      showTemplateDialog(template);
    }
  } catch (error) {
    console.error('编辑模板Failed:', error);
  }
}


async function deleteTemplate(templateId) {
  const confirmMessage = chrome.i18n.getMessage('confirmDeleteTemplate');
  if (!confirm(confirmMessage)) {
    return;
  }
  
  try {
    const { promptTemplates = [] } = await chrome.storage.sync.get('promptTemplates');
    const filteredTemplates = promptTemplates.filter(t => t.id !== templateId);
    
    await chrome.storage.sync.set({ promptTemplates: filteredTemplates });
    await loadTemplatesList();
    showToast(chrome.i18n.getMessage('templateDeletedSuccess'));
    
  } catch (error) {
    console.error('删除模板Failed:', error);
    showToast('删除Failed，请重试');
  }
}


function generateTemplateId() {
  return 'template_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}


function handleHashNavigation() {
  const hash = window.location.hash;
  if (hash) {
    
    const targetId = hash.substring(1);
    const targetElement = document.getElementById(targetId);
    
    if (targetElement) {
      
      setTimeout(() => {
        targetElement.scrollIntoView({ behavior: 'smooth' });
        
        
        updateNavigationState(targetId);
      }, 100);
    }
  }
}


function updateNavigationState(activeSection) {
  
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  
  const activeLink = document.querySelector(`[data-section="${activeSection}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}


function initializeNavigation() {
  
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      if (section) {
        const targetElement = document.getElementById(section);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
          updateNavigationState(section);
          
          
          window.history.pushState(null, null, `#${section}`);
        }
      }
    });
  });
}


function openHistoryPage() {
  window.location.href = chrome.runtime.getURL('history/history.html');
}


function openFavoritesPage() {
  window.location.href = chrome.runtime.getURL('favorites/favorites.html');
}


document.addEventListener('DOMContentLoaded', () => {
  console.log('Options page loaded');
  
  
  initializeI18n();
  
  
  loadConfig();
  
  
  initializeNavigation();
  
  
  handleHashNavigation();
  
  
  window.addEventListener('hashchange', handleHashNavigation);
  
  
  const historyLink = document.getElementById('historyLink');
  if (historyLink) {
    historyLink.addEventListener('click', (e) => {
      e.preventDefault();
      openHistoryPage();
    });
  }

  
  const favoritesLink = document.getElementById('favoritesLink');
  if (favoritesLink) {
    favoritesLink.addEventListener('click', (e) => {
      e.preventDefault();
      openFavoritesPage();
    });
  }
});