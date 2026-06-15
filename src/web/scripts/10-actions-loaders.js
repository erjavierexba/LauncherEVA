    async function api(path, body) {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
      });
      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.mensaje || `HTTP ${response.status}`);
      }

      return data;
    }

    function setStatus(message) {
      if (statusMessage.textContent && statusMessage.textContent !== "Panel listo.") {
        statusHistory.unshift({
          time: new Date(),
          message: statusMessage.textContent,
        });
        statusHistory = statusHistory.slice(0, 12);
      }

      statusMessage.textContent = message;
      renderStatusLog();
    }

    function renderStatusLog() {
      statusLog.innerHTML = "";

      for (const item of statusHistory) {
        const line = document.createElement("div");
        line.className = "status-log-line";

        const time = document.createElement("span");
        time.className = "status-log-time";
        time.textContent = item.time.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const message = document.createElement("span");
        message.textContent = item.message;

        line.appendChild(time);
        line.appendChild(message);
        statusLog.appendChild(line);
      }
    }

    async function runAction(action) {
      try {
        const data = await action();
        setStatus(data.mensaje || "Orden ejecutada.");
        if (data.estado) {
          renderMusicStatus(data.estado);
        }
        await loadCardsStatus();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }

    async function assignCard() {
      return api("/api/cards/assign", {
        numero: numeroSelect.value,
        palo: paloSelect.value,
        jugador: cardPlayerSelect.value,
      });
    }

    async function sendMedia() {
      const data = await api("/api/media/send", {
        destinatario: mediaTargetSelect.value,
        nombre: mediaFileSelect.value,
      });
      cacheMediaItem(data.accion?.valor, data.accion?.destinatario);
      return data;
    }

    async function startCountdown() {
      return api("/api/countdown", {
        destinatario: countdownTargetSelect.value,
        durationSeconds: countdownSecondsInput.value,
        label: countdownLabelInput.value,
      });
    }

    async function cancelCountdown() {
      return api("/api/countdown/cancel");
    }

    async function resetClient() {
      return api("/api/client/reset");
    }

    async function playMusic() {
      const selected = JSON.parse(musicTrackSelect.value);

      return api("/api/music/play", {
        contexto: selected.contexto,
        numero: selected.numero,
      });
    }

    async function controlMusic(action) {
      return api("/api/music/control", { action });
    }

    async function cancelDoor() {
      const data = await api("/api/doors/cancel");
      for (const challenge of data.accion?.valor?.challenges || []) {
        renderDoorChallenge(challenge);
      }
      return data;
    }

    async function startExchange() {
      const participants = [...exchangeParticipants.querySelectorAll("[data-exchange-participant]")]
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.dataset.exchangeParticipant);

      const data = await api("/api/exchanges", { participants });
      activeExchange = data.exchange || null;
      renderExchange(activeExchange);
      closeExchangeModal();
      return data;
    }

    async function cancelExchange() {
      const data = await api("/api/exchanges/cancel");
      activeExchange = data.exchange || null;
      renderExchange(activeExchange);
      return data;
    }

    async function evaluateDoor() {
      const data = await api("/api/doors/evaluate", {
        participantType: "players",
        combination: doorCombinationSelect.value,
        straightLength: doorLengthInput.value,
        groupSize: doorLengthInput.value,
        atLeastCount: doorAtLeastCountInput.value,
        atLeastKind: doorAtLeastKindSelect.value,
        suitMode: doorSuitModeSelect.value,
        suit: doorSuitSelect.value,
        rankFilter: doorRankFilterSelect.value,
        color: doorColorSelect.value,
        parity: doorParitySelect.value,
      });

      renderDoorResults(data);

      return {
        ok: true,
        mensaje: `${data.matchCount} ruta(s) posible(s). Puerta enviada al cliente.`,
      };
    }

    async function resolveDoor(challengeId, action) {
      return api(`/api/doors/challenges/${encodeURIComponent(challengeId)}/resolve`, { action });
    }

    async function eliminatePlayer() {
      const jugador = killPlayerSelect.value;
      const response = await fetch(`/api/users/${encodeURIComponent(jugador)}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.mensaje || `HTTP ${response.status}`);
      }

      return data;
    }

    async function createNpc() {
      const fields = {};
      for (const input of npcTemplateFields.querySelectorAll("[data-template-field]")) {
        fields[input.dataset.templateField] = input.value;
      }

      const data = await api("/api/characters", {
        playerId: npcPlayerSelect.value,
        nombre: npcNameInput.value,
        role: npcRoleInput.value,
        fields,
      });
      npcNameInput.value = "";
      npcRoleInput.value = "";
      await loadCardsStatus();
      return data;
    }

    async function generateNamesAction() {
      const data = await api("/api/name-generator", {
        category: nameCategorySelect.value,
        subtype: nameSubtypeSelect.value,
        gender: nameGenderSelect.value,
      });

      renderGeneratedNames(data.names || []);

      return {
        ok: true,
        mensaje: `${data.count || 0} nombres generados.`,
      };
    }

    async function loadCardsStatus() {
      try {
        const response = await fetch("/api/cards/status");
        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.mensaje || "No se pudo cargar el estado.");
        }

        activeTemplate = data.template || null;
        players = data.players || [];
        characters = data.personajes || data.usuarios || [];
        populateSelects();
        renderNpcTemplateFields();
        renderPlayerSummary(characters);
        renderPlayersCards(characters);
      } catch (error) {
        playersCards.textContent = "Error cargando jugadores.";
        playerSummary.textContent = "Error cargando mesa.";
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }

    async function loadMusicStatus() {
      try {
        const response = await fetch("/api/music/status");
        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.mensaje || "No se pudo cargar la música.");
        }

        renderMusicCatalog(data.catalogo || []);
        renderMusicStatus(data.estado);
      } catch (error) {
        musicStateLabel.textContent = "Error";
        musicCurrentTitle.textContent = error instanceof Error ? error.message : String(error);
      }
    }

    async function loadMediaCatalog() {
      try {
        const response = await fetch("/api/media/catalog");
        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.mensaje || "No se pudo cargar el catálogo.");
        }

        mediaCatalog = data.catalogo || [];
        renderMediaCatalog();
      } catch (error) {
        mediaFileSelect.innerHTML = "";
        const option = document.createElement("option");
        option.value = "";
        option.textContent = error instanceof Error ? error.message : String(error);
        mediaFileSelect.appendChild(option);
      }
    }

    async function loadNameGeneratorOptions() {
      try {
        const response = await fetch("/api/name-generator/options");
        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.mensaje || "No se pudo cargar el generador.");
        }

        nameGeneratorOptions = {
          personas: data.personas || [],
          fantasia: data.fantasia || [],
        };
        renderNameSubtypeOptions();
      } catch (error) {
        nameSubtypeSelect.innerHTML = "";
        nameResults.innerHTML = "";
        const item = document.createElement("li");
        item.className = "name-result";
        item.textContent = error instanceof Error ? error.message : String(error);
        nameResults.appendChild(item);
      }
    }

    function renderNameSubtypeOptions() {
      const category = nameCategorySelect.value;
      const previousValue = nameSubtypeSelect.value;
      let values = [];

      if (category === "persona") {
        values = nameGeneratorOptions.personas;
      } else if (category === "fantasia") {
        values = nameGeneratorOptions.fantasia;
      } else {
        values = [
          {
            value: "ciudad",
            label: "Ciudad fantástica",
          },
        ];
      }

      nameSubtypeSelect.innerHTML = "";

      for (const item of values) {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        nameSubtypeSelect.appendChild(option);
      }

      if ([...nameSubtypeSelect.options].some((option) => option.value === previousValue)) {
        nameSubtypeSelect.value = previousValue;
      }

      nameGenderField.style.display = category === "ciudad" ? "none" : "block";
      nameResults.innerHTML = "";
    }

    function renderGeneratedNames(names) {
      nameResults.innerHTML = "";

      for (const name of names.slice(0, 10)) {
        const item = document.createElement("li");
        item.className = "name-result";
        item.textContent = name;
        item.title = name;
        nameResults.appendChild(item);
      }
    }

    function loadInitiativeState() {
      const saved = readLocalJson(INITIATIVE_STORAGE_KEY, initiativeState);
      initiativeState = {
        turnIndex: Number.isInteger(saved.turnIndex) ? saved.turnIndex : 0,
        combatants: Array.isArray(saved.combatants) ? saved.combatants.map(normalizeCombatant) : [],
      };
      clampInitiativeTurn();
      renderInitiative();
    }

    function normalizeCombatant(item) {
      return {
        id: item?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: String(item?.name || "").trim() || "Sin nombre",
        initiative: Number.isFinite(Number(item?.initiative)) ? Number(item.initiative) : 0,
        hp: String(item?.hp || ""),
        damage: Number.isFinite(Number(item?.damage)) ? Number(item.damage) : 0,
        notes: String(item?.notes || ""),
      };
    }

    function saveInitiativeState() {
      clampInitiativeTurn();
      writeLocalJson(INITIATIVE_STORAGE_KEY, initiativeState);
    }

    function clampInitiativeTurn() {
      const total = initiativeState.combatants.length;

      if (total === 0) {
        initiativeState.turnIndex = 0;
        return;
      }

      if (initiativeState.turnIndex < 0 || initiativeState.turnIndex >= total) {
        initiativeState.turnIndex = 0;
      }
    }

    function sortInitiative() {
      const activeId = initiativeState.combatants[initiativeState.turnIndex]?.id;
      initiativeState.combatants.sort((a, b) => {
        if (b.initiative !== a.initiative) {
          return b.initiative - a.initiative;
        }

        return a.name.localeCompare(b.name);
      });

      const nextIndex = initiativeState.combatants.findIndex((item) => item.id === activeId);
      initiativeState.turnIndex = nextIndex >= 0 ? nextIndex : 0;
    }

    function addInitiativeCombatant() {
      const name = initiativeNameInput.value.trim();
      const initiative = Number.parseInt(initiativeScoreInput.value, 10);
      const hp = initiativeHpInput.value.trim();

      if (!name || Number.isNaN(initiative)) {
        setStatus("Falta nombre o iniciativa.");
        return;
      }

      initiativeState.combatants.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        initiative,
        hp,
        damage: 0,
        notes: "",
      });
      sortInitiative();
      saveInitiativeState();
      renderInitiative();

      initiativeNameInput.value = "";
      initiativeHpInput.value = "";
      initiativeNameInput.focus();
      setStatus(`${name} entra en iniciativa.`);
    }

    function nextInitiativeTurn() {
      if (initiativeState.combatants.length === 0) {
        setStatus("No hay participantes en iniciativa.");
        return;
      }

      initiativeState.turnIndex = (initiativeState.turnIndex + 1) % initiativeState.combatants.length;
      saveInitiativeState();
      renderInitiative();
      setStatus(`Turno de ${initiativeState.combatants[initiativeState.turnIndex].name}.`);
    }

    function clearInitiative() {
      initiativeState = {
        turnIndex: 0,
        combatants: [],
      };
      saveInitiativeState();
      renderInitiative();
      setStatus("Iniciativa limpiada.");
    }

    function removeInitiativeCombatant(id) {
      const currentId = initiativeState.combatants[initiativeState.turnIndex]?.id;
      initiativeState.combatants = initiativeState.combatants.filter((item) => item.id !== id);
      const nextIndex = initiativeState.combatants.findIndex((item) => item.id === currentId);
      initiativeState.turnIndex = nextIndex >= 0 ? nextIndex : initiativeState.turnIndex;
      saveInitiativeState();
      renderInitiative();
    }

    function updateInitiativeCombatant(id, patch) {
      const combatant = initiativeState.combatants.find((item) => item.id === id);

      if (!combatant) {
        return;
      }

      Object.assign(combatant, patch);
      saveInitiativeState();
      renderInitiative();
    }

    function updateInitiativeText(id, key, value) {
      if (key === "name" && !value.trim()) {
        renderInitiative();
        return;
      }

      updateInitiativeCombatant(id, {
        [key]: value.trim(),
      });
    }

    function updateInitiativeScore(id, value) {
      const initiative = Number.parseInt(value, 10);

      if (Number.isNaN(initiative)) {
        renderInitiative();
        return;
      }

      updateInitiativeCombatant(id, { initiative });
    }

    function blurOnEnter(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    }

    function updateInitiativeDamage(id, value) {
      const damage = Number.parseInt(value, 10);

      if (Number.isNaN(damage)) {
        renderInitiative();
        return;
      }

      updateInitiativeCombatant(id, { damage: Math.max(0, damage) });
    }

    function updateInitiativeNotes(id, value) {
      const combatant = initiativeState.combatants.find((item) => item.id === id);

      if (!combatant) {
        return;
      }

      combatant.notes = value;
      saveInitiativeState();
    }

    function moveInitiativeCombatant(fromId, toId) {
      if (!fromId || !toId || fromId === toId) {
        return;
      }

      const activeId = initiativeState.combatants[initiativeState.turnIndex]?.id;
      const fromIndex = initiativeState.combatants.findIndex((item) => item.id === fromId);
      const toIndex = initiativeState.combatants.findIndex((item) => item.id === toId);

      if (fromIndex < 0 || toIndex < 0) {
        return;
      }

      const [moved] = initiativeState.combatants.splice(fromIndex, 1);
      initiativeState.combatants.splice(toIndex, 0, moved);
      initiativeState.turnIndex = Math.max(0, initiativeState.combatants.findIndex((item) => item.id === activeId));
      saveInitiativeState();
      renderInitiative();
      setStatus("Orden de combate actualizado.");
    }

    function renderInitiative() {
      initiativeList.innerHTML = "";

      if (initiativeState.combatants.length === 0) {
        initiativeCurrent.textContent = "Sin combate activo";
        initiativeNote.textContent = "Añade participantes, arrastra para ordenar y registra daño/notas.";
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Sin participantes.";
        initiativeList.appendChild(empty);
        return;
      }

      const current = initiativeState.combatants[initiativeState.turnIndex];
      initiativeCurrent.textContent = `Turno: ${current.name}`;
      initiativeNote.textContent = `${initiativeState.turnIndex + 1}/${initiativeState.combatants.length} · iniciativa ${current.initiative} · daño ${current.damage || 0}`;

      initiativeState.combatants.forEach((combatant, index) => {
        const row = document.createElement("div");
        row.className = `initiative-row ${index === initiativeState.turnIndex ? "active" : ""}`;
        row.dataset.combatantId = combatant.id;
        row.addEventListener("dragover", (event) => {
          event.preventDefault();
          row.classList.add("drag-over");
        });
        row.addEventListener("dragleave", () => {
          row.classList.remove("drag-over");
        });
        row.addEventListener("drop", (event) => {
          event.preventDefault();
          row.classList.remove("drag-over");
          moveInitiativeCombatant(event.dataTransfer.getData("text/plain"), combatant.id);
        });

        const order = document.createElement("div");
        order.className = "initiative-index";
        order.title = "Arrastra para reordenar";
        order.draggable = true;
        order.textContent = `⋮⋮ ${index + 1}`;
        order.addEventListener("dragstart", (event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", combatant.id);
          row.classList.add("dragging");
        });
        order.addEventListener("dragend", () => {
          row.classList.remove("dragging");
        });

        const name = document.createElement("input");
        name.className = "initiative-edit initiative-name";
        name.value = combatant.name;
        name.title = combatant.name;
        name.dataset.noBlockSubmit = "true";
        name.addEventListener("change", () => updateInitiativeText(combatant.id, "name", name.value));
        name.addEventListener("keydown", blurOnEnter);

        const score = document.createElement("input");
        score.className = "initiative-edit initiative-score";
        score.type = "number";
        score.value = combatant.initiative;
        score.dataset.noBlockSubmit = "true";
        score.addEventListener("change", () => updateInitiativeScore(combatant.id, score.value));
        score.addEventListener("keydown", blurOnEnter);

        const hp = document.createElement("input");
        hp.className = "initiative-edit initiative-hp";
        hp.value = combatant.hp || "";
        hp.placeholder = "PV / estado";
        hp.title = combatant.hp || "";
        hp.dataset.noBlockSubmit = "true";
        hp.addEventListener("change", () => updateInitiativeText(combatant.id, "hp", hp.value));
        hp.addEventListener("keydown", blurOnEnter);

        const damage = document.createElement("input");
        damage.className = "initiative-edit initiative-damage";
        damage.type = "number";
        damage.min = "0";
        damage.value = combatant.damage || 0;
        damage.title = "Daño registrado";
        damage.dataset.noBlockSubmit = "true";
        damage.addEventListener("change", () => updateInitiativeDamage(combatant.id, damage.value));
        damage.addEventListener("keydown", blurOnEnter);

        const notes = document.createElement("textarea");
        notes.className = "initiative-notes";
        notes.value = combatant.notes || "";
        notes.placeholder = "Notas, efectos, planes, heridas, recordatorios...";
        notes.rows = 2;
        notes.dataset.noBlockSubmit = "true";
        notes.addEventListener("change", () => updateInitiativeNotes(combatant.id, notes.value));

        const remove = document.createElement("button");
        remove.className = "initiative-delete secondary";
        remove.type = "button";
        remove.textContent = "X";
        remove.title = `Quitar ${combatant.name}`;
        remove.addEventListener("click", () => removeInitiativeCombatant(combatant.id));

        row.appendChild(order);
        row.appendChild(name);
        row.appendChild(score);
        row.appendChild(hp);
        row.appendChild(damage);
        row.appendChild(remove);
        row.appendChild(notes);
        initiativeList.appendChild(row);
      });
    }

    function renderMediaCatalog() {
      const selectedValue = mediaFileSelect.value;
      const selectedType = mediaTypeSelect.value;
      const files = mediaCatalog.filter((item) => item.tipo === selectedType);

      mediaFileSelect.innerHTML = "";
      mediaGallery.innerHTML = "";

      if (files.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Sin archivos de este tipo";
        mediaFileSelect.appendChild(option);
        const empty = document.createElement("div");
        empty.className = "media-empty";
        empty.textContent = "Sin archivos de este tipo.";
        mediaGallery.appendChild(empty);
        return;
      }

      for (const item of files) {
        const option = document.createElement("option");
        option.value = item.selector || item.filename || item.nombre;
        option.textContent = `${item.nombre}${item.aliases?.length ? ` · ${item.aliases.join(", ")}` : ""}`;
        mediaFileSelect.appendChild(option);
      }

      if ([...mediaFileSelect.options].some((option) => option.value === selectedValue)) {
        mediaFileSelect.value = selectedValue;
      }

      renderMediaGallery(files);
    }

    function renderMediaGallery(files) {
      mediaGallery.innerHTML = "";
      const selected = mediaFileSelect.value;

      for (const item of files) {
        const value = item.selector || item.filename || item.nombre;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "media-tile";
        button.classList.toggle("active", value === selected);
        button.dataset.mediaValue = value;
        button.title = item.aliases?.length ? item.aliases.join(", ") : item.nombre;

        const preview = document.createElement("span");
        preview.className = "media-tile-preview";

        if (item.tipo === "IMAGEN") {
          const image = document.createElement("img");
          image.src = item.url;
          image.alt = "";
          preview.appendChild(image);
        } else {
          preview.textContent = item.tipo.slice(0, 3);
        }

        const name = document.createElement("span");
        name.className = "media-tile-name";
        name.textContent = item.nombre;

        const aliases = document.createElement("span");
        aliases.className = "media-tile-aliases";
        aliases.textContent = item.aliases?.slice(0, 3).join(", ") || item.filename || "";

        button.appendChild(preview);
        button.appendChild(name);
        button.appendChild(aliases);
        button.addEventListener("click", () => {
          mediaFileSelect.value = value;
          renderMediaGallery(files);
        });

        mediaGallery.appendChild(button);
      }
    }

    function getSelectedMediaItem() {
      const selectedType = mediaTypeSelect.value;
      const selectedValue = mediaFileSelect.value;

      return mediaCatalog.find((item) => (
        item.tipo === selectedType &&
        (item.selector === selectedValue || item.filename === selectedValue || item.nombre === selectedValue)
      ));
    }

    function mediaCacheSessionId() {
      return String(window.EVA_SESSION_ID || "default");
    }

    function ensureMediaCacheSession() {
      const currentSessionId = mediaCacheSessionId();
      const savedSessionId = localStorage.getItem(MEDIA_CACHE_SESSION_KEY);

      if (savedSessionId !== currentSessionId) {
        localStorage.setItem(MEDIA_CACHE_SESSION_KEY, currentSessionId);
        localStorage.removeItem(MEDIA_CACHE_STORAGE_KEY);
      }
    }

    function readMediaCache() {
      ensureMediaCacheSession();
      cachedMediaItems = readLocalJson(MEDIA_CACHE_STORAGE_KEY, []);
      renderCachedMedia();
    }

    function writeMediaCache() {
      writeLocalJson(MEDIA_CACHE_STORAGE_KEY, cachedMediaItems);
    }

    function cacheMediaItem(item, destinatario = null) {
      if (!item || !item.url) {
        return;
      }

      const key = item.filename || item.url || item.nombre;
      cachedMediaItems = [
        {
          ...item,
          destinatario,
          cachedAt: new Date().toISOString(),
        },
        ...cachedMediaItems.filter((cached) => (cached.filename || cached.url || cached.nombre) !== key),
      ].slice(0, 24);
      writeMediaCache();
      renderCachedMedia();
    }

    function clearMediaCache() {
      cachedMediaItems = [];
      localStorage.removeItem(MEDIA_CACHE_STORAGE_KEY);
      renderCachedMedia();
      closeMediaPreviewModal();
      setStatus("Cache de archivos borrada.");
    }

    function renderCachedMedia() {
      cachedMediaList.innerHTML = "";

      if (cachedMediaItems.length === 0) {
        const empty = document.createElement("div");
        empty.className = "media-empty";
        empty.textContent = "Sin archivos guardados.";
        cachedMediaList.appendChild(empty);
        return;
      }

      for (const item of cachedMediaItems) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cached-media-item";
        button.title = item.destinatario ? `${item.nombre} · ${item.destinatario}` : item.nombre;

        const icon = document.createElement("span");
        icon.className = "cached-media-icon";
        icon.textContent = item.tipo === "IMAGEN" ? "IMG" : item.tipo?.slice(0, 3) || "ARC";

        const label = document.createElement("span");
        label.className = "cached-media-name";
        label.textContent = item.nombre || item.filename || "Archivo";

        const meta = document.createElement("span");
        meta.className = "cached-media-meta";
        meta.textContent = item.destinatario || item.tipo || "";

        button.appendChild(icon);
        button.appendChild(label);
        button.appendChild(meta);
        button.addEventListener("click", () => previewMediaItem(item));
        cachedMediaList.appendChild(button);
      }
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
      stage.addEventListener("wheel", (event) => {
        event.preventDefault();
        const previousScale = scale;
        scale = scale * (event.deltaY < 0 ? 1.12 : 0.88);
        clampTransform();

        if (scale === 1 || previousScale === scale) {
          applyTransform();
          return;
        }

        translateX += (event.offsetX - stage.clientWidth / 2) * (previousScale - scale) / previousScale;
        translateY += (event.offsetY - stage.clientHeight / 2) * (previousScale - scale) / previousScale;
        clampTransform();
        applyTransform();
      }, { passive: false });

      image.addEventListener("dblclick", () => {
        scale = scale > 1 ? 1 : 2;
        translateX = 0;
        translateY = 0;
        applyTransform();
      });

      applyTransform();
      return stage;
    }

    async function previewMediaItem(item) {
      if (!item) {
        setStatus("No hay archivo seleccionado para previsualizar.");
        return;
      }

      mediaPreviewTitle.textContent = item.nombre;
      mediaPreviewBody.innerHTML = "";
      openMediaPreviewModal();

      if (item.tipo === "IMAGEN") {
        mediaPreviewBody.appendChild(createZoomableImage(item));
        return;
      }

      if (item.tipo === "VIDEO") {
        const video = document.createElement("video");
        video.src = item.url;
        video.controls = true;
        mediaPreviewBody.appendChild(video);
        return;
      }

      if (item.tipo === "AUDIO") {
        const audio = document.createElement("audio");
        audio.src = item.url;
        audio.controls = true;
        mediaPreviewBody.appendChild(audio);
        return;
      }

      if (item.tipo === "TEXTO") {
        const text = document.createElement("pre");
        text.className = "preview-text";
        text.textContent = "Cargando texto...";
        mediaPreviewBody.appendChild(text);

        try {
          const response = await fetch(item.url);
          text.textContent = await response.text();
        } catch (error) {
          text.textContent = error instanceof Error ? error.message : String(error);
        }
        return;
      }

      const placeholder = document.createElement("div");
      placeholder.className = "preview-placeholder";
      placeholder.textContent = `${item.tipo} · ${item.filename || item.nombre}`;
      mediaPreviewBody.appendChild(placeholder);
    }

    async function previewSelectedMedia() {
      await previewMediaItem(getSelectedMediaItem());
    }

    function renderMusicCatalog(catalogo) {
      const selectedValue = musicTrackSelect.value;
      musicTrackSelect.innerHTML = "";

      for (const item of catalogo) {
        const option = document.createElement("option");
        option.value = JSON.stringify({
          contexto: item.contexto,
          numero: item.numero,
        });
        option.textContent = item.label;
        musicTrackSelect.appendChild(option);
      }

      if ([...musicTrackSelect.options].some((option) => option.value === selectedValue)) {
        musicTrackSelect.value = selectedValue;
      }
    }

    function renderMusicStatus(estado) {
      if (!estado || !estado.current) {
        musicStateLabel.textContent = "Sin música";
        musicCurrentTitle.textContent = "Nada sonando";
        return;
      }

      musicStateLabel.textContent = estado.paused ? "Pausada" : estado.playing ? "Sonando" : "Cargada";
      musicCurrentTitle.textContent = estado.current.label || estado.current.path || "Música";
    }

    function renderDoorSummary() {
      const combinationLabels = {
        at_least: "Al menos",
        pair: "Pareja",
        three: "Trío",
        four: "Poker",
        full_house: "Full house",
        straight: "Escalera",
        flush: "Palo / color",
      };
      const atLeastLabels = {
        odd: "impares",
        even: "pares",
        figures: "figuras",
        red: "rojas",
        black: "negras",
        same_suit: "del mismo palo",
      };
      const parts = [
        `${combinationLabels[doorCombinationSelect.value] || "Puerta"}`,
        `${doorLengthInput.value || 0} huecos`,
      ];

      if (doorCombinationSelect.value === "at_least") {
        parts.push(`mínimo ${doorAtLeastCountInput.value || 0} ${atLeastLabels[doorAtLeastKindSelect.value] || ""}`.trim());
      }

      if (doorSuitModeSelect.value === "specific") {
        parts.push(`palo: ${doorSuitSelect.options[doorSuitSelect.selectedIndex]?.textContent || doorSuitSelect.value}`);
      } else if (doorSuitModeSelect.value === "same") {
        parts.push("un palo a elegir");
      }

      if (doorRankFilterSelect.value === "figures") {
        parts.push("solo figuras");
      }

      if (doorColorSelect.value !== "any") {
        parts.push(doorColorSelect.options[doorColorSelect.selectedIndex]?.textContent || doorColorSelect.value);
      }

      if (doorParitySelect.value !== "any") {
        parts.push(doorParitySelect.options[doorParitySelect.selectedIndex]?.textContent || doorParitySelect.value);
      }

      doorSummary.textContent = parts.join(" · ");
    }
