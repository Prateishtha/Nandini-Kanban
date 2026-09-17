const STORAGE_KEY = "kanban-board-state";
const THEME_KEY = "kanban-board-theme";
const COLOR_KEY = "kanban-board-color";
const FILE_DB_NAME = "kanban-board-files";
const FILE_DB_VERSION = 1;
const ACCOUNT_KEY = "kanban-board-account";
const SESSION_KEY = "kanban-board-session";

const defaultState = {
  columns: [
    { id: uid(), title: "Backlog", cards: [
      { id: uid(), text: "Click a card to edit it, drag it to move it" }
    ] },
    { id: uid(), title: "Discovery", cards: [] },
    { id: uid(), title: "Wow!", cards: [] },
    { id: uid(), title: "Review", cards: [] },
    { id: uid(), title: "Done", cards: [] }
  ]
};

let state = loadState();
let draggedCardId = null;
let draggedSourceColumnId = null;
let draggedCardNode = null;
let pointerDrag = null;
let dragPlaceholder = null;
let dragGhost = null;

const boardEl = document.getElementById("board");
const columnTemplate = document.getElementById("columnTemplate");
const cardTemplate = document.getElementById("cardTemplate");
const themeToggle = document.getElementById("themeToggle");
const themeColor = document.getElementById("themeColor");
const storagePanel = document.getElementById("storagePanel");
const storageToggle = document.getElementById("storageToggle");
const menuToggle = document.getElementById("menuToggle");
const workspaceMenu = document.getElementById("workspaceMenu");
const logoutBtn = document.getElementById("logoutBtn");
const storageClose = document.getElementById("storageClose");
const storageBackdrop = document.getElementById("storageBackdrop");
const fileInput = document.getElementById("fileInput");
const newFolderBtn = document.getElementById("newFolderBtn");
const folderForm = document.getElementById("folderForm");
const folderNameInput = document.getElementById("folderNameInput");
const cancelFolderBtn = document.getElementById("cancelFolderBtn");
const folderList = document.getElementById("folderList");
const fileList = document.getElementById("fileList");
const storageUsage = document.getElementById("storageUsage");
const storageUsageBar = document.getElementById("storageUsageBar");
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const authForm = document.getElementById("authForm");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmit = document.getElementById("authSubmit");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
let authMode = "login";

document.addEventListener("pointermove", handlePointerMove);
document.addEventListener("pointerup", handlePointerUp);
document.addEventListener("pointercancel", handlePointerUp);

storageToggle.addEventListener("click", () => setStoragePanel(true));
menuToggle.addEventListener("click", () => {
  workspaceMenu.hidden = !workspaceMenu.hidden;
  menuToggle.setAttribute("aria-expanded", String(!workspaceMenu.hidden));
});
logoutBtn.addEventListener("click", logout);
storageClose.addEventListener("click", () => setStoragePanel(false));
storageBackdrop.addEventListener("click", () => setStoragePanel(false));
fileInput.addEventListener("change", () => uploadFiles(fileInput.files));
newFolderBtn.addEventListener("click", () => {
  folderForm.hidden = false;
  folderNameInput.focus();
});
cancelFolderBtn.addEventListener("click", () => {
  folderForm.hidden = true;
  folderNameInput.value = "";
});
folderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createFolder(folderNameInput.value);
});

applyTheme(loadTheme());
applyThemeColor(loadThemeColor());
themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
});
themeColor.addEventListener("input", () => {
  applyThemeColor(themeColor.value);
  localStorage.setItem(COLOR_KEY, themeColor.value);
});

document.getElementById("addColumnBtn").addEventListener("click", () => {
  state.columns.push({ id: uid(), title: "New column", cards: [] });
  saveState();
  render();
  const titles = boardEl.querySelectorAll(".column-title");
  const last = titles[titles.length - 1];
  last.focus();
  last.select();
});

render();
refreshStoragePanel();
initializeAuth();

loginTab.addEventListener("click", () => setAuthMode("login"));
signupTab.addEventListener("click", () => setAuthMode("signup"));
authForm.addEventListener("submit", handleAuthSubmit);

