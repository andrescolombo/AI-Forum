
console.log('🎯 inject.js script loaded');


let __aiCompareHistoryContext = {
  historyId: null,
  siteName: null
};


async function isAISite() {
  try {
    
    if (window.siteDetector) {
      const isAI = await window.siteDetector.isAISite();
      if (isAI) {
        console.log('🎯 Matched AI site using new detector');
      } else {
        console.log('🎯 New detector: Current site is not in AI site configuration');
      }
      return isAI;
    }
    
    
    if (!window.getDefaultSites) {
      console.log('🎯 getDefaultSites 函数不可用，跳过处理');
      return false;
    }
    
    const sites = await window.getDefaultSites();
    
    if (!sites || !Array.isArray(sites)) {
      console.log('🎯 获取Site列表Failed，跳过处理');
      return false;
    }
    
    const currentHostname = window.location.hostname;
    
    
    const matchedSite = sites.find(site => {
      if (!site.url || site.hidden) return false;
      
      try {
        const siteUrl = new URL(site.url);
        const siteHostname = siteUrl.hostname;
        
        
        return currentHostname === siteHostname || 
               currentHostname.includes(siteHostname) || 
               siteHostname.includes(currentHostname);
      } catch (urlError) {
        return false;
      }
    });
    
    if (matchedSite) {
      console.log('🎯 匹配到 AI Site:', matchedSite.name);
      return true;
    } else {
      console.log('🎯 当前Site不在 AI SiteConfig中，跳过处理');
      return false;
    }
  } catch (error) {
    console.log('🎯 Check AI SiteConfigFailed:', error);
    return false;
  }
}


let isAISiteChecked = false;
let isAISiteResult = false;

async function checkAISite() {
  if (!isAISiteChecked) {
    isAISiteResult = await isAISite();
    isAISiteChecked = true;
  }
  return isAISiteResult;
}


async function executeSiteHandler(query, handlerConfig) {
  console.log('🚀 executeSiteHandler 开始Execute');
  console.log('🔍 调试信息 - 查询内容:', query);
  console.log('🔍 调试信息 - 处理器Config:', handlerConfig);
  
  if (!handlerConfig || !handlerConfig.steps) {
    console.error('❌ 无效的处理器Config');
    return;
  }

  console.log('✅ 开始ExecuteConfig化处理器，Step数:', handlerConfig.steps.length);

  for (let i = 0; i < handlerConfig.steps.length; i++) {
    const step = handlerConfig.steps[i];
    console.log(`ExecuteStep ${i + 1}:`, step.action);

    try {
      switch (step.action) {
        case 'click':
          await executeClick(step);
          break;
        case 'focus':
          await executeFocus(step);
          break;
        case 'setValue':
          await executeSetValue(step, query);
          break;
        case 'triggerEvents':
          await executeTriggerEvents(step);
          break;
        case 'sendKeys':
          await executeSendKeys(step, query);
          break;
        case 'replace':
          await executeReplace(step, query);
          break;
        case 'wait':
          await executeWait(step);
          break;
        case 'custom':
          await executeCustom(step, query);
          break;
        case 'paste':
          await executePaste(step);
          break;
        default:
          console.warn('未知的Step类型:', step.action);
      }

      
      if (step.waitAfter) {
        await new Promise(resolve => setTimeout(resolve, step.waitAfter));
      }
    } catch (error) {
      console.error(`Step ${i + 1} ExecuteFailed:`, error);
      if (step.required !== false) { 
        throw error;
      }
    }
  }

  console.log('Configuration handler execution completed');
}

// Execute paste operation
async function executePaste(step) {
  console.log('🎯 Executing paste operation');
  console.log('粘贴StepConfig:', step);
  
  
  console.log('🔍 Config验证:');
  console.log('- window.AppConfigManager 存在:', !!window.AppConfigManager);
  if (window.AppConfigManager) {
    try {
      const testTypes = await window.AppConfigManager.getAllSupportedFileTypes();
      console.log('- ConfigLoadSuccessful，支持文件类型数量:', testTypes.length);
    } catch (error) {
      console.error('- ConfigLoadFailed:', error);
    }
  }
  
  try {
    
    if (window._currentFileData) {
      console.log('🎯 使用传递的文件数据进行粘贴');
      await handleFileDataPaste(window._currentFileData);
      return;
    }
    
    
    const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' });
    console.log('剪贴板权限状态:', permissionStatus.state);
    console.log('权限详情:', permissionStatus);
    
    if (permissionStatus.state === 'denied') {
      console.log('❌ 剪贴板权限被拒绝，无法Execute粘贴操作');
      throw new Error('剪贴板权限被拒绝');
    }
    
    if (permissionStatus.state === 'prompt') {
      console.log('🔄 剪贴板权限需要用户授权，尝试请求权限...');
    }
    
    
    console.log('🔍 Check文档焦点状态...');
    if (!document.hasFocus()) {
      console.log('⚠️ 文档没有焦点，尝试获取焦点...');
      window.focus();
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    
    const activeElement = document.activeElement;
    console.log('当前Focus元素:', activeElement);
    
    
    console.log('📋 尝试读取剪贴板内容...');
    let clipboardData;
    try {
      clipboardData = await navigator.clipboard.read();
    } catch (clipboardError) {
      console.log('❌ 剪贴板读取Failed:', clipboardError.message);
      
      
      if (clipboardError.name === 'NotAllowedError' && clipboardError.message.includes('not focused')) {
        console.log('🔄 检测到焦点问题，尝试通过模拟用户交互解决...');
        
        
        const tempButton = document.createElement('button');
        tempButton.style.position = 'fixed';
        tempButton.style.top = '-1000px';
        tempButton.style.left = '-1000px';
        tempButton.style.opacity = '0';
        tempButton.style.pointerEvents = 'none';
        document.body.appendChild(tempButton);
        
        
        tempButton.focus();
        tempButton.click();
        
        
        try {
          clipboardData = await navigator.clipboard.read();
          console.log('✅ 通过用户交互Successful读取剪贴板');
        } catch (retryError) {
          console.log('❌ 重试仍然Failed:', retryError.message);
          throw retryError;
        } finally {
          
          document.body.removeChild(tempButton);
        }
      } else {
        throw clipboardError;
      }
    }
    console.log('剪切板内容:', clipboardData);
    console.log('剪贴板项目数量:', clipboardData.length);
    
    if (clipboardData.length === 0) {
      console.log('❌ 剪贴板为空');
      throw new Error('剪贴板为空');
    }
    
    
    
    const fileTypes = await window.AppConfigManager.getAllSupportedFileTypes();
    console.log('从Config获取支持的文件类型:', fileTypes);
    
    for (const item of clipboardData) {
      console.log('剪贴板项目类型:', item.types);
      
      
      const isFile = fileTypes.some(type => item.types.includes(type));
      
      if (isFile) {
        console.log('🎯 检测到文件在剪贴板中，类型:', item.types);
        
        
        let file = null;
        let fileType = null;
        
        
        if (item.types.includes('Files')) {
          file = await item.getType('Files');
          fileType = 'Files';
        } else {
          
          for (const type of fileTypes) {
            if (item.types.includes(type)) {
              file = await item.getType(type);
              fileType = type;
              break;
            }
          }
        }
        
        console.log('文件对象:', file);
        console.log('文件类型:', fileType);
        
        
        const dataTransfer = new DataTransfer();
        if (file) {
          
          let fileToAdd = file;
          if (file instanceof Blob && !(file instanceof File)) {
            
            let fileName = null;
            if (window.AppConfigManager) {
              fileName = await window.AppConfigManager.generateFileName(null, fileType, 'clipboard');
              console.log('🎯 生成智能文件名:', fileName, '基于 MIME 类型:', fileType);
            } else {
              
              const extension = await getFileExtensionFromMimeType(fileType);
              fileName = `clipboard-${Date.now()}.${extension}`;
            }
            
            fileToAdd = new File([file], fileName, { type: fileType });
            console.log('将 Blob 转换为 File:', {
              name: fileToAdd.name,
              type: fileToAdd.type,
              size: fileToAdd.size,
              originalType: fileType
            });
          }
          dataTransfer.items.add(fileToAdd);
        }
        
        
        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true
        });
        
        
        const activeElement = document.activeElement;
        if (activeElement) {
          console.log('已向Focus元素发送文件粘贴事件:', activeElement);
          activeElement.dispatchEvent(pasteEvent);
        } else {
          console.log('没有Focus的元素，向 document 发送文件粘贴事件');
          document.dispatchEvent(pasteEvent);
        }
        
        console.log('✅ 文件粘贴事件已Trigger');
        
      } else if (item.types.includes('text/plain')) {
        console.log('🎯 检测到文本在剪贴板中');
        
        
        const textContent = await item.getType('text/plain');
        console.log('文本内容:', textContent);
        
        
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', textContent);
        
        
        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true
        });
        
        
        const activeElement = document.activeElement;
        if (activeElement) {
          console.log('已向Focus元素发送文本粘贴事件:', activeElement);
          activeElement.dispatchEvent(pasteEvent);
        } else {
          console.log('没有Focus的元素，向 document 发送文本粘贴事件');
          document.dispatchEvent(pasteEvent);
        }
        
        console.log('✅ 文本粘贴事件已Trigger');
      }
    }
    
    console.log('✅ 粘贴操作ExecuteCompleted');
    
  } catch (error) {
    console.error('❌ 粘贴操作Failed:', error);
    throw error;
  }
}


