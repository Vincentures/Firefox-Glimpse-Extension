// Glimpse previews are real popup windows (browser.windows.create type:"popup"),
// not iframes. A popup window is a top-level browsing context, so
// X-Frame-Options / CSP frame-ancestors never apply - every site renders.
// The slim popup chrome makes it look and feel like a floating panel.

let previewWindowId = null;
let previewTabId = null;
let originTabId = null;
let originWindowId = null;
let screenInfo = null; // { availLeft, availTop, availWidth, availHeight } from the origin page
let previewOpenedAt = 0; // guard against the opening click instantly closing the preview

let boundsPollTimer = null;
let lastBoundsSignature = null;

const DEFAULT_MARGIN_PCT = 0.05; // space left on every side of the popup, as a fraction of the screen

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Remembered popup geometry

async function getSavedBounds() {
  const { glimpseBounds } = await browser.storage.local.get("glimpseBounds");
  return glimpseBounds || null;
}

function defaultBounds() {
  const s = screenInfo || { availLeft: 0, availTop: 0, availWidth: 1600, availHeight: 900 };
  const marginX = Math.round(s.availWidth * DEFAULT_MARGIN_PCT);
  const marginY = Math.round(s.availHeight * DEFAULT_MARGIN_PCT);
  return {
    left: s.availLeft + marginX,
    top: s.availTop + marginY,
    width: s.availWidth - marginX * 2,
    height: s.availHeight - marginY * 2,
  };
}

function startBoundsPolling() {
  stopBoundsPolling();
  boundsPollTimer = setInterval(async () => {
    if (!previewWindowId) return;
    try {
      const w = await browser.windows.get(previewWindowId);
      const bounds = { left: w.left, top: w.top, width: w.width, height: w.height };
      const signature = JSON.stringify(bounds);
      if (signature !== lastBoundsSignature) {
        lastBoundsSignature = signature;
        await browser.storage.local.set({ glimpseBounds: bounds });
      }
    } catch (err) {
      // window may be mid-close
    }
  }, 500);
}

function stopBoundsPolling() {
  if (boundsPollTimer) {
    clearInterval(boundsPollTimer);
    boundsPollTimer = null;
  }
}

// ---------- Messaging helpers (content script may not be ready yet)

async function sendToTab(tabId, message) {
  try {
    await browser.tabs.sendMessage(tabId, message);
    return true;
  } catch (err) {
    return false;
  }
}

async function showControlsSoon() {
  const bookmarked = await isPreviewBookmarked();
  for (let i = 0; i < 24; i++) {
    if (!previewTabId) return;
    if (await sendToTab(previewTabId, { type: "glimpse:show-controls", bookmarked })) return;
    await sleep(150);
  }
}

// ---------- Bookmarks

async function getPreviewTab() {
  if (previewTabId === null) return null;
  try {
    return await browser.tabs.get(previewTabId);
  } catch (err) {
    return null;
  }
}

async function isPreviewBookmarked() {
  const tab = await getPreviewTab();
  if (!tab || !tab.url) return false;
  try {
    const matches = await browser.bookmarks.search({ url: tab.url });
    return matches.length > 0;
  } catch (err) {
    return false; // about:blank and friends make bookmarks.search throw
  }
}

function flattenFolders(nodes, depth, out) {
  for (const node of nodes) {
    if (node.url !== undefined || node.type === "separator") continue;
    out.push({ id: node.id, title: node.title, depth });
    if (node.children) flattenFolders(node.children, depth + 1, out);
  }
  return out;
}

// Everything the bookmark dialog needs: current state, suggested name,
// the full folder tree, and the last folder the user saved into.
async function getBookmarkInfo() {
  const tab = await getPreviewTab();
  if (!tab || !tab.url) return { bookmarked: false, title: "", folders: [], defaultFolderId: null };

  const tree = await browser.bookmarks.getTree();
  const folders = flattenFolders(tree[0].children || [], 0, []);

  const { glimpseBookmarkFolder } = await browser.storage.local.get("glimpseBookmarkFolder");
  const defaultFolderId =
    glimpseBookmarkFolder && folders.some((f) => f.id === glimpseBookmarkFolder)
      ? glimpseBookmarkFolder
      : "unfiled_____"; // "Other Bookmarks"

  return {
    bookmarked: await isPreviewBookmarked(),
    title: tab.title || tab.url,
    folders,
    defaultFolderId,
  };
}

async function createBookmark(title, parentId) {
  const tab = await getPreviewTab();
  if (!tab || !tab.url) return { bookmarked: false };
  try {
    await browser.bookmarks.create({ title: title || tab.title || tab.url, url: tab.url, parentId });
    await browser.storage.local.set({ glimpseBookmarkFolder: parentId });
    return { bookmarked: true };
  } catch (err) {
    return { bookmarked: false };
  }
}

async function removeBookmark() {
  const tab = await getPreviewTab();
  if (!tab || !tab.url) return { bookmarked: false };
  try {
    const matches = await browser.bookmarks.search({ url: tab.url });
    await Promise.all(matches.map((b) => browser.bookmarks.remove(b.id)));
  } catch (err) {
    // nothing to remove
  }
  return { bookmarked: false };
}

// ---------- Preview lifecycle