function initializeAuth() {
  const session = loadJson(SESSION_KEY);
  authScreen.hidden = Boolean(session);
  appShell.hidden = !session;
  setAuthMode("login");
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  loginTab.classList.toggle("is-active", !signup);
  signupTab.classList.toggle("is-active", signup);
  authName.parentElement.hidden = !signup;
  authName.required = signup;
  authPassword.autocomplete = signup ? "new-password" : "current-password";
  authSubmit.textContent = signup ? "Create account" : "Log in";
  authError.textContent = "";
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authError.textContent = "";
  const email = authEmail.value.trim().toLowerCase();
  const passwordHash = await hashPassword(authPassword.value);
  const account = loadJson(ACCOUNT_KEY);
  if (authMode === "signup") {
    if (account) {
      authError.textContent = "An account already exists in this browser. Log in instead.";
      return;
    }
    saveJson(ACCOUNT_KEY, { name: authName.value.trim(), email, passwordHash });
  } else if (!account || account.email !== email || account.passwordHash !== passwordHash) {
    authError.textContent = "That email or password does not match this browser account.";
    return;
  }
  saveJson(SESSION_KEY, { email, name: authMode === "signup" ? authName.value.trim() : account.name });
  authScreen.hidden = true;
  appShell.hidden = false;
  authForm.reset();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  setStoragePanel(false);
  workspaceMenu.hidden = true;
  authScreen.hidden = false;
  appShell.hidden = true;
  setAuthMode("login");
}

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (err) {
    return null;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setStoragePanel(isOpen) {
  storagePanel.classList.toggle("is-open", isOpen);
  storageBackdrop.classList.toggle("is-visible", isOpen);
  storagePanel.setAttribute("aria-hidden", String(!isOpen));
  storageToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    workspaceMenu.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
  }
}

function openFileDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, FILE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("files")) database.createObjectStore("files", { keyPath: "id" });
      if (!database.objectStoreNames.contains("folders")) database.createObjectStore("folders", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function databaseRequest(storeName, mode, action) {
  const database = await openFileDatabase();
  return new Promise((resolve, reject) => {
    const request = action(database.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredItems(storeName) {
  return databaseRequest(storeName, "readonly", (store) => store.getAll());
}

async function uploadFiles(fileList) {
  if (!fileList.length) return;
  const database = await openFileDatabase();
  const transaction = database.transaction("files", "readwrite");
  const store = transaction.objectStore("files");
  [...fileList].forEach((file) => store.put({ id: uid(), name: file.name, type: file.type, size: file.size, updatedAt: Date.now(), blob: file }));
  transaction.oncomplete = () => {
    fileInput.value = "";
    refreshStoragePanel();
  };
}

async function createFolder(name) {
  if (!name || !name.trim()) return;
  await databaseRequest("folders", "readwrite", (store) => store.put({ id: uid(), name: name.trim(), createdAt: Date.now() }));
  folderForm.hidden = true;
  folderNameInput.value = "";
  refreshStoragePanel();
}

async function deleteStoredItem(storeName, id) {
  await databaseRequest(storeName, "readwrite", (store) => store.delete(id));
  refreshStoragePanel();
}

async function downloadStoredFile(id) {
  const file = await databaseRequest("files", "readonly", (store) => store.get(id));
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

async function refreshStoragePanel() {
  const [files, folders] = await Promise.all([getStoredItems("files"), getStoredItems("folders")]);
  folderList.innerHTML = folders.length ? folders.map((folder) => `<div class="stored-row"><span class="stored-icon">&#128193;</span><span class="stored-name">${escapeHtml(folder.name)}</span><button data-delete-folder="${folder.id}" aria-label="Delete ${escapeHtml(folder.name)}">&times;</button></div>`).join("") : "";
  fileList.innerHTML = files.length ? files.map((file) => `<div class="stored-row"><span class="stored-icon">&#128196;</span><span class="stored-name"><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)}</small></span><button data-download-file="${file.id}" aria-label="Download ${escapeHtml(file.name)}">&#8595;</button><button data-delete-file="${file.id}" aria-label="Delete ${escapeHtml(file.name)}">&times;</button></div>`).join("") : `<p class="empty-storage">Your saved files will appear here.</p>`;
  folderList.querySelectorAll("[data-delete-folder]").forEach((button) => button.addEventListener("click", () => deleteStoredItem("folders", button.dataset.deleteFolder)));
  fileList.querySelectorAll("[data-download-file]").forEach((button) => button.addEventListener("click", () => downloadStoredFile(button.dataset.downloadFile)));
  fileList.querySelectorAll("[data-delete-file]").forEach((button) => button.addEventListener("click", () => deleteStoredItem("files", button.dataset.deleteFile)));
  updateStorageMeter(files);
}

async function updateStorageMeter(files) {
  if (!navigator.storage?.estimate) return;
  const estimate = await navigator.storage.estimate();
  const used = estimate.usage || files.reduce((total, file) => total + file.size, 0);
  const quota = estimate.quota || 1;
  const percentage = Math.min(100, Math.round((used / quota) * 100));
  storageUsage.textContent = `${formatBytes(used)} used`;
  storageUsageBar.style.width = `${Math.max(2, percentage)}%`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "light";
  } catch (err) {
    return "light";
  }
}

function applyThemeColor(hex) {
  const { hue, saturation, lightness } = hexToHsl(hex);
  const root = document.documentElement;
  root.style.setProperty("--user-accent", hex);
  root.style.setProperty("--user-accent-soft", `hsl(${hue} ${Math.min(70, saturation + 8)}% 68%)`);
  root.style.setProperty("--user-light-bg", `hsl(${hue} 22% 96%)`);
  root.style.setProperty("--user-light-mid", `hsl(${hue} 25% 98%)`);
  root.style.setProperty("--user-light-deep", `hsl(${hue} 22% 91%)`);
  root.style.setProperty("--user-light-panel", `hsl(${hue} 20% 99%)`);
  root.style.setProperty("--user-light-card", `hsl(${hue} 18% 100%)`);
  root.style.setProperty("--user-dark-bg", `hsl(${hue} ${Math.min(32, saturation * 0.55)}% ${Math.max(8, Math.min(16, lightness * 0.18))}%)`);
  root.style.setProperty("--user-dark-mid", `hsl(${hue} ${Math.min(28, saturation * 0.48)}% ${Math.max(11, Math.min(21, lightness * 0.24))}%)`);
  root.style.setProperty("--user-dark-deep", `hsl(${hue} ${Math.min(38, saturation * 0.7)}% ${Math.max(6, Math.min(12, lightness * 0.13))}%)`);
  root.style.setProperty("--user-dark-panel", `hsl(${hue} ${Math.min(30, saturation * 0.5)}% 15%)`);
  root.style.setProperty("--user-dark-card", `hsl(${hue} ${Math.min(28, saturation * 0.45)}% 19%)`);
  themeColor.value = hex;
}

function loadThemeColor() {
  try {
    return localStorage.getItem(COLOR_KEY) || themeColor.value;
  } catch (err) {
    return themeColor.value;
  }
}

function hexToHsl(hex) {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const range = max - min;
  if (!range) return { hue: 0, saturation: 0, lightness: lightness * 100 };
  const saturation = range / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === red) hue = ((green - blue) / range) % 6;
  else if (max === green) hue = (blue - red) / range + 2;
  else hue = (red - green) / range + 4;
  return { hue: Math.round(hue * 60 + (hue < 0 ? 360 : 0)), saturation: saturation * 100, lightness: lightness * 100 };
}

function render() {
  boardEl.innerHTML = "";
  state.columns.forEach((column) => {
    boardEl.appendChild(renderColumn(column));
  });
}

function renderColumn(column) {
  const node = columnTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.columnId = column.id;

  const titleInput = node.querySelector(".column-title");
  titleInput.value = column.title;
  titleInput.addEventListener("change", () => {
    column.title = titleInput.value.trim() || "Untitled";
    saveState();
  });
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") titleInput.blur();
  });

  node.querySelector(".column-count").textContent = column.cards.length;

  node.querySelector(".column-delete").addEventListener("click", () => {
    if (column.cards.length && !confirm("Delete this column and its cards?")) return;
    state.columns = state.columns.filter((c) => c.id !== column.id);
    saveState();
    render();
  });

  const list = node.querySelector(".card-list");
  column.cards.forEach((card) => {
    list.appendChild(renderCard(card, column));
  });

  setupListDropZone(list, column);

  const addBtn = node.querySelector(".add-card-btn");
  addBtn.addEventListener("click", () => startNewCard(list, addBtn, column));

  return node;
}

function renderCard(card, column) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;
  node.draggable = false;

  const text = node.querySelector(".card-text");
  text.textContent = card.text;

  text.addEventListener("click", () => {
    if (node.dataset.justDragged === "true") {
      delete node.dataset.justDragged;
      return;
    }
    text.contentEditable = "true";
    text.focus();
    document.execCommand("selectAll", false, null);
  });

  text.addEventListener("blur", () => {
    text.contentEditable = "false";
    const value = text.textContent.trim();
    if (!value) {
      column.cards = column.cards.filter((c) => c.id !== card.id);
      saveState();
      render();
      return;
    }
    card.text = value;
    saveState();
  });

  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      text.blur();
    }
  });

  node.querySelector(".card-delete").addEventListener("click", () => {
    column.cards = column.cards.filter((c) => c.id !== card.id);
    saveState();
    render();
  });

  node.addEventListener("dragstart", (e) => {
    node.classList.add("dragging");
    node.dataset.sourceColumn = column.id;
    draggedCardId = card.id;
    draggedSourceColumnId = column.id;
    draggedCardNode = node;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
  });
  node.addEventListener("dragend", () => {
    node.classList.remove("dragging");
    draggedCardId = null;
    draggedSourceColumnId = null;
    draggedCardNode = null;
    saveState();
  });

  node.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    pointerDrag = {
      card,
      column,
      node,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false
    };
    node.setPointerCapture(e.pointerId);
  });

  return node;
}

