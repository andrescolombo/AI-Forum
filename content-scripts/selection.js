let toolbar = null;
let isToolbarVisible = false;
let lastSelectedText = '';
let favoriteButton = null;
let currentSelectedText = '';
let siteSelectButton = null;
let siteDropdown = null;





function updateFavoriteButton() {
  if (!favoriteButton) return;
  
  chrome.storage.sync.get('favoriteSites', function(settings) {
    console.log("UpdateFavorites按钮文案settings favouriteSites", settings.favoriteSites);
    if (settings.favoriteSites && settings.favoriteSites.length > 0) {
      favoriteButton.textContent = settings.favoriteSites[0].name;
      console.log("获取到的favoriteButton.textContent", settings.favoriteSites[0].name);
    }
  });
}


async function createToolbar() {
    
    const sites = await window.getDefaultSites();
    if (!sites || !sites.length) return;
  
    
    const visibleSites = sites.filter(site => !site.hidden);
    console.log('可见的Site:', visibleSites);

 
  if (toolbar) return;
  
  toolbar = document.createElement('div');
  toolbar.className = 'multi-ai-toolbar';
  
  
  favoriteButton = document.createElement('button');
  favoriteButton.className = 'multi-ai-favorite-button';
  
  siteSelectButton = document.createElement('button');
  siteSelectButton.className = 'site-select-button';
  siteSelectButton.textContent = '▼';
  siteDropdown = document.createElement('div');
  siteDropdown.className = 'site-dropdown';  


  
  updateFavoriteButton();
  
function initializeSiteDropdown() {
  if (!siteDropdown || !siteSelectButton) return;
  console.log("初始化下拉菜单",visibleSites);

  
  const querySupportedSites = visibleSites.filter(site => 
    site.supportUrlQuery === true && site.enabled === true
  );
  
  console.log("支持query的Site:", querySupportedSites);

  
  if (querySupportedSites.length === 0) {
    console.log("没有支持query的Site，隐藏下拉按钮");
    siteSelectButton.style.display = 'none';
    return;
  }

  
  querySupportedSites.forEach(site => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    siteItem.textContent = `${site.name}`;
    
    siteItem.addEventListener('click', async () => {
      if (!currentSelectedText) {
        console.log('没有有效的选中文本');
        return;
      }

      console.log('ClickSite:', site.name, '查询:', currentSelectedText);
      
      chrome.runtime.sendMessage({
        action: 'singleSiteSearch',
        query: currentSelectedText,
        siteName: site.name
      }).catch(error => {
        console.error('发送消息Failed:', error);
      });
      
      const newFavoriteSite = [{
        name: site.name
      }];
      
      
      await chrome.storage.sync.set({ favoriteSites: newFavoriteSite });
      
      
      siteDropdown.classList.remove('show');
      if (toolbar) {
        toolbar.style.display = 'none';
        isToolbarVisible = false;
        currentSelectedText = '';
        lastSelectedText = '';
      }
    });
    
    siteDropdown.appendChild(siteItem);
  });

  
  siteSelectButton.addEventListener('click', (e) => {
    e.stopPropagation();
    siteDropdown.classList.toggle('show');
  });

  
  document.addEventListener('click', () => {
    siteDropdown.classList.remove('show');
  });

  
  siteDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}
  
  
  favoriteButton.onclick = async (e) => {
    e.stopPropagation();
    if (!currentSelectedText) {
      console.log('没有有效的选中文本');
      return;
    }

    chrome.storage.sync.get('favoriteSites', async function(settings) {
      if (settings.favoriteSites && settings.favoriteSites.length > 0) {
        await chrome.runtime.sendMessage({
          action: 'singleSiteSearch',
          query: currentSelectedText,
          siteName: settings.favoriteSites[0].name
        }).catch(error => {
          console.error('发送消息Failed:', error);
        });
      }
    });
  };
  
  
  const compareButton = document.createElement('img');
  compareButton.src = chrome.runtime.getURL('icons/icon48.png');
  compareButton.title = chrome.i18n.getMessage('searchWithMultiAI');
  compareButton.className = 'multi-ai-compare-button';
  
  compareButton.onclick = async (e) => {
    e.stopPropagation();

    if (!currentSelectedText) {
      console.log('没有有效的选中文本');
      return;
    }

    if (currentSelectedText) {
      await chrome.runtime.sendMessage({
        action: 'createComparisonPage',
        query: currentSelectedText
      }).catch(error => {
        console.error('发送消息Failed:', error);
      });
    }
  };
  
  initializeSiteDropdown();
  

  
  const singleSearchGroup = document.createElement('div');
  singleSearchGroup.className = 'single-search-group';
  singleSearchGroup.style.display = 'flex'; 
  
  
  singleSearchGroup.appendChild(favoriteButton);
  singleSearchGroup.appendChild(siteSelectButton);
  singleSearchGroup.appendChild(siteDropdown);
  
  
  toolbar.appendChild(singleSearchGroup);
  toolbar.appendChild(compareButton);
  document.body.appendChild(toolbar);
}


