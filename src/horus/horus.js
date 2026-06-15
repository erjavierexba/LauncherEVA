const USER_STORAGE_KEY = "horus.username";
const MEDIA_SESSION_KEY = "horus.mediaSessionId";
const MEDIA_STORAGE_KEY = "horus.mediaItems";

let username = localStorage.getItem(USER_STORAGE_KEY) || "";
let sheet = null;
let characters = [];
let mediaItems = [];
let countdownTimer = null;
let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const loginStatus = document.getElementById("loginStatus");
const playerName = document.getElementById("playerName");
const statusLine = document.getElementById("statusLine");
const sheetList = document.getElementById("sheetList");
const mediaList = document.getElementById("mediaList");
const countdownPanel = document.getElementById("countdownPanel");
const mediaDialog = document.getElementById("mediaDialog");
const mediaTitle = document.getElementById("mediaTitle");
const mediaBody = document.getElementById("mediaBody");
const installButton = document.getElementById("installButton");
const diceFormulaInput = document.getElementById("diceFormulaInput");
const diceFormulaResult = document.getElementById("diceFormulaResult");

function setStatus(message) {
  statusLine.textContent = message;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.mensaje || `HTTP ${response.status}`);
  }

  return data;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function ensureMediaSession() {
  const current = String(window.HORUS_SESSION_ID || "default");
  if (localStorage.getItem(MEDIA_SESSION_KEY) !== current) {
    localStorage.setItem(MEDIA_SESSION_KEY, current);
    localStorage.removeItem(MEDIA_STORAGE_KEY);
  }
}

function loadMediaItems() {
  ensureMediaSession();
  mediaItems = readJson(MEDIA_STORAGE_KEY, []);
  renderMedia();
}

function saveMediaItems() {
  localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(mediaItems));
}

function showLogin() {
  loginView.hidden = false;
  appView.hidden = true;
  usernameInput.value = username;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  playerName.textContent = username;
}

async function login(name) {
  const data = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username: name }),
  });
  username = data.username;
  localStorage.setItem(USER_STORAGE_KEY, username);
  showApp();
  await refreshState();
}

async function refreshState() {
  if (!username) {
    return;
  }

  const data = await api(`/load/${encodeURIComponent(username)}`);
  sheet = data.sheet || null;
  characters = data.characters || [];
  renderAll();
  setStatus("Sincronizado con EVA.");
}

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador no soporta service workers.");
  }

  if (serviceWorkerRegistration) {
    return serviceWorkerRegistration;
  }

  serviceWorkerRegistration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return serviceWorkerRegistration;
}

function renderAll() {
  renderSheet();
  renderMedia();
}

function renderSheet() {
  sheetList.innerHTML = "";
  const items = [];

  if (sheet?.fields?.length) {
    items.push({ title: username, id: null, fields: sheet.fields });
  }

  for (const character of characters) {
    if (character.sheet?.fields?.length) {
      items.push({ title: character.nombre, id: character.id, fields: character.sheet.fields });
    }
  }

  if (!items.length) {
    sheetList.appendChild(empty("Sin ficha asignada."));
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "sheet-card";
    card.dataset.characterId = item.id || "";

    const title = document.createElement("h3");
    title.textContent = item.title;
    card.appendChild(title);

    const fields = document.createElement("div");
    fields.className = "field-grid";

    for (const field of item.fields) {
      const wrapper = document.createElement("div");
      const label = document.createElement("label");
      label.textContent = field.label;
      const input = document.createElement(field.multiline ? "textarea" : "input");
      input.value = field.value || "";
      input.dataset.fieldKey = field.key;
      wrapper.append(label, input);
      fields.appendChild(wrapper);
    }

    card.appendChild(fields);
    sheetList.appendChild(card);
  }
}

async function saveSheet() {
  const cards = [...sheetList.querySelectorAll(".sheet-card")];

  for (const card of cards) {
    const fields = {};
    card.querySelectorAll("[data-field-key]").forEach((input) => {
      fields[input.dataset.fieldKey] = input.value;
    });

    const characterId = card.dataset.characterId;
    if (characterId) {
      await api(`/api/characters/by-id/${encodeURIComponent(characterId)}/sheet`, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      });
    } else {
      await api(`/api/characters/${encodeURIComponent(username)}/sheet`, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      });
    }
  }

  setStatus("Ficha guardada.");
  await refreshState();
}

function cacheMedia(item) {
  if (!item || !item.url) {
    return;
  }

  const key = item.filename || item.url || item.nombre;
  mediaItems = [
    { ...item, cachedAt: new Date().toISOString() },
    ...mediaItems.filter((media) => (media.filename || media.url || media.nombre) !== key),
  ].slice(0, 24);
  saveMediaItems();
  renderMedia();
}