async function executeClick(step) {
  let element = null;
  let foundSelector = null;
  
  
  const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
  
  for (const selector of selectors) {
    
    if (selector.startsWith('text:')) {
      const textToFind = selector.substring(5);
      
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent || btn.innerText || btn.getAttribute('aria-label') || '';
        if (text.toLowerCase().includes(textToFind.toLowerCase())) {
          element = btn;
          foundSelector = selector;
          break;
        }
      }
      if (element) break;
    } else {
      
      element = document.querySelector(selector);
      if (element) {
        foundSelector = selector;
        break;
      }
    }
  }
  
  if (!element) {
    throw new Error(`未找到任何元素，尝试的选择器: ${selectors.join(', ')}`);
  }
  
  if (step.condition) {
    
    const conditionElement = document.querySelector(step.condition.selector);
    if (!conditionElement) {
      console.log(`条件元素不存在，跳过Click: ${step.condition.selector}`);
      return;
    }
  }

  
  if (step.retryOnDisabled) {
    const maxAttempts = step.maxAttempts || 5;
    const retryInterval = step.retryInterval || 200;
    let attempts = 0;
    
    const tryClick = () => {
      if (!element.disabled) {
        element.click();
        console.log('Click元素:', foundSelector);
        return;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`按钮被禁用，${retryInterval}ms后重试 (${attempts}/${maxAttempts})`);
        setTimeout(tryClick, retryInterval);
      } else {
        console.error('达到最大尝试次数，按钮仍然被禁用');
      }
    };
    
    
    setTimeout(tryClick, 100);
  } else {
    element.click();
    console.log('Click元素:', foundSelector);
  }
}


async function executeFocus(step) {
  let element = null;
  let foundSelector = null;
  
  
  const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
  
  
  const maxAttempts = step.maxAttempts || (step.waitForElement ? 5 : 1);
  const retryInterval = step.retryInterval || 200;
  let attempts = 0;
  
  const tryFocus = async () => {
    
    for (const selector of selectors) {
      element = document.querySelector(selector);
      if (element) {
        foundSelector = selector;
        break;
      }
    }
    
    if (element) {
      
      element.focus();
      console.log('Focus元素:', foundSelector);
      return;
    }
    
    
    attempts++;
    if (attempts < maxAttempts && (step.waitForElement || step.maxAttempts)) {
      console.log(`元素未找到，${retryInterval}ms后重试 (${attempts}/${maxAttempts}): ${selectors.join(', ')}`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      return tryFocus();
    } else {
      throw new Error(`未找到任何元素，尝试的选择器: ${selectors.join(', ')}`);
    }
  };
  
  await tryFocus();
}


async function executeSetValue(step, query) {
  let element = null;
  let foundSelector = null;
  
  
  const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
  
  
  const maxAttempts = step.maxAttempts || (step.waitForElement ? 5 : 1);
  const retryInterval = step.retryInterval || 200;
  let attempts = 0;
  
  const trySetValue = async () => {
    
    for (const selector of selectors) {
      element = document.querySelector(selector);
      if (element) {
        foundSelector = selector;
        break;
      }
    }
    
    if (!element) {
      
      attempts++;
      if (attempts < maxAttempts && (step.waitForElement || step.maxAttempts)) {
        console.log(`元素未找到，${retryInterval}ms后重试 (${attempts}/${maxAttempts}): ${selectors.join(', ')}`);
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        return trySetValue();
      } else {
        throw new Error(`未找到任何元素，尝试的选择器: ${selectors.join(', ')}`);
      }
    }
    
    
    return element;
  };
  
  element = await trySetValue();

  if (step.inputType === 'contenteditable') {

    // If a customSetValue strategy is specified, route to the legacy handler
    if (step.customSetValue) {
      await executeLegacySpecialSetValue(step, query);
      return;
    }

    const isLexicalEditor = element.hasAttribute('data-lexical-editor') ||
                           element.getAttribute('data-lexical-editor') === 'true';
    
    if (isLexicalEditor) {
      
      console.log('检测到 Lexical 编辑器，尝试Update内容');
      
      
      let updatedViaAPI = false;
      try {
        
        const editorKey = Object.keys(element).find(key => 
          key.includes('__lexical') || key.includes('lexical') || key.includes('editor')
        );
        
        if (editorKey && element[editorKey]) {
          const editor = element[editorKey];
          if (editor.update && typeof editor.update === 'function') {
            editor.update(() => {
              const root = editor.getRootElement();
              if (root) {
                root.innerHTML = '';
                const p = document.createElement('p');
                const span = document.createElement('span');
                span.setAttribute('data-lexical-text', 'true');
                span.textContent = query;
                p.appendChild(span);
                root.appendChild(p);
              }
            });
            updatedViaAPI = true;
            console.log('通过 Lexical API Update内容');
          }
        }
      } catch (apiError) {
        console.log('Lexical API 方法Failed，尝试其他方法:', apiError);
      }
      
      
      if (!updatedViaAPI) {
        
        element.focus();
        
        
        const pElements = element.querySelectorAll('p');
        if (pElements.length > 0) {
          if (pElements.length > 1) {
            for (let i = 1; i < pElements.length; i++) {
              pElements[i].remove();
            }
          }
          const pElement = pElements[0];
          
          
          if (query.trim()) {
            pElement.innerHTML = '';
            const span = document.createElement('span');
            span.setAttribute('data-lexical-text', 'true');
            span.textContent = query;
            pElement.appendChild(span);
          } else {
            pElement.innerHTML = '';
          }
        } else {
          
          element.innerHTML = '';
          const pElement = document.createElement('p');
          if (query.trim()) {
            const span = document.createElement('span');
            span.setAttribute('data-lexical-text', 'true');
            span.textContent = query;
            pElement.appendChild(span);
          }
          element.appendChild(pElement);
        }
        
        
        
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: query
        });
        element.dispatchEvent(inputEvent);
        
        
        const beforeInputEvent = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: query
        });
        element.dispatchEvent(beforeInputEvent);
        
        
        element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        element.dispatchEvent(new CompositionEvent('compositionupdate', { 
          bubbles: true, 
          data: query 
        }));
        element.dispatchEvent(new CompositionEvent('compositionend', { 
          bubbles: true, 
          data: query 
        }));
        
        
        const changeEvent = new Event('change', {
          bubbles: true,
          cancelable: true
        });
        element.dispatchEvent(changeEvent);
        
        
        let execCommandSuccess = false;
        try {
          
          const range = document.createRange();
          range.selectNodeContents(element);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          
          if (document.execCommand('insertText', false, query)) {
            console.log('使用 execCommand 插入文本Successful');
            execCommandSuccess = true;
          }
        } catch (execError) {
          console.log('execCommand 方法Failed:', execError);
        }
        
        
        if (!execCommandSuccess && query.trim()) {
          try {
            
            element.focus();
            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', query);
            
            
            const pasteEvent = new ClipboardEvent('paste', {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true
            });
            
            
            const beforeInputEvent = new InputEvent('beforeinput', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertFromPaste',
              data: query
            });
            element.dispatchEvent(beforeInputEvent);
            
            
            const pasteHandled = element.dispatchEvent(pasteEvent);
            
            if (pasteHandled) {
              console.log('通过模拟粘贴事件Completed');
            } else {
              
              document.execCommand('insertText', false, query);
              console.log('通过 insertText 命令Completed');
            }
          } catch (fallbackError) {
            console.log('备用方法Failed:', fallbackError);
          }
        }
        
        console.log('Lexical 编辑器内容已Settings（通过 DOM + 事件）');
      }
    } else {
      
      
      const pElements = element.querySelectorAll('p');
      
      if (pElements.length > 0) {
        
        if (pElements.length > 1) {
          
          for (let i = 1; i < pElements.length; i++) {
            pElements[i].remove();
          }
        }
        const pElement = pElements[0];
        
        pElement.classList.remove('is-empty', 'is-editor-empty');
        
        pElement.innerText = query;
        
        if (!query.trim()) {
          pElement.innerHTML = '';
        }
      } else {
        
        element.innerHTML = '<p></p>';
        const newP = element.querySelector('p');
        if (newP) {
          newP.innerText = query;
        }
      }
    }
  } else if (step.inputType === 'special') {
    
    await executeSpecialSetValue(step, query, element);
  } else if (step.inputType === 'angular') {
    
    
    
    
    
    element.focus();
    element.value = query;
    
    
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: query
    });
    element.dispatchEvent(inputEvent);
    
    
    const changeEvent = new Event('change', {
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(changeEvent);
    
    
    
    try {
      
      const ngElement = element;
      if (ngElement.__ngContext__) {
        
        const context = ngElement.__ngContext__;
        for (let i = 0; i < context.length; i++) {
          if (context[i] && typeof context[i].setValue === 'function') {
            context[i].setValue(query);
            console.log('通过 Angular FormControl API Settings值');
            break;
          }
        }
      }
    } catch (error) {
      
      console.log('无法访问 Angular FormControl API，使用事件方式');
    }
    
    
    element.focus();
    
    console.log('Angular FormControl 值已Settings并Trigger事件');
  } else {
    
    element.value = query;
    
    
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: query
    });
    element.dispatchEvent(inputEvent);
  }

  console.log('Settings元素值:', foundSelector);
}