function updateToolbarPosition(selection) {
  if (!toolbar) createToolbar();
  
  if (!selection || !selection.rangeCount || selection.rangeCount === 0) {
    console.log('无效的选区');
    return;
  }
  
  try {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    if (rect.width > 0 && rect.height > 0) {
      
      const left = rect.right + 5;
      const top = rect.top - 5;
      
      
      const maxLeft = window.innerWidth - toolbar.offsetWidth - 10;
      const finalLeft = Math.min(left, maxLeft);
      
      toolbar.style.left = `${finalLeft}px`;
      toolbar.style.top = `${top}px`;
      toolbar.style.display = 'block';
      isToolbarVisible = true;
      
      console.log('工具栏位置Update', {
        left: finalLeft,
        top,
        display: toolbar.style.display,
        visible: isToolbarVisible,
        toolbarWidth: toolbar.offsetWidth,
        toolbarHeight: toolbar.offsetHeight
      });
    }
  } catch (error) {
    console.error('Update工具栏位置Failed:', error);
  }
}


document.addEventListener('mouseup', (e) => {
  
  if (toolbar && toolbar.contains(e.target)) {
    console.log('在工具栏内Click，保持当前选中文本');
    return;
  }

  setTimeout(() => {
    
    const selection = window.getSelection();
    currentSelectedText = selection?.toString().trim() || '';
    
    
    if (currentSelectedText) {
      console.log("currentSelectedText", currentSelectedText);
    }
    
    if (currentSelectedText && selection.rangeCount > 0) {
      lastSelectedText = currentSelectedText;
      chrome.storage.sync.get(['buttonConfig'], function(result) {
        const buttonConfig = result.buttonConfig || { selectionSearch: true };
        if (buttonConfig.selectionSearch) {
          updateToolbarPosition(selection);
        } else {
          console.log('滑词已禁用');
        }
      });
    }
  }, 10);
});


document.addEventListener('mousedown', (e) => {
  if (toolbar && !toolbar.contains(e.target)) {
    console.log("鼠标Clicktoolbar消失", toolbar.contains(e.target));
    toolbar.style.display = 'none';
    isToolbarVisible = false;
    lastSelectedText = '';
    currentSelectedText = '';
    console.log("清空currentSelectedText");
  }
});


window.addEventListener('scroll', () => {
  
  console.log("页面滚动 isToolbarVisible", isToolbarVisible);
  if (isToolbarVisible) {
    toolbar.style.display = 'none';
    isToolbarVisible = false;
    lastSelectedText = '';
  }
}, { passive: true });


document.addEventListener('keydown', (e) => {
  
  if (isToolbarVisible) {
    console.log("键盘按键 isToolbarVisible", isToolbarVisible, "按键:", e.key);
    toolbar.style.display = 'none';
    isToolbarVisible = false;
    lastSelectedText = '';
    currentSelectedText = '';
    console.log("键盘按键导致工具栏消失");
  }
});




chrome.storage.sync.get(['buttonConfig'], function(result) {
  const buttonConfig = result.buttonConfig || { selectionSearch: true };
  if (buttonConfig.selectionSearch) {
    createToolbar(); 
  } else {
    console.log('滑词已禁用');
  }
});




window.addEventListener('error', function(event) {
  if (event.error?.message?.includes('Extension context invalidated')) {
    console.log('扩展已重新Load，将刷新页面');
    window.location.reload();
  }
});


chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
  if (message.action === 'extensionReloaded') {
    window.location.reload();
  }
});


chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.favoriteSites) {
    updateFavoriteButton();
  }
});