function handlePointerMove(e) {
  if (!pointerDrag || pointerDrag.pointerId !== e.pointerId) return;
  const { node } = pointerDrag;
  const moved = Math.hypot(e.clientX - pointerDrag.startX, e.clientY - pointerDrag.startY) > 6;
  if (!pointerDrag.active && !moved) return;
  pointerDrag.active = true;
  node.classList.add("dragging");

  if (!dragPlaceholder) {
    const rect = node.getBoundingClientRect();
    dragPlaceholder = document.createElement("div");
    dragPlaceholder.className = "card-placeholder";
    dragPlaceholder.style.height = `${rect.height}px`;
    dragPlaceholder.style.width = `${rect.width}px`;
    node.parentNode.insertBefore(dragPlaceholder, node);
    node.style.visibility = "hidden";
    dragGhost = node.cloneNode(true);
    dragGhost.classList.add("drag-ghost");
    dragGhost.style.width = `${rect.width}px`;
    dragGhost.style.left = `${e.clientX - rect.width / 2}px`;
    dragGhost.style.top = `${e.clientY - rect.height / 2}px`;
    document.body.appendChild(dragGhost);
  }
  const rect = dragGhost.getBoundingClientRect();
  dragGhost.style.left = `${e.clientX - rect.width / 2}px`;
  dragGhost.style.top = `${e.clientY - rect.height / 2}px`;

    const edgeDistance = 56;
    if (e.clientX > window.innerWidth - edgeDistance) {
      boardEl.scrollLeft += 18;
    } else if (e.clientX < edgeDistance) {
      boardEl.scrollLeft -= 18;
    }

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const list = target && target.closest(".card-list");
    if (!list) return;
    list.closest(".column").classList.add("drag-over");
    const after = getCardAfterPoint(list, e.clientY);
    if (after == null) list.appendChild(dragPlaceholder);
    else list.insertBefore(dragPlaceholder, after);
}

