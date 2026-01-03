/* ========================================================================== */
/* Acidentes App - Refactored                                                 */
/* - Namespaced localStorage (no cross-app collisions)                        */
/* - Single init on DOMContentLoaded                                          */
/* - Centralized event binding + guards                                       */
/* - Same visible behavior / outputs                                          */
/* ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------ */
  /* Config                                                                   */
  /* ------------------------------------------------------------------------ */
  const APP_NS = 'acidentes:'; // unique storage prefix for this app
  const YEAR_SUFFIX = '2026';  // keep old behavior; set '' to auto from date

  /* ------------------------------------------------------------------------ */
  /* DOM Utils                                                                */
  /* ------------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  const hasEl = (id) => Boolean(byId(id));

  const setText = (id, text) => { const el = byId(id); if (el) el.textContent = text; };

  /* ------------------------------------------------------------------------ */
  /* Storage (namespaced)                                                     */
  /* ------------------------------------------------------------------------ */
  const store = {
    get(key) { return window.localStorage.getItem(APP_NS + key); },
    set(key, v) { window.localStorage.setItem(APP_NS + key, v); },
    remove(key) { window.localStorage.removeItem(APP_NS + key); },
    clearAll() {
      const toDelete = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(APP_NS)) toDelete.push(k);
      }
      toDelete.forEach(k => window.localStorage.removeItem(k));
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Persistence: save/restore inputs & textareas (and selects)               */
  /* ------------------------------------------------------------------------ */
  function restoreField(el) {
    if (!el.id) return;
    const saved = store.get(el.id);
    if (saved === null) return;

    if (el.type === 'checkbox') el.checked = saved === 'true';
    else if (el.type === 'radio') el.checked = saved === 'true';
    else el.value = saved;
  }

  function persistField(el) {
    if (!el.id) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      store.set(el.id, String(el.checked));
    } else {
      store.set(el.id, el.value.trim());
    }
  }

  function wirePersistence(root = document) {
    const fields = $$('input[id], textarea[id], select[id]', root);
    fields.forEach(el => {
      restoreField(el);
      el.addEventListener('input', () => persistField(el));
      el.addEventListener('change', () => persistField(el));
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Mini helpers                                                             */
  /* ------------------------------------------------------------------------ */
  const nonEmpty = (v) => v != null && String(v).trim() !== '';

  function formatPtBrDate(yyyyMmDd) {
    if (!nonEmpty(yyyyMmDd)) return '';
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    if (!y || !m || !d) return '';
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('pt-BR').toUpperCase(); // e.g., 31/12/2025
  }

  function getYearSuffix(yyyyMmDd) {
    if (YEAR_SUFFIX) return YEAR_SUFFIX;
    if (nonEmpty(yyyyMmDd)) {
      const y = Number(yyyyMmDd.slice(0, 4));
      if (y) return String(y);
    }
    return String(new Date().getFullYear());
  }

  /* ------------------------------------------------------------------------ */
  /* UI: live “box-*” mirrors                                                 */
  /* ------------------------------------------------------------------------ */
  const boxFieldMap = {
    coletivo: 'box-coletivo',
    logradouro: 'box-logradouro',
    driverName: 'box-condutor',
    driverCpf: 'box-cpf'
  };

  function updateBoxContent() {
    Object.entries(boxFieldMap).forEach(([inputId, boxId]) => {
      const input = byId(inputId);
      const output = byId(boxId);
      if (!input || !output) return;

      const label = output.id.replace('box-', '');
      output.innerHTML = `<span class="label">${label}:</span> ${input.value}`;
    });
  }

  function wireBoxes() {
    Object.keys(boxFieldMap).forEach((inputId) => {
      const input = byId(inputId);
      if (input) input.addEventListener('input', updateBoxContent);
    });
    updateBoxContent();
  }

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* Keep signatures identical; add guards; toggle .valid/.invalid + errors   */
  /* ------------------------------------------------------------------------ */
  function setValidity(el, isValid, errorEl) {
    if (!el) return;
    el.classList.toggle('invalid', !isValid);
    el.classList.toggle('valid', isValid);
    if (errorEl) errorEl.style.display = isValid ? 'none' : 'inline';
  }

  function validateNoc() {
    const nOc = byId('nOc');
    const nOcError = byId('nOcError');
    if (!nOc) return;
    nOc.value = nOc.value.toUpperCase();
    const ok = /^6A\d{4}$/.test(nOc.value);
    setValidity(nOc, ok, nOcError);
  }

  function validateOcorrencia() {
    const el = byId('ocorrencia');
    const err = byId('ocorrenciaError');
    if (!el) return;
    el.value = el.value.toUpperCase();
    const ok = nonEmpty(el.value);
    setValidity(el, ok, err);
  }

  function validateColetivo() {
    const el = byId('coletivo');
    const err = byId('coletivoError');
    if (!el) return;
    const ok = /^\d{5}( X \d{5})?$/.test(el.value.toUpperCase());
    setValidity(el, ok, err);
  }

  function validateLinha() {
    const el = byId('linha');
    const err = byId('linhaError');
    if (!el) return;
    const ok = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{2}$/.test(el.value);
    setValidity(el, ok, err);
  }

  function validateDate() {
    const el = byId('date');
    const err = byId('dateError');
    if (!el) return;
    const ok = nonEmpty(el.value); // rely on native date input for format
    setValidity(el, ok, err);
  }

  function validateTime() {
    const el = byId('time');
    const err = byId('timeError');
    if (!el) return;
    const ok = /^\d{2}:\d{2}$/.test(el.value);
    setValidity(el, ok, err);
  }

  function validateLogradouro() {
    const el = byId('logradouro');
    const err = byId('logradouroError');
    if (!el) return;
    const ok = nonEmpty(el.value);
    setValidity(el, ok, err);
  }

  function validateNumero() {
    const el = byId('numero');
    const err = byId('numeroError');
    if (!el) return;
    const ok = /^(\d+|-)$/.test(el.value);
    setValidity(el, ok, err);
  }

  function validateBairro() {
    const el = byId('bairro');
    const err = byId('bairroError');
    if (!el) return;
    const ok = nonEmpty(el.value);
    setValidity(el, ok, err);
  }

  function validateInicioFato() {
    const el = byId('inicioFato');
    if (!el) return;
    const ok = nonEmpty(el.value);
    setValidity(el, ok);
  }

  function validateDesfecho() {
    const el = byId('desfecho');
    if (!el) return;
    const ok = nonEmpty(el.value);
    setValidity(el, ok);
  }

  function validateCco() {
    const el = byId('cco');
    const err = byId('ccoError');
    if (!el) return;
    const ok = nonEmpty(el.value);
    setValidity(el, ok, err);
  }

  function validateMatricula() {
    const el = byId('matricula');
    const err = byId('matriculaError');
    if (!el) return;
    const ok = nonEmpty(el.value);
    setValidity(el, ok, err);
  }

  function wireValidators() {
    const map = {
      nOc: validateNoc,
      coletivo: validateColetivo,
      linha: validateLinha,
      date: validateDate,
      time: validateTime,
      numero: validateNumero,
      ocorrencia: validateOcorrencia,
      logradouro: validateLogradouro,
      bairro: validateBairro,
      inicioFato: validateInicioFato,
      desfecho: validateDesfecho,
      cco: validateCco,
      matricula: validateMatricula,
    };
    Object.entries(map).forEach(([id, fn]) => {
      const el = byId(id);
      if (el) el.addEventListener('blur', fn);
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Template loader (Docx)                                                   */
  /* ------------------------------------------------------------------------ */
  async function loadTemplate() {
    const res = await fetch('template.docx');
    if (!res.ok) throw new Error('Failed to load template');
    return res.arrayBuffer();
  }

  /* ------------------------------------------------------------------------ */
  /* Clear UI + storage                                                       */
  /* ------------------------------------------------------------------------ */
  function clearAll() {
    store.clearAll();
    $$('input, textarea, select').forEach(input => {
      if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
      else input.value = '';
    });
    const excel = byId('excel');
    if (excel) excel.classList.add('hidden');
  }

  /* ------------------------------------------------------------------------ */
  /* Modal (notes)                                                            */
  /* ------------------------------------------------------------------------ */
  function wireModal() {
    const modal = byId('modal');
    const notesButton = byId('notes');
    if (!modal || !notesButton) return;

    notesButton.addEventListener('click', () => modal.classList.add('show'));

    modal.addEventListener('click', (evt) => {
      const content = $('.modal-content', modal) || modal;
      if (!content.contains(evt.target)) modal.classList.remove('show');
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Generate Word (Docxtemplater + PizZip)                                   */
  /* ------------------------------------------------------------------------ */
  async function handleGenerateWord() {
    try {
      // Gather + normalize (UPPERCASE where required downstream)
      const nOc = (byId('nOc')?.value || '').toUpperCase();
      const ocorrencia = (byId('ocorrencia')?.value || '').toUpperCase();
      const coletivo = (byId('coletivo')?.value || '').toUpperCase();
      const linha = (byId('linha')?.value || '').toUpperCase();
      const dateRaw = (byId('date')?.value || '');
      const time = (byId('time')?.value || '').toUpperCase();
      const logradouro = (byId('logradouro')?.value || '').toUpperCase();
      let numero = (byId('numero')?.value || '').toUpperCase();
      const bairro = (byId('bairro')?.value || '').toUpperCase();
      const inicioFato = (byId('inicioFato')?.value || '').trim().toUpperCase();
      const desfecho = (byId('desfecho')?.value || '').trim().toUpperCase();
      const driverName = (byId('driverName')?.value || '').toUpperCase();
      const driverCpf = (byId('driverCpf')?.value || '').toUpperCase();
      const driverSituation = (byId('driverSituation')?.value || '').toUpperCase();

      let victimName = (byId('victimName')?.value || '').toUpperCase();
      let victimDocumentation = (byId('victimDocumentation')?.value || '').toUpperCase();
      let victimSituation = (byId('victimSituation')?.value || '').toUpperCase();
      let victimContact = (byId('victimContact')?.value || '').toUpperCase();

      let thirdPartyName = (byId('thirdPartyName')?.value || '').toUpperCase();
      let thirdPartyDocumentation = (byId('thirdPartyDocumentation')?.value || '').toUpperCase();
      let thirdPartyContact = (byId('thirdPartyContact')?.value || '').toUpperCase();

      let witnessName = (byId('witnessName')?.value || '').toUpperCase();
      let witnessDocumentation = (byId('witnessDocumentation')?.value || '').toUpperCase();
      let witnessContact = (byId('witnessContact')?.value || '').toUpperCase();
      let witnessEmail = (byId('witnessEmail')?.value || '').toUpperCase();

      let prat = (byId('prat')?.value || '').toUpperCase();
      let pmvt = (byId('pmvt')?.value || '').toUpperCase();
      let pmvtr = (byId('pmvtr')?.value || '').toUpperCase();
      let bombeirosSamu = (byId('bombeirosSamu')?.value || '').toUpperCase();
      let sptrans = (byId('sptrans')?.value || '').toUpperCase();
      let cet = (byId('cet')?.value || '').toUpperCase();
      let policiaCivil = (byId('policiaCivil')?.value || '').toUpperCase();
      let gcm = (byId('gcm')?.value || '').toUpperCase();
      let bo = (byId('bo')?.value || '').toUpperCase();
      let responsavelBo = (byId('responsavelBo')?.value || '').toUpperCase();
      let pericia = (byId('pericia')?.value || '').toUpperCase();
      let ocSptrans = (byId('ocSptrans')?.value || '').toUpperCase();
      let alerta = (byId('alerta')?.value || '').toUpperCase();

      const cco = (byId('cco')?.value || '').toUpperCase();
      const matricula = (byId('matricula')?.value || '').toUpperCase();
      let operacional = (byId('operacional')?.value || '').toUpperCase();
      let matriculaOp = (byId('matriculaOp')?.value || '').toUpperCase();
      let moto = (byId('moto')?.value || '').toUpperCase();

      // Basic required checks (keep same alerts/messages)
      if (!nOc) return alert('Insira um numero de ocorrência. Ex: 6A1234');
      if (!ocorrencia) return alert('Insira um tipo de ocorrência. Ex: Coletivo X ...');
      if (!coletivo) return alert('Insira um coletivo. Ex: 66123');
      if (!linha) return alert('Insira uma linha. Ex: 6666-66');
      const dateFmt = formatPtBrDate(dateRaw);
      if (!dateFmt) return alert('Insira uma data válida para a ocorrência');
      if (!time) return alert('Insira um horário válido para o momento que ocorreu o incidente');
      if (!logradouro) return alert('Insira um endereço para o ocorrido');
      if (!numero) return alert('Insira um numero para o logradouro');
      if (!bairro) return alert('Insira um bairro para o logradouro');
      if (!inicioFato) return alert('Insira corpo da ocorrência');
      if (!desfecho) return alert('Insira o desfecho da ocorrência');
      if (!driverName) return alert('Insira o nome do condutor');
      if (!driverCpf) return alert('Insira o CPF do condutor');
      if (!driverSituation) return alert('Insira a situação do condutor');
      if (!cco) return alert('Insira o nome do responsável do CCO pela elaboração da ocorrência');
      if (!matricula) return alert('Insira a matricula do responsável do CCO pela elaboração da ocorrência');

      // Defaults "NÃO HOUVE"
      const DH = 'NÃO HOUVE';
      victimName = victimName || DH;
      victimDocumentation = victimDocumentation || DH;
      victimSituation = victimSituation || DH;
      victimContact = victimContact || DH;
      thirdPartyName = thirdPartyName || DH;
      thirdPartyDocumentation = thirdPartyDocumentation || DH;
      thirdPartyContact = thirdPartyContact || DH;
      witnessName = witnessName || DH;
      witnessDocumentation = witnessDocumentation || DH;
      witnessContact = witnessContact || DH;
      witnessEmail = witnessEmail || DH;
      prat = prat || DH;
      pmvt = pmvt || DH;
      pmvtr = pmvtr || DH;
      bombeirosSamu = bombeirosSamu || DH;
      sptrans = sptrans || DH;
      cet = cet || DH;
      policiaCivil = policiaCivil || DH;
      gcm = gcm || DH;
      bo = bo || DH;
      responsavelBo = responsavelBo || DH;
      pericia = pericia || DH;
      ocSptrans = ocSptrans || DH;
      alerta = alerta || DH;
      operacional = operacional || DH;
      matriculaOp = matriculaOp || DH;
      moto = moto || DH;

      // Load template & render
      const content = await loadTemplate();
      const zip = new PizZip(content);
      const doc = new docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      const year = getYearSuffix(dateRaw);

      doc.setData({
        nOc: `${nOc}/${year}`,
        ocorrencia, coletivo, linha,
        date: dateFmt,
        time,
        logradouro, numero, bairro,
        inicioFato, desfecho,
        driverName, driverCpf, driverSituation,
        victimName, victimDocumentation, victimSituation, victimContact,
        thirdPartyName, thirdPartyDocumentation, thirdPartyContact,
        witnessName, witnessDocumentation, witnessContact, witnessEmail,
        prat, pmvt, pmvtr, bombeirosSamu, sptrans, cet, policiaCivil, gcm,
        bo, responsavelBo, pericia, ocSptrans, alerta,
        cco, matricula, operacional, matriculaOp, moto
      });

      doc.render();

      const blob = new Blob(
        [doc.getZip().generate({ type: 'arraybuffer' })],
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      );

      const nomeOcorrencia =
        `${nOc} - ${dateFmt.replace(/\//g, '.').slice(0, 5)} - ${linha} - ${coletivo} - ${ocorrencia} - ${logradouro}`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${nomeOcorrencia}.docx`;
      link.click();

      // Fill preview table (if present)
      setText('td-nOc', `${nOc}/${year}`);
      setText('td-date', dateFmt);
      setText('td-alerta', alerta);
      setText('td-victimName', victimName);
      setText('td-driverName', driverName);
      setText('td-driverCpf', driverCpf);
      setText('td-coletivo', coletivo);
      setText('td-linha', linha);
      setText('td-ocorrencia', ocorrencia);
      setText('td-logradouro', logradouro);
      setText('td-operacional', operacional);
      setText('td-bo', bo);
      setText('td-ocSptrans', ocSptrans);
      setText('td-sptrans', sptrans);
      setText('td-time', time);
      setText('td-cco', cco);
      setText('td-fechamento', cco);

      const excel = byId('excel');
      if (excel) excel.classList.remove('hidden');
    } catch (err) {
      console.error('Error generating document:', err);
      alert('Error generating document: ' + err.message);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Copy first row to clipboard (Excel-friendly)                              */
  /* ------------------------------------------------------------------------ */
  function handleCopyRow() {
    const row = $('#excel tbody tr');
    if (!row) return;

    const text = $$('#excel tbody tr:first-child td')
      .map(td => td.innerText)
      .join('\t');

    navigator.clipboard.writeText(text)
      .then(() => alert('Linha copiada!'))
      .catch(err => console.error('Erro ao copiar:', err));
  }

  /* ------------------------------------------------------------------------ */
  /* Wire buttons                                                              */
  /* ------------------------------------------------------------------------ */
  function wireActions() {
    const clearBtn = byId('clear');
    if (clearBtn) clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearAll();
    });

    const genBtn = byId('generateWord');
    if (genBtn) genBtn.addEventListener('click', handleGenerateWord);

    const copyBtn = byId('copy');
    if (copyBtn) copyBtn.addEventListener('click', handleCopyRow);
  }

  /* ------------------------------------------------------------------------ */
  /* Options panel (Acidentes)                                                */
  /* ------------------------------------------------------------------------ */

  function setValA(id, value) {
    const el = byId(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillOnlyOcorrencia(text) {
    setValA('ocorrencia', text);
  }

  function fillAvariaColetivo() {
    setValA('ocorrencia', 'AVARIA NO COLETIVO');
    setValA('logradouro', 'GARAGEM UNIÃO');
    setValA('numero', '244');
    setValA('bairro', 'JARDIM GUANABARA');

    // driver fields
    setValA('driverName', 'NÃO CABE');
    setValA('driverCpf', '-');
    setValA('driverSituation', '-');

    // body + outcome
    setValA('inicioFato',
      `INSPETOR OPERACIONAL __________ INFORMA, TRATA-SE DE UMA AVARIA ENCONTRADA NO COLETIVO ______, DENTRO DA GARAGEM UNIÃO, COLETIVO FOI ENCONTRADO PELO OPERACIONAL ÀS _________, NO ____________ COM A ______________ DANIFICADA.`);
    setValA('desfecho', 'OPERACIONAL ___________ COMPARECEU AO CCO PARA INFORMAR SOBRE A AVARIA.');
  }

  function fillGeralAcidentes() {
    setValA('inicioFato',
      `INSPETOR OPERACIONAL _____________ RELATA, TRATA-SE DE ______________, ENVOLVENDO O COLETIVO ______________, CONDUZIDO POR ______________________, PORTADOR DO CPF: ___________________, O MESMO RELATA _______________________________.

NA ANÁLISE DAS CÂMERAS, __________________________________________.`);
  }

  function isDisabledOption(selectEl, value) {
    const opt = Array.from(selectEl.options).find(o => o.value === value);
    // Treat unknown or explicitly disabled as unavailable
    return !opt || opt.disabled;
  }


  function applyOptionAcidentes() {
    const sel = byId('opt-action-a');
    if (!sel) return;

    const choice = sel.value;
    if (!choice) return;

    // Don’t act on disabled/placeholder items
    if (isDisabledOption(sel, choice)) {
      sel.value = ''; // reset to placeholder
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // Prep form
    clearAll();

    // Restore user selection after clear
    sel.value = choice;
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    switch (choice) {
      case 'clear-all':
        // already cleared by applyOptionAcidentes() pre-step; nothing else to fill
        break;
      case 'avaria-coletivo':
        fillAvariaColetivo();
        break;
      case 'geral':
        fillGeralAcidentes();
        break;
      default:
        // Unhandled options are considered inactive
        break;
    }
  }


  function wireOptionsPanelAcidentes() {
    const btn = byId('opt-apply-a');
    if (btn) btn.addEventListener('click', applyOptionAcidentes);
  }

  /* ------------------------------------------------------------------------ */
  /* Init                                                                      */
  /* ------------------------------------------------------------------------ */
  function init() {
    wirePersistence();
    wireBoxes();
    wireValidators();
    wireModal();
    wireActions();
    wireOptionsPanelAcidentes();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