async function openPreview(url, sender) {
  // Alt+click inside the preview itself just navigates the preview.
  if (sender.tab && sender.tab.id === previewTabId) {
    await browser.tabs.update(previewTabId, { url });
    return;
  }

  const newOriginTabId = sender.tab ? sender.tab.id : null;
  const newOriginWindowId = sender.tab ? sender.tab.windowId : null;

  if (previewWindowId !== null) {
    // Reuse the existing popup; move the dim overlay if the origin changed.
    if (originTabId !== null && originTabId !== newOriginTabId) {
      await sendToTab(originTabId, { type: "glimpse:remove-overlay" });
    }
    originTabId = newOriginTabId;
    originWindowId = newOriginWindowId;
    await browser.tabs.update(previewTabId, { url, active: true });
    await browser.windows.update(previewWindowId, { focused: true });
  } else {
    originTabId = newOriginTabId;
    originWindowId = newOriginWindowId;
    const bounds = (await getSavedBounds()) || defaultBounds();
    const w = await browser.windows.create({
      url,
      type: "popup",
      titlePreface: "Glimpse - ",
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      focused: true,
    });
    previewWindowId = w.id;
    previewTabId = w.tabs && w.tabs.length ? w.tabs[0].id : null;
    if (previewTabId === null) {
      const tabs = await browser.tabs.query({ windowId: previewWindowId });
      previewTabId = tabs.length ? tabs[0].id : null;
    }
    startBoundsPolling();
  }

  previewOpenedAt = Date.now();
  showControlsSoon();
  if (originTabId !== null) {
    await sendToTab(originTabId, { type: "glimpse:add-overlay" });
  }
}

async function cleanup({ closeWindow }) {
  stopBoundsPolling();
  if (originTabId !== null) {
    await sendToTab(originTabId, { type: "glimpse:remove-overlay" });
  }
  if (closeWindow && previewWindowId !== null) {
    try {
      await browser.windows.remove(previewWindowId);
    } catch (err) {
      // already closed
    }
  }
  previewWindowId = null;
  previewTabId = null;
  originTabId = null;
  originWindowId = null;
  lastBoundsSignature = null;
}

async function closePreview() {
  if (Date.now() - previewOpenedAt < 800) return; // ignore the click that opened it
  await cleanup({ closeWindow: true });
}

async function promoteToTab() {
  if (previewTabId === null || originWindowId === null) return;
  try {
    await sendToTab(previewTabId, { type: "glimpse:hide-controls" });
    const moved = await browser.tabs.move(previewTabId, { windowId: originWindowId, index: -1 });
    const movedId = Array.isArray(moved) ? moved[0].id : moved.id;
    previewTabId = null; // the tab now belongs to the main window; don't close it with the popup
    await browser.tabs.update(movedId, { active: true });
    await browser.windows.update(originWindowId, { focused: true });
  } catch (err) {
    // move can fail if the origin window closed; leave the popup as-is
    return;
  }
  await cleanup({ closeWindow: true });
}

// ---------- Message router

browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.type) {
    case "glimpse:open":
      if (message.screen) screenInfo = message.screen;
      return openPreview(message.url, sender);
    case "glimpse:close":
      return closePreview();
    case "glimpse:promote":
      return promoteToTab();
    case "glimpse:bookmark-info":
      return getBookmarkInfo();
    case "glimpse:bookmark-create":
      return createBookmark(message.title, message.parentId);
    case "glimpse:bookmark-remove":
      return removeBookmark();
  }
});

// Re-inject the controls bar after any navigation inside the preview.
browser.webNavigation.onCommitted.addListener((details) => {
  if (details.tabId === previewTabId && details.frameId === 0) showControlsSoon();
});
browser.tabs.onUpdated.addListener((tabId, info) => {
  if (tabId === previewTabId && info.status === "complete") showControlsSoon();
});

// The preview belongs to the page it was opened from - if the user switches
// to a different tab in the origin window, close it instead of leaving an
// orphaned popup floating behind the main window.
browser.tabs.onActivated.addListener((activeInfo) => {
  if (previewWindowId === null) return;
  if (activeInfo.windowId === originWindowId && activeInfo.tabId !== originTabId) {
    cleanup({ closeWindow: true });
  }
});

// Close the preview whenever focus moves anywhere outside it - the origin
// window, another app, or the taskbar. Focus switches can fire a transient
// WINDOW_ID_NONE before settling, so re-check after a short debounce instead
// of acting on the first event.
let focusCheckTimer = null;
browser.windows.onFocusChanged.addListener((windowId) => {
  if (previewWindowId === null) return;
  if (windowId === previewWindowId) {
    if (focusCheckTimer) {
      clearTimeout(focusCheckTimer);
      focusCheckTimer = null;
    }
    return;
  }
  if (focusCheckTimer) clearTimeout(focusCheckTimer);
  focusCheckTimer = setTimeout(async () => {
    focusCheckTimer = null;
    if (previewWindowId === null) return;
    if (Date.now() - previewOpenedAt < 800) return; // still settling after open
    try {
      const w = await browser.windows.getLastFocused();
      if (w && w.focused && w.id === previewWindowId) return; // focus came back
    } catch (err) {
      // fall through and close
    }
    cleanup({ closeWindow: true });
  }, 200);
});

// User closed the popup (or its tab) directly.
browser.windows.onRemoved.addListener((windowId) => {
  if (windowId === previewWindowId) {
    previewWindowId = null; // already gone; don't try to remove it again
    cleanup({ closeWindow: false });
  }
});
browser.tabs.onRemoved.addListener((tabId) => {
  if (tabId === previewTabId) {
    previewTabId = null;
  }
  if (tabId === originTabId) {
    originTabId = null;
  }
});
