    async function loadTemplates(selectedId = null) {
      try {
        const response = await fetch("/api/templates");
        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.mensaje || "No se pudieron cargar las plantillas.");
        }

        templates = Array.isArray(data.templates) ? data.templates : [];
        renderTemplateSelect(selectedId);
        setStatus(templates.length ? `${templates.length} plantilla(s) cargada(s).` : "No hay plantillas guardadas.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }

    function renderTemplateSelect(selectedId = null) {
      const previous = selectedId ?? templateSelect.value;
      templateSelect.innerHTML = "";

      for (const template of templates) {
        const option = document.createElement("option");
        option.value = String(template.id);
        option.textContent = `${template.active ? "✓ " : ""}${template.label}`;
        templateSelect.appendChild(option);
      }

      if ([...templateSelect.options].some((option) => option.value === String(previous))) {
        templateSelect.value = String(previous);
      } else if (templateSelect.options.length) {
        templateSelect.selectedIndex = 0;
      }

      renderTemplateEditor();
    }

    function selectedTemplate() {
      return templates.find((template) => String(template.id) === templateSelect.value) || templates[0] || null;
    }

    function renderTemplateEditor() {
      const template = selectedTemplate();
      templateFieldsEditor.innerHTML = "";
      templateLabelInput.value = template?.label || "";

      if (!template) {
        return;
      }

      const fields = Array.isArray(template.fields) ? template.fields : [];

      for (const field of fields) {
        try {
          templateFieldsEditor.appendChild(createFieldEditorRow(field));
        } catch (error) {
          console.error("No se pudo pintar el campo de plantilla", field, error);
        }
      }

      if (!fields.length) {
        templateFieldsEditor.appendChild(createTemplateEmptyState(template));
      }
    }

    function createTemplateEmptyState(template) {
      const empty = document.createElement("div");
      empty.className = "template-empty-state";
      empty.textContent = `${template.label || "Esta plantilla"} no tiene campos rápidos. Pulsa Diseñar para revisar el JSON o Añadir campo para crear uno.`;
      return empty;
    }

    function createFieldEditorRow(field = {}) {
      const row = document.createElement("div");
      row.className = "field-editor";

      const key = labeledInput("Clave", field.key || "");
      const label = labeledInput("Etiqueta", field.label || "");
      const type = labeledSelect(
        "Tipo",
        ["text", "int", "b_int", "formula", "throw", "cycle", "array", "d4_throw_int", "d6_throw_int", "d8_throw_int", "d10_throw_int", "d12_throw_int", "d20_throw_int"],
        field.type || "text"
      );
      const defaultValue = labeledInput("Default", field.defaultValue || "");
      const group = labeledInput("Grupo", field.group || "");
      const arrayItems = labeledInput("Items", formatArrayConfig(field.config));
      arrayItems.input.placeholder = "nombre:text,nivel:int,tirada:throw";
      const favorite = document.createElement("label");
      favorite.className = "switch-row";
      favorite.innerHTML = `<input type="checkbox" ${field.favorite ? "checked" : ""} /><span>Fav</span>`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "×";
      remove.addEventListener("click", () => row.remove());

      row.appendChild(key.wrapper);
      row.appendChild(label.wrapper);
      row.appendChild(type.wrapper);
      row.appendChild(defaultValue.wrapper);
      row.appendChild(group.wrapper);
      row.appendChild(arrayItems.wrapper);
      row.appendChild(favorite);
      row.appendChild(remove);

      row.dataset.sortOrder = field.sortOrder || "";

      return row;
    }

    function labeledInput(labelText, value) {
      const wrapper = document.createElement("div");
      const label = document.createElement("label");
      const input = document.createElement("input");
      label.textContent = labelText;
      input.value = value;
      wrapper.appendChild(label);
      wrapper.appendChild(input);

      return { wrapper, input };
    }

    function labeledSelect(labelText, values, selected) {
      const wrapper = document.createElement("div");
      const label = document.createElement("label");
      const select = document.createElement("select");
      label.textContent = labelText;

      for (const value of values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }

      if (selected && !values.includes(selected)) {
        const option = document.createElement("option");
        option.value = selected;
        option.textContent = selected;
        select.appendChild(option);
      }

      select.value = selected;
      wrapper.appendChild(label);
      wrapper.appendChild(select);

      return { wrapper, select };
    }

    function labeledTextarea(labelText, value, placeholder = "") {
      const wrapper = document.createElement("div");
      const label = document.createElement("label");
      const textarea = document.createElement("textarea");
      label.textContent = labelText;
      textarea.value = value;
      textarea.placeholder = placeholder;
      textarea.rows = 2;
      wrapper.appendChild(label);
      wrapper.appendChild(textarea);

      return { wrapper, textarea };
    }

    function schemaFieldTypes() {
      return ["text", "number", "roll", "formula", "cycle", "array"];
    }

    function fieldTypeLabel(type) {
      return {
        text: "Texto",
        number: "Número",
        roll: "Tirada",
        formula: "Fórmula",
        cycle: "Ciclo",
        array: "Lista",
      }[type] || type;
    }

    function normalizeBuilderSchema(schema) {
      const next = schema && typeof schema === "object" && !Array.isArray(schema)
        ? JSON.parse(JSON.stringify(schema))
        : defaultSystemSchema("nuevo_sistema", "Nuevo sistema");

      next.id = next.id || templateJsonKeyInput.value || "nuevo_sistema";
      next.name = next.name || templateJsonLabelInput.value || "Nuevo sistema";
      next.version = next.version || 1;
      next.constants = next.constants && typeof next.constants === "object" && !Array.isArray(next.constants)
        ? next.constants
        : {};
      next.fields = Array.isArray(next.fields) ? next.fields.filter((field) => field && typeof field === "object") : [];
      next.pages = Array.isArray(next.pages) ? next.pages.filter((page) => page && typeof page === "object") : [];

      if (next.pages.length === 0) {
        next.pages.push({ key: "main", label: "Principal", sections: [] });
      }

      for (const page of next.pages) {
        page.key = page.key || templateKeyFromLabel(page.label || "pagina");
        page.label = page.label || page.key;
        page.sections = Array.isArray(page.sections) ? page.sections.filter((section) => section && typeof section === "object") : [];
      }

      return next;
    }

    function currentBuilderSchema() {
      try {
        return normalizeBuilderSchema(JSON.parse(templateJsonTextarea.value || "{}"));
      } catch (error) {
        return normalizeBuilderSchema(defaultSystemSchema(
          templateJsonKeyInput.value || "nuevo_sistema",
          templateJsonLabelInput.value || "Nuevo sistema"
        ));
      }
    }

    function writeBuilderSchema(schema, options = {}) {
      const next = normalizeBuilderSchema(schema);
      next.id = templateJsonKeyInput.value || next.id;
      next.name = templateJsonLabelInput.value || next.name;
      templateJsonTextarea.value = formatJson(next);
      if (!options.skipRender) {
        renderTemplateBuilder(next);
      } else {
        renderTemplatePreview(next);
      }
      setTemplateJsonStatus(`${next.fields.length} campos · ${next.pages.length} páginas · ${Object.keys(next.constants || {}).length} constantes.`);
    }

    function updateSchemaFromBuilder(mutator) {
      const schema = currentBuilderSchema();
      mutator(schema);
      writeBuilderSchema(schema);
    }

    function setTemplateBuilderTab(tab) {
      templateBuilderTab = tab;
      const showBuilder = tab === "builder";
      templateBuilderPanel.hidden = !showBuilder;
      templateJsonPanel.hidden = showBuilder;
      templateBuilderTabButton.classList.toggle("secondary", !showBuilder);
      templateJsonTabButton.classList.toggle("secondary", showBuilder);

      if (showBuilder) {
        renderTemplateBuilder(currentBuilderSchema());
      } else {
        validateTemplateJson();
      }
    }

    function addBuilderInputListener(control, applyValue) {
      control.dataset.noBlockSubmit = "true";
      control.addEventListener("change", () => {
        updateSchemaFromBuilder((schema) => applyValue(schema, control.value, control));
      });
    }

    function renderTemplateBuilder(schema = currentBuilderSchema()) {
      const normalized = normalizeBuilderSchema(schema);
      renderBuilderFields(normalized);
      renderBuilderConstants(normalized);
      renderBuilderPages(normalized);
      renderTemplatePreview(normalized);
    }

    function renderBuilderFields(schema) {
      builderFieldsList.innerHTML = "";

      if (schema.fields.length === 0) {
        const empty = document.createElement("div");
        empty.className = "builder-empty";
        empty.textContent = "Añade campos para que aparezcan en secciones y fichas.";
        builderFieldsList.appendChild(empty);
      }

      schema.fields.forEach((field, index) => {
        const panel = document.createElement("div");
        panel.className = "builder-panel";
        const title = document.createElement("div");
        title.className = "builder-panel-title";
        title.textContent = field.label || field.key || `Campo ${index + 1}`;
        const actions = document.createElement("div");
        actions.className = "builder-panel-actions";
        const up = builderIconButton("↑", "Subir", () => moveSchemaItem("fields", index, -1));
        const down = builderIconButton("↓", "Bajar", () => moveSchemaItem("fields", index, 1));
        const remove = builderIconButton("×", "Eliminar campo", () => removeSchemaField(index));
        remove.className = "danger";
        actions.append(up, down, remove);
        title.appendChild(actions);

        const grid = document.createElement("div");
        grid.className = "builder-mini-grid";
        const key = labeledInput("Clave", field.key || "");
        const label = labeledInput("Etiqueta", field.label || "");
        const type = labeledSelect("Tipo", schemaFieldTypes(), field.type || "text");
        [...type.select.options].forEach((option) => {
          option.textContent = fieldTypeLabel(option.value);
        });
        const defaultValue = labeledInput("Default", field.default ?? "");
        const formula = labeledInput("Fórmula", field.formula || "");
        const display = labeledSelect("Vista", ["", "stepper", "counter", "list"], field.display || "");
        const options = labeledInput("Opciones/constante", field.options || "");

        const favorite = document.createElement("label");
        favorite.className = "switch-row";
        favorite.innerHTML = `<input type="checkbox" ${field.favorite ? "checked" : ""} /><span>Favorito</span>`;
        favorite.querySelector("input").addEventListener("change", (event) => {
          updateSchemaFromBuilder((next) => {
            next.fields[index].favorite = event.target.checked;
          });
        });

        const editable = document.createElement("label");
        editable.className = "switch-row";
        editable.innerHTML = `<input type="checkbox" ${field.editable !== false ? "checked" : ""} /><span>Editable</span>`;
        editable.querySelector("input").addEventListener("change", (event) => {
          updateSchemaFromBuilder((next) => {
            next.fields[index].editable = event.target.checked;
          });
        });

        addBuilderInputListener(key.input, (next, value) => {
          const oldKey = next.fields[index].key;
          const newKey = templateKeyFromLabel(value || `campo_${index + 1}`);
          next.fields[index].key = newKey;
          replaceFieldKeyInPages(next, oldKey, newKey);
        });
        addBuilderInputListener(label.input, (next, value) => {
          next.fields[index].label = value || next.fields[index].key;
        });
        type.select.addEventListener("change", () => {
          updateSchemaFromBuilder((next) => {
            next.fields[index].type = type.select.value;
            if (type.select.value === "array" && !next.fields[index].itemTemplate) {
              next.fields[index].display = "list";
              next.fields[index].itemTemplate = {
                fields: [{ key: "name", label: "Nombre", type: "text", default: "" }],
              };
            }
          });
        });
        addBuilderInputListener(defaultValue.input, (next, value) => {
          next.fields[index].default = parseJsonishValue(value);
        });
        addBuilderInputListener(formula.input, (next, value) => {
          if (value) {
            next.fields[index].formula = value;
          } else {
            delete next.fields[index].formula;
          }
        });
        display.select.addEventListener("change", () => {
          updateSchemaFromBuilder((next) => {
            if (display.select.value) {
              next.fields[index].display = display.select.value;
            } else {
              delete next.fields[index].display;
            }
          });
        });
        addBuilderInputListener(options.input, (next, value) => {
          if (value) {
            next.fields[index].options = value;
          } else {
            delete next.fields[index].options;
          }
        });

        grid.append(key.wrapper, label.wrapper, type.wrapper, defaultValue.wrapper, display.wrapper, options.wrapper, formula.wrapper, favorite, editable);

        panel.append(title, grid);
        if ((field.type || "") === "array") {
          panel.appendChild(createArrayTemplateBuilder(field, index));
        }
        builderFieldsList.appendChild(panel);
      });
    }

    function createArrayTemplateBuilder(field, fieldIndex) {
      const wrapper = document.createElement("div");
      wrapper.className = "builder-panel compact-panel";
      const header = document.createElement("div");
      header.className = "builder-panel-title";
      header.textContent = "Campos de cada elemento";
      const add = document.createElement("button");
      add.type = "button";
      add.className = "compact secondary";
      add.textContent = "Añadir";
      add.addEventListener("click", () => {
        updateSchemaFromBuilder((schema) => {
          const fields = schema.fields[fieldIndex].itemTemplate?.fields || [];
          schema.fields[fieldIndex].itemTemplate = { fields };
          fields.push({ key: `item_${fields.length + 1}`, label: `Item ${fields.length + 1}`, type: "text", default: "" });
        });
      });
      header.appendChild(add);
      wrapper.appendChild(header);

      const itemFields = field.itemTemplate?.fields || [];
      itemFields.forEach((itemField, itemIndex) => {
        const row = document.createElement("div");
        row.className = "builder-mini-grid";
        const key = labeledInput("Clave", itemField.key || "");
        const label = labeledInput("Etiqueta", itemField.label || "");
        const type = labeledSelect("Tipo", ["text", "number", "roll"], itemField.type || "text");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "danger";
        remove.textContent = "×";
        addBuilderInputListener(key.input, (schema, value) => {
          schema.fields[fieldIndex].itemTemplate.fields[itemIndex].key = templateKeyFromLabel(value || `item_${itemIndex + 1}`);
        });
        addBuilderInputListener(label.input, (schema, value) => {
          schema.fields[fieldIndex].itemTemplate.fields[itemIndex].label = value || schema.fields[fieldIndex].itemTemplate.fields[itemIndex].key;
        });
        type.select.addEventListener("change", () => {
          updateSchemaFromBuilder((schema) => {
            schema.fields[fieldIndex].itemTemplate.fields[itemIndex].type = type.select.value;
          });
        });
        remove.addEventListener("click", () => {
          updateSchemaFromBuilder((schema) => {
            schema.fields[fieldIndex].itemTemplate.fields.splice(itemIndex, 1);
          });
        });
        row.append(key.wrapper, label.wrapper, type.wrapper, remove);
        wrapper.appendChild(row);
      });

      return wrapper;
    }

    function renderBuilderConstants(schema) {
      builderConstantsList.innerHTML = "";
      const entries = Object.entries(flattenConstants(schema.constants || {}));

      if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "builder-empty";
        empty.textContent = "Las constantes sirven para tablas, opciones y fórmulas.";
        builderConstantsList.appendChild(empty);
      }

      entries.forEach(([path, value], index) => {
        const panel = document.createElement("div");
        panel.className = "builder-panel compact-panel";
        const grid = document.createElement("div");
        grid.className = "builder-mini-grid";
        const key = labeledInput("Ruta", path);
        const val = labeledInput("Valor JSON", formatConstantValue(value));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "danger";
        remove.textContent = "×";
        addBuilderInputListener(key.input, (next, newPath) => {
          const constants = flattenConstants(next.constants || {});
          delete constants[path];
          constants[newPath || `constante_${index + 1}`] = value;
          next.constants = unflattenConstants(constants);
        });
        addBuilderInputListener(val.input, (next, raw) => {
          const constants = flattenConstants(next.constants || {});
          constants[path] = parseJsonishValue(raw);
          next.constants = unflattenConstants(constants);
        });
        remove.addEventListener("click", () => {
          updateSchemaFromBuilder((next) => {
            const constants = flattenConstants(next.constants || {});
            delete constants[path];
            next.constants = unflattenConstants(constants);
          });
        });
        grid.append(key.wrapper, val.wrapper, remove);
        panel.appendChild(grid);
        builderConstantsList.appendChild(panel);
      });
    }

    function renderBuilderPages(schema) {
      builderPagesList.innerHTML = "";
      const fields = schema.fields || [];

      schema.pages.forEach((page, pageIndex) => {
        const panel = document.createElement("div");
        panel.className = "builder-panel";
        const title = document.createElement("div");
        title.className = "builder-panel-title";
        title.textContent = page.label || `Página ${pageIndex + 1}`;
        const actions = document.createElement("div");
        actions.className = "builder-panel-actions";
        actions.append(
          builderIconButton("+", "Añadir sección", () => addSectionToPage(pageIndex)),
          builderIconButton("↑", "Subir", () => moveSchemaItem("pages", pageIndex, -1)),
          builderIconButton("↓", "Bajar", () => moveSchemaItem("pages", pageIndex, 1))
        );
        const remove = builderIconButton("×", "Eliminar página", () => removeSchemaPage(pageIndex));
        remove.className = "danger";
        actions.appendChild(remove);
        title.appendChild(actions);

        const grid = document.createElement("div");
        grid.className = "builder-mini-grid";
        const key = labeledInput("Clave", page.key || "");
        const label = labeledInput("Etiqueta", page.label || "");
        addBuilderInputListener(key.input, (next, value) => {
          next.pages[pageIndex].key = templateKeyFromLabel(value || `pagina_${pageIndex + 1}`);
        });
        addBuilderInputListener(label.input, (next, value) => {
          next.pages[pageIndex].label = value || next.pages[pageIndex].key;
        });
        grid.append(key.wrapper, label.wrapper);

        panel.append(title, grid);
        (page.sections || []).forEach((section, sectionIndex) => {
          panel.appendChild(createSectionBuilder(section, pageIndex, sectionIndex, fields));
        });
        builderPagesList.appendChild(panel);
      });
    }

    function createSectionBuilder(section, pageIndex, sectionIndex, fields) {
      const panel = document.createElement("div");
      panel.className = "builder-panel compact-panel";
      const title = document.createElement("div");
      title.className = "builder-panel-title";
      title.textContent = section.label || `Sección ${sectionIndex + 1}`;
      const actions = document.createElement("div");
      actions.className = "builder-panel-actions";
      const remove = builderIconButton("×", "Eliminar sección", () => {
        updateSchemaFromBuilder((schema) => {
          schema.pages[pageIndex].sections.splice(sectionIndex, 1);
        });
      });
      remove.className = "danger";
      actions.appendChild(remove);
      title.appendChild(actions);

      const grid = document.createElement("div");
      grid.className = "builder-mini-grid";
      const key = labeledInput("Clave", section.key || "");
      const label = labeledInput("Etiqueta", section.label || "");
      addBuilderInputListener(key.input, (schema, value) => {
        schema.pages[pageIndex].sections[sectionIndex].key = templateKeyFromLabel(value || `seccion_${sectionIndex + 1}`);
      });
      addBuilderInputListener(label.input, (schema, value) => {
        schema.pages[pageIndex].sections[sectionIndex].label = value || schema.pages[pageIndex].sections[sectionIndex].key;
      });
      grid.append(key.wrapper, label.wrapper);

      const picker = document.createElement("div");
      picker.className = "section-fields-picker";
      for (const field of fields) {
        const chip = document.createElement("label");
        chip.className = "field-chip";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = (section.fields || []).includes(field.key);
        checkbox.addEventListener("change", () => {
          updateSchemaFromBuilder((schema) => {
            const sectionFields = schema.pages[pageIndex].sections[sectionIndex].fields || [];
            if (checkbox.checked && !sectionFields.includes(field.key)) {
              sectionFields.push(field.key);
            } else if (!checkbox.checked) {
              const position = sectionFields.indexOf(field.key);
              if (position >= 0) sectionFields.splice(position, 1);
            }
            schema.pages[pageIndex].sections[sectionIndex].fields = sectionFields;
          });
        });
        const text = document.createElement("span");
        text.textContent = field.label || field.key;
        chip.append(checkbox, text);
        picker.appendChild(chip);
      }

      panel.append(title, grid, picker);
      return panel;
    }

    function builderIconButton(text, title, onClick) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = text;
      button.title = title;
      button.addEventListener("click", onClick);
      return button;
    }

    function addBuilderField() {
      updateSchemaFromBuilder((schema) => {
        const key = `campo_${schema.fields.length + 1}`;
        schema.fields.push({
          key,
          label: `Campo ${schema.fields.length + 1}`,
          type: "text",
          default: "",
          editable: true,
        });
        if (schema.pages[0]?.sections?.[0]) {
          schema.pages[0].sections[0].fields = schema.pages[0].sections[0].fields || [];
          schema.pages[0].sections[0].fields.push(key);
        }
      });
    }

    function addBuilderConstant() {
      updateSchemaFromBuilder((schema) => {
        const constants = flattenConstants(schema.constants || {});
        constants[`constante_${Object.keys(constants).length + 1}`] = "";
        schema.constants = unflattenConstants(constants);
      });
    }

    function addBuilderPage() {
      updateSchemaFromBuilder((schema) => {
        const pageIndex = schema.pages.length + 1;
        schema.pages.push({
          key: `pagina_${pageIndex}`,
          label: `Página ${pageIndex}`,
          sections: [],
        });
      });
    }

    function addSectionToPage(pageIndex) {
      updateSchemaFromBuilder((schema) => {
        const sections = schema.pages[pageIndex].sections || [];
        schema.pages[pageIndex].sections = sections;
        sections.push({
          key: `seccion_${sections.length + 1}`,
          label: `Sección ${sections.length + 1}`,
          fields: [],
        });
      });
    }

    function moveSchemaItem(collection, index, delta) {
      updateSchemaFromBuilder((schema) => {
        const list = schema[collection] || [];
        const nextIndex = index + delta;
        if (nextIndex < 0 || nextIndex >= list.length) return;
        const [item] = list.splice(index, 1);
        list.splice(nextIndex, 0, item);
      });
    }

    function removeSchemaField(index) {
      updateSchemaFromBuilder((schema) => {
        const [field] = schema.fields.splice(index, 1);
        if (!field) return;
        for (const page of schema.pages || []) {
          for (const section of page.sections || []) {
            section.fields = (section.fields || []).filter((key) => key !== field.key);
          }
        }
      });
    }

    function removeSchemaPage(index) {
      updateSchemaFromBuilder((schema) => {
        if (schema.pages.length <= 1) {
          schema.pages[0] = { key: "main", label: "Principal", sections: [] };
          return;
        }
        schema.pages.splice(index, 1);
      });
    }

    function replaceFieldKeyInPages(schema, oldKey, newKey) {
      if (!oldKey || !newKey || oldKey === newKey) return;
      for (const page of schema.pages || []) {
        for (const section of page.sections || []) {
          section.fields = (section.fields || []).map((fieldKey) => fieldKey === oldKey ? newKey : fieldKey);
        }
      }
    }

    function flattenConstants(value, prefix = "", result = {}) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        if (prefix) result[prefix] = value;
        return result;
      }

      for (const [key, innerValue] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (innerValue && typeof innerValue === "object" && !Array.isArray(innerValue)) {
          flattenConstants(innerValue, path, result);
        } else {
          result[path] = innerValue;
        }
      }

      return result;
    }

    function unflattenConstants(entries) {
      const result = {};
      for (const [path, value] of Object.entries(entries)) {
        const parts = String(path || "").split(".").map((part) => templateKeyFromLabel(part)).filter(Boolean);
        if (parts.length === 0) continue;
        let cursor = result;
        parts.forEach((part, index) => {
          if (index === parts.length - 1) {
            cursor[part] = value;
          } else {
            cursor[part] = cursor[part] && typeof cursor[part] === "object" && !Array.isArray(cursor[part])
              ? cursor[part]
              : {};
            cursor = cursor[part];
          }
        });
      }
      return result;
    }

    function parseJsonishValue(raw) {
      const text = String(raw ?? "").trim();
      if (!text) return "";
      try {
        return JSON.parse(text);
      } catch (error) {
        return raw;
      }
    }

    function formatConstantValue(value) {
      return typeof value === "string" ? value : JSON.stringify(value);
    }

    function renderTemplatePreview(schema, pageIndex = templatePreviewPageIndex) {
      templatePhonePreview.innerHTML = "";
      const fieldsByKey = new Map((schema.fields || []).map((field) => [field.key, field]));
      const pages = schema.pages || [];
      templatePreviewPageIndex = Math.max(0, Math.min(pageIndex, Math.max(0, pages.length - 1)));
      const title = document.createElement("div");
      title.className = "preview-template-title";
      title.textContent = templateJsonLabelInput.value || schema.name || "Nueva plantilla";
      templatePhonePreview.appendChild(title);

      const tabs = document.createElement("div");
      tabs.className = "preview-tabs";
      pages.forEach((page, index) => {
        const tab = document.createElement("div");
        tab.className = `preview-tab${index === templatePreviewPageIndex ? " active" : ""}`;
        tab.role = "button";
        tab.tabIndex = 0;
        tab.textContent = page.label || page.key || `Página ${index + 1}`;
        tab.addEventListener("click", () => renderTemplatePreview(schema, index));
        tab.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            renderTemplatePreview(schema, index);
          }
        });
        tabs.appendChild(tab);
      });
      templatePhonePreview.appendChild(tabs);

      const page = pages[templatePreviewPageIndex];
      if (!page) {
        const empty = document.createElement("div");
        empty.className = "builder-empty";
        empty.textContent = "Sin páginas.";
        templatePhonePreview.appendChild(empty);
        return;
      }

      for (const section of page.sections || []) {
        const sectionNode = document.createElement("div");
        sectionNode.className = "preview-section";
        const sectionTitle = document.createElement("div");
        sectionTitle.className = "preview-section-title";
        sectionTitle.textContent = section.label || section.key || "Sección";
        sectionNode.appendChild(sectionTitle);

        for (const fieldKey of section.fields || []) {
          const field = fieldsByKey.get(fieldKey);
          if (!field) continue;
          const row = document.createElement("div");
          row.className = "preview-field";
          const label = document.createElement("div");
          label.className = "preview-field-label";
          label.textContent = field.label || field.key;
          const value = document.createElement("div");
          value.className = "preview-field-value";
          value.textContent = previewFieldValue(field);
          row.append(label, value);
          sectionNode.appendChild(row);
        }

        templatePhonePreview.appendChild(sectionNode);
      }
    }

    function previewFieldValue(field) {
      if (field.type === "array") {
        return "Lista";
      }
      if (field.type === "roll") {
        return field.formula || "1d20";
      }
      if (field.type === "cycle") {
        return field.default || field.options || "Opción";
      }
      if (field.formula) {
        return "=";
      }
      return field.default ?? "—";
    }

    function readTemplateFieldsEditor() {
      return [...templateFieldsEditor.querySelectorAll(".field-editor")].map((row, index) => {
        const inputs = row.querySelectorAll("input");
        const select = row.querySelector("select");
        const config = parseArrayConfig(inputs[4].value);
        if (select.value === "formula") {
          config.formula = inputs[2].value;
        }

        return {
          key: inputs[0].value,
          label: inputs[1].value,
          type: select.value,
          defaultValue: inputs[2].value,
          group: inputs[3].value,
          config,
          favorite: inputs[5].checked,
          sortOrder: (index + 1) * 10,
        };
      });
    }

    function formatArrayConfig(config = {}) {
      return (config.itemFields || [])
        .map((field) => `${field.key}:${field.type || "text"}`)
        .join(",");
    }

    function parseArrayConfig(raw) {
      const itemFields = String(raw || "")
        .split(",")
        .map((part, index) => {
          const [keyRaw, typeRaw] = part.trim().split(":");
          const key = (keyRaw || "").trim();
          const type = (typeRaw || "text").trim();

          if (!key) return null;

          return {
            key,
            label: key.replace(/_/g, " "),
            type,
            defaultValue: "",
            sortOrder: (index + 1) * 10,
          };
        })
        .filter(Boolean);

      return { itemFields };
    }

    function templateKeyFromLabel(label) {
      return String(label || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "nueva_plantilla";
    }

    function defaultSystemSchema(key = "nuevo_sistema", label = "Nuevo sistema") {
      return {
        id: key,
        name: label,
        version: 1,
        constants: {
          proficiency: {
            untrained: 0,
            trained: 2,
            expert: 4,
            master: 6,
            legendary: 8,
          },
        },
        fields: [
          {
            key: "level",
            label: "Nivel",
            type: "number",
            default: 1,
            editable: true,
            display: "stepper",
          },
        ],
        pages: [
          {
            key: "main",
            label: "Principal",
            sections: [
              {
                key: "identity",
                label: "Identidad",
                fields: ["level"],
              },
            ],
          },
        ],
      };
    }

    function schemaFromTemplateFields(key, label, fields) {
      const schemaFields = fields.map((field) => {
        const type = field.type === "int" || field.type === "b_int" ? "number" : field.type;
        const schemaField = {
          key: field.key,
          label: field.label,
          type,
          default: field.defaultValue,
          editable: true,
        };

        if (field.type === "b_int") {
          schemaField.display = "counter";
        }

        if (field.type === "array") {
          schemaField.display = "list";
          schemaField.itemTemplate = {
            fields: (field.config?.itemFields || []).map((itemField) => ({
              key: itemField.key,
              label: itemField.label,
              type: itemField.type === "int" || itemField.type === "b_int" ? "number" : itemField.type,
              default: itemField.defaultValue || "",
            })),
          };
        }

        if (field.type === "cycle") {
          schemaField.type = "cycle";
          schemaField.options = field.defaultValue || "";
        }

        if (field.type === "throw" || /^d[1-9]\d*_throw_int$/.test(field.type || "")) {
          schemaField.type = "roll";
          schemaField.formula = field.defaultValue || "1d20";
        }

        if (field.type === "formula") {
          schemaField.type = "formula";
          schemaField.formula = field.config?.formula || field.defaultValue || "";
          schemaField.default = field.defaultValue || "";
        }

        return schemaField;
      });

      const groups = new Map();
      for (const field of fields) {
        const group = field.group || "General";
        if (!groups.has(group)) {
          groups.set(group, []);
        }
        groups.get(group).push(field.key);
      }

      return {
        id: key,
        name: label,
        version: 1,
        constants: {},
        fields: schemaFields,
        pages: [
          {
            key: "main",
            label: "Principal",
            sections: [...groups.entries()].map(([group, fieldKeys]) => ({
              key: templateKeyFromLabel(group),
              label: group,
              fields: fieldKeys,
            })),
          },
        ],
      };
    }

    function compatibilityFieldsFromSchema(schema) {
      const fields = Array.isArray(schema?.fields) ? schema.fields : [];

      return fields.map((field, index) => {
        let type = "text";
        if (field.type === "number") {
          type = field.display === "counter" ? "b_int" : "int";
        } else if (field.type === "formula") {
          type = "formula";
        } else if (field.type === "array") {
          type = "array";
        } else if (field.type === "roll") {
          type = "throw";
        } else if (field.type === "cycle") {
          type = "cycle";
        }

        const firstSection = (schema.pages || [])
          .flatMap((page) => page.sections || [])
          .find((section) => (section.fields || []).includes(field.key));

        const itemFields = field.itemTemplate?.fields || field.config?.itemFields || [];

        return {
          key: field.key || `field_${index + 1}`,
          label: field.label || field.key || `Campo ${index + 1}`,
          type,
          defaultValue: field.type === "cycle" ? (field.options || field.default || "") : (field.default ?? field.value ?? ""),
          group: firstSection?.label || "",
          favorite: Boolean(field.favorite),
          config: {
            itemFields: itemFields.map((itemField, itemIndex) => ({
              key: itemField.key || `item_${itemIndex + 1}`,
              label: itemField.label || itemField.key || `Item ${itemIndex + 1}`,
              type: itemField.type === "number" ? "int" : itemField.type || "text",
              defaultValue: itemField.default ?? itemField.value ?? "",
              sortOrder: (itemIndex + 1) * 10,
            })),
            formula: field.formula || "",
          },
          sortOrder: (index + 1) * 10,
        };
      });
    }

    function formatJson(value) {
      return JSON.stringify(value, null, 2);
    }

    function readTemplateJson() {
      try {
        const schema = JSON.parse(templateJsonTextarea.value || "{}");
        if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
          throw new Error("El schema debe ser un objeto JSON.");
        }
        if (!Array.isArray(schema.fields)) {
          throw new Error("El schema necesita un array fields.");
        }
        if (!Array.isArray(schema.pages)) {
          throw new Error("El schema necesita un array pages.");
        }
        schema.id = templateJsonKeyInput.value || schema.id;
        schema.name = templateJsonLabelInput.value || schema.name;
        return schema;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : String(error));
      }
    }

    function setTemplateJsonStatus(message, ok = true) {
      templateJsonStatus.textContent = message;
      templateJsonStatus.classList.toggle("ok", ok);
      templateJsonStatus.classList.toggle("error", !ok);
    }

    function openTemplateJsonModal(mode) {
      const template = selectedTemplate();
      templateJsonMode = mode;
      templateJsonSourceId = template?.id || null;
      templateJsonKeyInput.disabled = mode === "edit";
      templateJsonStatus.textContent = "";
      templateJsonStatus.className = "schema-status";

      if (mode === "create") {
        const label = "Nueva plantilla";
        const key = templateKeyFromLabel(label);
        templateJsonModalTitle.textContent = "Crear plantilla";
        templateJsonKeyInput.value = key;
        templateJsonLabelInput.value = label;
        templateJsonTextarea.value = formatJson(defaultSystemSchema(key, label));
      } else if (mode === "duplicate" && template) {
        const label = `${template.label} copia`;
        const key = templateKeyFromLabel(`${template.key || template.label}_copia`);
        templateJsonModalTitle.textContent = "Duplicar plantilla";
        templateJsonKeyInput.value = key;
        templateJsonLabelInput.value = label;
        templateJsonTextarea.value = formatJson(template.schema || defaultSystemSchema(key, label));
      } else if (template) {
        const key = template.key || templateKeyFromLabel(template.label);
        templateJsonModalTitle.textContent = "Editar plantilla";
        templateJsonKeyInput.value = key;
        templateJsonLabelInput.value = templateLabelInput.value || template.label;
        templateJsonTextarea.value = formatJson(template.schema || schemaFromTemplateFields(key, template.label, template.fields || []));
      } else {
        return;
      }

      templateJsonModal.classList.add("open");
      templateJsonModal.setAttribute("aria-hidden", "false");
      setTemplateBuilderTab("builder");
      writeBuilderSchema(currentBuilderSchema());
      templateJsonLabelInput.focus();
    }

    function closeTemplateJsonModal() {
      templateJsonModal.classList.remove("open");
      templateJsonModal.setAttribute("aria-hidden", "true");
    }

    function fillTemplateFieldsFromSchema(schema) {
      templateFieldsEditor.innerHTML = "";
      for (const field of compatibilityFieldsFromSchema(schema)) {
        templateFieldsEditor.appendChild(createFieldEditorRow(field));
      }
    }

    function syncTemplateJsonFromFields() {
      const key = templateJsonKeyInput.value || selectedTemplate()?.key || "sistema";
      const label = templateJsonLabelInput.value || templateLabelInput.value || "Sistema";
      const schema = schemaFromTemplateFields(key, label, readTemplateFieldsEditor());
      templateJsonTextarea.value = formatJson(schema);
      renderTemplateBuilder(schema);
      setTemplateJsonStatus("JSON regenerado desde los campos visibles.");
    }

    function syncTemplateFieldsFromJson() {
      try {
        const schema = readTemplateJson();
        fillTemplateFieldsFromSchema(schema);
        renderTemplateBuilder(schema);
        setTemplateJsonStatus("Campos rápidos actualizados desde el JSON.");
      } catch (error) {
        setTemplateJsonStatus(error instanceof Error ? error.message : String(error), false);
      }
    }

    function validateTemplateJson() {
      try {
        const schema = readTemplateJson();
        templateJsonTextarea.value = formatJson(schema);
        renderTemplateBuilder(schema);
        setTemplateJsonStatus(`${schema.fields.length} campos · ${schema.pages.length} páginas.`);
      } catch (error) {
        setTemplateJsonStatus(error instanceof Error ? error.message : String(error), false);
      }
    }

    async function saveTemplateJson() {
      const schema = readTemplateJson();
      const key = templateJsonKeyInput.value;
      const label = templateJsonLabelInput.value;
      const fields = compatibilityFieldsFromSchema(schema);
      let data;

      if (templateJsonMode === "create") {
        data = await api("/api/templates", { key, label, schema });
      } else if (templateJsonMode === "duplicate") {
        data = await api(`/api/templates/${templateJsonSourceId}/duplicate`, { key, label, schema });
      } else {
        const template = selectedTemplate();
        if (!template) return { ok: false, mensaje: "No hay plantilla seleccionada." };
        const response = await fetch(`/api/templates/${template.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, fields, schema }),
        });
        data = await response.json();

        if (!response.ok || data.ok === false) {
          throw new Error(data.mensaje || `HTTP ${response.status}`);
        }
      }

      if (templateJsonMode !== "edit" && data.template?.id) {
        const response = await fetch(`/api/templates/${data.template.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, fields, schema }),
        });
        const updated = await response.json();

        if (!response.ok || updated.ok === false) {
          throw new Error(updated.mensaje || `HTTP ${response.status}`);
        }

        data = updated;
      }

      closeTemplateJsonModal();
      await loadTemplates(data.template?.id || templateJsonSourceId);
      await loadStatus();

      return { ok: true, mensaje: "Plantilla JSON guardada." };
    }

    async function createTemplate() {
      openTemplateJsonModal("create");
      return { ok: true, mensaje: "Editor de plantilla abierto." };
    }

    async function duplicateTemplate() {
      if (!selectedTemplate()) return { ok: false, mensaje: "No hay plantilla seleccionada." };
      openTemplateJsonModal("duplicate");
      return { ok: true, mensaje: "Duplicador abierto." };
    }

    async function editTemplateJson() {
      if (!selectedTemplate()) return { ok: false, mensaje: "No hay plantilla seleccionada." };
      openTemplateJsonModal("edit");
      return { ok: true, mensaje: "Editor JSON abierto." };
    }

    async function saveTemplate() {
      const template = selectedTemplate();
      if (!template) return { ok: false, mensaje: "No hay plantilla seleccionada." };

      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: templateLabelInput.value,
          fields: readTemplateFieldsEditor(),
          schema: template.schema || {},
        }),
      });
      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.mensaje || `HTTP ${response.status}`);
      }

      await loadTemplates(template.id);
      await loadStatus();

      return { ok: true, mensaje: "Plantilla guardada." };
    }

    async function activateTemplate() {
      const template = selectedTemplate();
      if (!template) return { ok: false, mensaje: "No hay plantilla seleccionada." };

      const data = await api(`/api/templates/${template.id}/activate`);
      await loadTemplates(data.template?.id || template.id);
      await loadStatus();

      return { ok: true, mensaje: `${data.template?.label || "Plantilla"} activada.` };
    }

    async function deleteTemplate() {
      const template = selectedTemplate();
      if (!template) return { ok: false, mensaje: "No hay plantilla seleccionada." };

      if (!window.confirm(`Eliminar ${template.label}?`)) {
        return { ok: true, mensaje: "Eliminación cancelada." };
      }

      const response = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.mensaje || `HTTP ${response.status}`);
      }

      await loadTemplates();
      await loadStatus();

      return { ok: true, mensaje: "Plantilla eliminada." };
    }