async function executeSpecialSetValue(step, query, element) {
  const specialConfig = step.specialConfig;
  
  if (!specialConfig) {
    
    await executeLegacySpecialSetValue(step, query);
    return;
  }
  
  switch (specialConfig.type) {
    case 'lexical-editor':
      await handleLexicalEditor(specialConfig, query);
      break;
    case 'growing-textarea':
      await handleGrowingTextarea(specialConfig, query);
      break;
    case 'custom-element':
      await handleCustomElement(specialConfig, query);
      break;
    case 'multi-sync':
      await handleMultiSync(specialConfig, query);
      break;
    default:
      console.warn('未知的特殊处理类型:', specialConfig.type);
      
      element.value = query;
  }
}


async function handleLexicalEditor(config, query) {
  const container = document.querySelector(config.containerSelector);
  if (!container) {
    throw new Error(`未找到容器元素: ${config.containerSelector}`);
  }
  
  
  if (config.clearContainer !== false) {
    container.innerHTML = '';
  }
  
  
  const element = document.createElement(config.elementType || 'span');
  
  
  if (config.attributes) {
    Object.entries(config.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  
  if (config.contentType === 'innerHTML') {
    element.innerHTML = query;
  } else {
    element.textContent = query;
  }
  
  
  container.appendChild(element);
  
  console.log('Lexical 编辑器内容已Settings');
}


async function handleGrowingTextarea(config, query) {
  const container = document.querySelector(config.containerSelector);
  if (!container) {
    throw new Error(`未找到容器元素: ${config.containerSelector}`);
  }
  
  
  if (config.containerAttribute) {
    container.setAttribute(config.containerAttribute, query);
  }
  
  
  if (config.inputSelector) {
    const input = container.querySelector(config.inputSelector);
    if (input) {
      input.value = query;
    }
  }
  
  console.log('自适应文本框内容已Settings');
}


async function handleCustomElement(config, query) {
  const element = document.querySelector(config.selector);
  if (!element) {
    throw new Error(`未找到元素: ${config.selector}`);
  }
  
  
  if (config.method === 'setAttribute') {
    element.setAttribute(config.attribute, query);
  } else if (config.method === 'setProperty') {
    element[config.property] = query;
  } else if (config.method === 'innerHTML') {
    element.innerHTML = query;
  } else if (config.method === 'textContent') {
    element.textContent = query;
  }
  
  console.log('自定义元素内容已Settings');
}


async function handleMultiSync(config, query) {
  const elements = config.elements || [];
  
  for (const elementConfig of elements) {
    const element = document.querySelector(elementConfig.selector);
    if (element) {
      if (elementConfig.method === 'value') {
        element.value = query;
      } else if (elementConfig.method === 'attribute') {
        element.setAttribute(elementConfig.attribute, query);
      } else if (elementConfig.method === 'textContent') {
        element.textContent = query;
      }
    }
  }
  
  console.log('多元素同步Completed');
}


async function executeLegacySpecialSetValue(step, query) {
  if (step.customSetValue === 'wenxin') {
    const p = document.querySelector('p.yc-editor-paragraph');
    if (p) {
      p.innerHTML = '';
    }
    const span = document.createElement('span');
    span.setAttribute('data-lexical-text', 'true');
    span.textContent = query;
    p.appendChild(span);
  } else if (step.customSetValue === 'poe') {
    const growingTextArea = document.querySelector('.GrowingTextArea_growWrap__im5W3');
    if (growingTextArea) {
      growingTextArea.setAttribute('data-replicated-value', query);
      const textarea = growingTextArea.querySelector('textarea');
      if (textarea) {
        textarea.value = query;
      }
    }
  } else if (step.customSetValue === 'prosemirror') {
    // ProseMirror / Tiptap editor (used by Claude)
    // The correct method: focus, select all, then use execCommand insertText
    // This triggers ProseMirror's internal state update which enables the send button
    const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
    let editor = null;
    for (const sel of selectors) {
      editor = document.querySelector(sel);
      if (editor) break;
    }
    if (!editor) {
      throw new Error('ProseMirror editor element not found');
    }

    // Step 1: Focus the editor
    editor.focus();
    await new Promise(r => setTimeout(r, 100));

    // Step 2: Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);

    // Step 3: Use execCommand to replace content — ProseMirror listens to this
    try {
      document.execCommand('insertText', false, query);
      console.log('ProseMirror: text inserted via execCommand insertText');
    } catch (e) {
      // Fallback: direct DOM manipulation + input event
      editor.innerHTML = '<p>' + query.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: query
      }));
      console.log('ProseMirror: text inserted via innerHTML fallback');
    }

    // Step 4: Dispatch input event to ensure React/ProseMirror picks up the change
    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: query
    }));
    await new Promise(r => setTimeout(r, 200));
  }
}


