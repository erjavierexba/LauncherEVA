    const BROADCAST = "TODOS";
    const PANEL_STORAGE_KEY = "eva.visiblePanels";
    const PANEL_VIEW_STORAGE_KEY = "eva.activePanelView";
    const INITIATIVE_STORAGE_KEY = "eva.initiativeTracker";
    const MEDIA_CACHE_SESSION_KEY = "eva.mediaCacheSessionId";
    const MEDIA_CACHE_STORAGE_KEY = "eva.mediaCache.items";
    let characters = [];
    let players = [];
    let activeTemplate = null;
    let templates = [];
    let mediaCatalog = [];
    let cachedMediaItems = [];
    let nameGeneratorOptions = {
      personas: [],
      fantasia: [],
    };
    let panelVisibility = {};
    let activePanelView = "all";
    let initiativeState = {
      turnIndex: 0,
      combatants: [],
    };
    let statusHistory = [];
    let activeCharacterDetailName = null;
    let activeCharacterDetailId = null;
    let pendingDeleteCharacter = null;
    let templateJsonMode = "edit";
    let templateJsonSourceId = null;
    let templateBuilderTab = "builder";
    let templatePreviewPageIndex = 0;

    const checksNpcSwitch = document.getElementById("checksNpcSwitch");
    const viewTabs = [...document.querySelectorAll("[data-panel-filter]")];
    const panelSections = [...document.querySelectorAll("[data-panel]")];
    const settingsModal = document.getElementById("settingsModal");
    const panelOptions = document.getElementById("panelOptions");
    const templateSelect = document.getElementById("templateSelect");
    const templateLabelInput = document.getElementById("templateLabelInput");
    const templateFieldsEditor = document.getElementById("templateFieldsEditor");
    const templateJsonModal = document.getElementById("templateJsonModal");
    const templateJsonModalTitle = document.getElementById("templateJsonModalTitle");
    const templateJsonKeyInput = document.getElementById("templateJsonKeyInput");
    const templateJsonLabelInput = document.getElementById("templateJsonLabelInput");
    const templateJsonTextarea = document.getElementById("templateJsonTextarea");
    const templateJsonStatus = document.getElementById("templateJsonStatus");
    const templateBuilderPanel = document.getElementById("templateBuilderPanel");
    const templateJsonPanel = document.getElementById("templateJsonPanel");
    const templateBuilderTabButton = document.getElementById("templateBuilderTabButton");
    const templateJsonTabButton = document.getElementById("templateJsonTabButton");
    const builderFieldsList = document.getElementById("builderFieldsList");
    const builderConstantsList = document.getElementById("builderConstantsList");
    const builderPagesList = document.getElementById("builderPagesList");
    const templatePhonePreview = document.getElementById("templatePhonePreview");
    const npcNameInput = document.getElementById("npcNameInput");
    const npcPlayerSelect = document.getElementById("npcPlayerSelect");
    const npcNotesInput = document.getElementById("npcNotesInput");
    const npcTemplateFields = document.getElementById("npcTemplateFields");
    const mediaTargetSelect = document.getElementById("mediaTargetSelect");
    const mediaTypeSelect = document.getElementById("mediaTypeSelect");
    const mediaFileSelect = document.getElementById("mediaFileSelect");
    const mediaGallery = document.getElementById("mediaGallery");
    const cachedMediaList = document.getElementById("cachedMediaList");
    const countdownTargetSelect = document.getElementById("countdownTargetSelect");
    const countdownSecondsInput = document.getElementById("countdownSecondsInput");
    const countdownLabelInput = document.getElementById("countdownLabelInput");
    const musicTrackSelect = document.getElementById("musicTrackSelect");
    const musicStateLabel = document.getElementById("musicStateLabel");
    const musicCurrentTitle = document.getElementById("musicCurrentTitle");
    const killPlayerSelect = document.getElementById("killPlayerSelect");
    const nameCategorySelect = document.getElementById("nameCategorySelect");
    const nameSubtypeSelect = document.getElementById("nameSubtypeSelect");
    const nameGenderField = document.getElementById("nameGenderField");
    const nameGenderSelect = document.getElementById("nameGenderSelect");
    const nameResults = document.getElementById("nameResults");
    const statusMessage = document.getElementById("statusMessage");
    const statusLog = document.getElementById("statusLog");
    const playerSummary = document.getElementById("playerSummary");
    const playersCards = document.getElementById("playersCards");
    const playersModal = document.getElementById("playersModal");
    const characterDetailModal = document.getElementById("characterDetailModal");
    const characterDetailTitle = document.getElementById("characterDetailTitle");
    const characterDetailBody = document.getElementById("characterDetailBody");
    const deleteCharacterModal = document.getElementById("deleteCharacterModal");
    const deleteCharacterText = document.getElementById("deleteCharacterText");
    const mediaPreviewModal = document.getElementById("mediaPreviewModal");
    const mediaPreviewTitle = document.getElementById("mediaPreviewTitle");
    const mediaPreviewBody = document.getElementById("mediaPreviewBody");
    const initiativeCurrent = document.getElementById("initiativeCurrent");
    const initiativeNote = document.getElementById("initiativeNote");
    const initiativeNameInput = document.getElementById("initiativeNameInput");
    const initiativeScoreInput = document.getElementById("initiativeScoreInput");
    const initiativeHpInput = document.getElementById("initiativeHpInput");
    const initiativeList = document.getElementById("initiativeList");
    function populateSelects() {
      const activePlayers = players.filter((player) => player.active);
      const activeNames = activePlayers.map((player) => player.nombre);

      fillSelect(killPlayerSelect, activeNames, { preserveSelection: true });
      fillSelect(npcPlayerSelect, activePlayers.map((player) => ({ value: player.id, label: player.nombre })), { preserveSelection: true });
      fillSelect(mediaTargetSelect, [BROADCAST, ...activeNames], { preserveSelection: true });
      fillSelect(countdownTargetSelect, [BROADCAST, ...activeNames], { preserveSelection: true });
    }

    function fillSelect(select, values, options = {}) {
      const previousValue = select.value;
      select.innerHTML = "";

      for (const item of values) {
        const value = item && typeof item === "object" ? item.value : item;
        const label = item && typeof item === "object" ? item.label : item;
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      }

      if (
        options.preserveSelection &&
        values.some((item) => String(item && typeof item === "object" ? item.value : item) === previousValue)
      ) {
        select.value = previousValue;
      }
    }

    function submitOnEnter(container, action) {
      container.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }

        const target = event.target;

        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
          return;
        }

        if (target.dataset.noBlockSubmit === "true") {
          return;
        }

        event.preventDefault();
        action();
      });
    }

    function readLocalJson(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function writeLocalJson(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }

    function loadPanelVisibility() {
      const saved = readLocalJson(PANEL_STORAGE_KEY, {});
      activePanelView = localStorage.getItem(PANEL_VIEW_STORAGE_KEY) || "all";
      panelVisibility = {};

      for (const section of panelSections) {
        const key = section.dataset.panel;
        panelVisibility[key] = saved[key] !== false;
      }

      applyPanelVisibility();
      renderPanelViewTabs();
      renderPanelOptions();
    }

    function applyPanelVisibility() {
      for (const section of panelSections) {
        const key = section.dataset.panel;
        const group = section.dataset.panelGroup || "admin";
        const visibleInSettings = panelVisibility[key] !== false;
        const visibleInView = activePanelView === "all" || group === activePanelView || group === "table";
        section.style.display = visibleInSettings && visibleInView ? "" : "none";
      }
    }

    function setPanelView(view) {
      activePanelView = view || "all";
      localStorage.setItem(PANEL_VIEW_STORAGE_KEY, activePanelView);
      renderPanelViewTabs();
      applyPanelVisibility();
    }

    function renderPanelViewTabs() {
      for (const tab of viewTabs) {
        const active = tab.dataset.panelFilter === activePanelView;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", active ? "true" : "false");
      }
    }

    function renderPanelOptions() {
      panelOptions.innerHTML = "";

      for (const section of panelSections) {
        const key = section.dataset.panel;
        const option = document.createElement("label");
        option.className = "panel-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = panelVisibility[key] !== false;
        checkbox.dataset.panelOption = key;

        const text = document.createElement("span");
        text.textContent = section.dataset.panelTitle || key;

        option.appendChild(checkbox);
        option.appendChild(text);
        panelOptions.appendChild(option);
      }
    }

    function savePanelVisibility() {
      panelOptions.querySelectorAll("[data-panel-option]").forEach((checkbox) => {
        panelVisibility[checkbox.dataset.panelOption] = checkbox.checked;
      });
      writeLocalJson(PANEL_STORAGE_KEY, panelVisibility);
      applyPanelVisibility();
      closeSettingsModal();
      setStatus("Configuración de paneles guardada.");
    }

    function resetPanelVisibility() {
      for (const section of panelSections) {
        panelVisibility[section.dataset.panel] = true;
      }
      writeLocalJson(PANEL_STORAGE_KEY, panelVisibility);
      applyPanelVisibility();
      renderPanelOptions();
      setStatus("Todos los paneles están visibles.");
    }

    function openSettingsModal() {
      renderPanelOptions();
      settingsModal.classList.add("open");
      settingsModal.setAttribute("aria-hidden", "false");
    }

    function closeSettingsModal() {
      settingsModal.classList.remove("open");
      settingsModal.setAttribute("aria-hidden", "true");
    }
