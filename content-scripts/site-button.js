

(async function() {
  'use strict';

  
  if (window.self !== window.top) {
    return;
  }

  
  function waitForBaseConfig(maxAttempts = 10, interval = 200) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const checkConfig = () => {
        if (typeof window.getDefaultSites !== 'undefined') {
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkConfig, interval);
        } else {
          reject(new Error('Wait baseConfig Load超时'));
        }
      };
      checkConfig();
    });
  }

  try {
    await waitForBaseConfig();
    initSiteButton();
  } catch (error) {
    console.error('初始化Site按钮Failed:', error);
  }

  async function initSiteButton() {
    try {
      
      if (typeof window.ENABLE_SITE_BUTTON !== 'undefined' && !window.ENABLE_SITE_BUTTON) {
        console.log('Site按钮功能已禁用 (ENABLE_SITE_BUTTON = false)');
        return;
      }

      
      const sites = await window.getDefaultSites();
      if (!sites || sites.length === 0) {
        console.log('未找到SiteConfig');
        return;
      }

      
      const currentSite = detectCurrentSite(sites);
      if (!currentSite) {
        console.log('当前Site不在支持列表中');
        return;
      }

      
      
      if (!currentSite.supportIframe) {
        console.log('当前Site不支持 iframe');
        return;
      }

      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          createSiteButton(currentSite);
          
          if (currentSite.userPromptButton) {
            createUserPromptButtons(currentSite);
          }
        });
      } else {
        createSiteButton(currentSite);
        
        if (currentSite.userPromptButton) {
          createUserPromptButtons(currentSite);
        }
      }
    } catch (error) {
      console.error('初始化Site按钮Failed:', error);
    }
  }

  
  function detectCurrentSite(sites) {
    const currentUrl = window.location.href;
    const currentHostname = window.location.hostname;

    
    for (const site of sites) {
      try {
        const siteUrl = new URL(site.url);
        const siteHostname = siteUrl.hostname;

        
        if (currentHostname === siteHostname || 
            currentHostname.includes(siteHostname) || 
            siteHostname.includes(currentHostname)) {
          
          const sitePath = siteUrl.pathname;
          if (sitePath && sitePath !== '/') {
            if (currentUrl.includes(sitePath)) {
              return site;
            }
          } else {
            return site;
          }
        }
      } catch (e) {
        
        if (currentUrl.includes(site.url) || site.url.includes(currentHostname)) {
          return site;
        }
      }
    }

    return null;
  }

  
  function findSendButtonNearInput(inputElement) {
    if (!inputElement) return null;

    
    const commonSendButtonSelectors = [
      'button[type="submit"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="发送" i]',
      'button[title*="Send" i]',
      'button[title*="发送" i]',
      'button:has(svg)',
      '[role="button"][aria-label*="Send" i]'
    ];

    
    let container = inputElement.parentElement;
    let depth = 0;
    const maxDepth = 5; 

    while (container && depth < maxDepth) {
      for (const selector of commonSendButtonSelectors) {
        try {
          const button = container.querySelector(selector);
          if (button && button !== inputElement) {
            
            const rect = button.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return button;
            }
          }
        } catch (e) {
          
        }
      }
      container = container.parentElement;
      depth++;
    }

    return null;
  }

  
  function createSiteButton(site) {
    
    const sendButtonSelector = getSendButtonSelector(site);
    const inputSelector = getInputSelector(site);

    if (!inputSelector) {
      console.log('无法找到Input box的 selector');
      return;
    }

    
    const observer = new MutationObserver((mutations, obs) => {
      const inputElement = findElement(inputSelector);
      if (!inputElement) return;

      
      let sendButton = null;
      if (sendButtonSelector) {
        sendButton = findElement(sendButtonSelector);
      } else {
        
        sendButton = findSendButtonNearInput(inputElement);
        
        if (!sendButton) {
          sendButton = inputElement;
        }
      }

      if (sendButton && inputElement) {
        obs.disconnect();
        
        
        const existingButton = sendButton.parentElement?.querySelector('.multi-ai-site-button') ||
                               document.querySelector('.multi-ai-site-button');
        if (existingButton) {
          return;
        }

        
        insertButton(sendButton, inputElement, site);
      }
    });

    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    
    const inputElement = findElement(inputSelector);
    if (!inputElement) return;

    
    let sendButton = null;
    if (sendButtonSelector) {
      sendButton = findElement(sendButtonSelector);
    } else {
      
      sendButton = findSendButtonNearInput(inputElement);
      
      if (!sendButton) {
        sendButton = inputElement;
      }
    }

    if (sendButton && inputElement) {
      observer.disconnect();
      
      
      const existingButton = sendButton.parentElement?.querySelector('.multi-ai-site-button') ||
                             document.querySelector('.multi-ai-site-button');
      if (existingButton) {
        return;
      }

      insertButton(sendButton, inputElement, site);
    }
  }

  
  function getSendButtonSelector(site) {
    if (!site.searchHandler || !site.searchHandler.steps) {
      return null;
    }

    
    for (const step of site.searchHandler.steps) {
      if (step.action === 'click') {
        if (typeof step.selector === 'string') {
          return step.selector;
        } else if (Array.isArray(step.selector)) {
          
          return step.selector[0];
        }
      }
    }

    
    return null;
  }

  
  function getInputSelector(site) {
    if (!site.searchHandler || !site.searchHandler.steps) {
      return null;
    }

    
    for (const step of site.searchHandler.steps) {
      if (step.action === 'focus' || step.action === 'setValue') {
        if (typeof step.selector === 'string') {
          return step.selector;
        } else if (Array.isArray(step.selector)) {
          
          return step.selector[0];
        }
      }
    }

    return null;
  }

  
  function findElement(selector) {
    if (!selector) return null;

    try {
      
      if (Array.isArray(selector)) {
        for (const sel of selector) {
          const element = document.querySelector(sel);
          if (element) return element;
        }
        return null;
      }

      
      return document.querySelector(selector);
    } catch (e) {
      console.error('查找元素Failed:', e);
      return null;
    }
  }

  
  function getInputValue(element) {
    if (!element) return '';

    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value || '';
    }

    
    if (element.contentEditable === 'true') {
      return element.innerText || element.textContent || '';
    }

    return '';
  }

  
  function insertButton(sendButton, inputElement, site) {
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'multi-ai-site-button-container';

    
    const button = document.createElement('button');
    button.className = 'multi-ai-site-button';
    button.title = '使用 Multi-AI 搜索';
    button.setAttribute('aria-label', '使用 Multi-AI 搜索');

    
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon48.png');
    icon.className = 'multi-ai-site-button-icon';
    button.appendChild(icon);

    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const query = getInputValue(inputElement).trim();
      if (!query) {
        console.log('Input box为空');
        return;
      }

      
      chrome.runtime.sendMessage({
        action: 'createComparisonPage',
        query: query
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('打开 iframe 页面Failed:', chrome.runtime.lastError);
        } else {
          console.log('Message response:', response);
        }
      });
    });

    buttonContainer.appendChild(button);

    
    const isInputElement = sendButton === inputElement || 
                          sendButton.tagName === 'TEXTAREA' || 
                          sendButton.tagName === 'INPUT' ||
                          sendButton.contentEditable === 'true';

    
    if (isInputElement) {
      
      
      const inputParent = inputElement.parentElement;
      if (inputParent) {
        
        
        const inputSiblings = Array.from(inputParent.children);
        const inputIndex = inputSiblings.indexOf(inputElement);
        
        
        let insertAfterElement = inputElement;
        for (let i = inputIndex + 1; i < inputSiblings.length; i++) {
          const sibling = inputSiblings[i];
          if (sibling.tagName === 'BUTTON' || 
              sibling.querySelector('button') ||
              sibling.getAttribute('role') === 'button') {
            insertAfterElement = sibling;
            break;
          }
        }
        
        try {
          insertAfterElement.insertAdjacentElement('afterend', buttonContainer);
        } catch (e) {
          
          inputParent.appendChild(buttonContainer);
        }
      } else {
        
        inputElement.after(buttonContainer);
      }
    } else {
      
      try {
        sendButton.insertAdjacentElement('afterend', buttonContainer);
      } catch (e) {
        
        const sendButtonParent = sendButton.parentElement;
        if (sendButtonParent) {
          
          const nextSibling = sendButton.nextSibling;
          if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
            sendButtonParent.insertBefore(buttonContainer, nextSibling);
          } else {
            sendButtonParent.appendChild(buttonContainer);
          }
        } else {
          
          sendButton.after(buttonContainer);
        }
      }
    }
  }

  
  function createUserPromptButtons(site) {
    const userPromptConfig = site.userPromptButton;
    if (!userPromptConfig || !userPromptConfig.containerSelector) {
      console.log('未Config userPromptButton');
      return;
    }

    const containerSelector = userPromptConfig.containerSelector;
    const textSelector = userPromptConfig.textSelector || containerSelector;

    
    const processedContainers = new WeakSet();

    
    function extractUserPromptText(container) {
      if (!container) return '';

      
      if (textSelector) {
        try {
          const textElement = container.querySelector(textSelector);
          if (textElement) {
            return textElement.innerText || textElement.textContent || '';
          }
        } catch (e) {
          console.error('提取 userprompt 文本Failed:', e);
        }
      }

      
      return container.innerText || container.textContent || '';
    }

    
    function insertUserPromptButton(container) {
      
      if (processedContainers.has(container)) {
        return;
      }

      
      const existingButton = container.querySelector('.multi-ai-userprompt-button');
      if (existingButton) {
        processedContainers.add(container);
        return;
      }

      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'multi-ai-userprompt-button-container';
      buttonContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; vertical-align: middle;';

      
      const button = document.createElement('button');
      button.className = 'multi-ai-userprompt-button';
      button.textContent = '多AI 对比';
      button.title = '使用多AI对比搜索';
      button.setAttribute('aria-label', '使用多AI对比搜索');
      button.style.cssText = `
        padding: 4px 8px;
        font-size: 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
        color: #333;
        transition: all 0.2s;
      `;

      
      button.addEventListener('mouseenter', () => {
        button.style.background = '#f0f0f0';
        button.style.borderColor = '#999';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = '#fff';
        button.style.borderColor = '#ccc';
      });

      
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const query = extractUserPromptText(container).trim();
        if (!query) {
          console.log('userprompt 文本为空');
          return;
        }

        
        chrome.runtime.sendMessage({
          action: 'createComparisonPage',
          query: query
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('打开 iframe 页面Failed:', chrome.runtime.lastError);
          } else {
            console.log('Message response:', response);
          }
        });
      });

      buttonContainer.appendChild(button);

      
      
      try {
        container.insertAdjacentElement('afterend', buttonContainer);
      } catch (e) {
        
        try {
          
          if (textSelector && textSelector !== containerSelector) {
            const textElement = container.querySelector(textSelector);
            if (textElement) {
              textElement.insertAdjacentElement('afterend', buttonContainer);
            } else {
              container.appendChild(buttonContainer);
            }
          } else {
            
            container.appendChild(buttonContainer);
          }
        } catch (e2) {
          
          const parent = container.parentElement;
          if (parent) {
            try {
              const nextSibling = container.nextSibling;
              if (nextSibling) {
                parent.insertBefore(buttonContainer, nextSibling);
              } else {
                parent.appendChild(buttonContainer);
              }
            } catch (e3) {
              console.error('插入 userprompt 按钮Failed:', e3);
            }
          }
        }
      }

      processedContainers.add(container);
    }

    
    function processExistingContainers() {
      try {
        const containers = document.querySelectorAll(containerSelector);
        containers.forEach(container => {
          if (container && !processedContainers.has(container)) {
            insertUserPromptButton(container);
          }
        });
      } catch (e) {
        console.error('处理现有 userprompt 容器Failed:', e);
      }
    }

    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            
            try {
              if (node.matches && node.matches(containerSelector)) {
                insertUserPromptButton(node);
              }
              
              const containers = node.querySelectorAll ? node.querySelectorAll(containerSelector) : [];
              containers.forEach(container => {
                if (!processedContainers.has(container)) {
                  insertUserPromptButton(container);
                }
              });
            } catch (e) {
              
            }
          }
        });
      });
    });

    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    
    processExistingContainers();

    
    setInterval(() => {
      processExistingContainers();
    }, 1000);
  }
})();