async function executeTriggerEvents(step) {
  let element = null;
  let foundSelector = null;
  
  
  const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
  
  
  const maxAttempts = step.maxAttempts || (step.waitForElement ? 5 : 1);
  const retryInterval = step.retryInterval || 200;
  let attempts = 0;
  
  const tryTriggerEvents = async () => {
    
    let foundElement = null;
    let foundSel = null;
    
    for (const selector of selectors) {
      foundElement = document.querySelector(selector);
      if (foundElement) {
        foundSel = selector;
        break;
      }
    }
    
    if (!foundElement) {
      
      attempts++;
      if (attempts < maxAttempts && (step.waitForElement || step.maxAttempts)) {
        console.log(`元素未找到，${retryInterval}ms后重试 (${attempts}/${maxAttempts}): ${selectors.join(', ')}`);
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        return tryTriggerEvents();
      } else {
        throw new Error(`未找到任何元素，尝试的选择器: ${selectors.join(', ')}`);
      }
    }
    
    
    element = foundElement;
    foundSelector = foundSel;
    return { element: foundElement, selector: foundSel };
  };
  
  const result = await tryTriggerEvents();
  element = result.element;
  foundSelector = result.selector;

  const events = step.events || ['input', 'change'];
  events.forEach(eventName => {
    if (eventName === 'input' && step.inputType === 'special') {
      
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: element.value || element.innerText
      });
      element.dispatchEvent(inputEvent);
    } else {
      element.dispatchEvent(new Event(eventName, { bubbles: true }));
    }
  });

  console.log('Trigger事件:', events, '在元素:', foundSelector);
}


async function executeSendKeys(step, query) {
  let element = null;
  let foundSelector = null;
  
  
  const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
  
  for (const selector of selectors) {
    element = document.querySelector(selector);
    if (element) {
      foundSelector = selector;
      break;
    }
  }
  
  if (!element) {
    throw new Error(`未找到任何元素，尝试的选择器: ${selectors.join(', ')}`);
  }

  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;

  if (step.keys === 'Enter') {
    const enterEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      location: 0,
      repeat: false,
      isComposing: false
    });
    element.dispatchEvent(enterEvent);
    console.log('发送回车键到元素:', foundSelector);
  } else if (step.keys === '⌘ + Enter' || step.keys === 'Command+Enter' || step.keys === 'Meta+Enter') {
    
    
    const metaKey = isMac; 
    const ctrlKey = !isMac; 
    
    
    const keyDownEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      location: 0,
      repeat: false,
      isComposing: false,
      ctrlKey: ctrlKey,
      metaKey: metaKey,
      shiftKey: false,
      altKey: false
    });
    element.dispatchEvent(keyDownEvent);
    
    
    const keyUpEvent = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      location: 0,
      repeat: false,
      isComposing: false,
      ctrlKey: ctrlKey,
      metaKey: metaKey,
      shiftKey: false,
      altKey: false
    });
    element.dispatchEvent(keyUpEvent);
    
    console.log(`发送 ${isMac ? '⌘ + Enter (Meta+Enter)' : 'Ctrl + Enter'} 到元素:`, foundSelector);
  } else if (step.keys === 'Ctrl+Enter' || step.keys === 'Control+Enter') {
    
    const keyDownEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      location: 0,
      repeat: false,
      isComposing: false,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false
    });
    element.dispatchEvent(keyDownEvent);
    
    const keyUpEvent = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      location: 0,
      repeat: false,
      isComposing: false,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false
    });
    element.dispatchEvent(keyUpEvent);
    
    console.log('发送 Ctrl + Enter 到元素:', foundSelector);
  } else {
    console.warn('不支持的按键类型:', step.keys);
  }
}


async function executeReplace(step, query) {
  console.log('🔧 executeReplace 开始Execute');
  console.log('🔧 StepConfig:', step);
  console.log('🔧 查询内容:', query);
  
  let element = null;
  let foundSelector = null;
  
  
  const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
  console.log('🔧 尝试的选择器:', selectors);
  
  for (const selector of selectors) {
    element = document.querySelector(selector);
    console.log(`🔧 选择器 ${selector} 结果:`, element);
    if (element) {
      foundSelector = selector;
      break;
    }
  }
  
  if (!element) {
    throw new Error(`未找到任何元素，尝试的选择器: ${selectors.join(', ')}`);
  }

  console.log('🔧 找到元素:', element);
  console.log('🔧 元素当前HTML:', element.innerHTML);
  
  
  element.innerHTML = '';
  console.log('🔧 清空后HTML:', element.innerHTML);
  
  
  if (step.write && Array.isArray(step.write)) {
    console.log('🔧 开始创建元素，Config数量:', step.write.length);
    for (const elementConfig of step.write) {
      console.log('🔧 创建元素Config:', elementConfig);
      const newElement = createElementFromConfig(elementConfig, query);
      console.log('🔧 创建的元素:', newElement);
      console.log('🔧 创建的元素HTML:', newElement.outerHTML);
      element.appendChild(newElement);
    }
  }
  
  console.log('🔧 最终元素HTML:', element.innerHTML);
  console.log('✅ 元素替换Completed:', foundSelector, '内容:', query);
}


function createElementFromConfig(config, query) {
  console.log('🔧 createElementFromConfig 开始，Config:', config, '查询:', query);
  
  const element = document.createElement(config.tag);
  console.log('🔧 创建元素:', config.tag, element);
  
  
  if (config.attributes) {
    console.log('🔧 Settings属性:', config.attributes);
    Object.entries(config.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
      console.log(`🔧 Settings属性 ${key} = ${value}`);
    });
  }
  
  
  if (config.text) {
    
    const text = config.text.replace(/\$query/g, query);
    console.log('🔧 Settings文本内容:', text);
    element.textContent = text;
  }
  
  
  if (config.html) {
    
    const html = config.html.replace(/\$query/g, query);
    console.log('🔧 SettingsHTML内容:', html);
    element.innerHTML = html;
  }
  
  
  if (config.children && Array.isArray(config.children)) {
    console.log('🔧 创建子元素，数量:', config.children.length);
    config.children.forEach((childConfig, index) => {
      console.log(`🔧 创建子元素 ${index}:`, childConfig);
      const childElement = createElementFromConfig(childConfig, query);
      element.appendChild(childElement);
    });
  }
  
  console.log('🔧 最终创建的元素:', element.outerHTML);
  return element;
}


async function executeWait(step) {
  await new Promise(resolve => setTimeout(resolve, step.duration));
  console.log('Wait:', step.duration + 'ms');
}


