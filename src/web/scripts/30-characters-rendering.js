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
        const nameText = document.createElement("span");
        nameText.textContent = `${personaje.playerName || personaje.username} / ${personaje.nombre}`;
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = personaje.notes || personaje.template?.label || "Personaje";
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
      } else if (isFormulaField(field)) {
        value.appendChild(createFormulaRollButton(field, personaje));
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

      if (isFormulaField(field)) {
        return createFormulaRollButton({ ...field, value });
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

    function isFormulaField(field) {
      return field?.type === "formula" || Boolean(field?.config?.formula);
    }

    function createFormulaRollButton(field, personaje = null) {
      const wrapper = document.createElement("div");
      wrapper.className = "formula-roll";
      const output = document.createElement("div");
      output.className = "formula-roll-output";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = "Lanzar";

      const formula = field.config?.formula || field.value || field.defaultValue || "";
      output.textContent = formula || "Sin fórmula";
      button.disabled = !formula;

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        try {
          const result = evaluateSheetFormula(formula, personaje?.sheet?.fields || activeTemplate?.fields || []);
          output.textContent = `${result.total} · ${result.breakdown}`;
          sendDiceRoll(personaje?.playerName || personaje?.username, personaje?.nombre, field, {
            dice: result.diceLabel || "formula",
            natural: result.natural ?? result.total,
            modifier: result.modifier ?? 0,
            total: result.total,
            formula: result.formula,
            breakdown: result.breakdown,
          });
        } catch (error) {
          output.textContent = error instanceof Error ? error.message : String(error);
        }
      });

      wrapper.append(button, output);
      return wrapper;
    }

    function evaluateSheetFormula(rawFormula, fields) {
      const values = Object.fromEntries((fields || []).map((field) => [field.key, field.value ?? field.defaultValue ?? ""]));
      return evaluateFormulaExpression(rawFormula, values);
    }

    function evaluateFormulaExpression(rawFormula, values = {}) {
      const formula = String(rawFormula || "").trim();
      if (!formula) throw new Error("Fórmula vacía.");

      const normalized = formula.replace(/\{([a-zA-Z_][\w-]*)\}/g, "$1").replace(/\*([a-zA-Z_][\w-]*)/g, "$1");
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
        natural: rolls.length === 1 ? rolls[0].total : null,
        modifier: rolls.length === 1 ? total - rolls[0].total : 0,
        diceLabel: rolls.map((roll) => roll.label).join("+"),
        breakdown: rolls.length ? `${formula} · ${rolls.map((roll) => `${roll.label}[${roll.rolls.join(",")}]`).join(" ")}` : formula,
      };
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
          const raw = values[keyMatch[0]];
          const result = valueToFormulaNumber(raw);
          tokens.push(result);
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
          formula: roll.formula,
          breakdown: roll.breakdown,
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
      meta.textContent = `${personaje.playerName || personaje.username} / ${personaje.nombre} · ${personaje.notes || "Sin notas"} · ${personaje.sheet?.template?.label || personaje.template?.label || "Ficha"}`;
      characterDetailBody.appendChild(meta);

      const sheetFields = personaje.sheet?.fields || [];
      if (sheetFields.length > 0) {
        renderCharacterSheetSections(characterDetailBody, personaje);
      } else {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Sin ficha.";
        characterDetailBody.appendChild(empty);
      }

      characterDetailModal.classList.add("open");
      characterDetailModal.setAttribute("aria-hidden", "false");
    }

    function renderCharacterSheetSections(container, personaje, activePageIndex = 0) {
      const pages = characterSheetPages(personaje);
      const selectedIndex = Math.max(0, Math.min(activePageIndex, pages.length - 1));

      if (pages.length > 1) {
        const tabs = document.createElement("div");
        tabs.className = "sheet-page-tabs";
        pages.forEach((page, index) => {
          const tab = document.createElement("button");
          tab.type = "button";
          tab.className = index === selectedIndex ? "secondary active" : "secondary";
          tab.textContent = page.label || page.key || `Página ${index + 1}`;
          tab.addEventListener("click", () => {
            container.querySelectorAll(".sheet-page-tabs, .sheet-sections").forEach((node) => node.remove());
            renderCharacterSheetSections(container, personaje, index);
          });
          tabs.appendChild(tab);
        });
        container.appendChild(tabs);
      }

      const sectionsNode = document.createElement("div");
      sectionsNode.className = "sheet-sections";
      const fieldsByKey = new Map((personaje.sheet?.fields || []).map((field) => [field.key, field]));

      for (const section of pages[selectedIndex].sections) {
        const sectionNode = document.createElement("section");
        sectionNode.className = "sheet-section";
        const title = document.createElement("h3");
        title.textContent = section.label || section.key || "Sección";
        sectionNode.appendChild(title);

        const grid = document.createElement("div");
        grid.className = "stat-grid";
        for (const key of section.fields || []) {
          const field = fieldsByKey.get(key);
          if (field) grid.appendChild(createStatBlock(field, personaje));
        }
        sectionNode.appendChild(grid);
        sectionsNode.appendChild(sectionNode);
      }

      container.appendChild(sectionsNode);
    }

    function characterSheetPages(personaje) {
      const fields = personaje.sheet?.fields || [];
      const schemaPages = Array.isArray(personaje.sheet?.template?.schema?.pages) ? personaje.sheet.template.schema.pages : [];
      const fieldKeys = new Set(fields.map((field) => field.key));
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
      const looseFields = fields.map((field) => field.key).filter((key) => !usedKeys.has(key));
      if (looseFields.length) {
        pages.push({ key: "otros", label: "Otros", sections: [{ key: "otros", label: "Otros", fields: looseFields }] });
      }

      return pages.length ? pages : [{ key: "main", label: "Ficha", sections: [{ key: "main", label: "Ficha", fields: fields.map((field) => field.key) }] }];
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
        await loadStatus();
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
