const USER_STORAGE_KEY = "horus.username";
const MEDIA_SESSION_KEY = "horus.mediaSessionId";
const MEDIA_STORAGE_KEY = "horus.mediaItems";
const ROLL_HISTORY_STORAGE_KEY = "horus.rollHistory";
const PAGE_COLOR_STORAGE_KEY = "horus.pageColors";

let username = localStorage.getItem(USER_STORAGE_KEY) || "";
let sheet = null;
let roleName = "";
let characters = [];
let allCharacters = [];
let selectedCharacter = null;
let mediaItems = [];
let rollHistory = [];
let pageColors = {};
let countdownTimer = null;
let editingCharacterId = null;
let pendingDeleteCharacter = null;

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const loginStatus = document.getElementById("loginStatus");
const playerName = document.getElementById("playerName");
const statusLine = document.getElementById("statusLine");
const characterSelectView = document.getElementById("characterSelectView");
const characterOverview = document.getElementById("characterOverview");
const characterSelectList = document.getElementById("characterSelectList");
const sheetList = document.getElementById("sheetList");
const mediaList = document.getElementById("mediaList");
const countdownPanel = document.getElementById("countdownPanel");
const mediaDialog = document.getElementById("mediaDialog");
const mediaTitle = document.getElementById("mediaTitle");
const mediaBody = document.getElementById("mediaBody");
const characterForm = document.getElementById("characterForm");
const characterNameInput = document.getElementById("characterNameInput");
const characterNotesInput = document.getElementById("characterNotesInput");
const characterDeleteDialog = document.getElementById("characterDeleteDialog");
const characterDeleteTitle = document.getElementById("characterDeleteTitle");
const characterDeleteMessage = document.getElementById("characterDeleteMessage");
const cancelCharacterDeleteButton = document.getElementById("cancelCharacterDeleteButton");
const keepCharacterButton = document.getElementById("keepCharacterButton");
const confirmCharacterDeleteButton = document.getElementById("confirmCharacterDeleteButton");
const diceFormulaInput = document.getElementById("diceFormulaInput");
const diceFormulaResult = document.getElementById("diceFormulaResult");
const rollHistoryList = document.getElementById("rollHistoryList");

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

function rollHistoryKey() {
  return `${ROLL_HISTORY_STORAGE_KEY}.${username || "anon"}`;
}

function loadRollHistory() {
  rollHistory = readJson(rollHistoryKey(), []);
  renderRollHistory();
}

function saveRollHistory() {
  localStorage.setItem(rollHistoryKey(), JSON.stringify(rollHistory));
}

function loadPageColors() {
  pageColors = readJson(pageColorStorageKey(), {});
}

function pageColorStorageKey() {
  return `${PAGE_COLOR_STORAGE_KEY}.${username || "anon"}`;
}

function pageColorKey(item, page) {
  return [item.id || "sheet", item.schema?.id || "template", page.key || page.label || "page"].join(":");
}

function pageColorFor(item, page) {
  return pageColors[pageColorKey(item, page)] || "";
}

function savePageColor(item, page, color) {
  const key = pageColorKey(item, page);
  if (color) {
    pageColors = { ...pageColors, [key]: color };
  } else {
    const next = { ...pageColors };
    delete next[key];
    pageColors = next;
  }
  localStorage.setItem(pageColorStorageKey(), JSON.stringify(pageColors));
}

function applyPageAccent(card, color) {
  if (color) {
    card.style.setProperty("--page-accent", color);
  } else {
    card.style.removeProperty("--page-accent");
  }
}

function themeAccentColor() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#66c6dd";
}

function addRollHistory(entry) {
  rollHistory = [{ ...entry, at: new Date().toISOString() }, ...rollHistory].slice(0, 200);
  saveRollHistory();
  renderRollHistory();
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
  loadPageColors();
  loadRollHistory();
}

async function unregisterLegacyServiceWorkers() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
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
  roleName = data.role || document.title || "";
  allCharacters = data.allCharacters || data.characters || [];
  selectedCharacter = data.selectedCharacter || null;
  characters = data.characters || [];
  renderAll();

  if (!selectedCharacter && allCharacters.length > 0) {
    setActiveView("characterSelect");
    setStatus("Elige un personaje para cargarlo.");
    return;
  }

  setStatus("Sincronizado con EVA.");
}

function renderAll() {
  renderCharacterOverview();
  renderCharacterSelect();
  renderSheet();
  renderMedia();
  renderRollHistory();
}