async function executeCustom(step, query) {
  if (step.customAction === 'metaso_recommend') {
    const iframeUrl = window.frameElement ? window.frameElement.src : window.location.href;
    if (iframeUrl.includes('/search/')) {
      const recommendBox = document.querySelector('div.MuiBox-root.css-qtri4c');
      if (recommendBox) {
        recommendBox.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } else if (step.customAction === 'send_message') {
    window.parent.postMessage({ type: 'message_received', originalType: step.messageType }, '*');
  } else if (step.customAction === 'retry_click') {
    
    console.warn('retry_click 已废弃，请使用 click action 配合 retryOnDisabled 参数');
  } else if (step.customAction === 'url_query') {
    console.log('Site使用URL查询，无需搜索处理器');
  } else if (step.customAction === 'placeholder') {
    console.log('Site暂未实现搜索处理器');
  }
  
  console.log('Execute自定义操作:', step.customAction);
}


async function getSiteHandler(domain) {
  try {
    
    if (window.siteDetector) {
      const siteHandler = await window.siteDetector.getSiteHandler(domain);
      if (siteHandler) {
        console.log(`✅ 使用新检测器找到SiteConfig: ${siteHandler.name}`);
        return siteHandler;
      }
    }
    
    
    let sites = [];
    try {
      if (!window.getDefaultSites) {
        console.error('window.getDefaultSites 不可用，请Check baseConfig.js 是否正确Load');
        return null;
      }
      
      sites = await window.getDefaultSites();
      console.log('从 getDefaultSites 获取SiteConfigSuccessful，数量:', sites.length);
    } catch (error) {
      console.error('获取SiteConfigFailed:', error);
    }
    
    
    if (!sites || sites.length === 0) {
      console.warn('没有找到SiteConfig，请Check网络连接或重新Load扩展');
      return null;
    }
    
    
    const site = sites.find(s => {
      if (!s.url) return false;
      try {
        const siteUrl = new URL(s.url);
        const siteDomain = siteUrl.hostname;
        return domain === siteDomain || domain.includes(siteDomain) || siteDomain.includes(domain);
      } catch (urlError) {
        return false;
      }
    });
    
    if (!site) {
      console.warn('未找到匹配的SiteConfig:', domain);
      return null;
    }
    
    console.log(`找到SiteConfig: ${site.name}`);
    console.log('SiteConfig详情:', {
      name: site.name,
      hasSearchHandler: !!site.searchHandler,
      hasFileUploadHandler: !!site.fileUploadHandler
    });
    
    return {
      name: site.name,
      searchHandler: site.searchHandler,
      fileUploadHandler: site.fileUploadHandler,
      contentExtractor: site.contentExtractor,
      historyHandler: site.historyHandler
    };
  } catch (error) {
    console.error('获取Site处理器Failed:', error);
    return null;
  }
}


window.addEventListener('message', async function(event) {
    
    const isAI = await checkAISite();
    if (!isAI) {
        return; 
    }
    
    
    if (!event.data || typeof event.data !== 'object') {
        return; 
    }
    
    
    if (!event.data.query && !event.data.type && !event.data.fileData) {
        return; 
    }
    
    
    if (event.data.action || event.data.payload || event.data._stripeJsV3 || 
        event.data.sourceFrameId || event.data.targetFrameId || 
        event.data.controllerAppFrameId) {
        return; 
    }
    
    
    console.log('🎯🎯🎯 inject.js 收到 AIShortcuts 消息:', event.data, '来源:', event.origin);
    
    
    if (event.data.type && (
        event.data.type.includes('ad-finder') || 
        event.data.type.includes('wxt') ||
        event.data.type.includes('content-script-started') ||
        event.data.type.includes('ads#') ||
        event.data.type.includes('adblock') ||
        event.data.type.includes('ublock') ||
        event.data.type.includes('ghostery') ||
        event.data.type.includes('privacy') ||
        event.data.type.startsWith('laankejkbhbdhmipfmgcngdelahlfoji') ||
        event.data.type.includes('INIT') ||
        event.data.type.includes('EXTENSION_')
    )) {
        return;
    }
    
    
    const validMultiAITypes = ['TRIGGER_PASTE', 'search', 'EXTRACT_CONTENT', 'SET_HISTORY_CONTEXT', 'GET_CURRENT_URL'];
    
    if (!validMultiAITypes.includes(event.data.type)) {
        return;
    }
    
    console.log('收到消息类型:', event.data.type);

    
    if (event.data.type === 'SET_HISTORY_CONTEXT') {
        __aiCompareHistoryContext.historyId = event.data.historyId || null;
        __aiCompareHistoryContext.siteName = event.data.siteName || __aiCompareHistoryContext.siteName;
        console.log('✅ 已Update历史上下文:', __aiCompareHistoryContext);
        return;
    }
    
    
    if (event.data.type === 'TRIGGER_PASTE') {
        console.log('🎯 收到文件粘贴Trigger消息');
        console.log('消息详情:', event.data);
        
        if (event.data.index && event.data.total) {
            console.log(`🎯 当前处理进度: ${event.data.index}/${event.data.total}`);
        }
        
        
        if (event.data.fallback) {
            console.log('🎯 降级模式：iframe 自行尝试读取剪贴板');
        } else if (event.data.useSiteHandler) {
            console.log('🎯 优先模式：使用Site特定的文件上传处理器');
        } else if (event.data.global) {
            console.log('🎯 全局文件粘贴操作');
            if (event.data.forced) {
                console.log('🎯 强制处理模式');
            }
        } else {
            console.log('🎯 单个 iframe 的文件粘贴操作');
        }
        
        
        const domain = event.data.domain || window.location.hostname;
        const siteHandler = await getSiteHandler(domain);
        
        if (siteHandler && siteHandler.fileUploadHandler) {
            console.log(`🎯 使用 ${siteHandler.name} 的文件上传处理器`);
            console.log('Site处理器Config:', siteHandler.fileUploadHandler);
            
            try {
                
                if (event.data.fileData) {
                    console.log('🎯 收到传递的文件数据，存储供Site处理器使用');
                    window._currentFileData = event.data.fileData;
                }
                
                await executeSiteHandler(null, siteHandler.fileUploadHandler);
                console.log('🎯 Site文件上传处理器ExecuteCompleted');
                
                
                if (window._currentFileData) {
                    delete window._currentFileData;
                }
                
            } catch (error) {
                console.error(`${siteHandler.name} 文件上传处理Failed:`, error);
                
                
                if (event.data.fileData) {
                    console.log('🎯 降级到直接文件数据粘贴');
                    try {
                        await handleFileDataPaste(event.data.fileData);
                        console.log('✅ 降级文件数据粘贴Successful');
                    } catch (fallbackError) {
                        console.error('❌ 降级文件数据粘贴也Failed:', fallbackError);
                        
                        await executeSiteHandler(null, { 
                            steps: [{ 
                                action: 'paste', 
                                description: '最后降级：默认粘贴操作' 
                            }] 
                        });
                    }
                } else {
                    
                    console.log('🎯 降级到默认粘贴操作');
                    await executeSiteHandler(null, { 
                        steps: [{ 
                            action: 'paste', 
                            description: '降级：默认粘贴操作' 
                        }] 
                    });
                }
            }
        } else {
            console.log('❌ 未找到文件上传处理器');
            
            
            if (event.data.fileData) {
                console.log('🎯 使用直接文件数据粘贴');
                try {
                    await handleFileDataPaste(event.data.fileData);
                    console.log('✅ 直接文件数据粘贴Successful');
                } catch (error) {
                    console.error('❌ 直接文件数据粘贴Failed:', error);
                }
            } else {
                console.log('🎯 使用默认粘贴处理方式');
                await executeSiteHandler(null, { 
                    steps: [{ 
                        action: 'paste', 
                        description: '默认粘贴操作' 
                    }] 
                });
            }
        }
        return;
    }

    
    if (event.data.type === 'GET_CURRENT_URL') {
        console.log('🎯 收到获取当前 URL 请求:', event.data);
        
        
        let pageUrl = window.location.href;
        try {
            
            const alternateLinks = document.querySelectorAll('link[rel="alternate"]');
            for (const link of alternateLinks) {
                const href = link.getAttribute('href');
                if (href && href.includes('chatgpt.com/c/')) {
                    const url = new URL(href);
                    url.searchParams.delete('locale');
                    pageUrl = url.toString();
                    console.log(`🔗 从alternate标签获取清洁URL: ${pageUrl}`);
                    break;
                }
            }
        } catch (error) {
            console.log('⚠️ URL清理Failed，使用原始URL:', error);
        }
        
        
        window.parent.postMessage({
            type: 'GET_CURRENT_URL_RESPONSE',
            siteName: event.data.siteName,
            url: pageUrl
        }, '*');
        
        console.log('✅ 已发送当前 URL:', pageUrl);
        return;
    }

    
    if (event.data.type === 'EXTRACT_CONTENT') {
        console.log('🎯 收到内容提取请求:', event.data);
        
        
        (async () => {
            try {
                
                const content = await extractPageContent();
                
                
                let pageUrl = window.location.href;
                try {
                    
                    const alternateLinks = document.querySelectorAll('link[rel="alternate"]');
                    for (const link of alternateLinks) {
                        const href = link.getAttribute('href');
                        if (href && href.includes('chatgpt.com/c/')) {
                            const url = new URL(href);
                            url.searchParams.delete('locale');
                            pageUrl = url.toString();
                            console.log(`🔗 从alternate标签获取清洁URL: ${pageUrl}`);
                            break;
                        }
                    }
                } catch (error) {
                    console.log('⚠️ URL清理Failed，使用原始URL:', error);
                }
                
                
                window.parent.postMessage({
                    type: 'EXTRACTED_CONTENT',
                    siteName: event.data.siteName,
                    content: content,
                    url: pageUrl
                }, '*');
                
                console.log('✅ 内容提取Completed，已发送结果');
            } catch (error) {
                console.error('❌ 内容提取Failed:', error);
                
                
                window.parent.postMessage({
                    type: 'EXTRACTED_CONTENT',
                    siteName: event.data.siteName,
                    content: `内容提取Failed: ${error.message}`
                }, '*');
            }
        })();
        return;
    }

    

    // ── Ollama: watch for response completion ──────────────────────────────
    if (event.data.type === 'WATCH_FOR_RESPONSE') {
        const siteName = event.data.siteName;
        console.log(`🤖 Ollama: starting response watch for ${siteName}`);

        let lastContent = '';
        let stableCount = 0;
        const POLL_MS = 2500;
        const STABLE_NEEDED = 2;   // 2 consecutive identical polls = done
        const MAX_MS = 120000;     // 2 min hard cap
        const startTime = Date.now();

        const poll = async () => {
            if (Date.now() - startTime > MAX_MS) {
                window.parent.postMessage({
                    type: 'RESPONSE_COMPLETE',
                    siteName,
                    content: lastContent || '(no response captured)',
                    timedOut: true
                }, '*');
                return;
            }
            try {
                const content = await extractPageContent();
                if (content && content.length > 60) {
                    if (content === lastContent) {
                        stableCount++;
                        if (stableCount >= STABLE_NEEDED) {
                            console.log(`🤖 Ollama: ${siteName} response stable — sending`);
                            window.parent.postMessage({
                                type: 'RESPONSE_COMPLETE',
                                siteName,
                                content,
                                timedOut: false
                            }, '*');
                            return;
                        }
                    } else {
                        stableCount = 0;
                        lastContent = content;
                    }
                }
            } catch (e) {
                console.warn('🤖 Ollama poll error:', e);
            }
            setTimeout(poll, POLL_MS);
        };

        // Start polling after a small delay so the AI has begun responding
        setTimeout(poll, 4000);
        return;
    }
    // ── End Ollama watch ───────────────────────────────────────────────────

    if (event.data.type !== 'TRIGGER_PASTE' && !event.data.query) {
        return;
    }
    
    console.log('收到query:',event.data.query, '收到type:',event.data.type);
    console.log('收到消息event 原始:',event);

    
    const domain = event.data.domain || window.location.hostname;
    console.log('🔍 调试信息 - 域名:', domain, '当前hostname:', window.location.hostname);
    
    const siteHandler = await getSiteHandler(domain);
    console.log('🔍 调试信息 - Site处理器:', siteHandler);
    
    if (siteHandler && siteHandler.searchHandler && event.data.query) {
        
        if (event.data.historyId) {
            __aiCompareHistoryContext.historyId = event.data.historyId;
            __aiCompareHistoryContext.siteName = siteHandler.name;
        }

        console.log(`✅ 使用 ${siteHandler.name} Config化处理器处理消息`);
        console.log('🔍 调试信息 - 搜索处理器Config:', siteHandler.searchHandler);
        try {
            
            await executeSiteHandler(event.data.query, siteHandler.searchHandler);
            console.log(`✅ ${siteHandler.name} 处理Completed`);
            
            
            console.log('🔍 Check historyHandler Config:', {
                hasHistoryHandler: !!siteHandler.historyHandler,
                historyHandler: siteHandler.historyHandler,
                urlFeature: siteHandler.historyHandler?.urlFeature
            });
            if (siteHandler.historyHandler && siteHandler.historyHandler.urlFeature) {
                console.log(`✅ 启动 ${siteHandler.name} 的 URL 检测，特征: ${siteHandler.historyHandler.urlFeature}`);
                startHistoryUrlDetection(
                    siteHandler.name,
                    siteHandler.historyHandler.urlFeature,
                    event.data.historyId || __aiCompareHistoryContext.historyId
                );
            } else {
                console.warn(`⚠️ ${siteHandler.name} 未Config historyHandler 或 urlFeature，跳过 URL 检测`);
            }
        } catch (error) {
            console.error(`❌ ${siteHandler.name} 处理Failed:`, error);
        }
        return;
    }

    
    console.warn('❌ 未找到对应的Site处理器');
    console.warn('🔍 调试信息 - 域名:', domain);
    console.warn('🔍 调试信息 - Site处理器:', siteHandler);
    console.warn('🔍 调试信息 - 消息类型:', event.data.type);
    console.warn('🔍 调试信息 - 查询内容:', event.data.query);
}); 


async function handleFileDataPaste(fileData) {
    console.log('🎯 开始处理传递的文件数据');
    console.log('文件数据:', fileData);
    
    if (!fileData || (!fileData.blob && !fileData.data)) {
        console.error('❌ 无效的文件数据');
        return;
    }
    
    try {
        
        console.log('🔍 Check文档焦点状态...');
        if (!document.hasFocus()) {
            console.log('⚠️ 文档没有焦点，尝试获取焦点...');
            window.focus();
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        
        const blobData = fileData.blob || fileData.data; 
        let file = blobData;
        
        if (blobData instanceof Blob && !(blobData instanceof File)) {
            
            let fileName = fileData.fileName || fileData.name;
            if (!fileName && window.AppConfigManager) {
                fileName = await window.AppConfigManager.generateFileName(
                    fileData.originalName, 
                    fileData.type, 
                    'clipboard'
                );
                console.log('🎯 生成智能文件名:', fileName);
            } else if (!fileName) {
                
                const extension = await getFileExtensionFromMimeType(fileData.type);
                fileName = `clipboard-${Date.now()}.${extension}`;
            }
            
            file = new File([blobData], fileName, { type: fileData.type });
            console.log('将 Blob 转换为 File:', {
                name: file.name,
                type: file.type,
                size: file.size,
                originalData: fileData
            });
        }
        
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
        });
        
        
        const activeElement = document.activeElement;
        if (activeElement) {
            console.log('已向Focus元素发送文件粘贴事件:', activeElement);
            activeElement.dispatchEvent(pasteEvent);
        } else {
            console.log('没有Focus的元素，向 document 发送文件粘贴事件');
            document.dispatchEvent(pasteEvent);
        }
        
        console.log('✅ 文件数据粘贴事件已Trigger');
        
    } catch (error) {
        console.error('❌ 文件数据粘贴Failed:', error);
        throw error;
    }
}


async function getFileExtensionFromMimeType(mimeType) {
    if (window.AppConfigManager) {
        return await window.AppConfigManager.getFileExtensionByMimeType(mimeType);
    }
    
    
    const basicMappings = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'text/plain': 'txt',
        'Files': 'file'
    };
    
    return basicMappings[mimeType] || 'bin';
} 


