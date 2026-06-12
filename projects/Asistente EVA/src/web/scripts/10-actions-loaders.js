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

    async function sendMedia() {
      return api("/api/media/send", {
        destinatario: mediaTargetSelect.value,
        nombre: mediaFileSelect.value,
      });
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

    async function loadCardsStatus() {
      try {
        const response = await fetch("/api/characters");
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

    function loadInitiativeState() {
      const saved = readLocalJson(INITIATIVE_STORAGE_KEY, initiativeState);
      initiativeState = {
        turnIndex: Number.isInteger(saved.turnIndex) ? saved.turnIndex : 0,
        combatants: Array.isArray(saved.combatants) ? saved.combatants : [],
      };
      clampInitiativeTurn();
      renderInitiative();
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
      sortInitiative();
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

    function renderInitiative() {
      initiativeList.innerHTML = "";

      if (initiativeState.combatants.length === 0) {
        initiativeCurrent.textContent = "Sin combate activo";
        initiativeNote.textContent = "Añade participantes y ordénalos por iniciativa.";
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Sin participantes.";
        initiativeList.appendChild(empty);
        return;
      }

      const current = initiativeState.combatants[initiativeState.turnIndex];
      initiativeCurrent.textContent = `Turno: ${current.name}`;
      initiativeNote.textContent = `${initiativeState.turnIndex + 1}/${initiativeState.combatants.length} · iniciativa ${current.initiative}`;

      initiativeState.combatants.forEach((combatant, index) => {
        const row = document.createElement("div");
        row.className = `initiative-row ${index === initiativeState.turnIndex ? "active" : ""}`;

        const order = document.createElement("div");
        order.className = "initiative-index";
        order.textContent = String(index + 1);

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
        hp.placeholder = "-";
        hp.title = combatant.hp || "";
        hp.dataset.noBlockSubmit = "true";
        hp.addEventListener("change", () => updateInitiativeText(combatant.id, "hp", hp.value));
        hp.addEventListener("keydown", blurOnEnter);

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
        row.appendChild(remove);
        initiativeList.appendChild(row);
      });
    }

    function renderMediaCatalog() {
      const selectedValue = mediaFileSelect.value;
      const selectedType = mediaTypeSelect.value;
      const files = mediaCatalog.filter((item) => item.tipo === selectedType);

      mediaFileSelect.innerHTML = "";

      if (files.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Sin archivos de este tipo";
        mediaFileSelect.appendChild(option);
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
    }

    function getSelectedMediaItem() {
      const selectedType = mediaTypeSelect.value;
      const selectedValue = mediaFileSelect.value;

      return mediaCatalog.find((item) => (
        item.tipo === selectedType &&
        (item.selector === selectedValue || item.filename === selectedValue || item.nombre === selectedValue)
      ));
    }

    async function previewSelectedMedia() {
      const item = getSelectedMediaItem();

      if (!item) {
        setStatus("No hay archivo seleccionado para previsualizar.");
        return;
      }

      mediaPreviewTitle.textContent = item.nombre;
      mediaPreviewBody.innerHTML = "";
      openMediaPreviewModal();

      if (item.tipo === "IMAGEN") {
        const image = document.createElement("img");
        image.src = item.url;
        image.alt = item.nombre;
        mediaPreviewBody.appendChild(image);
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