function renderCharacterOverview() {
  characterOverview.innerHTML = "";

  const card = document.createElement("div");
  card.className = selectedCharacter ? "selected-character-card" : "selected-character-card empty-selection";

  const head = document.createElement("div");
  head.className = "selected-character-head";

  const titleWrap = document.createElement("div");
  const kicker = document.createElement("span");
  kicker.className = "selected-character-kicker";
  kicker.textContent = roleName || "Rol activo";
  const title = document.createElement("h3");
  const characterName = selectedCharacter?.nombre || selectedCharacter?.name || "Sin personaje cargado";
  title.textContent = selectedCharacter ? `${username} / ${characterName}` : `${username || "Jugador"} / Sin personaje`;
  titleWrap.append(kicker, title);

  const badge = document.createElement("span");
  badge.className = selectedCharacter ? "selected-character-badge active" : "selected-character-badge";
  badge.textContent = selectedCharacter ? "Seleccionado" : "Pendiente";

  head.append(titleWrap, badge);
  card.appendChild(head);

  const facts = document.createElement("div");
  facts.className = "selected-character-facts";

  if (selectedCharacter) {
    facts.appendChild(summaryFact("Plantilla", selectedCharacter.template?.label || selectedCharacter.sheet?.template?.label || "Ficha"));
    const characterRole = selectedCharacter.rol || selectedCharacter.role || "";
    if (characterRole) facts.appendChild(summaryFact("Concepto", characterRole));
  } else {
    facts.appendChild(summaryFact("Personajes", String(allCharacters.length)));
  }
  card.appendChild(facts);

  if (selectedCharacter) {
    const notesForm = document.createElement("form");
    notesForm.className = "selected-character-notes-form";
    const notes = document.createElement("textarea");
    notes.rows = 2;
    notes.value = selectedCharacter.notes || selectedCharacter.notas || "";
    notes.placeholder = "Notas del personaje";
    const saveNotes = document.createElement("button");
    saveNotes.type = "submit";
    saveNotes.className = "secondary";
    saveNotes.textContent = "Guardar notas";
    notesForm.append(notes, saveNotes);
    notesForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await updateCharacter(selectedCharacter.id, selectedCharacter.nombre || selectedCharacter.name || "", notes.value);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    });
    card.appendChild(notesForm);
  }

  const highlights = selectedCharacter ? characterHighlights(selectedCharacter) : [];
  if (highlights.length) {
    const highlightGrid = document.createElement("div");
    highlightGrid.className = "selected-character-highlights";
    for (const field of highlights) {
      highlightGrid.appendChild(summaryFact(field.label || field.key, formatSummaryValue(field.value ?? field.defaultValue ?? "")));
    }
    card.appendChild(highlightGrid);
  } else {
    const hint = document.createElement("div");
    hint.className = "selected-character-hint";
    hint.textContent = selectedCharacter ? "Sin datos destacados todavía." : "Elige un personaje para cargar sus datos.";
    card.appendChild(hint);
  }

  if (selectedCharacter) {
    const actions = document.createElement("div");
    actions.className = "selected-character-actions";
    const sheetButton = document.createElement("button");
    sheetButton.type = "button";
    sheetButton.textContent = "Ver ficha";
    sheetButton.addEventListener("click", () => setActiveView("sheet"));
    actions.appendChild(sheetButton);
    card.appendChild(actions);
  }

  characterOverview.appendChild(card);
}

function summaryFact(label, value) {
  const item = document.createElement("div");
  item.className = "summary-fact";
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  valueNode.textContent = value || "-";
  item.append(labelNode, valueNode);
  return item;
}

function characterHighlights(character) {
  const fields = character.sheet?.fields || [];
  const filled = fields.filter((field) => {
    const value = field.value ?? field.defaultValue ?? "";
    return formatSummaryValue(value) !== "";
  });
  const favorites = filled.filter((field) => field.favorite || field.favourite || field.config?.favorite);
  return (favorites.length ? favorites : filled).slice(0, 6);
}

function formatSummaryValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (entry && typeof entry === "object") return objectTitle(entry, [], 0);
      return String(entry || "");
    }).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    return objectTitle(value, [], 0);
  }
  return String(value ?? "").trim();
}