function showClipboardPermissionTip() {
  console.log('提示: 需要用户授权剪切板访问权限');
  console.log('解决方法: 请重新Load扩展以应用新的权限Settings');
  console.log('或者Click页面获得焦点后重试');
}


async function extractPageContent() {
    console.log('🔍 开始提取页面内容...');
    
    try {
        
        const domain = window.location.hostname;
        console.log('🔍 当前域名:', domain);
        
        
        
        const siteHandler = await getSiteHandler(domain);
        console.log('🔍 Site处理器:', siteHandler);
        
        let content = '';
        
        if (siteHandler && siteHandler.contentExtractor) {
            
            console.log('✅ 使用Config文件中的内容提取规则');
            content = await extractWithConfig(siteHandler.contentExtractor, siteHandler.name);
        } else {
            
            const siteName = siteHandler ? siteHandler.name : domain;
            console.log(`⚠️ 未找到 ${siteName} 的内容提取Config，返回提示信息`);
            content = `无法自动提取 ${siteName} 的详细内容，请手动复制。\n\n提示：该Site可能尚未Config内容提取规则，或者页面结构发生了变化。`;
        }
        
        console.log('✅ 内容提取Completed，长度:', content.length);
        return content;
        
    } catch (error) {
        console.error('❌ 内容提取Failed:', error);
        return `内容提取Failed: ${error.message}`;
    }
}


