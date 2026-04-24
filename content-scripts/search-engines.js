
const SEARCH_ENGINE_CONFIGS = {
  'www.google.com': {
    containerSelector: 'textarea[name="q"], textarea#APjFqb, textarea.gLFyf',
    position: 'afterend'
  },
  'www.baidu.com': {
    containerSelector: '#form',
    position: 'beforeend'
  },
  'www.bing.com': {
    containerSelector: '#sb_form_q',
    position: 'beforeend'
  },
  'cn.bing.com': {
    containerSelector: '#sb_form_q',
    position: 'beforeend'
  }
};


function getQueryFromUrl() {
  const url = new URL(window.location.href);
  const hostname = window.location.hostname;
  
  
  const queryParams = {
    'www.google.com': 'q',    
    'www.baidu.com': 'wd',    
    'www.bing.com': 'q',      
    'cn.bing.com': 'q'        
  };
  
  const queryParam = queryParams[hostname];
  if (!queryParam) return '';
  
  
  const query = url.searchParams.get(queryParam);
  return query ? decodeURIComponent(query) : '';
}


async function createSearchToolbar(container, position) {
  const sites = await window.getDefaultSites();
    if (!sites || !sites.length) return;
  
    
    const visibleSites = sites.filter(site => !site.hidden);
    console.log('可见的Site:', visibleSites);

  
  const toolbar = document.createElement('div');
  toolbar.className = 'multi-ai-toolbar multi-ai-toolbar-float';  
  
  
  const favoriteButton = document.createElement('button');
  favoriteButton.className = 'multi-ai-favorite-button';
   
  const updateFavoriteButtonText = () => {
    chrome.storage.sync.get({
      favoriteSites: []
    }, (settings) => {
      favoriteButton.textContent = settings.favoriteSites[0].name;
      console.log("Update按钮文本:", favoriteButton.textContent);
    });
  };
  
  
  updateFavoriteButtonText();
 
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.favoriteSites) {
      console.log("FavoritesSite变化:", changes.favoriteSites.newValue);
      updateFavoriteButtonText();
    }
  });

  
  const siteSelectButton = document.createElement('button');
  siteSelectButton.className = 'site-select-button';
  siteSelectButton.textContent = '▼';
  const siteDropdown = document.createElement('div');
  siteDropdown.className = 'site-dropdown';  

  function initializeSiteDropdown() {
    if (!siteDropdown || !siteSelectButton) return;
    console.log("初始化下拉菜单",visibleSites);
  
    
    visibleSites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      siteItem.textContent = `${site.name}`;
      
      siteItem.addEventListener('click', async () => {
        
        const query = getQueryFromUrl();
        chrome.runtime.sendMessage({
          action: 'singleSiteSearch',
          query: query,
          siteName: site.name
        }, (response) => {
          console.log('Message response:', response);  
        });


        const newFavoriteSite = [{
          name: site.name
        }];
        
        
        await chrome.storage.sync.set({ favoriteSites: newFavoriteSite });
        
        siteDropdown.classList.remove('show');
      });
      
      siteDropdown.appendChild(siteItem);
      console.log("添加Site列表",siteDropdown);
    });
  
    
    siteSelectButton.addEventListener('click', (e) => {
      e.stopPropagation();
      siteDropdown.classList.toggle('show');
      console.log('下拉菜单显示状态:', siteDropdown.classList.contains('show'));
    });
  
    
    document.addEventListener('click', () => {
      siteDropdown.classList.remove('show');
    });
  
    
    siteDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  initializeSiteDropdown();

   
   const singleSearchGroup = document.createElement('div');
   singleSearchGroup.className = 'single-search-group';
   singleSearchGroup.style.display = 'none';  
   
   
   singleSearchGroup.appendChild(favoriteButton);
   singleSearchGroup.appendChild(siteSelectButton);
   singleSearchGroup.appendChild(siteDropdown);

  
  const compareButton = document.createElement('img');
  compareButton.src = chrome.runtime.getURL('icons/icon48.png');
  compareButton.title = chrome.i18n.getMessage('searchWithMultiAI');
  compareButton.className = 'multi-ai-compare-button';
  
  
  toolbar.appendChild(singleSearchGroup);
  toolbar.appendChild(compareButton);
  
  document.body.appendChild(toolbar);
  
  
  favoriteButton.addEventListener('click', () => {
    const query = getQueryFromUrl();
    console.log('Favorite button clicked, query:', query);  
    
    if (query) {
      
      chrome.storage.sync.get({
        favoriteSites: []
      }, (settings) => {
        console.log('Settings loaded:', settings);  
        
        chrome.runtime.sendMessage({
          action: 'singleSiteSearch',
          query: query,
          siteName: settings.favoriteSites[0].name
        }, (response) => {
          console.log('Message response:', response);  
        });
      });
    }
  });
  
  compareButton.addEventListener('click', () => {
    const query = getQueryFromUrl();
    console.log('Compare button clicked, query:', query);  
    
    if (query) {
      chrome.storage.local.get({
        sites: []
      }, (settings) => {
        console.log('Settings loaded:', settings);  
        
        chrome.runtime.sendMessage({
          action: 'createComparisonPage',
          query: query
        }, (response) => {
          console.log('Message response:', response);  
        });
      });
    }
  });
  
  
  
  
  const updatePosition = () => {
    const containerRect = container.getBoundingClientRect();
    
    
    console.log('Container position:', containerRect);
    
    toolbar.style.position = 'fixed';
    
    const hostname = window.location.hostname;
    if (hostname.includes('google')) {
      toolbar.style.top = `${containerRect.top + 5}px`;
      toolbar.style.left = `${containerRect.right - 30}px`;  
    } else if (hostname.includes('bing')) {
      toolbar.style.top = `${containerRect.top + 5}px`; 
      toolbar.style.left = `${containerRect.right - 100}px`;
    } else if (hostname.includes('baidu')) {
      toolbar.style.top = `${containerRect.top}px`;
      toolbar.style.left = `${containerRect.right - 310}px`;
    } else {
      
      toolbar.style.top = `${containerRect.top}px`;
      toolbar.style.left = `${containerRect.right + 10}px`;
    }
    
    
    
    console.log('Toolbar style:', {
      top: toolbar.style.top,
      left: toolbar.style.left,
      display: getComputedStyle(toolbar).display,
      visibility: getComputedStyle(toolbar).visibility,
      zIndex: getComputedStyle(toolbar).zIndex
    });
  };
  
  
  updatePosition();
  
  
  window.addEventListener('scroll', updatePosition);
  window.addEventListener('resize', updatePosition);
  
  return toolbar;
}


function initSearchEngineToolbar() {
  const hostname = window.location.hostname;
  const config = SEARCH_ENGINE_CONFIGS[hostname];
  if (!config) return;

  
  const observer = new MutationObserver((mutations, obs) => {
    const container = document.querySelector(config.containerSelector);
    console.log("找到搜索引擎的Input boxcontainer", container);
    if (container) {
      
      createSearchToolbar(container, config.position);
      obs.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}



chrome.storage.sync.get(['buttonConfig'], function(result) {
  const buttonConfig = result.buttonConfig || { searchEngine: true };
  if (buttonConfig.searchEngine) {
    initSearchEngineToolbar();;
  } else {
    console.log('浮动按钮已禁用');
  }
});


