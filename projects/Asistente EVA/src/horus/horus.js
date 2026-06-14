const USER_STORAGE_KEY = "horus.username";
const MEDIA_SESSION_KEY = "horus.mediaSessionId";
const MEDIA_STORAGE_KEY = "horus.mediaItems";
const FIREBASE_SDK_VERSION = "10.13.2";

let username = localStorage.getItem(USER_STORAGE_KEY) || "";
let cards = [];
let sheet = null;
let characters = [];
let mediaItems = [];
let activeDoorChallenges = [];
let activeExchange = null;
let countdownTimer = null;
let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;
let firebaseWebConfig = null;
let firebaseMessaging = null;

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const loginStatus = document.getElementById("loginStatus");
const playerName = document.getElementById("playerName");
const statusLine = document.getElementById("statusLine");
const cardsList = document.getElementById("cardsList");
const cardCount = document.getElementById("cardCount");
const sheetList = document.getElementById("sheetList");
const mediaList = document.getElementById("mediaList");
const countdownPanel = document.getElementById("countdownPanel");
const doorPanel = document.getElementById("doorPanel");
const exchangePanel = document.getElementById("exchangePanel");
const mediaDialog = document.getElementById("mediaDialog");
const mediaTitle = document.getElementById("mediaTitle");
const mediaBody = document.getElementById("mediaBody");
const installButton = document.getElementById("installButton");
const pushButton = document.getElementById("pushButton");

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
  cards = data.cards || data.data || [];
  sheet = data.sheet || null;
  characters = data.characters || [];
  activeDoorChallenges = data.activeDoorChallenges || [];
  activeExchange = data.activeExchange || null;
  renderAll();
  setStatus("Sincronizado con EVA.");
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });
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

async function getFirebaseWebConfig() {
  if (firebaseWebConfig) {
    return firebaseWebConfig;
  }

  const response = await fetch("/api/firebase-web-config", { cache: "no-store" });
  firebaseWebConfig = await response.json();

  if (!firebaseWebConfig.ok) {
    throw new Error(firebaseWebConfig.mensaje || "Firebase web no configurado.");
  }

  if (!firebaseWebConfig.configured) {
    const missing = firebaseWebConfig.missing?.join(", ") || "firebaseConfig";
    throw new Error(`Falta configuración web Firebase: ${missing}.`);
  }

  return firebaseWebConfig;
}

async function loadFirebaseMessaging() {
  const config = await getFirebaseWebConfig();

  await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`);
  await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`);

  if (!firebase.apps.length) {
    firebase.initializeApp(config.firebaseConfig);
  }

  firebaseMessaging = firebaseMessaging || firebase.messaging();
  firebaseMessaging.onMessage((payload) => {
    pollNotifications();
    setStatus(payload.notification?.body || "Notificación recibida.");
  });

  return firebaseMessaging;
}