async function extractWithConfig(contentExtractor, siteName) {
    console.log(`🔍 使用 ${siteName} Config提取内容...`);
    console.log('🔍 内容提取Config:', contentExtractor);
    
    const startTime = performance.now();
    let content = '';
    let extractionMethod = '';
    
    try {
        
        if (contentExtractor.contentSelectors && contentExtractor.contentSelectors.length > 0) {
            console.log('🔍 尝试主要选择器...');
            content = await extractWithSelectorsOptimized(
                contentExtractor.contentSelectors, 
                siteName, 
                contentExtractor.excludeSelectors,
                contentExtractor.messageContainer
            );
            
            if (content.trim() && !content.includes('无法自动提取')) {
                extractionMethod = '主要选择器';
                console.log('✅ 主要选择器提取Successful');
                return content;
            }
        }
        
        
        if (contentExtractor.fallbackSelectors && contentExtractor.fallbackSelectors.length > 0) {
            console.log('🔍 主要选择器Failed，尝试备用选择器...');
            content = await extractWithSelectorsOptimized(
                contentExtractor.fallbackSelectors, 
                siteName, 
                contentExtractor.excludeSelectors,
                contentExtractor.messageContainer
            );
            
            if (content.trim() && !content.includes('无法自动提取')) {
                extractionMethod = '备用选择器';
                console.log('✅ 备用选择器提取Successful');
                return content;
            }
        }
        
        
        console.log('🔍 尝试智能内容检测...');
        content = await intelligentContentDetection(siteName);
        
        if (content.trim() && !content.includes('无法自动提取')) {
            extractionMethod = '智能检测';
            console.log('✅ 智能内容检测Successful');
            return content;
        }
        
        
        console.log('🔍 尝试通用内容提取...');
        content = await genericContentExtraction(siteName);
        
        if (content.trim() && !content.includes('无法自动提取')) {
            extractionMethod = '通用提取';
            console.log('✅ 通用内容提取Successful');
            return content;
        }
        
    } catch (error) {
        console.error('❌ 内容提取过程中发生错误:', error);
        return `内容提取Failed: ${error.message}`;
    } finally {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`📊 内容提取Completed - 方法: ${extractionMethod || 'Failed'}, 耗时: ${duration.toFixed(2)}ms`);
    }
}



