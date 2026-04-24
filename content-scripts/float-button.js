
async function createFloatButton() {
  console.log('脚本开始Load');
  
  
  const i18n = {
    inputPlaceholder: await chrome.i18n.getMessage('inputPlaceholder'),
    startCompare: await chrome.i18n.getMessage('startCompare')
  };
  
  
  const container = document.createElement('div');
  container.className = 'multi-ai-container';

  
  const button = document.createElement('div');
  button.className = 'multi-ai-float-button';
  
  
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/icon48.png');
  button.appendChild(img);

  
  const dialog = document.createElement('div');
  dialog.className = 'multi-ai-dialog';
  dialog.innerHTML = `
    <input 
      type="text" 
      placeholder="${i18n.inputPlaceholder}" 
      id="multiAiInput"
      autocomplete="off"
    >
    <div class="site-list"></div>
    <div class="buttons">
      <button class="search-button">
        ${i18n.startCompare}
      </button>
      <img src="${chrome.runtime.getURL('icons/more_32.png')}" class="more-icon">
    </div>
  `;

  
  const closeBtn = document.createElement('div');
  closeBtn.className = 'close-button';
  closeBtn.innerHTML = '×';

  
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();  
    e.preventDefault();   
    showCloseOptionsDialog(container, e);
    return false;        
  });

  
  button.appendChild(closeBtn);

  
  button.addEventListener('click', (e) => {
    e.stopPropagation(); 
    e.preventDefault();  
    
    if (!hasMoved) {  
      console.log('浮动按钮Click，发送TOGGLE_SIDE_PANEL消息');
      chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('发送消息Failed:', chrome.runtime.lastError);
        } else {
          console.log('收到响应:', response);
        }
      });
    } else {
      console.log('按钮被拖拽，不TriggerClick事件，hasMoved:', hasMoved);
    }
  });

  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  
  const shortcutText = isMac ? '⌘+M 打开侧边栏' : 'Ctrl+M 打开侧边栏';
  
  button.addEventListener('mouseenter', () => {
    const tooltip = document.createElement('div');
    tooltip.className = 'multi-ai-tooltip';
    tooltip.textContent = shortcutText;
    button.appendChild(tooltip);
    setTimeout(() => {
      if (tooltip && tooltip.parentNode === button) {
        tooltip.remove();
      }
    }, 500);
  });

  
  const iconContainer = document.createElement('div');
  iconContainer.className = 'icon-container';


  
  const settingIcon = document.createElement('img');
  settingIcon.src = chrome.runtime.getURL('icons/extension-setting.png');
  settingIcon.className = 'bottom-icon setting-icon';
  settingIcon.title = 'Settings';

  
  settingIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'openOptionsPage' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      }
    });
  });

  
  const feedbackIcon = document.createElement('img');
  feedbackIcon.src = chrome.runtime.getURL('icons/feedback.png');
  feedbackIcon.className = 'bottom-icon feedback-icon';
  feedbackIcon.title = '反馈';

  
  feedbackIcon.addEventListener('click', async (e) => {
    e.stopPropagation();
    const externalLinks = await window.AppConfigManager.getExternalLinks();
    window.open(externalLinks.feedbackSurvey, '_blank');
  });

  
  iconContainer.appendChild(settingIcon);
  iconContainer.appendChild(feedbackIcon);

  
  container.appendChild(button);
  container.appendChild(iconContainer);

  
  container.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  
  document.body.appendChild(container);
  document.body.appendChild(dialog);

 
  
  
  const initialTop = window.innerHeight / 2 - container.offsetHeight / 2;
  container.style.top = `${initialTop}px`;
  container.style.transform = 'none';  

  
  let isDragging = false;
  let startY = 0;
  let startTop = 0;
  let hasMoved = false;
  const DRAG_THRESHOLD = 10; 

  
  button.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation(); 
    isDragging = true;
    hasMoved = false;  
    startY = e.clientY;
    const rect = container.getBoundingClientRect();
    startTop = rect.top;
    container.classList.add('dragging');
  });

  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaY = e.clientY - startY;
    const moveDistance = Math.abs(deltaY);
    
    
    if (moveDistance > DRAG_THRESHOLD) {
      hasMoved = true;
    }
    
    
    if (hasMoved) {
      const newTop = startTop + deltaY;
      const maxTop = window.innerHeight - container.offsetHeight;
      const boundedTop = Math.max(0, Math.min(newTop, maxTop));
      container.style.top = `${boundedTop}px`;
      container.style.transform = 'none';
    }
  });

  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      container.classList.remove('dragging');
    }
  });

  
  button.addEventListener('selectstart', (e) => e.preventDefault());

  
  document.addEventListener('keydown', (e) => {
    
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
      e.preventDefault(); 
      chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL' });
    }
  });

  
  const moreIcon = dialog.querySelector('.more-icon');
  moreIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'openOptionsPage' });
  });
  
  
  document.addEventListener('click', (e) => {
    if (!dialog.contains(e.target) && !button.contains(e.target)) {
      dialog.classList.remove('show');
    }
  });
  
  
  const searchButton = dialog.querySelector('.search-button');
  const input = dialog.querySelector('#multiAiInput');
  
  searchButton.addEventListener('click', () => {
    console.log('searchButton clicked');
    const query = input.value.trim();
    if (!query) {
      input.classList.add('shake');
      setTimeout(() => {
        input.classList.remove('shake');
      }, 500);  
      return;
    }
    console.log('query:', query);
    const selectedSites = getSelectedSites();
    console.log('selectedSites:', selectedSites);
    if (selectedSites.length === 0) return;
    
    chrome.runtime.sendMessage({
      action: 'processQuery',
      query: query,
      sites: selectedSites
    });
  });
}





