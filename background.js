const MODEL_CONFIGS = {
  doubao: {
    title: "豆包",
    url: "https://www.doubao.com/chat"
  },
  deepseek: {
    title: "DeepSeek",
    url: "https://chat.deepseek.com/"
  }
};

const DEFAULT_PLATFORM = "doubao";
const MAX_SELECTION_LENGTH = 12000;

async function createMenus() {
  await browser.contextMenus.removeAll();

  const { llmPlatform = DEFAULT_PLATFORM } = await browser.storage.local.get("llmPlatform");
  const defaultPlatform = MODEL_CONFIGS[llmPlatform] ? llmPlatform : DEFAULT_PLATFORM;
  const defaultTitle = MODEL_CONFIGS[defaultPlatform].title;

  browser.contextMenus.create({
    id: "send-default",
    title: `直接发送到默认模型（${defaultTitle}）`,
    contexts: ["selection"]
  });

  browser.contextMenus.create({
    id: "choose-model",
    title: "选择模型发送...",
    contexts: ["selection"]
  });

  Object.entries(MODEL_CONFIGS).forEach(([platform, config]) => {
    browser.contextMenus.create({
      id: platform,
      parentId: "choose-model",
      title: config.title,
      contexts: ["selection"]
    });
  });
}

createMenus();

browser.runtime.onInstalled.addListener(createMenus);

function getPlatformUrl(platform) {
  return (MODEL_CONFIGS[platform] || MODEL_CONFIGS[DEFAULT_PLATFORM]).url;
}

function buildInjectionCode(text) {
  return `(() => {
    const text = ${JSON.stringify(text)};

    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const isEditable = (element) => {
      if (!element) return false;
      if (element.matches('textarea, input')) {
        return !element.disabled && !element.readOnly && isVisible(element);
      }
      return element.isContentEditable && isVisible(element);
    };

    const collectCandidates = () => {
      const results = [];
      const visitedRoots = new Set();

      const addCandidate = (element) => {
        if (element && !results.includes(element)) {
          results.push(element);
        }
      };

      const scanRoot = (root) => {
        if (!root || visitedRoots.has(root)) {
          return;
        }
        visitedRoots.add(root);

        root.querySelectorAll('textarea, input[type="text"], input:not([type]), [contenteditable="true"], [role="textbox"]').forEach(addCandidate);
        root.querySelectorAll('*').forEach((element) => {
          if (element.shadowRoot) {
            scanRoot(element.shadowRoot);
          }
        });
      };

      if (document.activeElement) {
        addCandidate(document.activeElement);
      }

      scanRoot(document);
      return results.filter(isEditable);
    };

    const setNativeValue = (element, value) => {
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) {
        setter.call(element, value);
      } else {
        element.value = value;
      }
    };

    const dispatchInputEvents = (element) => {
      try {
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: text,
          inputType: 'insertText'
        }));
      } catch (error) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const insertIntoContentEditable = (element) => {
      element.focus();

      const selection = window.getSelection();
      if (!selection) {
        element.textContent = text;
        dispatchInputEvents(element);
        return true;
      }

      let range = null;
      if (selection.rangeCount > 0) {
        const currentRange = selection.getRangeAt(0);
        if (element.contains(currentRange.commonAncestorContainer)) {
          range = currentRange;
        }
      }

      if (!range) {
        range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
      }

      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);

      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      dispatchInputEvents(element);
      return true;
    };

    const insertIntoEditable = (element) => {
      element.focus();

      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        setNativeValue(element, text);
        dispatchInputEvents(element);
        return true;
      }

      return insertIntoContentEditable(element);
    };

    const tryFill = () => {
      const candidates = collectCandidates();
      for (const candidate of candidates) {
        if (insertIntoEditable(candidate)) {
          return true;
        }
      }
      return false;
    };

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (tryFill() || attempts >= 25) {
        clearInterval(timer);
      }
    }, 400);
  })();`;
}

function normalizeSelectionText(rawText) {
  if (typeof rawText !== "string") {
    return "";
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= MAX_SELECTION_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_SELECTION_LENGTH)}\n\n[...内容过长，已截断]`;
}

async function notifyError(message) {
  try {
    await browser.notifications.create({
      type: "basic",
      title: "LLM Sender",
      message
    });
  } catch (error) {
    console.error("通知发送失败:", error);
  }
}

async function findReusableTab(url) {
  const tabs = await browser.tabs.query({});
  return tabs.find((currentTab) => {
    if (!currentTab.url) {
      return false;
    }
    return currentTab.url.startsWith(url);
  }) || null;
}

// 点击菜单
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = normalizeSelectionText(info.selectionText);
  if (!text) return;

  let platform = null;

  if (info.menuItemId === "send-default") {
    try {
      const { llmPlatform = DEFAULT_PLATFORM } = await browser.storage.local.get("llmPlatform");
      platform = MODEL_CONFIGS[llmPlatform] ? llmPlatform : DEFAULT_PLATFORM;
    } catch (error) {
      console.error("读取默认模型失败:", error);
      platform = DEFAULT_PLATFORM;
    }
  } else if (MODEL_CONFIGS[info.menuItemId]) {
    platform = info.menuItemId;
    try {
      await browser.storage.local.set({ llmPlatform: platform });
      await createMenus();
    } catch (error) {
      console.error("更新默认模型失败:", error);
    }
  } else {
    return;
  }

  if (!platform) {
    console.error("未找到可用的模型平台:", info.menuItemId);
    await notifyError("未找到可用的默认模型，请先在菜单中选择一个模型。");
    return;
  }

  const url = getPlatformUrl(platform);

  let targetTab = null;
  try {
    targetTab = await findReusableTab(url);
    if (targetTab) {
      await browser.tabs.update(targetTab.id, { active: true });
    } else {
      targetTab = await browser.tabs.create({ url });
    }
  } catch (error) {
    console.error("打开目标页面失败:", error);
    await notifyError("无法打开目标模型页面，请稍后重试。");
    return;
  }

  // 页面加载完后填入内容
  const listener = async (tabId, changeInfo) => {
    if (tabId !== targetTab.id || changeInfo.status !== "complete") {
      return;
    }

    try {
      await browser.tabs.executeScript(tabId, {
        code: buildInjectionCode(text)
      });
    } catch (error) {
      console.error("注入脚本失败:", error);
      await notifyError("无法在目标页面填充文本，请检查登录状态或页面是否可编辑。");
    } finally {
      browser.tabs.onUpdated.removeListener(listener);
    }
  };

  browser.tabs.onUpdated.addListener(listener);

  // 已打开的页面可能无需触发 complete，先尝试一次注入。
  try {
    await browser.tabs.executeScript(targetTab.id, {
      code: buildInjectionCode(text)
    });
    browser.tabs.onUpdated.removeListener(listener);
  } catch (error) {
    // 忽略即时注入失败，等待 onUpdated 再重试。
  }
});