function handlePointerUp(e) {
  if (!pointerDrag || pointerDrag.pointerId !== e.pointerId) return;
  const { card, column, node } = pointerDrag;
  if (pointerDrag.active) {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const list = (target && target.closest(".card-list")) || dragPlaceholder?.parentElement;
    const targetColumn = state.columns.find((item) => item.id === list?.dataset.columnId);
    if (list && targetColumn) {
      if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
      moveCardToColumn(card.id, column.id, list, targetColumn);
      node.dataset.justDragged = "true";
    }
  }
  node.style.position = "";
  node.style.visibility = "";
  node.classList.remove("dragging");
  if (dragPlaceholder) dragPlaceholder.remove();
  if (dragGhost) dragGhost.remove();
  dragPlaceholder = null;
  dragGhost = null;
  pointerDrag = null;
}

function startNewCard(list, addBtn, column) {
  const textarea = document.createElement("textarea");
  textarea.className = "new-card-input";
  textarea.rows = 2;
  textarea.placeholder = "Type a card and press Enter";
  list.appendChild(textarea);
  textarea.focus();

  function commit() {
    if (textarea.dataset.committed === "true") return;
    const value = textarea.value.trim();
    if (value) {
      textarea.dataset.committed = "true";
      column.cards.push({ id: uid(), text: value });
      saveState();
      render();
    } else {
      textarea.dataset.committed = "true";
      textarea.remove();
    }
  }

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      textarea.remove();
    }
  });

  textarea.addEventListener("blur", commit);
}

function setupListDropZone(list, column) {
  list.dataset.columnId = column.id;
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = draggedCardNode;
    if (!dragging) return;
    list.closest(".column").classList.add("drag-over");
    const after = getCardAfterPoint(list, e.clientY);
    if (after == null) {
      list.appendChild(dragging);
    } else {
      list.insertBefore(dragging, after);
    }
  });

  list.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!draggedCardId || !draggedSourceColumnId) return;
    const cardId = draggedCardId;
    const sourceColumnId = draggedSourceColumnId;
    const sourceColumn = state.columns.find((c) => c.id === sourceColumnId);
    if (!sourceColumn) return;
    const card = sourceColumn.cards.find((c) => c.id === cardId);
    if (!card) return;

    sourceColumn.cards = sourceColumn.cards.filter((c) => c.id !== cardId);

    const orderedIds = Array.from(list.children)
      .filter((el) => el.classList.contains("card"))
      .map((el) => el.dataset.cardId);
    const insertIndex = orderedIds.includes(cardId)
      ? orderedIds.indexOf(cardId)
      : column.cards.length;
    column.cards.splice(insertIndex, 0, card);

    draggedCardId = null;
    draggedSourceColumnId = null;
    saveState();
    render();
  });

  list.addEventListener("dragleave", (e) => {
    if (!list.contains(e.relatedTarget)) {
      list.closest(".column").classList.remove("drag-over");
    }
  });
}

function moveCardToColumn(cardId, sourceColumnId, list, column) {
  const sourceColumn = state.columns.find((item) => item.id === sourceColumnId);
  if (!sourceColumn) return;
  const card = sourceColumn.cards.find((item) => item.id === cardId);
  if (!card) return;

  sourceColumn.cards = sourceColumn.cards.filter((item) => item.id !== cardId);
  const children = Array.from(list.children);
  const placeholderIndex = dragPlaceholder ? children.indexOf(dragPlaceholder) : -1;
  const orderedIds = children
    .filter((element) => element.classList.contains("card"))
    .map((element) => element.dataset.cardId);
  const insertIndex = placeholderIndex >= 0
    ? children.slice(0, placeholderIndex).filter((element) => element.classList.contains("card")).length
    : orderedIds.includes(cardId) ? orderedIds.indexOf(cardId) : column.cards.length;
  column.cards.splice(insertIndex, 0, card);
  saveState();
  render();
}

function getCardAfterPoint(list, y) {
  const cards = [...list.querySelectorAll(".card:not(.dragging)")];
  return cards.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error("Could not load saved board", err);
  }
  return defaultState;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Could not save board", err);
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