function showCloseOptionsDialog(container, event) {
  
  const existingDialog = document.querySelector('.close-options-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }

  
  const mouseX = event ? event.clientX : window.innerWidth / 2;
  const mouseY = event ? event.clientY : window.innerHeight / 2;

  
  const overlay = document.createElement('div');
  overlay.className = 'close-options-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2147483646;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  
  const dialog = document.createElement('div');
  dialog.className = 'close-options-dialog';
  
  
  const dialogWidth = 350; 
  const dialogHeight = 220; 
  const offsetX = -40; 
  const offsetY = -dialogHeight / 2; 
  
  
  let finalLeft = mouseX + offsetX - dialogWidth;
  let finalTop = mouseY + offsetY;
  
  
  finalLeft = Math.max(20, Math.min(finalLeft, window.innerWidth - dialogWidth - 20));
  finalTop = Math.max(20, Math.min(finalTop, window.innerHeight - dialogHeight - 20));
  
  dialog.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    padding: 24px;
    min-width: 300px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: closeDialogSlideIn 0.3s ease-out;
    position: fixed;
    left: ${finalLeft}px;
    top: ${finalTop}px;
    z-index: 2147483647;
  `;

  
  overlay.style.justifyContent = 'unset';
  overlay.style.alignItems = 'unset';

  dialog.innerHTML = `
    <style>
      @keyframes closeDialogSlideIn {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
    </style>
    <div class="dialog-header" style="margin-bottom: 20px;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #333;">关闭悬浮球</h3>
      <div style="position: absolute; top: 16px; right: 16px; cursor: pointer; font-size: 24px; color: #999; line-height: 1;" onclick="this.closest('.close-options-overlay').remove()">×</div>
    </div>
    <div class="dialog-options" style="margin-bottom: 24px;">
      <label class="option-item" style="display: block; margin-bottom: 16px; cursor: pointer;">
        <input type="radio" name="closeOption" value="temporary" checked style="margin-right: 12px;">
        <span style="color: #333; font-size: 14px;">本次关闭直到下次访问</span>
      </label>
      <label class="option-item" style="display: block; margin-bottom: 16px; cursor: pointer;">
        <input type="radio" name="closeOption" value="currentSite" style="margin-right: 12px;">
        <span style="color: #333; font-size: 14px;">当前网站禁用</span>
        <span style="color: #999; font-size: 12px; margin-left: 24px;">(可在Settings页开启)</span>
      </label>
      <label class="option-item" style="display: block; margin-bottom: 0; cursor: pointer;">
        <input type="radio" name="closeOption" value="permanent" style="margin-right: 12px;">
        <span style="color: #333; font-size: 14px;">永久禁用</span>
        <span style="color: #999; font-size: 12px; margin-left: 24px;">(可在Settings页开启)</span>
      </label>
    </div>
    <div class="dialog-buttons" style="display: flex; justify-content: flex-end; gap: 12px;">
      <button class="cancel-btn" style="padding: 8px 16px; background: transparent; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 14px; color: #666;">取消</button>
      <button class="confirm-btn" style="padding: 8px 16px; background: #e91e63; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">确定</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  
  const cancelBtn = dialog.querySelector('.cancel-btn');
  const confirmBtn = dialog.querySelector('.confirm-btn');

  
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  
  confirmBtn.addEventListener('click', () => {
    const selectedOption = dialog.querySelector('input[name="closeOption"]:checked').value;
    handleCloseOption(selectedOption, container);
    overlay.remove();
  });

  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });
}


function handleCloseOption(option, container) {
  const currentDomain = window.location.hostname;
  
  switch (option) {
    case 'temporary':
      
      container.remove();
      console.log('悬浮球已临时关闭');
      break;
      
    case 'currentSite':
      
      chrome.storage.sync.get(['disabledSites'], (result) => {
        const disabledSites = result.disabledSites || [];
        if (!disabledSites.includes(currentDomain)) {
          disabledSites.push(currentDomain);
          chrome.storage.sync.set({ disabledSites }, () => {
            console.log(`已禁用 ${currentDomain} 的悬浮球`);
            container.remove();
          });
        } else {
          container.remove();
        }
      });
      break;
      
    case 'permanent':
      
      chrome.storage.sync.get(['buttonConfig'], (result) => {
        const currentButtonConfig = result.buttonConfig || {};
        const updatedButtonConfig = {
          ...currentButtonConfig,
          floatButton: false
        };
        
        chrome.storage.sync.set({ 
          buttonConfig: updatedButtonConfig 
        }, () => {
          console.log('悬浮球已永久禁用，其他快捷入口不受影响');
          container.remove();
        });
      });
      break;
  }
}



chrome.storage.sync.get(['buttonConfig', 'disabledSites'], async function(result) {
  
  const defaultButtonConfig = await window.AppConfigManager.getButtonConfig();
  const buttonConfig = result.buttonConfig || defaultButtonConfig;
  const disabledSites = result.disabledSites || [];
  const currentDomain = window.location.hostname;
  
  
  if (!buttonConfig.floatButton) {
    console.log('浮动按钮已全局禁用');
    return;
  }
  
  if (disabledSites.includes(currentDomain)) {
    console.log(`当前网站 ${currentDomain} 的悬浮球已被禁用`);
    return;
  }
  
  
  createFloatButton();
});