async function enablePushNotifications() {
  if (!username) {
    throw new Error("Entra como jugador antes de activar notificaciones.");
  }

  if (!window.isSecureContext) {
    throw new Error("Las notificaciones web requieren HTTPS o localhost.");
  }

  if (!("Notification" in window)) {
    throw new Error("Este navegador no soporta notificaciones web.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permiso de notificaciones denegado.");
  }

  const config = await getFirebaseWebConfig();
  const registration = await getServiceWorkerRegistration();
  const messaging = await loadFirebaseMessaging();
  const token = await messaging.getToken({
    vapidKey: config.vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("Firebase no devolvió token para este navegador.");
  }

  await api(`/push-token/${encodeURIComponent(username)}`, {
    method: "PUT",
    body: JSON.stringify({ token }),
  });

  pushButton.classList.add("active");
  setStatus("Notificaciones activadas.");
}

function renderAll() {
  renderCards();
  renderSheet();
  renderDoors();
  renderExchange();
  renderMedia();
}

function renderCards() {
  cardsList.innerHTML = "";
  cardCount.textContent = String(cards.length);

  if (!cards.length) {
    cardsList.appendChild(empty("No tienes cartas."));
    return;
  }

  for (const card of cards) {
    cardsList.appendChild(createCardToken(card));
  }
}

function createCardToken(rawCard) {
  const visual = getCardVisual(String(rawCard));
  const token = document.createElement("div");
  token.className = "card-token";

  const circle = document.createElement("div");
  circle.className = `card-circle ${visual.colorClass}`;
  circle.textContent = visual.value;

  const label = document.createElement("div");
  label.className = "card-label";
  label.textContent = `${visual.suit ? `${visual.suit} ` : ""}${visual.label}`;

  token.append(circle, label);
  return token;
}

function getCardVisual(rawCard) {
  const card = rawCard.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (card === "joker dorado") return { value: "J", suit: "*", label: "Joker dorado", colorClass: "gold" };
  if (card === "joker") return { value: "J", suit: "", label: "Joker", colorClass: "gold" };

  const match = card.match(/^(.+?) de (picas|corazones|diamantes|treboles)$/);
  if (!match) return { value: "?", suit: "", label: rawCard, colorClass: "" };

  const labels = { as: "A", jota: "J", reina: "Q", rey: "K" };
  const suits = { picas: "P", corazones: "C", diamantes: "D", treboles: "T" };
  const red = match[2] === "corazones" || match[2] === "diamantes";

  return {
    value: labels[match[1]] || match[1],
    suit: suits[match[2]],
    label: rawCard,
    colorClass: red ? "red" : "",
  };
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

function renderDoors() {
  doorPanel.innerHTML = "";
  const challenge = activeDoorChallenges.find((item) => ["active", "pending_validation"].includes(item.status));

  if (!challenge) {
    doorPanel.hidden = true;
    return;
  }

  doorPanel.hidden = false;
  const title = document.createElement("div");
  title.className = "panel-title";
  title.textContent = challenge.status === "pending_validation" ? "Puerta enviada a EVA" : "Puerta activa";
  const requirement = document.createElement("div");
  requirement.textContent = challenge.requirement || "Combinación pendiente";
  doorPanel.append(title, requirement);

  for (const slot of challenge.slots || []) {
    const row = document.createElement("div");
    row.className = "door-slot";

    const index = document.createElement("div");
    index.className = "slot-index";
    index.textContent = String(slot.index + 1);

    const select = document.createElement("select");
    select.disabled = Boolean(slot.owner && slot.owner !== username) || challenge.status === "pending_validation";
    select.appendChild(new Option(slot.card && slot.owner ? `${slot.owner}: ${slot.card}` : "Hueco libre", ""));
    for (const card of cards) {
      select.appendChild(new Option(card, card));
    }
    if (slot.owner === username && slot.card) {
      select.value = slot.card;
    }

    const action = document.createElement("button");
    action.className = "secondary";
    action.type = "button";
    action.textContent = slot.owner === username && slot.card ? "Quitar" : "Poner";
    action.disabled = select.disabled && !(slot.owner === username && slot.card);
    action.addEventListener("click", () => updateDoorSlot(challenge, slot, select.value));

    row.append(index, select, action);
    doorPanel.appendChild(row);
  }
}

async function updateDoorSlot(challenge, slot, card) {
  if (slot.owner === username && slot.card) {
    await api(`/api/doors/challenges/${encodeURIComponent(challenge.id)}/slots`, {
      method: "DELETE",
      body: JSON.stringify({ username, slotIndex: slot.index }),
    });
  } else {
    await api(`/api/doors/challenges/${encodeURIComponent(challenge.id)}/slots`, {
      method: "POST",
      body: JSON.stringify({ username, slotIndex: slot.index, card }),
    });
  }
  await refreshState();
}

function renderExchange() {
  exchangePanel.innerHTML = "";

  if (!activeExchange || activeExchange.status !== "active" || !activeExchange.playerParticipants?.includes(username)) {
    exchangePanel.hidden = true;
    return;
  }

  exchangePanel.hidden = false;
  const title = document.createElement("div");
  title.className = "panel-title";
  title.textContent = "Intercambio activo";

  const row = document.createElement("div");
  row.className = "exchange-row";

  const cardSelect = document.createElement("select");
  for (const card of cards) {
    cardSelect.appendChild(new Option(card, card));
  }

  const recipientSelect = document.createElement("select");
  for (const player of activeExchange.participants || []) {
    if (player !== username) {
      recipientSelect.appendChild(new Option(player, player));
    }
  }

  const send = document.createElement("button");
  send.type = "button";
  send.textContent = "Enviar";
  send.addEventListener("click", () => sendExchangeCard(activeExchange, cardSelect.value, recipientSelect.value));

  const decline = document.createElement("button");
  decline.className = "secondary";
  decline.type = "button";
  decline.textContent = "Pasar";
  decline.addEventListener("click", () => declineExchange(activeExchange));

  row.append(cardSelect, recipientSelect, send);
  exchangePanel.append(title, row, decline);
}

async function sendExchangeCard(exchange, card, recipient) {
  await api(`/api/exchanges/${encodeURIComponent(exchange.id)}/transfer`, {
    method: "POST",
    body: JSON.stringify({ username, card, recipient }),
  });
  setStatus("Carta enviada.");
  await refreshState();
}

async function declineExchange(exchange) {
  await api(`/api/exchanges/${encodeURIComponent(exchange.id)}/decline`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  setStatus("Has pasado el intercambio.");
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

  if (event.tipo === "CARTA") {
    setStatus(`Nueva carta: ${event.valor}.`);
    await refreshState();
  } else if (event.tipo === "MUESTRA") {
    cacheMedia(event.valor);
    setStatus(`Archivo recibido: ${event.valor?.nombre || "archivo"}.`);
  } else if (event.tipo === "COUNTDOWN") {
    startCountdown(event.valor || {});
  } else if (event.tipo === "COUNTDOWN_CANCEL") {
    cancelCountdown();
  } else if (event.tipo === "DOOR_CHALLENGE" || event.tipo === "DOOR_CANCEL") {
    await refreshState();
  } else if (event.tipo === "EXCHANGE_OPEN" || event.tipo === "EXCHANGE_CLOSED") {
    await refreshState();
  } else if (event.tipo === "DICE_ROLL") {
    setStatus(event.mensaje || "Tirada registrada.");
  } else if (event.tipo === "TEMPLATE_UPDATE" || event.tipo === "CHARACTER_SHEET_UPDATE") {
    await refreshState();
  }
}

async function pollNotifications() {
  if (!username) {
    return;
  }

  try {
    const response = await fetch(`/notifications/${encodeURIComponent(username)}`);
    const data = await response.json();

    if (!data.hasNotifications) {
      return;
    }

    await handleEvent(data.data.data);
    await api(`/notifications/${encodeURIComponent(username)}`, {
      method: "PUT",
      body: JSON.stringify({ id: data.data.id }),
    });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
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

function empty(text) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = text;
  return element;
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
pushButton.addEventListener("click", async () => {
  try {
    pushButton.disabled = true;
    setStatus("Activando notificaciones...");
    await enablePushNotifications();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    pushButton.disabled = false;
  }
});
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
setInterval(pollNotifications, 2000);

if (username) {
  showApp();
  refreshState().catch((error) => {
    setStatus(error instanceof Error ? error.message : String(error));
  });
} else {
  showLogin();
}