function renderCharacterSelect() {
  characterSelectList.innerHTML = "";

  if (!allCharacters.length) {
    characterSelectList.appendChild(empty("Sin personajes."));
    return;
  }

  for (const character of allCharacters) {
    const isSelected = selectedCharacter && String(selectedCharacter.id) === String(character.id);
    const isEditing = String(editingCharacterId || "") === String(character.id);
    const card = document.createElement(isEditing ? "form" : "div");
    card.className = isSelected ? "character-select-card selected" : "character-select-card";
    card.dataset.characterId = character.id;

    if (isEditing) {
      const name = document.createElement("input");
      name.value = character.nombre || character.name || "";
      name.placeholder = "Nombre";

      const notes = document.createElement("textarea");
      notes.value = character.notes || character.notas || "";
      notes.rows = 2;
      notes.placeholder = "Notas";

      const actions = document.createElement("div");
      actions.className = "character-select-actions";

      const save = document.createElement("button");
      save.type = "submit";
      save.className = "secondary";
      save.textContent = "Guardar";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "secondary";
      cancel.textContent = "Cancelar";
      cancel.addEventListener("click", () => {
        editingCharacterId = null;
        renderCharacterSelect();
      });

      actions.append(save, cancel);
      card.append(name, notes, actions);
      card.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await updateCharacter(character.id, name.value, notes.value);
          editingCharacterId = null;
          renderAll();
        } catch (error) {
          setStatus(error instanceof Error ? error.message : String(error));
        }
      });
      characterSelectList.appendChild(card);
      continue;
    }

    const select = document.createElement("button");
    select.type = "button";
    select.className = "character-select-main";

    const name = document.createElement("span");
    name.className = "character-select-name";
    name.textContent = character.nombre || character.name || "Personaje";

    const meta = document.createElement("span");
    meta.className = "character-select-meta";
    meta.textContent = isSelected ? "Seleccionado" : character.notes || character.template?.label || "Personaje";

    select.append(name, meta);
    select.addEventListener("click", () => selectCharacter(character.id));

    const actions = document.createElement("div");
    actions.className = "character-select-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => {
      editingCharacterId = character.id;
      renderCharacterSelect();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Borrar";
    remove.addEventListener("click", () => openCharacterDeleteDialog(character));

    actions.append(edit, remove);
    card.append(select, actions);
    characterSelectList.appendChild(card);
  }
}

