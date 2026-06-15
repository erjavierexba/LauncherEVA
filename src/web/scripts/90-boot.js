    document.getElementById("mediaButton").addEventListener("click", () => runAction(sendMedia));
    document.getElementById("mediaPreviewButton").addEventListener("click", previewSelectedMedia);
    document.getElementById("clearMediaCacheButton").addEventListener("click", clearMediaCache);
    mediaTypeSelect.addEventListener("change", renderMediaCatalog);
    mediaFileSelect.addEventListener("change", renderMediaCatalog);
    document.getElementById("countdownButton").addEventListener("click", () => runAction(startCountdown));
    document.getElementById("countdownCancelButton").addEventListener("click", () => runAction(cancelCountdown));
    document.getElementById("musicSelectPlayButton").addEventListener("click", () => runAction(playMusic));
    document.getElementById("musicResumeButton").addEventListener("click", () => runAction(() => controlMusic("play")));
    document.getElementById("musicPauseButton").addEventListener("click", () => runAction(() => controlMusic("pause")));
    document.getElementById("musicRestartButton").addEventListener("click", () => runAction(() => controlMusic("restart")));
    document.getElementById("musicUpButton").addEventListener("click", () => runAction(() => controlMusic("up")));
    document.getElementById("musicDownButton").addEventListener("click", () => runAction(() => controlMusic("down")));
    document.getElementById("musicStopButton").addEventListener("click", () => runAction(() => controlMusic("stop")));
    document.getElementById("killButton").addEventListener("click", () => runAction(eliminatePlayer));
    document.getElementById("generateNamesButton").addEventListener("click", () => runAction(generateNamesAction));
    nameCategorySelect.addEventListener("change", renderNameSubtypeOptions);
    document.getElementById("createNpcButton").addEventListener("click", () => runAction(createNpc));
    templateSelect.addEventListener("change", renderTemplateEditor);
    document.getElementById("addTemplateFieldButton").addEventListener("click", () => {
      templateFieldsEditor.appendChild(createFieldEditorRow({ sortOrder: templateFieldsEditor.children.length * 10 + 10 }));
    });
    document.getElementById("createTemplateButton").addEventListener("click", () => runAction(createTemplate));
    document.getElementById("duplicateTemplateButton").addEventListener("click", () => runAction(duplicateTemplate));
    document.getElementById("editTemplateJsonButton").addEventListener("click", () => runAction(editTemplateJson));
    document.getElementById("saveTemplateButton").addEventListener("click", () => runAction(saveTemplate));
    document.getElementById("activateTemplateButton").addEventListener("click", () => runAction(activateTemplate));
    document.getElementById("deleteTemplateButton").addEventListener("click", () => runAction(deleteTemplate));
    document.getElementById("closeTemplateJsonButton").addEventListener("click", closeTemplateJsonModal);
    templateBuilderTabButton.addEventListener("click", () => setTemplateBuilderTab("builder"));
    templateJsonTabButton.addEventListener("click", () => setTemplateBuilderTab("json"));
    document.getElementById("builderAddFieldButton").addEventListener("click", () => addBuilderField("text"));
    document.querySelectorAll("[data-builder-preset]").forEach((button) => {
      button.addEventListener("click", () => addBuilderField(button.dataset.builderPreset || "text"));
    });
    document.getElementById("builderAddConstantButton").addEventListener("click", addBuilderConstant);
    document.getElementById("builderAddPageButton").addEventListener("click", addBuilderPage);
    templateJsonKeyInput.addEventListener("input", () => {
      templateKeyEdited = true;
      writeBuilderSchema(currentBuilderSchema());
    });
    templateJsonLabelInput.addEventListener("input", () => {
      syncTemplateKeyFromLabel();
      writeBuilderSchema(currentBuilderSchema());
    });
    templateJsonTextarea.addEventListener("change", () => {
      try {
        renderTemplateBuilder(readTemplateJson());
        setTemplateJsonStatus("JSON aplicado al constructor.");
      } catch (error) {
        setTemplateJsonStatus(error instanceof Error ? error.message : String(error), false);
      }
    });
    document.getElementById("templateJsonFromFieldsButton").addEventListener("click", syncTemplateJsonFromFields);
    document.getElementById("templateJsonToFieldsButton").addEventListener("click", syncTemplateFieldsFromJson);
    document.getElementById("validateTemplateJsonButton").addEventListener("click", validateTemplateJson);
    document.getElementById("saveTemplateJsonButton").addEventListener("click", () => runAction(saveTemplateJson));
    document.getElementById("refreshButton").addEventListener("click", loadStatus);
    document.getElementById("copyClientAddressButton")?.addEventListener("click", async (event) => {
      const text = event.currentTarget.dataset.copyText || "";
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        const input = document.createElement("input");
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setStatus(`Copiado: ${text}`);
    });
    document.getElementById("resetClientButton").addEventListener("click", () => runAction(resetClient));
    document.getElementById("openPlayersButton").addEventListener("click", openPlayersModal);
    document.getElementById("closePlayersButton").addEventListener("click", closePlayersModal);
    document.getElementById("closeCharacterDetailButton").addEventListener("click", closeCharacterDetailModal);
    document.getElementById("deleteCharacterButton").addEventListener("click", openDeleteCharacterModal);
    document.getElementById("cancelDeleteCharacterButton").addEventListener("click", closeDeleteCharacterModal);
    document.getElementById("confirmDeleteCharacterButton").addEventListener("click", confirmDeleteCharacter);
    document.getElementById("closeMediaPreviewButton").addEventListener("click", closeMediaPreviewModal);
    document.getElementById("openSettingsButton").addEventListener("click", openSettingsModal);
    document.getElementById("closeSettingsButton").addEventListener("click", closeSettingsModal);
    document.getElementById("savePanelsButton").addEventListener("click", savePanelVisibility);
    document.getElementById("resetPanelsButton").addEventListener("click", resetPanelVisibility);
    document.getElementById("initiativeAddButton").addEventListener("click", addInitiativeCombatant);
    document.getElementById("initiativeNextButton").addEventListener("click", nextInitiativeTurn);
    document.getElementById("initiativeClearButton").addEventListener("click", clearInitiative);
    submitOnEnter(npcNameInput.closest("section"), () => runAction(createNpc));
    submitOnEnter(mediaTargetSelect.closest("section"), () => runAction(sendMedia));
    submitOnEnter(countdownTargetSelect.closest("section"), () => runAction(startCountdown));
    submitOnEnter(killPlayerSelect.closest("section"), () => runAction(eliminatePlayer));
    submitOnEnter(nameCategorySelect.closest("section"), () => runAction(generateNamesAction));
    submitOnEnter(initiativeNameInput.closest("section"), addInitiativeCombatant);
    viewTabs.forEach((tab) => {
      tab.addEventListener("click", () => setPanelView(tab.dataset.panelFilter));
    });
    function connectEvents() {
      const ws = new WebSocket(window.EVA_WS_URL);

      ws.addEventListener("open", () => {
        setStatus(`Eventos conectados: ${window.EVA_WS_URL}`);
      });

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.tipo === "COUNTDOWN_CANCEL") {
            setStatus("Countdown cancelado.");
          }

          if (data.tipo === "MUESTRA") {
            cacheMediaItem(data.valor, data.destinatario);
            setStatus(data.mensaje || `Archivo guardado: ${data.valor?.nombre || "archivo"}.`);
          }

          if (data.tipo === "DICE_ROLL") {
            setStatus(data.mensaje || "Tirada registrada.");
          }

          if (data.tipo === "TEMPLATE_UPDATE") {
            setStatus(data.mensaje || "Plantilla actualizada.");
            applyTemplateUpdateEvent(data);
            loadTemplates(data.valor?.template?.id || null);
            loadStatus();
          }

          if (data.tipo === "CHARACTER_SHEET_UPDATE") {
            setStatus(data.mensaje || "Ficha actualizada.");
            applyCharacterSheetUpdateEvent(data);
            loadStatus();
          }
        } catch (error) {
          console.warn("Evento websocket inválido", error);
        }
      });

      ws.addEventListener("error", () => {
        setStatus(`No se pudo conectar a eventos: ${window.EVA_WS_URL}`);
      });

      ws.addEventListener("close", () => {
        setStatus("Eventos desconectados. Reintentando...");
        setTimeout(connectEvents, 1500);
      });
    }

    loadPanelVisibility();
    loadInitiativeState();
    readMediaCache();
    loadTemplates();
    loadStatus();
    loadMediaCatalog();
    loadNameGeneratorOptions();
    loadMusicStatus();
    connectEvents();
    setInterval(loadStatus, 5000);
    setInterval(loadMediaCatalog, 10000);
    setInterval(loadMusicStatus, 2000);
