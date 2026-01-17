/* ========================================================================== */
/* Accident Report App - Final Version with Adobe PDF & Custom UI             */
/* ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------------ */
  /* Config & State                                                           */
  /* ------------------------------------------------------------------------ */
  const APP_NS = "acidentes:";
  const YEAR_SUFFIX = "2026";

  const MAX_DOC_WIDTH = 680;
  const MAX_DOC_HEIGHT = 800;

  let attachedImages = [];
  let imageDimensionsCache = {};

  // Variáveis para segurar o documento enquanto o usuário escolhe o formato
  let currentDocBlob = null;
  let currentFileName = "";

  /* ------------------------------------------------------------------------ */
  /* DOM Utilities                                                            */
  /* ------------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);
  const nonEmpty = (v) => v != null && String(v).trim() !== "";

  const setText = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };

  /* ------------------------------------------------------------------------ */
  /* Custom UI Alerts (Substitui alert/confirm nativos)                       */
  /* ------------------------------------------------------------------------ */
  const ui = {
    // Exibe um alerta simples (Botão OK)
    alert: (title, message) => {
      const titleEl = byId("sys-title");
      const msgEl = byId("sys-msg");
      const actions = byId("sys-actions");
      const modal = byId("modal-system");

      if (titleEl) titleEl.innerText = title;
      if (msgEl) msgEl.innerHTML = message.replace(/\n/g, "<br>");

      if (actions) {
        actions.innerHTML = ""; // Limpa botões antigos
        const btn = document.createElement("button");
        btn.className = "button";
        btn.innerHTML = `<span class="shadow"></span><span class="edge"></span><div class="front"><span>OK</span></div>`;
        btn.onclick = () => modal.classList.remove("show");
        actions.appendChild(btn);
      }

      if (modal) modal.classList.add("show");
    },

    // Exibe confirmação (Botões Cancelar / Confirmar)
    confirm: (title, message, onConfirm) => {
      const titleEl = byId("sys-title");
      const msgEl = byId("sys-msg");
      const actions = byId("sys-actions");
      const modal = byId("modal-system");

      if (titleEl) titleEl.innerText = title;
      if (msgEl) msgEl.innerHTML = message.replace(/\n/g, "<br>");

      if (actions) {
        actions.innerHTML = "";

        // Botão Cancelar (Cinza)
        const btnCancel = document.createElement("button");
        btnCancel.className = "button";
        btnCancel.style.flex = "1";
        btnCancel.innerHTML = `<span class="shadow"></span><span class="edge"></span><div class="front" style="background:#777"><span>NÃO</span></div>`;
        btnCancel.onclick = () => modal.classList.remove("show");

        // Botão Confirmar (Amarelo)
        const btnConfirm = document.createElement("button");
        btnConfirm.className = "button";
        btnConfirm.style.flex = "1";
        btnConfirm.innerHTML = `<span class="shadow"></span><span class="edge"></span><div class="front"><span>SIM</span></div>`;
        btnConfirm.onclick = () => {
          modal.classList.remove("show");
          if (onConfirm) onConfirm();
        };

        actions.appendChild(btnCancel);
        actions.appendChild(btnConfirm);
      }

      if (modal) modal.classList.add("show");
    },
  };

  /* ------------------------------------------------------------------------ */
  /* Storage (LocalStorage Wrapper)                                           */
  /* ------------------------------------------------------------------------ */
  const store = {
    get(key) {
      return window.localStorage.getItem(APP_NS + key);
    },
    set(key, v) {
      window.localStorage.setItem(APP_NS + key, v);
    },
    clearAll() {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(APP_NS)) window.localStorage.removeItem(k);
      }
    },
  };

  /* ------------------------------------------------------------------------ */
  /* Image Processing Logic                                                   */
  /* ------------------------------------------------------------------------ */

  function base64DataURLToArrayBuffer(dataURL) {
    const base64Regex = /^data:image\/\w+;base64,/;
    if (!dataURL || !base64Regex.test(dataURL)) return null;

    const stringBase64 = dataURL.replace(base64Regex, "");
    const binaryString = window.atob(stringBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function addImage(base64, width, height) {
    if (imageDimensionsCache[base64]) return; // Avoid duplicates

    attachedImages.push({ src: base64, w: width, h: height });
    imageDimensionsCache[base64] = { w: width, h: height };
    renderGallery();
  }

  function processImageFile(blob) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result;
      const imgTemp = new Image();
      imgTemp.onload = () => {
        addImage(base64, imgTemp.naturalWidth, imgTemp.naturalHeight);
      };
      imgTemp.src = base64;
    };
    reader.readAsDataURL(blob);
  }

  function renderGallery() {
    const container = byId("paste-area");
    if (!container) return;

    // Reset container
    const existingGallery = container.querySelector(".img-preview-container");
    if (existingGallery) existingGallery.remove();

    if (attachedImages.length > 0) {
      const gallery = document.createElement("div");
      gallery.className = "img-preview-container";
      gallery.style.cssText =
        "display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; justify-content: center;";

      attachedImages.forEach((item, index) => {
        const wrap = document.createElement("div");
        wrap.style.cssText = "position: relative; animation: fadeIn 0.3s ease;";

        const img = document.createElement("img");
        img.src = item.src;
        img.style.cssText =
          "height: 100px; border-radius: 4px; border: 1px solid #ccc; box-shadow: 0 2px 5px rgba(0,0,0,0.2); object-fit: cover;";

        const btnRemove = document.createElement("button");
        btnRemove.innerText = "X";
        btnRemove.style.cssText =
          "position: absolute; top: -8px; right: -8px; background: red; color: white; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-weight: bold; font-size: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);";

        btnRemove.onclick = (e) => {
          e.stopPropagation();
          delete imageDimensionsCache[item.src];
          attachedImages.splice(index, 1);
          renderGallery();
        };

        wrap.appendChild(img);
        wrap.appendChild(btnRemove);
        gallery.appendChild(wrap);
      });

      container.appendChild(gallery);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Drag & Drop and Clipboard Handling                                       */
  /* ------------------------------------------------------------------------ */

  async function handlePasteFromClipboard() {
    const container = byId("paste-area");
    const textP = container.querySelector("p");
    const originalText = textP.innerHTML;

    try {
      container.classList.add("loading");
      textP.innerHTML = "Lendo área de transferência...";

      const clipboardItems = await navigator.clipboard.read();

      let found = false;
      for (const item of clipboardItems) {
        const imageTypes = item.types.filter((type) =>
          type.startsWith("image/"),
        );
        for (const type of imageTypes) {
          const blob = await item.getType(type);
          processImageFile(blob);
          found = true;
        }
      }

      if (!found) {
        ui.alert(
          "Aviso",
          "Nenhuma imagem encontrada na área de transferência.",
        );
      }
    } catch (err) {
      console.error("Clipboard access error:", err);
    } finally {
      container.classList.remove("loading");
      textP.innerHTML = originalText;
    }
  }

  function wireDragAndDrop(area) {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      area.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach((eventName) => {
      area.addEventListener(
        eventName,
        () => area.classList.add("dragging"),
        false,
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      area.addEventListener(
        eventName,
        () => area.classList.remove("dragging"),
        false,
      );
    });

    area.addEventListener(
      "drop",
      (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith("image/")) {
              processImageFile(file);
            }
          }
        }
      },
      false,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Polyfills                                                                */
  /* ------------------------------------------------------------------------ */
  if (
    typeof SVGElement !== "undefined" &&
    !SVGElement.prototype.hasOwnProperty("namespaceURI")
  ) {
    Object.defineProperty(SVGElement.prototype, "namespaceURI", {
      get: () => "http://www.w3.org/2000/svg",
      set: () => {},
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Persistence & Validation                                                 */
  /* ------------------------------------------------------------------------ */
  function restoreField(el) {
    if (!el.id) return;
    const val = store.get(el.id);
    if (val !== null)
      el.type === "checkbox" || el.type === "radio"
        ? (el.checked = val === "true")
        : (el.value = val);
  }

  function persistField(el) {
    if (el.id)
      store.set(
        el.id,
        el.type === "checkbox" || el.type === "radio"
          ? String(el.checked)
          : el.value.trim(),
      );
  }

  function wirePersistence() {
    $$("input[id], textarea[id], select[id]").forEach((el) => {
      restoreField(el);
      el.addEventListener("input", () => persistField(el));
      el.addEventListener("change", () => persistField(el));
    });
  }

  const validators = {
    nOc: (el) =>
      setValidity(
        el,
        /^6A\d{4}$/.test(el.value.toUpperCase()),
        byId("nOcError"),
      ),
    coletivo: (el) =>
      setValidity(
        el,
        /^\d{5}( X \d{5})?$/.test(el.value.toUpperCase()),
        byId("coletivoError"),
      ),
    linha: (el) =>
      setValidity(
        el,
        /^[A-Za-z0-9]{4}-[A-Za-z0-9]{2}$/.test(el.value),
        byId("linhaError"),
      ),
    time: (el) =>
      setValidity(el, /^\d{2}:\d{2}$/.test(el.value), byId("timeError")),
    numero: (el) =>
      setValidity(el, /^(\d+|-)$/.test(el.value), byId("numeroError")),
    generic: (el, errId) => setValidity(el, nonEmpty(el.value), byId(errId)),
  };

  function setValidity(el, isValid, errorEl) {
    if (!el) return;
    el.classList.toggle("invalid", !isValid);
    el.classList.toggle("valid", isValid);
    if (errorEl) errorEl.style.display = isValid ? "none" : "inline";
  }

  function wireValidators() {
    const map = {
      nOc: "nOc",
      coletivo: "coletivo",
      linha: "linha",
      time: "time",
      numero: "numero",
    };
    Object.entries(map).forEach(([id, type]) => {
      const el = byId(id);
      if (el)
        el.addEventListener("blur", () => {
          el.value = el.value.toUpperCase();
          validators[type](el);
        });
    });

    ["ocorrencia", "date", "logradouro", "bairro", "cco", "matricula"].forEach(
      (id) => {
        const el = byId(id);
        if (el)
          el.addEventListener("blur", () => {
            el.value = el.value.toUpperCase();
            validators.generic(el, id + "Error");
          });
      },
    );
  }

  function formatPtBrDate(ymd) {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-");
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
  }

  function getYearSuffix(ymd) {
    return ymd ? ymd.split("-")[0] : "2026";
  }

  function wireBoxes() {
    const map = {
      coletivo: "box-coletivo",
      logradouro: "box-logradouro",
      driverName: "box-condutor",
      driverCpf: "box-cpf",
    };
    const update = () =>
      Object.entries(map).forEach(([inp, out]) => {
        if (byId(inp) && byId(out))
          byId(out).innerHTML = `<span class="label">${byId(out).id.replace(
            "box-",
            "",
          )}:</span> ${byId(inp).value}`;
      });
    Object.keys(map).forEach((id) =>
      byId(id)?.addEventListener("input", update),
    );
    update();
  }

  async function loadTemplate() {
    const res = await fetch("template.docx");
    if (!res.ok) throw new Error("Failed to load template");
    return res.arrayBuffer();
  }

  function clearAll() {
    store.clearAll();
    $$("input, textarea, select").forEach((el) => {
      if (el.type === "checkbox") el.checked = false;
      else el.value = "";
    });
    attachedImages = [];
    imageDimensionsCache = {};
    renderGallery();
    byId("excel")?.classList.add("hidden");
  }

  /* ------------------------------------------------------------------------ */
  /* Generate Word & PDF Logic                                                */
  /* ------------------------------------------------------------------------ */

  async function prepareDocument() {
    try {
      const getVal = (id) => (byId(id)?.value || "").toUpperCase().trim();

      // Mandatory fields
      const inputs = {
        nOc: getVal("nOc"),
        ocorrencia: getVal("ocorrencia"),
        coletivo: getVal("coletivo"),
        linha: getVal("linha"),
        dateRaw: byId("date")?.value || "",
        time: getVal("time"),
        logradouro: getVal("logradouro"),
        numero: getVal("numero"),
        bairro: getVal("bairro"),
        inicioFato: getVal("inicioFato"),
        desfecho: getVal("desfecho"),
        driverName: getVal("driverName"),
        driverCpf: getVal("driverCpf"),
        driverSituation: getVal("driverSituation"),
        cco: getVal("cco"),
        matricula: getVal("matricula"),
      };

      // Optional fields defaulting to "NÃO HOUVE"
      const extras = [
        "victimName",
        "victimDocumentation",
        "victimSituation",
        "victimContact",
        "thirdPartyName",
        "thirdPartyDocumentation",
        "thirdPartyContact",
        "witnessName",
        "witnessDocumentation",
        "witnessContact",
        "witnessEmail",
        "prat",
        "pmvt",
        "pmvtr",
        "bombeirosSamu",
        "sptrans",
        "cet",
        "policiaCivil",
        "gcm",
        "bo",
        "responsavelBo",
        "pericia",
        "ocSptrans",
        "alerta",
        "operacional",
        "matriculaOp",
        "moto",
      ];

      const extraData = {};
      extras.forEach((f) => (extraData[f] = getVal(f) || "NÃO HOUVE"));

      // ---------------- VALIDAÇÃO ATUALIZADA ----------------
      const check = (val, msg) => {
        if (!val) {
          ui.alert("Campo Obrigatório", msg);
          return false;
        }
        return true;
      };

      if (
        !check(
          inputs.nOc,
          "Por favor, preencha o <strong>Número da OC</strong>.",
        )
      )
        return;
      if (
        !check(
          inputs.ocorrencia,
          "Preencha a descrição da <strong>Ocorrência</strong>.",
        )
      )
        return;
      if (
        !check(
          inputs.coletivo,
          "Preencha o número do <strong>Coletivo</strong>.",
        )
      )
        return;
      if (!check(inputs.linha, "Preencha a <strong>Linha</strong>.")) return;
      if (!check(inputs.dateRaw, "Selecione uma <strong>Data</strong>."))
        return;
      if (!check(inputs.time, "Preencha a <strong>Hora</strong>.")) return;

      if (
        !check(
          inputs.logradouro,
          "Preencha o <strong>Logradouro</strong> (Endereço).",
        )
      )
        return;
      if (!check(inputs.numero, "Preencha o <strong>Número</strong> (ou S/N)."))
        return;
      if (!check(inputs.bairro, "Preencha o <strong>Bairro</strong>.")) return;

      if (
        !check(
          inputs.driverName,
          "Preencha o <strong>Nome do Motorista</strong>.",
        )
      )
        return;
      if (
        !check(
          inputs.driverCpf,
          "Preencha o <strong>CPF do Motorista</strong>.",
        )
      )
        return;
      if (
        !check(
          inputs.driverSituation,
          "Preencha a <strong>Situação do Motorista</strong>.",
        )
      )
        return;

      if (
        !check(
          inputs.inicioFato,
          "Preencha a descrição do <strong>Início do Fato</strong>.",
        )
      )
        return;
      if (!check(inputs.desfecho, "Preencha o <strong>Desfecho</strong>."))
        return;

      if (!check(inputs.cco, "Preencha o <strong>CCO</strong> responsável."))
        return;
      if (!check(inputs.matricula, "Preencha a <strong>Matrícula</strong>."))
        return;
      // -----------------------------------------------------

      const dateFmt = formatPtBrDate(inputs.dateRaw);
      const year = getYearSuffix(inputs.dateRaw);

      // Image sizing logic (Bounding Box)
      const imageOpts = {
        centered: false,
        getImage: (tagValue) =>
          base64DataURLToArrayBuffer(tagValue) || new ArrayBuffer(0),

        getSize: function (img, tagValue) {
          const dims = imageDimensionsCache[tagValue];
          if (!dims) return [500, 300];

          let { w, h } = dims;

          // Resize down if width exceeds limit
          if (w > MAX_DOC_WIDTH) {
            const ratio = MAX_DOC_WIDTH / w;
            w = MAX_DOC_WIDTH;
            h = h * ratio;
          }
          // Resize down if height exceeds limit (checking aspect ratio integrity)
          if (h > MAX_DOC_HEIGHT) {
            const ratio = MAX_DOC_HEIGHT / h;
            h = MAX_DOC_HEIGHT;
            w = w * ratio;
          }
          return [w, h];
        },
      };

      let imageModule = null;
      if (window.ImageModule) imageModule = new window.ImageModule(imageOpts);

      const content = await loadTemplate();
      const zip = new PizZip(content);
      const doc = new docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: imageModule ? [imageModule] : [],
      });

      const fotosData =
        attachedImages.length > 0
          ? attachedImages.map((img) => ({ imagem: img.src }))
          : [];

      // Render Data
      doc.setData({
        ...inputs,
        ...extraData,
        nOc: `${inputs.nOc}/${year}`,
        date: dateFmt,
        fotos: fotosData,
      });

      doc.render();

      // Gera o Blob na Memória (Global)
      currentDocBlob = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      // Define o Nome do Arquivo (Global)
      currentFileName = `${inputs.nOc} - ${dateFmt
        .replace(/\//g, ".")
        .slice(0, 5)} - ${inputs.linha} - ${inputs.coletivo} - ${
        inputs.ocorrencia
      } - ${inputs.logradouro}`;

      // Update Excel preview
      setText("td-nOc", `${inputs.nOc}/${year}`);
      setText("td-date", dateFmt);
      setText("td-alerta", extraData.alerta);
      setText("td-victimName", extraData.victimName);
      setText("td-driverName", inputs.driverName);
      setText("td-driverCpf", inputs.driverCpf);
      setText("td-coletivo", inputs.coletivo);
      setText("td-linha", inputs.linha);
      setText("td-ocorrencia", inputs.ocorrencia);
      setText("td-logradouro", inputs.logradouro);
      setText("td-operacional", extraData.operacional);
      setText("td-bo", extraData.bo);
      setText("td-ocSptrans", extraData.ocSptrans);
      setText("td-sptrans", extraData.sptrans);
      setText("td-time", inputs.time);
      setText("td-cco", inputs.cco);
      setText("td-fechamento", inputs.cco);

      byId("excel")?.classList.remove("hidden");

      // ABRE O MODAL DE ESCOLHA
      byId("modal-format").classList.add("show");
    } catch (err) {
      console.error(err);
      ui.alert(
        "Erro na Geração",
        err.properties?.errors?.map((e) => e.message).join("\n") || err.message,
      );
    }
  }

  // Helper para download local
  function downloadBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
  }

  // Função que chama a API do Vercel (Adobe)
  async function generateAndDownloadPDF() {
    const msg = byId("pdf-loading-msg");
    if (msg) msg.style.display = "block";

    try {
      // Envia o blob do Word para nossa API
      const response = await fetch("/api/convert-pdf", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        body: currentDocBlob,
      });

      if (!response.ok) throw new Error("Falha na conversão PDF via API");

      const pdfBlob = await response.blob();
      downloadBlob(pdfBlob, currentFileName + ".pdf");
    } catch (e) {
      ui.alert("Erro Adobe PDF", "Erro ao converter: " + e.message);
    } finally {
      if (msg) msg.style.display = "none";
      byId("modal-format").classList.remove("show"); // Fecha modal
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Event Wiring & Actions                                                   */
  /* ------------------------------------------------------------------------ */
  function wireActions() {
    // Botão Limpar com UI Confirm
    byId("clear")?.addEventListener("click", (e) => {
      e.preventDefault();
      ui.confirm(
        "Limpar Formulário",
        "Tem certeza que deseja apagar todos os campos?\nEssa ação não pode ser desfeita.",
        () => {
          clearAll();
        },
      );
    });

    // Gera Word (Abre modal de escolha)
    byId("generateWord")?.addEventListener("click", prepareDocument);

    // Modal Formato - Apenas Word
    byId("btn-word-only")?.addEventListener("click", () => {
      if (currentDocBlob) {
        downloadBlob(currentDocBlob, currentFileName + ".docx");
      }
      byId("modal-format").classList.remove("show");
    });

    // Modal Formato - Word + PDF
    byId("btn-word-pdf")?.addEventListener("click", () => {
      if (currentDocBlob) {
        // Baixa o Word primeiro (garantia)
        downloadBlob(currentDocBlob, currentFileName + ".docx");
        // Depois tenta o PDF
        generateAndDownloadPDF();
      }
    });

    // Fechamento genérico de modais ao clicar fora
    window.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) {
        e.target.classList.remove("show");
      }
    });

    // Botão Copiar Linha
    byId("copy")?.addEventListener("click", () => {
      const row = $("#excel tbody tr");
      if (row)
        navigator.clipboard
          .writeText(row.innerText)
          .then(() =>
            ui.alert("Sucesso", "Linha copiada para a área de transferência!"),
          );
    });

    const pasteArea = byId("paste-area");
    if (pasteArea) {
      pasteArea.addEventListener("click", handlePasteFromClipboard);
      wireDragAndDrop(pasteArea);
      pasteArea.addEventListener("paste", (e) => {
        e.preventDefault();
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
          if (item.kind === "file" && item.type.includes("image/")) {
            processImageFile(item.getAsFile());
          }
        }
      });
    }

    byId("notes")?.addEventListener("click", () =>
      byId("modal").classList.add("show"),
    );

    // Lógica do Painel Lateral (Opções de Preenchimento Rápido)
    const optBtn = byId("opt-apply-a");
    if (optBtn)
      optBtn.addEventListener("click", () => {
        const sel = byId("opt-action-a");
        const val = sel?.value;
        if (!val || val === "clear-all") return;

        const setV = (id, v) => {
          const el = byId(id);
          if (el) {
            el.value = v;
            el.dispatchEvent(new Event("input"));
          }
        };

        clearAll();
        sel.value = val;

        if (val === "avaria-coletivo") {
          setV("ocorrencia", "AVARIA NO COLETIVO");
          setV("logradouro", "GARAGEM UNIÃO");
          setV("numero", "244");
          setV("bairro", "JARDIM GUANABARA");
          setV("driverName", "NÃO CABE");
          setV("driverCpf", "-");
          setV("driverSituation", "-");
          setV(
            "inicioFato",
            `INSPETOR OPERACIONAL __________ INFORMA, TRATA-SE DE UMA AVARIA ENCONTRADA NO COLETIVO ______, DENTRO DA GARAGEM UNIÃO, COLETIVO FOI ENCONTRADO PELO OPERACIONAL ÀS _________, NO ____________ COM A ______________ DANIFICADA.`,
          );
          setV(
            "desfecho",
            "OPERACIONAL ___________ COMPARECEU AO CCO PARA INFORMAR SOBRE A AVARIA.",
          );
        } else if (val === "geral") {
          setV(
            "inicioFato",
            `INSPETOR OPERACIONAL _____________ RELATA, TRATA-SE DE ______________, ENVOLVENDO O COLETIVO ______________, CONDUZIDO POR ______________________, PORTADOR DO CPF: ___________________, O MESMO RELATA _______________________________. \n\nNA ANÁLISE DAS CÂMERAS, __________________________________________.`,
          );
        }
      });

    /* ========================================================================== */
    /* Lógica de E-mail                                                           */
    /* ========================================================================== */

    const RAW_EMAILS = {
      cc: "reinaldooperacional@wolffsp.com,robertooperacional@wolffsp.com,celsooperacional@wolffsp.com,yvanoperacional@wolffsp.com",
      base: "mauricio.oliveira@wolffsp.com,sinistro@wolffsp.com,beatrizsinistro@wolffsp.com,gustavosinistro@wolffsp.com,maianesinistro@wolffsp.com",
      funilaria: "funilariad10@wolffsp.com",
      treinamento: "treinamento1@wolffsp.com",
      estoque: "estoquepecasd10@wolffsp.com",
    };

    const SCENARIOS = {
      "sem-danos": RAW_EMAILS.base,
      "com-danos": `${RAW_EMAILS.base},${RAW_EMAILS.funilaria}`,
      "delicado-sem-danos": `${RAW_EMAILS.base},${RAW_EMAILS.treinamento}`,
      "delicado-com-danos": `${RAW_EMAILS.base},${RAW_EMAILS.treinamento},${RAW_EMAILS.funilaria}`,
      furto: `${RAW_EMAILS.base},${RAW_EMAILS.treinamento},${RAW_EMAILS.funilaria},${RAW_EMAILS.estoque}`,
    };

    // Função auxiliar para gerar o Assunto
    function getFormattedSubject() {
      const getVal = (id) =>
        (document.getElementById(id)?.value || "").toUpperCase().trim();

      const nOc = getVal("nOc");
      const linha = getVal("linha");
      const coletivo = getVal("coletivo");
      const ocorrencia = getVal("ocorrencia");
      const logradouro = getVal("logradouro");
      const dateRaw = document.getElementById("date")?.value || "";

      const dateFmt = formatPtBrDate(dateRaw);
      const dateSubject = dateFmt
        ? dateFmt.replace(/\//g, ".").slice(0, 5)
        : "";

      return `${nOc} - ${dateSubject} - ${linha} - ${coletivo} - ${ocorrencia} - ${logradouro}`;
    }

    // Listeners dos botões de e-mail
    const emailButtons = document.querySelectorAll(".email-trigger");
    emailButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const targetBtn = e.target.closest(".email-trigger");
        const type = targetBtn.getAttribute("data-type");

        const to = SCENARIOS[type];
        const cc = RAW_EMAILS.cc;
        const rawSubject = getFormattedSubject();
        const subject = encodeURIComponent(rawSubject);
        const body = "";

        const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${to}&cc=${cc}&su=${subject}&body=${body}`;
        window.open(url, "_blank");
      });
    });

    /* ========================================================================== */
    /* Lógica da Planilha                                                         */
    /* ========================================================================== */

    const SHEET_CONFIG = {
      id: "1OcIUjqUdEszN1z0GqoqUoFJaDHdriiprTfgG61wApog",
      gid: "666841944",
    };

    function openSpreadsheetRow() {
      const nOcInput = document.getElementById("nOc");
      const rawValue = nOcInput?.value || "";

      const numberPart = rawValue.toUpperCase().replace("6A", "");
      const ocNumber = parseInt(numberPart, 10);

      if (isNaN(ocNumber)) {
        ui.alert("Erro", "Número da OC inválido para cálculo da linha.");
        return;
      }

      const targetRow = ocNumber + 2;
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.id}/edit#gid=${SHEET_CONFIG.gid}&range=B${targetRow}`;

      window.open(url, "_blank");
    }

    // Ligar o botão
    document.getElementById("openSheet")?.addEventListener("click", (e) => {
      e.preventDefault();
      openSpreadsheetRow();
    });
  }

  function init() {
    wirePersistence();
    wireBoxes();
    wireValidators();
    wireActions();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