async function selectCharacter(characterId) {
  const data = await api(`/api/characters/${encodeURIComponent(characterId)}/select`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  setStatus(data.mensaje || "Personaje cargado.");
  await refreshState();
  setActiveView("sheet");
}

function openCharacterDeleteDialog(character) {
  pendingDeleteCharacter = character;
  const characterName = character?.nombre || character?.name || "este personaje";
  characterDeleteTitle.textContent = `Borrar ${characterName}`;
  characterDeleteMessage.textContent = `Vas a borrar ${characterName}. Esta accion no se puede deshacer.`;
  characterDeleteDialog.showModal();
}

function closeCharacterDeleteDialog() {
  pendingDeleteCharacter = null;
  characterDeleteDialog.close();
}

async function createCharacter(name, notes) {
  const data = await api("/api/characters", {
    method: "POST",
    body: JSON.stringify({
      username,
      nombre: name,
      notes,
    }),
  });
  setStatus(data.mensaje || "Personaje creado.");
  await refreshState();
}

async function updateCharacter(characterId, name, notes) {
  const data = await api(`/api/characters/${encodeURIComponent(characterId)}`, {
    method: "PUT",
    body: JSON.stringify({ nombre: name, notes }),
  });
  setStatus(data.mensaje || "Personaje actualizado.");
  await refreshState();
}

async function deleteCharacter(characterId) {
  const data = await api(`/api/characters/${encodeURIComponent(characterId)}`, {
    method: "DELETE",
  });
  setStatus(data.mensaje || "Personaje eliminado.");
  await refreshState();
}

function renderSheet() {
  sheetList.innerHTML = "";
  const items = [];

  for (const character of characters) {
    if (character.sheet?.fields?.length) {
      items.push({ title: character.nombre, id: character.id, fields: character.sheet.fields, schema: character.sheet.template?.schema || null });
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

    renderSheetPages(card, item);
    sheetList.appendChild(card);
  }
}

function renderSheetPages(card, item, activePageIndex = 0) {
  const pages = sheetPages(item);
  const selectedIndex = Math.max(0, Math.min(activePageIndex, pages.length - 1));
  const activePage = pages[selectedIndex];
  const activeColor = pageColorFor(item, activePage);
  applyPageAccent(card, activeColor);

  if (pages.length > 1) {
    const tabs = document.createElement("div");
    tabs.className = "sheet-page-tabs";
    pages.forEach((page, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = index === selectedIndex ? "secondary active" : "secondary";
      tab.textContent = page.label || page.key || `Página ${index + 1}`;
      const tabColor = pageColorFor(item, page);
      if (tabColor) tab.style.setProperty("--page-tab-accent", tabColor);
      tab.addEventListener("click", () => {
        card.querySelectorAll(".sheet-page-tabs, .page-style-tools, .sheet-sections").forEach((node) => node.remove());
        renderSheetPages(card, item, index);
      });
      tabs.appendChild(tab);
    });
    card.appendChild(tabs);
  }

  const tools = document.createElement("div");
  tools.className = "page-style-tools";

  const swatch = document.createElement("input");
  swatch.type = "color";
  swatch.className = "page-color-input";
  swatch.value = activeColor || themeAccentColor();
  swatch.title = "Color de página";
  swatch.setAttribute("aria-label", "Color de página");
  swatch.addEventListener("input", () => {
    applyPageAccent(card, swatch.value);
    savePageColor(item, activePage, swatch.value);
  });

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "secondary page-default-button";
  reset.textContent = "Por defecto";
  reset.addEventListener("click", () => {
    savePageColor(item, activePage, "");
    card.querySelectorAll(".sheet-page-tabs, .page-style-tools, .sheet-sections").forEach((node) => node.remove());
    renderSheetPages(card, item, selectedIndex);
  });

  tools.append(swatch, reset);
  card.appendChild(tools);

  const sectionsNode = document.createElement("div");
  sectionsNode.className = "sheet-sections";
  const fieldsByKey = new Map(item.fields.map((field) => [field.key, field]));

  for (const section of activePage.sections) {
    const sectionNode = document.createElement("section");
    sectionNode.className = "sheet-section";
    const title = document.createElement("h4");
    title.textContent = section.label || section.key || "Sección";
    sectionNode.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "field-grid";
    for (const key of section.fields || []) {
      const field = fieldsByKey.get(key);
      if (field) grid.appendChild(createSheetFieldControl(field, item));
    }
    sectionNode.appendChild(grid);
    sectionsNode.appendChild(sectionNode);
  }

  card.appendChild(sectionsNode);
}

function sheetPages(item) {
  const schemaPages = Array.isArray(item.schema?.pages) ? item.schema.pages : [];
  const fieldKeys = new Set(item.fields.map((field) => field.key));
  const pages = schemaPages
    .map((page, pageIndex) => ({
      key: page.key || `page_${pageIndex + 1}`,
      label: page.label || page.key || `Página ${pageIndex + 1}`,
      sections: (page.sections || [])
        .map((section, sectionIndex) => ({
          key: section.key || `section_${sectionIndex + 1}`,
          label: section.label || section.key || `Sección ${sectionIndex + 1}`,
          fields: (section.fields || []).filter((key) => fieldKeys.has(key)),
        }))
        .filter((section) => section.fields.length > 0),
    }))
    .filter((page) => page.sections.length > 0);

  const usedKeys = new Set(pages.flatMap((page) => page.sections.flatMap((section) => section.fields)));
  const looseFields = item.fields.map((field) => field.key).filter((key) => !usedKeys.has(key));
  if (looseFields.length) {
    pages.push({ key: "otros", label: "Otros", sections: [{ key: "otros", label: "Otros", fields: looseFields }] });
  }

  return pages.length ? pages : [{ key: "main", label: "Ficha", sections: [{ key: "main", label: "Ficha", fields: item.fields.map((field) => field.key) }] }];
}

function createSheetFieldControl(field, item) {
  const wrapper = document.createElement("div");
  const label = document.createElement("label");
  label.textContent = field.label;
  if (field.type === "array") {
    wrapper.className = "sheet-field-wide";
    wrapper.append(label, createObjectListField(field, item));
  } else if (isSelectField(field)) {
    const select = createSelectField(field, field.value || field.defaultValue || "", item.schema);
    select.addEventListener("change", () => {
      updateSheetField(item, field.key, select.value).catch((error) => {
        setStatus(error instanceof Error ? error.message : String(error));
      });
    });
    wrapper.append(label, select);
  } else if (isFormulaField(field)) {
    wrapper.append(label, createFormulaRollButton(field, item));
  } else {
    const input = document.createElement(field.multiline || field.type === "long_text" ? "textarea" : "input");
    input.value = field.value || "";
    input.dataset.fieldKey = field.key;
    input.addEventListener("change", () => {
      updateSheetField(item, field.key, input.value).catch((error) => {
        setStatus(error instanceof Error ? error.message : String(error));
      });
    });
    wrapper.append(label, input);
  }
  return wrapper;
}

function createObjectListField(field, item) {
  const wrapper = document.createElement("div");
  wrapper.className = "object-list";
  const list = document.createElement("div");
  list.className = "object-items";
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.fieldKey = field.key;
  const add = document.createElement("button");
  add.type = "button";
  add.className = "secondary";
  add.textContent = "Añadir";

  let objects = normalizeObjectArray(field.value);
  const itemFields = normalizeObjectItemFields(field);

  const sync = (notify = true) => {
    hidden.value = JSON.stringify(objects);
    if (notify) {
      updateSheetField(item, field.key, objects).catch((error) => {
        setStatus(error instanceof Error ? error.message : String(error));
      });
    }
  };

  const render = () => {
    list.innerHTML = "";
    if (!objects.length) {
      list.appendChild(empty("Sin elementos."));
    }
    objects.forEach((objectValue, objectIndex) => {
      const card = document.createElement("div");
      card.className = "object-card";
      const head = document.createElement("div");
      head.className = "object-card-head";
      const title = document.createElement("strong");
      title.textContent = objectTitle(objectValue, itemFields, objectIndex);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger compact";
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        objects.splice(objectIndex, 1);
        sync();
        render();
      });
      head.append(title, remove);
      card.appendChild(head);

      const fieldsNode = document.createElement("div");
      fieldsNode.className = "object-fields";
      const rollsNode = document.createElement("div");
      rollsNode.className = "object-rolls";

      for (const itemField of itemFields) {
        if (isObjectRollField(itemField)) {
          rollsNode.appendChild(createObjectRollButton(itemField, objectValue, item));
        } else {
          fieldsNode.appendChild(createObjectFieldInput(itemField, objectValue, objectIndex, objects, sync, render, item.schema));
        }
      }

      card.appendChild(fieldsNode);
      if (rollsNode.children.length) card.appendChild(rollsNode);
      list.appendChild(card);
    });
  };

  add.addEventListener("click", () => {
    objects.push(Object.fromEntries(itemFields.map((itemField) => [itemField.key, itemField.defaultValue || itemField.default || ""])));
    sync();
    render();
  });

  wrapper.append(list, hidden, add);
  sync(false);
  render();
  return wrapper;
}