function startHistoryUrlDetection(siteName, urlFeature, historyId) {
  console.log(`🔍 开始检测 ${siteName} 的 URL 特征: ${urlFeature}`);
  const targetHistoryId = historyId || __aiCompareHistoryContext.historyId || null;
  
  let lastMatchedUrl = null; 
  let checkInterval = null;
  let checkCount = 0;
  const maxChecks = 60; 
  
  
  const checkUrl = () => {
    try {
      const currentUrl = window.location.href;
      const currentPath = window.location.pathname;
      
      
      if (currentPath.includes(urlFeature)) {
        
        if (currentUrl !== lastMatchedUrl) {
          lastMatchedUrl = currentUrl;
          console.log(`✅ ${siteName} URL 匹配Successful: ${currentUrl}`);
          
          
          window.parent.postMessage({
            type: 'HISTORY_URL_UPDATE',
            source: 'inject-script',
            siteName: siteName,
            url: currentUrl,
            historyId: targetHistoryId
          }, '*');
          
          console.log(`📤 已通知父窗口Update ${siteName} 的History URL`);
          
          
          if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
          }
          return true;
        }
      }
      
      checkCount++;
      if (checkCount >= maxChecks) {
        console.log(`⏰ ${siteName} URL 检测超时（${maxChecks} 次Check），停止检测`);
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        return false;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ ${siteName} URL 检测Failed:`, error);
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      return false;
    }
  };
  
  
  if (checkUrl()) {
    return; 
  }
  
  
  checkInterval = setInterval(checkUrl, 500);
  
  
  const urlChangeHandler = () => {
    checkUrl();
  };
  
  
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(urlChangeHandler, 100); 
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(urlChangeHandler, 100);
  };
  
  window.addEventListener('popstate', urlChangeHandler);
  window.addEventListener('hashchange', urlChangeHandler);
  
  console.log(`⏱️ ${siteName} URL 检测已启动，将每 500ms Check一次，最多检测 ${maxChecks} 次`);
}


function validateSelectors(selectors, searchRoot = document) {
    const validSelectors = [];
    for (const selector of selectors) {
        try {
            const elements = searchRoot.querySelectorAll(selector);
            if (elements.length > 0) {
                validSelectors.push(selector);
                console.log(`✅ 选择器 ${selector} 有效，找到 ${elements.length} 个元素`);
            } else {
                console.log(`⚠️ 选择器 ${selector} 无效，未找到元素`);
            }
        } catch (error) {
            console.error(`❌ 选择器 ${selector} 语法错误:`, error);
        }
    }
    return validSelectors;
}



async function extractWithSelectorsOptimized(selectors, siteName, excludeSelectors = [], messageContainer = null) {
    console.log(`🔍 开始提取 ${siteName} 的内容...`);
    console.log(`🔍 使用选择器:`, selectors);
    console.log(`🔍 排除选择器:`, excludeSelectors);
    console.log(`🔍 消息容器:`, messageContainer);
    
    let content = '';
    
    
    const defaultExcludeSelectors = ['nav', 'header', 'footer', '.sidebar', '.menu'];
    const allExcludeSelectors = [...defaultExcludeSelectors, ...(excludeSelectors || [])];
    
    
    let searchRoot = document;
    let messageContainers = [];
    if (messageContainer) {
        messageContainers = Array.from(document.querySelectorAll(messageContainer));
        console.log(`🔍 找到 ${messageContainers.length} 个消息容器`);
        
        if (messageContainers.length === 0) {
            console.log(`⚠️ 未找到消息容器 ${messageContainer}，使用整个文档`);
        } else {
            console.log(`🔍 将在 ${messageContainers.length} 个消息容器中搜索内容`);
        }
    }
    
    
    if (messageContainers.length === 0) {
        messageContainers = [document];
    }
    
    
    for (const [containerIndex, container] of messageContainers.entries()) {
        console.log(`🔍 处理第 ${containerIndex + 1}/${messageContainers.length} 个消息容器`);
        
        
        
        const validSelectors = validateSelectors(selectors, container);
        console.log(`🔍 容器内有效选择器数量: ${validSelectors.length}/${selectors.length}`);
    
        
        const extractionPromises = validSelectors.map(async (selector) => {
            try {
                const elements = container.querySelectorAll(selector);
                
            
            if (elements.length === 0) return '';
            
            let selectorContent = '';
            
            for (const [index, element] of elements.entries()) {
                
                const shouldExclude = allExcludeSelectors.some(excludeSelector => 
                    element.closest(excludeSelector)
                );
                
                if (shouldExclude) {
                    console.log(`🔍 排除元素:`, element);
                    continue;
                }
                
                
                await waitForContentLoad(element);
                
                
                let text = await extractElementContent(element);
                
                if (text.trim()) {
                    selectorContent += `\n\n${text.trim()}\n`;
                }
            }
            
            return selectorContent;
            } catch (error) {
                console.warn(`容器内选择器 ${selector} 提取Failed:`, error);
                return '';
            }
        });
        
        
        const results = await Promise.all(extractionPromises);
        
        
        const uniqueResults = [];
        const seenContent = new Set();
        
        for (const result of results) {
            if (result.trim() && !seenContent.has(result.trim())) {
                uniqueResults.push(result);
                seenContent.add(result.trim());
            }
        }
        
        content += uniqueResults.join('\n');
    }
    
    if (!content.trim()) {
        content = `无法自动提取 ${siteName} 的详细内容，请手动复制。`;
    }
    
    return content.trim();
}


async function waitForContentLoad(element, timeout = 1000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkContent = () => {
            const hasContent = element.textContent && element.textContent.trim().length > 10;
            const isTimeout = Date.now() - startTime > timeout;
            
            if (hasContent || isTimeout) {
                resolve();
            } else {
                setTimeout(checkContent, 50);
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


async function intelligentContentDetection(siteName) {
    console.log(`🧠 开始智能内容检测 ${siteName}...`);
    
    try {
        
        const streamingContent = await detectStreamingContent();
        if (streamingContent) {
            console.log('✅ 检测到流式内容');
            return streamingContent;
        }
        
        
        const latestContent = await detectLatestContent();
        if (latestContent) {
            console.log('✅ 检测到最新内容');
            return latestContent;
        }
        
        
        const valuableContent = await detectValuableContent();
        if (valuableContent) {
            console.log('✅ 检测到高价值内容');
            return valuableContent;
        }
        
    } catch (error) {
        console.error('智能内容检测Failed:', error);
    }
    
    return '';
}


async function detectStreamingContent() {
    const streamingSelectors = [
        '.streaming',
        '.typing',
        '.generating',
        '[class*="stream"]',
        '[class*="typing"]',
        '[class*="generating"]',
        '.result-streaming',
        '.response-streaming'
    ];
    
    for (const selector of streamingSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            const content = await extractElementContent(elements[0]);
            if (content) {
                return content;
            }
        }
    }
    
    return '';
}


async function detectLatestContent() {
    
    const recentElements = document.querySelectorAll('[class*="message"], [class*="response"], [class*="answer"]');
    
    if (recentElements.length === 0) return '';
    
    
    const latestElement = Array.from(recentElements).pop();
    const content = await extractElementContent(latestElement);
    
    if (content) {
        return content;
    }
    
    return '';
}


async function detectValuableContent() {
    const valuableSelectors = [
        'main',
        'article',
        '.content',
        '.main-content',
        '.chat-content',
        '.conversation',
        '.messages'
    ];
    
    for (const selector of valuableSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            const content = await extractElementContent(elements[0]);
            if (content && content.length > 100) {
                return content;
            }
        }
    }
    
    return '';
}


async function genericContentExtraction(siteName) {
    console.log(`🔧 开始通用内容提取 ${siteName}...`);
    
    try {
        
        const mainContent = document.querySelector('main') || document.querySelector('article') || document.body;
        
        if (mainContent) {
            const content = await extractElementContent(mainContent);
            if (content && content.length > 50) {
                return content;
            }
        }
        
        
        const bodyContent = document.body ? document.body.textContent || document.body.innerText : '';
        if (bodyContent && bodyContent.length > 100) {
            return cleanExtractedText(bodyContent);
        }
        
    } catch (error) {
        console.error('通用内容提取Failed:', error);
    }
    
    return '';
}



function convertHtmlToMarkdown(html) {
    try {
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        
        let markdown = html
            
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
            .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```')
            
            
            .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
                return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
            })
            .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
                let counter = 1;
                return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`) + '\n';
            })
            
            
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            
            
            .replace(/<br[^>]*>/gi, '\n')
            
            
            .replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
                
                const headerMatch = content.match(/<thead[^>]*>(.*?)<\/thead>/is);
                const bodyMatch = content.match(/<tbody[^>]*>(.*?)<\/tbody>/is);
                
                if (headerMatch && bodyMatch) {
                    
                    const headers = headerMatch[1].match(/<th[^>]*>(.*?)<\/th>/gi) || [];
                    const headerRow = headers.map(h => h.replace(/<[^>]*>/g, '').trim()).join(' | ');
                    
                    
                    const rows = bodyMatch[1].match(/<tr[^>]*>(.*?)<\/tr>/gi) || [];
                    const dataRows = rows.map(row => {
                        const cells = row.match(/<td[^>]*>(.*?)<\/td>/gi) || [];
                        return cells.map(cell => cell.replace(/<[^>]*>/g, '').trim()).join(' | ');
                    });
                    
                    return `\n${headerRow}\n${headers.map(() => '---').join(' | ')}\n${dataRows.join('\n')}\n\n`;
                }
                return match;
            })
            
            
            .replace(/<[^>]*>/g, '')
            
            
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        
        return markdown;
        
    } catch (error) {
        console.warn('HTML 到 Markdown 转换Failed:', error);
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || '';
    }
}