    function renderPlayerSummary(personajes) {
      const visibleCharacters = personajes.filter((personaje) => personaje.active);
      const total = visibleCharacters.length;
      const activePlayers = players.filter((player) => player.active).length;
      const hasSheet = visibleCharacters.some((personaje) => (personaje.sheet?.fields || []).length > 0);

      playerSummary.textContent = hasSheet
        ? `${activePlayers} jugadores · ${total} personajes · ${activeTemplate?.label || "Ficha"}`
        : `${activePlayers} jugadores · ${total} personajes`;
    }

    function renderNpcTemplateFields() {
      npcTemplateFields.innerHTML = "";

      const fields = activeTemplate?.fields || [];
      if (fields.length === 0) {
        return;
      }

      for (const field of fields) {
        const wrapper = document.createElement("div");
        const label = document.createElement("label");
        label.textContent = field.label;

        wrapper.appendChild(label);
        wrapper.appendChild(createFieldInput(field, field.defaultValue || ""));
        npcTemplateFields.appendChild(wrapper);
      }
    }

    function renderPlayersCards(personajes) {
      playersCards.innerHTML = "";

      const visibleCharacters = personajes.filter((personaje) => personaje.active);

      if (visibleCharacters.length === 0) {
        playersCards.textContent = "Sin jugadores activos.";
        return;
      }

      for (const personaje of visibleCharacters) {
        const wrapper = document.createElement("div");
        wrapper.className = "player";

        const name = document.createElement("div");
        name.className = "player-name";
        const type = personaje.role || personaje.rol || "Personaje";
        const nameText = document.createElement("span");
        nameText.textContent = `#${personaje.id} · ${personaje.nombre}`;
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = `${type} · ${personaje.playerName || personaje.username}`;
        name.appendChild(nameText);
        name.appendChild(badge);

        const sheetFields = personaje.sheet?.fields || [];
        const favoriteFields = sheetFields.filter((field) => field.favorite);
        const summaryFields = favoriteFields.length > 0
          ? favoriteFields
          : sheetFields.slice(0, 4);
        const body = document.createElement("div");

        if (summaryFields.length > 0) {
          body.className = "stat-grid";

          for (const field of summaryFields) {
            body.appendChild(createStatBlock(field, personaje, true));
          }
        } else {
          body.className = "stat-grid";
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "Sin ficha.";
          body.appendChild(empty);
        }

        wrapper.appendChild(name);
        wrapper.appendChild(body);
        if ((personaje.cards || []).length > 0) {
          const cards = document.createElement("div");
          cards.className = "cards";
          for (const carta of personaje.cards || []) {
            cards.appendChild(createCardToken(carta));
          }
          wrapper.appendChild(cards);
        }
        wrapper.addEventListener("click", () => openCharacterDetail(personaje));
        playersCards.appendChild(wrapper);
      }
    }

    function createStatBlock(field, personaje = null, compact = false) {
      const stat = document.createElement("div");
      stat.className = "stat-block";

      const label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = field.label;

      const value = document.createElement("div");
      value.className = "stat-value";

      if (field.type === "array") {
        if (compact) {
          const count = Array.isArray(field.value) ? field.value.length : 0;
          value.textContent = `${count} elemento${count === 1 ? "" : "s"}`;
        } else {
          value.appendChild(createArrayEditor(field, field.value, (nextValue) => (
            updateCharacterField(personaje?.id, field.key, nextValue)
          )));
        }
      } else if (isDiceThrowInteger(field.type)) {
        value.appendChild(createDiceThrowInteger(
          field,
          field.value,
          (nextValue) => updateCharacterField(personaje?.id, field.key, nextValue),
          (roll) => sendDiceRoll(personaje?.playerName || personaje?.username, personaje?.nombre, field, roll)
        ));
      } else if (field.type === "b_int") {
        value.appendChild(createButtonedInteger(
          field,
          field.value,
          (nextValue) => updateCharacterField(personaje?.id, field.key, nextValue)
        ));
      } else if (!compact && personaje) {
        value.appendChild(createEditableFieldInput(
          field,
          field.value,
          (nextValue) => updateCharacterField(personaje.id, field.key, nextValue)
        ));
      } else {
        value.textContent = field.value || "—";
      }

      stat.appendChild(label);
      stat.appendChild(value);

      return stat;
    }

    function createFieldInput(field, value = "") {
      if (field.type === "array") {
        return createArrayEditor(field, value);
      }

      if (isDiceThrowInteger(field.type)) {
        return createDiceThrowInteger(field, value);
      }

      if (field.type === "b_int") {
        return createButtonedInteger(field, value);
      }

      const input = document.createElement("input");
      input.dataset.templateField = field.key;
      input.value = value;

      if (field.type === "int") {
        input.type = "number";
        input.step = "1";
      } else if (field.type === "throw") {
        input.type = "text";
        input.placeholder = "d20+3";
      } else {
        input.type = "text";
      }

      return input;
    }

    function createEditableFieldInput(field, value = "", onChange = null) {
      const input = document.createElement("input");
      input.value = Array.isArray(value) ? JSON.stringify(value) : String(value ?? "");
      input.dataset.noBlockSubmit = "true";

      if (field.type === "int") {
        input.type = "number";
        input.step = "1";
      } else {
        input.type = "text";
      }

      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      input.addEventListener("change", () => {
        if (field.type === "int") {
          input.value = normalizeInteger(input.value);
        }

        if (onChange) onChange(input.value);
      });

      return input;
    }

    function createButtonedInteger(field, value = "", onChange = null) {
      const wrapper = document.createElement("div");
      wrapper.className = "buttoned-int";
      const minus = document.createElement("button");
      const input = document.createElement("input");
      const plus = document.createElement("button");

      minus.type = "button";
      plus.type = "button";
      minus.textContent = "-";
      plus.textContent = "+";
      input.type = "number";
      input.step = "1";
      input.value = normalizeInteger(value);
      input.dataset.templateField = field.key;

      const changeBy = (delta) => {
        input.value = String(parseInt(input.value || "0", 10) + delta);
        if (onChange) onChange(input.value);
      };

      minus.addEventListener("click", (event) => {
        event.stopPropagation();
        changeBy(-1);
      });
      plus.addEventListener("click", (event) => {
        event.stopPropagation();
        changeBy(1);
      });
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("change", () => {
        input.value = normalizeInteger(input.value);
        if (onChange) onChange(input.value);
      });

      wrapper.appendChild(minus);
      wrapper.appendChild(input);
      wrapper.appendChild(plus);

      return wrapper;
    }

    function createDiceThrowInteger(field, value = "", onChange = null, onRoll = null) {
      const wrapper = document.createElement("div");
      wrapper.className = "dice-throw-int";
      const input = document.createElement("input");
      const roll = document.createElement("button");
      const result = document.createElement("div");
      const faces = diceFaces(field.type);

      input.type = "number";
      input.step = "1";
      input.value = normalizeInteger(value);
      input.dataset.templateField = field.key;
      roll.type = "button";
      roll.className = "dice-roll-button";
      roll.textContent = "🎲";
      roll.title = `Lanzar d${faces}`;
      result.className = "dice-result";

      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("change", () => {
        input.value = normalizeInteger(input.value);
        if (onChange) onChange(input.value);
      });

      roll.addEventListener("click", (event) => {
        event.stopPropagation();
        roll.classList.remove("rolling");
        void roll.offsetWidth;
        roll.classList.add("rolling");
        result.className = "dice-result pending";
        result.textContent = "Lanzando...";

        setTimeout(() => {
          const natural = Math.floor(Math.random() * faces) + 1;
          const modifier = parseInt(input.value || "0", 10) || 0;
          const total = natural + modifier;
          roll.classList.remove("rolling");
          result.className = "dice-result";

          if (natural === faces) {
            result.classList.add("critical");
            result.textContent = `${natural} + ${modifier} = ${total} · crítico!`;
          } else if (natural === 1) {
            result.classList.add("fumble");
            result.textContent = `${natural} + ${modifier} = ${total} · pifia!`;
          } else {
            result.textContent = `${natural} + ${modifier} = ${total}`;
          }

          if (onRoll) {
            onRoll({ natural, modifier, total, dice: `d${faces}` });
          }
        }, 620);
      });

      wrapper.appendChild(input);
      wrapper.appendChild(roll);
      wrapper.appendChild(result);

      return wrapper;
    }

    function createArrayEditor(field, value = [], onChange = null) {
      const wrapper = document.createElement("div");
      wrapper.className = "array-field";
      const list = document.createElement("div");
      list.className = "array-items";
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.dataset.templateField = field.key;
      const add = document.createElement("button");
      add.type = "button";
      add.className = "secondary";
      add.textContent = "Añadir";

      let items = normalizeArrayValue(value);
      const itemFields = normalizeArrayItemFields(field);

      const sync = (notify = true) => {
        hidden.value = JSON.stringify(items);
        if (notify && onChange) onChange(items);
      };

      const render = () => {
        list.innerHTML = "";

        if (items.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "Sin elementos.";
          list.appendChild(empty);
        }

        items.forEach((item, itemIndex) => {
          const row = document.createElement("div");
          row.className = "array-item";

          for (const itemField of itemFields) {
            const control = createArrayItemInput(itemField, item[itemField.key] || "");
            control.addEventListener("change", () => {
              items[itemIndex] = {
                ...items[itemIndex],
                [itemField.key]: control.value,
              };
              sync();
            });
            row.appendChild(control);
          }

          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "danger";
          remove.textContent = "×";
          remove.addEventListener("click", (event) => {
            event.stopPropagation();
            items.splice(itemIndex, 1);
            render();
            sync();
          });
          row.appendChild(remove);
          list.appendChild(row);
        });
      };

      add.addEventListener("click", (event) => {
        event.stopPropagation();
        items.push(Object.fromEntries(itemFields.map((itemField) => [itemField.key, itemField.defaultValue || ""])));
        render();
        sync();
      });

      wrapper.appendChild(list);
      wrapper.appendChild(hidden);
      wrapper.appendChild(add);
      render();
      sync(false);

      return wrapper;
    }

    function createArrayItemInput(field, value) {
      const input = document.createElement("input");
      input.value = value;
      input.placeholder = field.label;

      if (field.type === "int" || field.type === "b_int") {
        input.type = "number";
        input.step = "1";
      } else {
        input.type = "text";
      }

      if (field.type === "throw") {
        input.placeholder = `${field.label} d20+3`;
      }

      return input;
    }

    function normalizeArrayValue(value) {
      if (Array.isArray(value)) {
        return value.filter((item) => item && typeof item === "object");
      }

      try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
      } catch (error) {
        return [];
      }
    }

    function normalizeArrayItemFields(field) {
      const itemFields = field.config?.itemFields || [];

      if (itemFields.length > 0) {
        return itemFields;
      }

      return [{ key: "nombre", label: "Nombre", type: "text", defaultValue: "" }];
    }

    function normalizeInteger(value) {
      const parsed = parseInt(String(value || "0"), 10);
      return String(Number.isFinite(parsed) ? parsed : 0);
    }

    function isDiceThrowInteger(type) {
      return /^d[1-9]\d*_throw_int$/.test(type || "");
    }

    function diceFaces(type) {
      const match = String(type || "").match(/^d([1-9]\d*)_throw_int$/);
      return match ? parseInt(match[1], 10) : 20;
    }

    async function updateCharacterField(characterId, key, value) {
      if (!characterId) return;

      try {
        const response = await fetch(`/api/characters/by-id/${encodeURIComponent(characterId)}/sheet`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [key]: value } }),
        });
        const data = await response.json();

        if (!response.ok || data.ok === false) {
          throw new Error(data.mensaje || `HTTP ${response.status}`);
        }

        applyCharacterSheetUpdateEvent({
          valor: {
            characterId,
            sheet: data.sheet,
          },
        });
        const character = characters.find((personaje) => String(personaje.id) === String(characterId));
        setStatus(`Ficha actualizada: ${character?.nombre || "personaje"}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }

    async function sendDiceRoll(username, characterName, field, roll) {
      if (!username) return;

      await fetch("/api/dice-rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          characterName,
          fieldLabel: field.label,
          dice: roll.dice,
          natural: roll.natural,
          modifier: roll.modifier,
          total: roll.total,
        }),
      });
    }

    function openCharacterDetail(personaje) {
      activeCharacterDetailName = personaje.nombre;
      activeCharacterDetailId = personaje.id;
      pendingDeleteCharacter = personaje;
      characterDetailTitle.textContent = `#${personaje.id} · ${personaje.nombre}`;
      characterDetailBody.innerHTML = "";

      const meta = document.createElement("div");
      meta.className = "character-meta";
      meta.textContent = `${personaje.playerName || personaje.username} · ${personaje.role || personaje.rol || "Sin rol"} · ${personaje.sheet?.template?.label || personaje.template?.label || "Ficha"}`;
      characterDetailBody.appendChild(meta);

      const sheetFields = personaje.sheet?.fields || [];
      if (sheetFields.length > 0) {
        for (const field of sheetFields) {
          characterDetailBody.appendChild(createStatBlock(field, personaje));
        }
      } else {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Sin ficha.";
        characterDetailBody.appendChild(empty);
      }

      characterDetailModal.classList.add("open");
      characterDetailModal.setAttribute("aria-hidden", "false");
    }

    function closeCharacterDetailModal() {
      activeCharacterDetailName = null;
      activeCharacterDetailId = null;
      characterDetailModal.classList.remove("open");
      characterDetailModal.setAttribute("aria-hidden", "true");
    }

    function openDeleteCharacterModal() {
      if (!pendingDeleteCharacter) return;

      deleteCharacterText.textContent = `Vas a eliminar "${pendingDeleteCharacter.nombre}" de ${pendingDeleteCharacter.playerName || pendingDeleteCharacter.username}. Esta acción no se puede deshacer.`;
      deleteCharacterModal.classList.add("open");
      deleteCharacterModal.setAttribute("aria-hidden", "false");
    }

    function closeDeleteCharacterModal() {
      deleteCharacterModal.classList.remove("open");
      deleteCharacterModal.setAttribute("aria-hidden", "true");
    }

    async function confirmDeleteCharacter() {
      if (!pendingDeleteCharacter) return;

      try {
        const response = await fetch(`/api/characters/${encodeURIComponent(pendingDeleteCharacter.id)}`, {
          method: "DELETE",
        });
        const data = await response.json();

        if (!response.ok || data.ok === false) {
          throw new Error(data.mensaje || `HTTP ${response.status}`);
        }

        const deletedName = pendingDeleteCharacter.nombre;
        pendingDeleteCharacter = null;
        closeDeleteCharacterModal();
        closeCharacterDetailModal();
        await loadCardsStatus();
        setStatus(data.mensaje || `Personaje ${deletedName} eliminado.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }

    function refreshCharacterViews() {
      populateSelects();
      renderNpcTemplateFields();
      renderPlayerSummary(characters);
      renderPlayersCards(characters);

      if (!activeCharacterDetailId) {
        return;
      }

      const activeCharacter = characters.find((personaje) => String(personaje.id) === String(activeCharacterDetailId));
      if (activeCharacter) {
        openCharacterDetail(activeCharacter);
      }
    }

    function applyTemplateUpdateEvent(data) {
      const nextCharacters = data?.valor?.characters;
      if (!Array.isArray(nextCharacters)) {
        return false;
      }

      activeTemplate = data.valor.template || activeTemplate;
      characters = nextCharacters;
      refreshCharacterViews();
      return true;
    }

    function applyCharacterSheetUpdateEvent(data) {
      const characterId = data?.valor?.characterId || data?.valor?.character?.id;
      const sheet = data?.valor?.sheet;

      if (!characterId || !sheet) {
        return false;
      }

      const index = characters.findIndex((personaje) => String(personaje.id) === String(characterId));
      if (index === -1) {
        return false;
      }

      characters = characters.map((personaje, currentIndex) => (
        currentIndex === index ? { ...personaje, sheet } : personaje
      ));
      refreshCharacterViews();
      return true;
    }

    function askInheritance(jugador) {
      return new Promise((resolve) => {
        const possibleHeirs = characters.filter((personaje) => personaje.active && personaje.nombre !== jugador);

        if (possibleHeirs.length === 0) {
          resolve(null);
          return;
        }

        fillSelect(inheritanceSelect, possibleHeirs.map((personaje) => personaje.nombre));
        pendingInheritance = resolve;
        inheritanceModal.classList.add("open");
        inheritanceModal.setAttribute("aria-hidden", "false");
      });
    }

    function closeInheritanceModal(value) {
      inheritanceModal.classList.remove("open");
      inheritanceModal.setAttribute("aria-hidden", "true");

      if (pendingInheritance) {
        pendingInheritance(value);
        pendingInheritance = null;
      }
    }

    function openPlayersModal() {
      playersModal.classList.add("open");
      playersModal.setAttribute("aria-hidden", "false");
    }

    function closePlayersModal() {
      playersModal.classList.remove("open");
      playersModal.setAttribute("aria-hidden", "true");
    }

    function openMediaPreviewModal() {
      mediaPreviewModal.classList.add("open");
      mediaPreviewModal.setAttribute("aria-hidden", "false");
    }

    function closeMediaPreviewModal() {
      mediaPreviewModal.classList.remove("open");
      mediaPreviewModal.setAttribute("aria-hidden", "true");
      mediaPreviewBody.querySelectorAll("audio, video").forEach((element) => {
        element.pause();
        element.removeAttribute("src");
        element.load();
      });
      mediaPreviewBody.innerHTML = "";
    }

    function createCardToken(cartaRaw) {
      const visual = getCardVisual(String(cartaRaw));
      const token = document.createElement("div");
      token.className = "card-token";
      token.title = cartaRaw;

      const circle = document.createElement("div");
      circle.className = `card-circle ${visual.colorClass}`;
      circle.textContent = visual.value;

      const label = document.createElement("div");
      label.className = "card-label";
      label.textContent = `${visual.suit ? `${visual.suit} ` : ""}${visual.label}`;

      token.appendChild(circle);
      token.appendChild(label);

      return token;
    }

    function renderDoorResults(data) {
      doorResults.innerHTML = "";

      if (data.challenge) {
        renderDoorChallenge(data.challenge);
      }

      if (!data.matches || data.matches.length === 0) {
        const empty = document.createElement("div");
        empty.className = "no-cards";
        empty.textContent = "Sin rutas automáticas. Puedes validarla manualmente si la mesa convence.";
        doorResults.appendChild(empty);
        return;
      }

      for (const match of data.matches) {
        const wrapper = document.createElement("div");
        wrapper.className = "door-match";

        const title = document.createElement("div");
        title.className = "door-match-title";
        title.textContent = `${match.label.toUpperCase()} · ${match.players.join(", ")}`;
        wrapper.appendChild(title);

        for (const card of match.cards) {
          const line = document.createElement("div");
          line.className = "door-card-line";
          line.textContent = `${card.owner}: ${formatDoorCard(card)}`;
          wrapper.appendChild(line);
        }

        doorResults.appendChild(wrapper);
      }
    }

    function renderDoorChallenge(challenge) {
      const wrapper = document.createElement("div");
      wrapper.className = "door-match";
      wrapper.dataset.challengeId = challenge.id;

      const title = document.createElement("div");
      title.className = "door-match-title";
      title.textContent = `${doorStatusLabel(challenge.status)} · ${challenge.requirement}`;
      wrapper.appendChild(title);

      const participants = document.createElement("div");
      participants.className = "participants-list";

      for (const name of challenge.participants || []) {
        const pill = document.createElement("span");
        pill.className = "participant-pill";
        pill.textContent = name;
        participants.appendChild(pill);
      }

      wrapper.appendChild(participants);

      for (const slot of challenge.slots || []) {
        const line = document.createElement("div");
        line.className = "door-card-line";
        line.textContent = slot.card && slot.owner
          ? `${slot.index + 1}. ${slot.owner}: ${slot.card}`
          : `${slot.index + 1}. Hueco libre`;
        wrapper.appendChild(line);
      }

      if (challenge.status === "pending_validation") {
        const actions = document.createElement("div");
        actions.className = "command-actions";

        const approve = document.createElement("button");
        approve.textContent = "Validar";
        approve.addEventListener("click", () => runAction(async () => {
          const data = await resolveDoor(challenge.id, "approve");
          renderDoorChallenge(data.challenge);
          return data;
        }));

        const reject = document.createElement("button");
        reject.className = "secondary";
        reject.textContent = "Rechazar";
        reject.addEventListener("click", () => runAction(async () => {
          const data = await resolveDoor(challenge.id, "reject");
          renderDoorChallenge(data.challenge);
          return data;
        }));

        actions.append(approve, reject);
        wrapper.appendChild(actions);
      }

      const existing = doorResults.querySelector(`[data-challenge-id="${challenge.id}"]`);
      if (existing) {
        existing.replaceWith(wrapper);
      } else {
        doorResults.prepend(wrapper);
      }
    }

    function renderExchange(exchange) {
      activeExchange = exchange || null;
      exchangeResults.innerHTML = "";

      if (!activeExchange || activeExchange.status !== "active") {
        exchangeStatus.textContent = exchangeStatusText(activeExchange);
        if (activeExchange?.transaction) {
          const line = document.createElement("div");
          line.className = "door-match";
          line.textContent = `${activeExchange.transaction.from} -> ${activeExchange.transaction.to}: ${activeExchange.transaction.card}`;
          exchangeResults.appendChild(line);
        }
        return;
      }

      exchangeStatus.textContent = `Activo: ${activeExchange.participants.join(", ")}`;

      const wrapper = document.createElement("div");
      wrapper.className = "door-match";

      const title = document.createElement("div");
      title.className = "door-match-title";
      title.textContent = "PUESTO ACTIVO";
      wrapper.appendChild(title);

      const declined = activeExchange.declined || [];
      const info = document.createElement("div");
      info.className = "door-card-line";
      info.textContent = declined.length
        ? `Han pasado: ${declined.join(", ")}`
        : "Esperando transacción.";
      wrapper.appendChild(info);

      exchangeResults.appendChild(wrapper);
    }

    function exchangeStatusText(exchange) {
      if (!exchange) return "Sin puesto activo.";
      if (exchange.status === "completed") return "Intercambio completado.";
      if (exchange.status === "declined") return "Todos han pasado.";
      if (exchange.status === "cancelled") return "Puesto cancelado.";
      return "Sin puesto activo.";
    }

    function renderExchangeParticipantOptions() {
      exchangeParticipants.innerHTML = "";

      const options = players.filter((player) => player.active);
      if (options.length === 0) {
        exchangeParticipants.textContent = "No hay participantes disponibles.";
        return;
      }

      for (const player of options) {
        const option = document.createElement("label");
        option.className = "panel-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !player.npc;
        checkbox.dataset.exchangeParticipant = player.nombre;

        const text = document.createElement("span");
        text.textContent = player.npc ? `${player.nombre} (NPC)` : player.nombre;

        option.append(checkbox, text);
        exchangeParticipants.appendChild(option);
      }
    }

    function openExchangeModal() {
      renderExchangeParticipantOptions();
      exchangeModal.classList.add("open");
      exchangeModal.setAttribute("aria-hidden", "false");
    }

    function closeExchangeModal() {
      exchangeModal.classList.remove("open");
      exchangeModal.setAttribute("aria-hidden", "true");
    }

    function doorStatusLabel(status) {
      if (status === "pending_validation") return "PENDIENTE DE EVA";
      if (status === "approved") return "VALIDADA";
      if (status === "rejected") return "RECHAZADA";
      if (status === "cancelled") return "CANCELADA";
      return "PUERTA ACTIVA";
    }

    function formatDoorCard(card) {
      if (!card.jokerAs) {
        return card.valor;
      }

      const rankLabels = { 1: "as", 11: "jota", 12: "reina", 13: "rey" };
      const rank = rankLabels[card.jokerAs.rank] || card.jokerAs.rank;

      return `${card.valor} -> ${rank} de ${card.jokerAs.suit}`;
    }

    function getCardVisual(cartaRaw) {
      const carta = cartaRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

      if (carta === "joker dorado") return { value: "J", suit: "*", label: "Joker dorado", colorClass: "gold" };
      if (carta === "joker") return { value: "J", suit: "", label: "Joker", colorClass: "gold" };

      const match = carta.match(/^(.+?) de (picas|corazones|diamantes|treboles)$/);
      if (!match) return { value: "?", suit: "", label: cartaRaw, colorClass: "" };

      const labels = { as: "A", jota: "J", reina: "Q", rey: "K" };
      const suits = { picas: "P", corazones: "C", diamantes: "D", treboles: "T" };
      const red = match[2] === "corazones" || match[2] === "diamantes";

      return {
        value: labels[match[1]] || match[1],
        suit: suits[match[2]],
        label: match[1],
        colorClass: red ? "red" : "",
      };
    }
