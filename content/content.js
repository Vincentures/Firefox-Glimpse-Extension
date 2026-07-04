(() => {
  if (window.__glimpseInjected) return;
  window.__glimpseInjected = true;

  const ICONS = {
    expand:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
    bookmark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    back:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>',
    forward:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
    copy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  };

  const CONTROLS_CSS = `
    .glimpse-bar {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      transform: translateY(-50%);
    }
    .glimpse-btn {
      appearance: none;
      border: none;
      background: rgba(30, 31, 36, 0.92);
      color: #c7c8cd;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      transition: background-color 0.15s ease, color 0.15s ease, transform 0.08s ease;
    }
    .glimpse-btn svg {
      width: 16px;
      height: 16px;
      pointer-events: none;
    }
    .glimpse-btn:hover {
      background: rgba(60, 62, 70, 0.95);
      color: #ffffff;
    }
    .glimpse-btn:active {
      transform: scale(0.9);
    }
    .glimpse-btn-active {
      background: rgba(90, 150, 255, 0.45);
      color: #ffffff;
    }
    .glimpse-btn-active svg {
      fill: currentColor;
    }
    .glimpse-btn-copied {
      background: rgba(70, 170, 110, 0.55);
      color: #ffffff;
    }
    .glimpse-bar-gap {
      height: 4px;
    }
    .glimpse-dialog-backdrop {
      position: fixed;
      inset: 0;
      pointer-events: auto;
    }
    .glimpse-dialog {
      pointer-events: auto;
      position: fixed;
      top: 50%;
      right: 54px;
      transform: translateY(-50%);
      width: 260px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px;
      background: #26272e;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      font: 13px -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #e6e6e9;
    }
    .glimpse-dialog h3 {
      margin: 0 0 2px;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
    }
    .glimpse-dialog label {
      font-size: 11px;
      color: #a5a6ac;
    }
    .glimpse-dialog input,
    .glimpse-dialog select {
      width: 100%;
      box-sizing: border-box;
      background: #1e1f24;
      border: 1px solid #3a3b42;
      border-radius: 6px;
      padding: 6px 8px;
      color: #e6e6e9;
      font: inherit;
    }
    .glimpse-dialog input:focus,
    .glimpse-dialog select:focus {
      outline: none;
      border-color: #5a96ff;
    }
    .glimpse-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 4px;
    }
    .glimpse-dialog-btn {
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font: inherit;
      cursor: pointer;
    }
    .glimpse-dialog-btn:hover {
      filter: brightness(1.15);
    }
    .glimpse-dialog-cancel {
      background: #3a3b42;
      color: #e6e6e9;
    }
    .glimpse-dialog-save {
      background: #5a96ff;
      color: #fff;
    }
  `;

  const MODIFIER_PROPS = { alt: "altKey", ctrl: "ctrlKey", shift: "shiftKey" };
  let modifier = "alt";
  browser.storage.local.get({ glimpseModifier: "alt" }).then((res) => {
    modifier = res.glimpseModifier;
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.glimpseModifier) {
      modifier = changes.glimpseModifier.newValue;
    }
  });

  let isPreview = false; // set once the background tells us we're the preview tab
  let overlayEl = null; // dim layer shown on the origin page while a preview is open
  let overlayArmAt = 0; // ignore the mouseup/click that opened the preview
  let controlsRoot = null;
  let controlsShadow = null;
  let bookmarkBtn = null;
  let copyBtn = null;
  let copyResetTimer = null;
  let dialogEls = null; // { backdrop, dialog } while the bookmark dialog is open

  function isPreviewableLink(anchor) {
    if (!anchor || !anchor.href) return false;
    if (anchor.hasAttribute("download")) return false;
    try {
      const url = new URL(anchor.href);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      if (!event[MODIFIER_PROPS[modifier]] || event.button !== 0) return;

      const anchor = event.target.closest && event.target.closest("a[href]");
      if (!isPreviewableLink(anchor)) return;

      event.preventDefault();
      event.stopPropagation();
      browser.runtime.sendMessage({
        type: "glimpse:open",
        url: anchor.href,
        screen: {
          availLeft: window.screen.availLeft || 0,
          availTop: window.screen.availTop || 0,
          availWidth: window.screen.availWidth,
          availHeight: window.screen.availHeight,
        },
      });
    },
    true
  );

  // Shortcuts inside the preview. Ctrl+D matches Firefox's own bookmark
  // shortcut (intercepted so it opens the Glimpse dialog instead of the
  // browser's star panel); Alt+←/→ for back/forward already work natively
  // because the preview is a real popup window.
  document.addEventListener(
    "keydown",
    (event) => {
      if (!isPreview) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey && !event.shiftKey && !event.altKey && key === "d") {
        event.preventDefault();
        event.stopPropagation();
        onBookmarkClick();
      } else if (event.ctrlKey && event.shiftKey && !event.altKey && key === "l") {
        event.preventDefault();
        event.stopPropagation();
        onCopyClick();
      } else if (event.ctrlKey && event.shiftKey && !event.altKey && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        browser.runtime.sendMessage({ type: "glimpse:promote" });
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      if (dialogEls) {
        event.preventDefault();
        event.stopPropagation();
        closeBookmarkDialog();
        return;
      }
      if (!overlayEl && !isPreview) return;
      event.preventDefault();
      event.stopPropagation();
      browser.runtime.sendMessage({ type: "glimpse:close" });
    },
    true
  );

  // ---------- Origin page overlay

  function addOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement("div");
    overlayEl.id = "glimpse-origin-overlay";
    Object.assign(overlayEl.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      background: "rgba(0, 0, 0, 0.25)",
      backdropFilter: "blur(4px)",
      cursor: "pointer",
      pointerEvents: "none",
    });
    document.documentElement.appendChild(overlayEl);
    overlayArmAt = performance.now() + 800;
    setTimeout(() => {
      if (overlayEl) overlayEl.style.pointerEvents = "auto";
    }, 800);
    overlayEl.addEventListener("click", () => {
      if (performance.now() < overlayArmAt) return;
      browser.runtime.sendMessage({ type: "glimpse:close" });
    });
  }

  function removeOverlay() {
    if (!overlayEl) return;
    overlayEl.remove();
    overlayEl = null;
  }

  // ---------- Preview controls bar

  function makeButton(className, iconSvg, title, handler) {
    const btn = document.createElement("button");
    btn.className = `glimpse-btn ${className}`;
    btn.innerHTML = iconSvg;
    btn.title = title;
    btn.type = "button";
    btn.addEventListener("click", handler);
    return btn;
  }

  function showControls(bookmarked) {
    isPreview = true;
    if (controlsRoot && document.documentElement.contains(controlsRoot)) {
      setBookmarkState(bookmarked);
      return;
    }

    controlsRoot = document.createElement("div");
    Object.assign(controlsRoot.style, {
      all: "initial",
      position: "fixed",
      top: "50%",
      right: "8px",
      zIndex: "2147483647",
      pointerEvents: "none",
    });
    controlsShadow = controlsRoot.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = CONTROLS_CSS;

    const bar = document.createElement("div");
    bar.className = "glimpse-bar";

    const backBtn = makeButton("glimpse-btn-back", ICONS.back, "Go back", () => history.back());
    const forwardBtn = makeButton("glimpse-btn-forward", ICONS.forward, "Go forward", () => history.forward());
    const gap = document.createElement("div");
    gap.className = "glimpse-bar-gap";
    copyBtn = makeButton("glimpse-btn-copy", ICONS.copy, "Copy link (Ctrl+Shift+L)", onCopyClick);
    bookmarkBtn = makeButton("glimpse-btn-bookmark", ICONS.bookmark, "Bookmark this page (Ctrl+D)", onBookmarkClick);
    const expandBtn = makeButton("glimpse-btn-expand", ICONS.expand, "Open in new tab (Ctrl+Shift+Enter)", () =>
      browser.runtime.sendMessage({ type: "glimpse:promote" })
    );

    bar.append(backBtn, forwardBtn, gap, copyBtn, bookmarkBtn, expandBtn);
    controlsShadow.append(style, bar);
    document.documentElement.appendChild(controlsRoot);

    setBookmarkState(bookmarked);
  }

  function hideControls() {
    isPreview = false;
    closeBookmarkDialog();
    if (copyResetTimer) {
      clearTimeout(copyResetTimer);
      copyResetTimer = null;
    }
    if (controlsRoot) {
      controlsRoot.remove();
      controlsRoot = null;
      controlsShadow = null;
      bookmarkBtn = null;
      copyBtn = null;
    }
  }

  function setBookmarkState(active) {
    if (bookmarkBtn) bookmarkBtn.classList.toggle("glimpse-btn-active", !!active);
  }

  // ---------- Copy link

  async function onCopyClick() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      // clipboard API can be denied on some pages; fall back to execCommand
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    if (!copyBtn) return;
    copyBtn.innerHTML = ICONS.check;
    copyBtn.classList.add("glimpse-btn-copied");
    if (copyResetTimer) clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      copyResetTimer = null;
      if (!copyBtn) return;
      copyBtn.innerHTML = ICONS.copy;
      copyBtn.classList.remove("glimpse-btn-copied");
    }, 1200);
  }

  // ---------- Bookmark dialog (Firefox's native star panel isn't reachable
  // from extensions, so this is a small replica: name + destination folder)

  async function onBookmarkClick() {
    if (dialogEls) {
      closeBookmarkDialog();
      return;
    }
    if (bookmarkBtn.classList.contains("glimpse-btn-active")) {
      const res = await browser.runtime.sendMessage({ type: "glimpse:bookmark-remove" });
      setBookmarkState(res && res.bookmarked);
      return;
    }
    const info = await browser.runtime.sendMessage({ type: "glimpse:bookmark-info" });
    if (!info) return;
    openBookmarkDialog(info);
  }

  function openBookmarkDialog(info) {
    const backdrop = document.createElement("div");
    backdrop.className = "glimpse-dialog-backdrop";
    backdrop.addEventListener("click", closeBookmarkDialog);

    const dialog = document.createElement("div");
    dialog.className = "glimpse-dialog";

    const heading = document.createElement("h3");
    heading.textContent = "Bookmark this page";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = info.title;

    const folderLabel = document.createElement("label");
    folderLabel.textContent = "Folder";
    const folderSelect = document.createElement("select");
    for (const folder of info.folders) {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = `${"  ".repeat(folder.depth)}${folder.title}`;
      if (folder.id === info.defaultFolderId) option.selected = true;
      folderSelect.appendChild(option);
    }

    const actions = document.createElement("div");
    actions.className = "glimpse-dialog-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "glimpse-dialog-btn glimpse-dialog-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", closeBookmarkDialog);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "glimpse-dialog-btn glimpse-dialog-save";
    saveBtn.textContent = "Save";
    const save = async () => {
      const res = await browser.runtime.sendMessage({
        type: "glimpse:bookmark-create",
        title: nameInput.value.trim(),
        parentId: folderSelect.value,
      });
      setBookmarkState(res && res.bookmarked);
      closeBookmarkDialog();
    };
    saveBtn.addEventListener("click", save);
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });

    actions.append(cancelBtn, saveBtn);
    dialog.append(heading, nameLabel, nameInput, folderLabel, folderSelect, actions);
    controlsShadow.append(backdrop, dialog);
    dialogEls = { backdrop, dialog };
    nameInput.focus();
    nameInput.select();
  }

  function closeBookmarkDialog() {
    if (!dialogEls) return;
    dialogEls.backdrop.remove();
    dialogEls.dialog.remove();
    dialogEls = null;
  }

  // ---------- Messages from the background script

  browser.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case "glimpse:add-overlay":
        addOverlay();
        break;
      case "glimpse:remove-overlay":
        removeOverlay();
        break;
      case "glimpse:show-controls":
        showControls(message.bookmarked);
        break;
      case "glimpse:hide-controls":
        hideControls();
        break;
    }
  });
})();