function createObjectFieldInput(itemField, objectValue, objectIndex, objects, sync, render, schema = null) {
  const label = document.createElement("label");
  label.textContent = itemField.label || itemField.key;
  const control = isSelectField(itemField)
    ? document.createElement("select")
    : document.createElement(itemField.type === "long_text" ? "textarea" : "input");
  control.value = objectValue[itemField.key] ?? "";
  if (isSelectField(itemField)) {
    fillSelectOptions(control, selectOptionsForField(itemField, schema), control.value || itemField.defaultValue || itemField.default || "");
  }
  if (itemField.type === "int" || itemField.type === "b_int" || itemField.type === "number") {
    control.type = "number";
    control.step = "1";
  }
  if (itemField.type === "csv") {
    control.placeholder = "rápido, sutil, mágico";
  }
  const updateValue = () => {
    objects[objectIndex] = { ...objects[objectIndex], [itemField.key]: control.value };
    sync();
  };
  control.addEventListener("input", updateValue);
  control.addEventListener("change", () => {
    updateValue();
    render();
  });
  label.appendChild(control);
  if (itemField.type === "csv") {
    label.appendChild(renderCsvChips(control.value));
  }
  return label;
}

function createObjectRollButton(itemField, objectValue, item) {
  const wrapper = document.createElement("div");
  wrapper.className = "formula-roll";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = itemField.label || "Tirada";
  const result = document.createElement("div");
  result.className = "dice-result";
  const formula = itemField.formula || objectValue[itemField.key] || itemField.defaultValue || "1d20";
  result.textContent = formula;
  button.addEventListener("click", async () => {
    try {
      const parentValues = Object.fromEntries((item.fields || []).map((field) => [field.key, field.value ?? field.defaultValue ?? ""]));
      const roll = evaluateFormulaExpression(formula, { ...parentValues, ...objectValue }, item.schema?.constants || {});
      result.innerHTML = `${roll.total}<span class="dice-breakdown">${roll.breakdown}</span>`;
      addRollHistory({
        title: `${item.title} · ${objectTitle(objectValue, normalizeObjectItemFields({ config: { itemFields: [] } }), 0)} · ${itemField.label}`,
        total: roll.total,
        formula: roll.formula,
        breakdown: roll.breakdown,
      });
      await sendRollToEva(item.title, `${objectTitle(objectValue, [], 0)} · ${itemField.label}`, roll);
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : String(error);
    }
  });
  wrapper.append(button, result);
  return wrapper;
}

function normalizeObjectArray(value) {
  if (Array.isArray(value)) return value.filter((entry) => entry && typeof entry === "object");
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object") : [];
  } catch (error) {
    return [];
  }
}

function normalizeObjectItemFields(field) {
  const itemFields = field.config?.itemFields || field.itemTemplate?.fields || [];
  return itemFields.length ? itemFields : [{ key: "nombre", label: "Nombre", type: "text", defaultValue: "" }];
}

function isObjectRollField(field) {
  return field.type === "formula" || field.type === "throw" || field.type === "roll" || Boolean(field.formula);
}

function isSelectField(field) {
  return field?.type === "cycle" || field?.type === "select";
}

function objectTitle(value, itemFields, index) {
  const titleKey = ["name", "nombre", "title", "titulo"].find((key) => value[key]);
  if (titleKey) return value[titleKey];
  const firstTextField = (itemFields || []).find((field) => ["text", "long_text"].includes(field.type) && value[field.key]);
  return firstTextField ? value[firstTextField.key] : `Objeto ${index + 1}`;
}

function renderCsvChips(value) {
  const chips = document.createElement("div");
  chips.className = "trait-list";
  String(value || "").split(",").map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const chip = document.createElement("span");
    chip.className = "trait-chip";
    chip.textContent = part;
    chips.appendChild(chip);
  });
  return chips;
}

function createSelectField(field, value = "", schema = null) {
  const select = document.createElement("select");
  select.dataset.fieldKey = field.key;
  fillSelectOptions(select, selectOptionsForField(field, schema), value || field.defaultValue || "");
  return select;
}