function renderMedia() {
  mediaList.innerHTML = "";

  if (!mediaItems.length) {
    mediaList.appendChild(empty("Sin archivos recibidos."));
    return;
  }

  for (const item of mediaItems) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "media-item";

    const name = document.createElement("span");
    name.className = "media-name";
    name.textContent = item.nombre || item.filename || "Archivo";

    const type = document.createElement("span");
    type.className = "media-type";
    type.textContent = item.tipo || "ARCHIVO";

    button.append(name, type);
    button.addEventListener("click", () => openMedia(item));
    mediaList.appendChild(button);
  }
}

async function openMedia(item) {
  mediaTitle.textContent = item.nombre || "Archivo";
  mediaBody.innerHTML = "";

  if (item.tipo === "IMAGEN") {
    mediaBody.appendChild(createZoomableImage(item));
  } else if (item.tipo === "VIDEO") {
    const video = document.createElement("video");
    video.src = item.url;
    video.controls = true;
    mediaBody.appendChild(video);
  } else if (item.tipo === "AUDIO") {
    const audio = document.createElement("audio");
    audio.src = item.url;
    audio.controls = true;
    mediaBody.appendChild(audio);
  } else if (item.tipo === "TEXTO") {
    const text = document.createElement("pre");
    text.textContent = "Cargando...";
    mediaBody.appendChild(text);
    const response = await fetch(item.url);
    text.textContent = await response.text();
  } else {
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = "Abrir archivo";
    link.target = "_blank";
    mediaBody.appendChild(link);
  }

  mediaDialog.showModal();
}

function createZoomableImage(item) {
  const stage = document.createElement("div");
  stage.className = "zoom-stage";

  const image = document.createElement("img");
  image.src = item.url;
  image.alt = item.nombre || "";
  image.draggable = false;
  stage.appendChild(image);

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let startScale = 1;
  let startTranslateX = 0;
  let startTranslateY = 0;
  let startDistance = 0;
  let startCenter = { x: 0, y: 0 };
  const pointers = new Map();

  function applyTransform() {
    image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    stage.classList.toggle("zoomed", scale > 1.01);
  }

  function clampTransform() {
    scale = Math.min(Math.max(scale, 1), 5);

    if (scale === 1) {
      translateX = 0;
      translateY = 0;
      return;
    }

    const rect = stage.getBoundingClientRect();
    const maxX = rect.width * (scale - 1) / 2;
    const maxY = rect.height * (scale - 1) / 2;
    translateX = Math.min(Math.max(translateX, -maxX), maxX);
    translateY = Math.min(Math.max(translateY, -maxY), maxY);
  }

  function pointerList() {
    return [...pointers.values()];
  }

  function distance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function center(a, b) {
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
  }

  stage.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, event);
    stage.setPointerCapture(event.pointerId);
    const active = pointerList();
    startScale = scale;
    startTranslateX = translateX;
    startTranslateY = translateY;

    if (active.length >= 2) {
      startDistance = distance(active[0], active[1]);
      startCenter = center(active[0], active[1]);
    } else {
      startCenter = { x: event.clientX, y: event.clientY };
    }
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    pointers.set(event.pointerId, event);
    const active = pointerList();

    if (active.length >= 2) {
      const currentCenter = center(active[0], active[1]);
      scale = startDistance ? startScale * (distance(active[0], active[1]) / startDistance) : startScale;
      translateX = startTranslateX + currentCenter.x - startCenter.x;
      translateY = startTranslateY + currentCenter.y - startCenter.y;
    } else if (scale > 1.01) {
      translateX = startTranslateX + event.clientX - startCenter.x;
      translateY = startTranslateY + event.clientY - startCenter.y;
    }

    clampTransform();
    applyTransform();
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    const active = pointerList();
    startScale = scale;
    startTranslateX = translateX;
    startTranslateY = translateY;

    if (active.length === 1) {
      startCenter = { x: active[0].clientX, y: active[0].clientY };
    }
  }

  stage.addEventListener("pointerup", releasePointer);
  stage.addEventListener("pointercancel", releasePointer);
  image.addEventListener("dblclick", () => {
    scale = scale > 1 ? 1 : 2;
    translateX = 0;
    translateY = 0;
    applyTransform();
  });

  applyTransform();
  return stage;
}

function closeMedia() {
  mediaBody.querySelectorAll("audio, video").forEach((element) => {
    element.pause();
    element.removeAttribute("src");
    element.load();
  });
  mediaDialog.close();
}

function startCountdown(value) {
  clearInterval(countdownTimer);
  countdownPanel.hidden = false;

  const render = () => {
    const target = new Date(value.targetAt).getTime();
    const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
    countdownPanel.innerHTML = `
      <div class="panel-title">${value.label || "Temporizador"}</div>
      <div>${remaining}s</div>
    `;

    if (remaining <= 0) {
      clearInterval(countdownTimer);
    }
  };

  render();
  countdownTimer = setInterval(render, 250);
}

function cancelCountdown() {
  clearInterval(countdownTimer);
  countdownPanel.hidden = true;
  countdownPanel.innerHTML = "";
}

function shouldHandleEvent(event) {
  return event.destinatario === "TODOS" || event.destinatario === username;
}