function fillSelectOptions(select, options, selectedValue) {
  select.innerHTML = "";
  const normalized = options.length ? options : [{ value: selectedValue || "", label: selectedValue || "Opción" }];
  normalized.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    select.appendChild(node);
  });
  if ([...select.options].some((option) => option.value === String(selectedValue))) {
    select.value = String(selectedValue);
  }
}

function selectOptionsForField(field, schema = null) {
  const source = field.options || field.config?.options || "";
  const constants = schema?.constants || {};
  const fromConstants = resolveConstantPath(constants, source);
  if (Array.isArray(fromConstants)) {
    return fromConstants.map((value) => ({ value: String(value), label: String(value) }));
  }
  if (fromConstants && typeof fromConstants === "object") {
    return Object.keys(fromConstants).map((key) => ({ value: key, label: key }));
  }
  return String(source || field.defaultValue || field.default || "")
    .split(/[,\n|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((value) => ({ value, label: value }));
}

function resolveConstantPath(constants, path) {
  if (!path) return null;
  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((cursor, key) => (
      cursor && typeof cursor === "object" && key in cursor ? cursor[key] : null
    ), constants);
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

async function updateSheetField(item, fieldId, value) {
  if (!item?.id || !fieldId) {
    return;
  }

  const data = await api(`/api/characters/by-id/${encodeURIComponent(item.id)}/sheet`, {
    method: "PUT",
    body: JSON.stringify({ fields: { [fieldId]: value } }),
  });

  applyCharacterSheetUpdate({
    user: username,
    character: item.id,
    fieldId,
    value,
  }, false);
  setStatus(data.mensaje || "Ficha actualizada.");
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
  return event.destinatario === "TODOS" || event.destinatario === username || event.user === username;
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
  } else if (event.tipo === "TEMPLATE_UPDATE") {
    await refreshState();
  } else if (event.tipo === "THEME_UPDATE") {
    window.location.reload();
  } else if (event.tipo === "CHARACTER_SHEET_UPDATE" || event.fieldId) {
    applyCharacterSheetUpdate(event);
  } else if (event.tipo === "CLIENT_RESET") {
    await resetClientApp();
  }
}

function applyCharacterSheetUpdate(event, rerender = true) {
  if (event.user && event.user !== username) {
    return false;
  }

  const characterId = event.character;
  const fieldId = event.fieldId;
  if (!characterId || !fieldId) {
    return false;
  }

  const updateCharacter = (character) => {
    if (String(character.id) !== String(characterId) || !character.sheet?.fields) {
      return character;
    }

    return {
      ...character,
      sheet: {
        ...character.sheet,
        fields: character.sheet.fields.map((field) => (
          field.key === fieldId ? { ...field, value: event.value } : field
        )),
      },
    };
  };

  characters = characters.map(updateCharacter);
  allCharacters = allCharacters.map(updateCharacter);
  selectedCharacter = selectedCharacter ? updateCharacter(selectedCharacter) : selectedCharacter;

  if (rerender) {
    renderAll();
    setStatus(event.mensaje || "Ficha actualizada desde EVA.");
  }

  return true;
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

  window.location.reload();
}

function empty(text) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = text;
  return element;
}

function isFormulaField(field) {
  return field?.type === "formula" || Boolean(field?.config?.formula);
}

function createFormulaRollButton(field, item) {
  const wrapper = document.createElement("div");
  wrapper.className = "formula-roll";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = "Lanzar";
  const result = document.createElement("div");
  result.className = "dice-result";

  const formula = field.config?.formula || field.value || field.defaultValue || "";
  result.textContent = formula || "Sin fórmula";
  button.disabled = !formula;

  button.addEventListener("click", async () => {
    try {
      const roll = evaluateSheetFormula(formula, item.fields || [], item.schema);
      result.innerHTML = `${roll.total}<span class="dice-breakdown">${roll.breakdown}</span>`;
      addRollHistory({
        title: `${item.title} · ${field.label}`,
        total: roll.total,
        formula: roll.formula,
        breakdown: roll.breakdown,
      });
      await sendRollToEva(item.title, field.label, roll);
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  wrapper.append(button, result);
  return wrapper;
}

function evaluateSheetFormula(rawFormula, fields, schema = null) {
  const values = Object.fromEntries((fields || []).map((field) => [field.key, field.value ?? field.defaultValue ?? ""]));
  return evaluateFormulaExpression(rawFormula, values, schema?.constants || {});
}

function rollFormula(rawFormula) {
  const currentFields = selectedCharacter?.sheet?.fields || characters[0]?.sheet?.fields || [];
  const values = Object.fromEntries((currentFields || []).map((field) => [field.key, field.value ?? field.defaultValue ?? ""]));
  const schema = selectedCharacter?.sheet?.template?.schema || characters[0]?.sheet?.template?.schema || null;
  return evaluateFormulaExpression(rawFormula, values, schema?.constants || {});
}

function evaluateFormulaExpression(rawFormula, values = {}, constants = {}) {
  return evaluateFormulaExpressionInternal(rawFormula, values, constants, 0);
}

function evaluateFormulaExpressionInternal(rawFormula, values = {}, constants = {}, depth = 0) {
  if (depth > 8) throw new Error("Fórmula demasiado profunda.");
  const formula = String(rawFormula || "").trim();
  if (!formula) throw new Error("Escribe una fórmula.");

  const withConstants = resolveFormulaConstants(formula, values, constants, depth);
  const normalized = withConstants.replace(/\{([a-zA-Z_][\w-]*)\}/g, "$1").replace(/\*([a-zA-Z_][\w-]*)/g, "$1");
  const tokens = tokenizeFormula(normalized, values);
  const output = [];
  const operators = [];
  const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
    } else if (token.type === "operator") {
      while (operators.length && operators.at(-1).value !== "(" && precedence[operators.at(-1).value] >= precedence[token.value]) {
        output.push(operators.pop());
      }
      operators.push(token);
    } else if (token.value === "(") {
      operators.push(token);
    } else if (token.value === ")") {
      while (operators.length && operators.at(-1).value !== "(") output.push(operators.pop());
      if (!operators.length) throw new Error("Paréntesis inválidos.");
      operators.pop();
    }
  }

  while (operators.length) {
    const operator = operators.pop();
    if (operator.value === "(") throw new Error("Paréntesis inválidos.");
    output.push(operator);
  }

  const stack = [];
  const rolls = [];
  for (const token of output) {
    if (token.type === "number") {
      stack.push(token.value);
      if (token.roll) rolls.push(token.roll);
      continue;
    }
    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) throw new Error("Fórmula inválida.");
    if (token.value === "+") stack.push(left + right);
    if (token.value === "-") stack.push(left - right);
    if (token.value === "*") stack.push(left * right);
    if (token.value === "/") stack.push(Math.trunc(left / right));
  }

  if (stack.length !== 1) throw new Error("Fórmula inválida.");
  const total = stack[0];
  return {
    formula,
    total,
    natural: rolls.length === 1 ? rolls[0].total : total,
    modifier: rolls.length === 1 ? total - rolls[0].total : 0,
    diceLabel: rolls.map((roll) => roll.label).join("+") || "formula",
    breakdown: formulaBreakdown(tokens, formula),
  };
}

function formulaBreakdown(tokens, fallback) {
  const parts = tokens.map((token) => {
    if (token.roll) {
      const label = `${token.roll.label}[${token.roll.rolls.join(",")}]`;
      return token.value < 0 ? `-${label}` : label;
    }

    if (token.type === "number") {
      return String(token.value);
    }

    return token.value;
  }).filter(Boolean);

  return parts.length ? parts.join(" ") : fallback;
}

function resolveFormulaConstants(formula, values, constants, depth = 0) {
  return String(formula || "").replace(/\$([a-zA-Z_][\w.-]*)\[([^\]]+)\]/g, (_match, path, keyExpression) => {
    const table = resolveConstantPath(constants, path);
    if (!table || typeof table !== "object") {
      return "0";
    }
    const rawKey = String(keyExpression || "").trim().replace(/^['"]|['"]$/g, "");
    const valueKey = rawKey.startsWith("*") ? rawKey.slice(1) : rawKey;
    const resolvedKey = Object.prototype.hasOwnProperty.call(values, valueKey)
      ? values[valueKey]
      : valueKey;
    const resolved = table[String(resolvedKey)];
    return String(resolveFormulaConstantValue(resolved, values, constants, depth));
  });
}

function resolveFormulaConstantValue(value, values, constants, depth = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;

  const raw = String(value ?? "0").trim();
  if (!raw) return 0;

  if (/^[+-]?\d+$/.test(raw)) {
    return parseInt(raw, 10);
  }

  return evaluateFormulaExpressionInternal(raw, values, constants, depth + 1).total;
}

function tokenizeFormula(formula, values) {
  const tokens = [];
  let index = 0;
  let expectValue = true;

  while (index < formula.length) {
    const rest = formula.slice(index);
    if (/^\s+/.test(rest)) {
      index += rest.match(/^\s+/)[0].length;
      continue;
    }
    if (/^[()]/.test(rest)) {
      const value = rest[0];
      tokens.push({ type: "paren", value });
      index += 1;
      expectValue = value !== ")";
      continue;
    }
    if (/^[+\-*/]/.test(rest) && !(expectValue && /^[+-](?:\d|d)/i.test(rest))) {
      tokens.push({ type: "operator", value: rest[0] });
      index += 1;
      expectValue = true;
      continue;
    }
    const signed = expectValue ? "[+-]?" : "";
    const diceMatch = rest.match(new RegExp(`^${signed}(?:(\\d*)d([1-9]\\d*))`, "i"));
    if (diceMatch) {
      const sign = diceMatch[0].startsWith("-") ? -1 : 1;
      const count = parseInt(diceMatch[1] || "1", 10);
      const faces = parseInt(diceMatch[2], 10);
      if (count > 100 || faces > 10000) throw new Error("Demasiados dados.");
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
      const sum = rolls.reduce((total, roll) => total + roll, 0);
      tokens.push({ type: "number", value: sign * sum, roll: { label: `${count}d${faces}`, rolls, total: sum } });
      index += diceMatch[0].length;
      expectValue = false;
      continue;
    }
    const numberMatch = rest.match(new RegExp(`^${signed}\\d+`));
    if (numberMatch) {
      tokens.push({ type: "number", value: parseInt(numberMatch[0], 10) });
      index += numberMatch[0].length;
      expectValue = false;
      continue;
    }
    const keyMatch = rest.match(/^[a-zA-Z_][\w-]*/);
    if (keyMatch) {
      tokens.push(valueToFormulaNumber(values[keyMatch[0]]));
      index += keyMatch[0].length;
      expectValue = false;
      continue;
    }
    throw new Error(`Token inválido: ${rest.slice(0, 8)}`);
  }

  return tokens;
}

function valueToFormulaNumber(value) {
  const raw = String(value ?? "0").trim();
  const dice = raw.match(/^(\d*)d([1-9]\d*)$/i);
  if (dice) {
    const count = parseInt(dice[1] || "1", 10);
    const faces = parseInt(dice[2], 10);
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    return { type: "number", value: total, roll: { label: `${count}d${faces}`, rolls, total } };
  }
  return { type: "number", value: parseInt(raw || "0", 10) || 0 };
}

async function sendRollToEva(characterName, fieldLabel, roll) {
  await api("/api/dice-rolls", {
    method: "POST",
    body: JSON.stringify({
      username,
      characterName,
      fieldLabel,
      dice: roll.diceLabel || "formula",
      natural: roll.natural ?? roll.total,
      modifier: roll.modifier ?? 0,
      total: roll.total,
      formula: roll.formula,
      breakdown: roll.breakdown,
    }),
  });
}

function renderRollHistory() {
  if (!rollHistoryList) return;
  rollHistoryList.innerHTML = "";
  if (!rollHistory.length) {
    rollHistoryList.appendChild(empty("Sin tiradas registradas."));
    return;
  }
  for (const item of rollHistory) {
    const row = document.createElement("div");
    row.className = "roll-history-item";
    const title = document.createElement("strong");
    title.textContent = `${item.total} · ${item.title || "Tirada"}`;
    const detail = document.createElement("span");
    detail.textContent = item.breakdown || item.formula || "";
    row.append(title, detail);
    rollHistoryList.appendChild(row);
  }
}

function handleFormulaRoll() {
  try {
    const result = rollFormula(diceFormulaInput.value);
    diceFormulaResult.innerHTML = `${result.total}<span class="dice-breakdown">${result.breakdown}</span>`;
    addRollHistory({
      title: "Dados",
      total: result.total,
      formula: result.formula,
      breakdown: result.breakdown,
    });
    sendRollToEva(username, "Dados", result).catch((error) => {
      setStatus(error instanceof Error ? error.message : String(error));
    });
  } catch (error) {
    diceFormulaResult.textContent = error instanceof Error ? error.message : String(error);
  }
}

function setActiveView(view) {
  if (view === "sheet" && !selectedCharacter && allCharacters.length > 0) {
    view = "characterSelect";
  }

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
  roleName = "";
  allCharacters = [];
  characters = [];
  selectedCharacter = null;
  showLogin();
});
document.getElementById("changeCharacterButton").addEventListener("click", () => {
  selectedCharacter = null;
  characters = [];
  renderAll();
  setActiveView("characterSelect");
  setStatus("Elige un personaje para cargarlo.");
});
characterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createCharacter(characterNameInput.value.trim(), characterNotesInput.value.trim());
    characterNameInput.value = "";
    characterNotesInput.value = "";
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});
cancelCharacterDeleteButton.addEventListener("click", closeCharacterDeleteDialog);
keepCharacterButton.addEventListener("click", closeCharacterDeleteDialog);
characterDeleteDialog.addEventListener("close", () => {
  pendingDeleteCharacter = null;
});
confirmCharacterDeleteButton.addEventListener("click", async () => {
  if (!pendingDeleteCharacter) {
    return;
  }
  const characterId = pendingDeleteCharacter.id;
  closeCharacterDeleteDialog();
  try {
    await deleteCharacter(characterId);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});
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

window.addEventListener("focus", () => {
  if (username) refreshState().catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && username) refreshState().catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
});
window.addEventListener("online", () => {
  if (username) refreshState().catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
});

loadMediaItems();
connectWebSocket();
unregisterLegacyServiceWorkers().catch(() => {});

if (username) {
  showApp();
  refreshState().catch((error) => {
    setStatus(error instanceof Error ? error.message : String(error));
  });
} else {
  showLogin();
}