async function handleEvent(event) {
  if (!shouldHandleEvent(event)) {
    return;
  }

  if (event.tipo === "MUESTRA") {
    cacheMedia(event.valor);
    setStatus(`Archivo recibido: ${event.valor?.nombre || "archivo"}.`);
  } else if (event.tipo === "COUNTDOWN") {
    startCountdown(event.valor || {});
  } else if (event.tipo === "COUNTDOWN_CANCEL") {
    cancelCountdown();
  } else if (event.tipo === "DICE_ROLL") {
    setStatus(event.mensaje || "Tirada registrada.");
  } else if (event.tipo === "TEMPLATE_UPDATE" || event.tipo === "CHARACTER_SHEET_UPDATE") {
    await refreshState();
  } else if (event.tipo === "CLIENT_RESET") {
    await resetClientApp();
  }
}

function connectWebSocket() {
  const ws = new WebSocket(window.HORUS_WS_URL);

  ws.addEventListener("message", (event) => {
    try {
      handleEvent(JSON.parse(event.data));
    } catch (error) {
      console.warn("Evento inválido", error);
    }
  });

  ws.addEventListener("close", () => {
    setTimeout(connectWebSocket, 1500);
  });
}

async function resetClientApp() {
  setStatus("Reiniciando cliente...");
  localStorage.removeItem(MEDIA_SESSION_KEY);
  localStorage.removeItem(MEDIA_STORAGE_KEY);

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  window.location.reload();
}

function empty(text) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = text;
  return element;
}

function rollFormula(rawFormula) {
  const formula = String(rawFormula || "").replace(/\s+/g, "").toLowerCase();
  if (!formula) {
    throw new Error("Escribe una fórmula.");
  }

  const tokenPattern = /([+-]?)(?:(\d*)d([1-9]\d*)|(\d+))/g;
  const terms = [];
  let cursor = 0;
  let match = tokenPattern.exec(formula);

  while (match) {
    if (match.index !== cursor) {
      throw new Error("Fórmula inválida.");
    }

    const sign = match[1] === "-" ? -1 : 1;
    if (match[3]) {
      const count = match[2] ? Number.parseInt(match[2], 10) : 1;
      const faces = Number.parseInt(match[3], 10);
      if (count <= 0 || count > 100 || faces <= 0 || faces > 10000) {
        throw new Error("Demasiados dados.");
      }
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
      const total = sign * rolls.reduce((sum, roll) => sum + roll, 0);
      terms.push({ kind: "dice", sign, count, faces, rolls, total });
    } else {
      const value = Number.parseInt(match[4], 10);
      terms.push({ kind: "modifier", sign, value, total: sign * value });
    }

    cursor = tokenPattern.lastIndex;
    match = tokenPattern.exec(formula);
  }

  if (cursor !== formula.length || terms.length === 0) {
    throw new Error("Fórmula inválida.");
  }

  return {
    formula,
    terms,
    total: terms.reduce((sum, term) => sum + term.total, 0),
  };
}

function formatRollBreakdown(result) {
  return result.terms
    .map((term, index) => {
      const prefix = term.sign < 0 ? "-" : index === 0 ? "" : "+";
      if (term.kind === "dice") {
        return `${prefix}${term.count}d${term.faces}[${term.rolls.join(",")}]`;
      }
      return `${prefix}${term.value}`;
    })
    .join(" ");
}

function handleFormulaRoll() {
  try {
    const result = rollFormula(diceFormulaInput.value);
    diceFormulaResult.innerHTML = `${result.total}<span class="dice-breakdown">${result.formula} · ${formatRollBreakdown(result)}</span>`;
  } catch (error) {
    diceFormulaResult.textContent = error instanceof Error ? error.message : String(error);
  }
}

function setActiveView(view) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${view}View`);
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "Entrando...";

  try {
    await login(usernameInput.value.trim());
  } catch (error) {
    loginStatus.textContent = error instanceof Error ? error.message : String(error);
  }
});

document.getElementById("refreshButton").addEventListener("click", refreshState);
document.getElementById("logoutButton").addEventListener("click", () => {
  localStorage.removeItem(USER_STORAGE_KEY);
  username = "";
  showLogin();
});
document.getElementById("saveSheetButton").addEventListener("click", saveSheet);
document.getElementById("clearMediaButton").addEventListener("click", () => {
  mediaItems = [];
  saveMediaItems();
  renderMedia();
});
document.getElementById("closeMediaButton").addEventListener("click", closeMedia);
document.getElementById("rollFormulaButton").addEventListener("click", handleFormulaRoll);
diceFormulaInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleFormulaRoll();
  }
});
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setActiveView(tab.dataset.view));
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

getServiceWorkerRegistration().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error));
});

loadMediaItems();
connectWebSocket();

if (username) {
  showApp();
  refreshState().catch((error) => {
    setStatus(error instanceof Error ? error.message : String(error));
  });
} else {
  showLogin();
}
