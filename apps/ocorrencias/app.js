/* ========================================================================== */
/* Ocorrências App - Refactored                                               */
/* - Namespaced localStorage (no cross-app collisions)                        */
/* - Single init on DOMContentLoaded                                          */
/* - Centralized validation + event binding                                   */
/* - Same visible behavior / outputs                                          */
/* ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------ */
  /* Config                                                                   */
  /* ------------------------------------------------------------------------ */
  const APP_NS = 'ocorrencias:'; // unique prefix for this app
  const YEAR_SUFFIX = '2025';     // keep old behavior; set '' to auto from date

  /* ------------------------------------------------------------------------ */
  /* DOM utils                                                                */
  /* ------------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);
  const setText = (id, text) => { const el = byId(id); if (el) el.textContent = text; };
  const nonEmpty = (v) => v != null && String(v).trim() !== '';

  /* ------------------------------------------------------------------------ */
  /* Storage (namespaced)                                                     */
  /* ------------------------------------------------------------------------ */
  const store = {
    get(k) { return window.localStorage.getItem(APP_NS + k); },
    set(k, v) { window.localStorage.setItem(APP_NS + k, v); },
    remove(k) { window.localStorage.removeItem(APP_NS + k); },
    clearAll() {
      const toDel = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(APP_NS)) toDel.push(k);
      }
      toDel.forEach(k => window.localStorage.removeItem(k));
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Persistence: inputs / textareas / selects                                */
  /* ------------------------------------------------------------------------ */
  function restoreField(el) {
    if (!el.id) return;
    const saved = store.get(el.id);
    if (saved === null) return;

    if (el.type === 'checkbox' || el.type === 'radio') el.checked = saved === 'true';
    else el.value = saved;
  }

  function persistField(el) {
    if (!el.id) return;
    if (el.type === 'checkbox' || el.type === 'radio') store.set(el.id, String(el.checked));
    else store.set(el.id, el.value.trim());
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
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */
  function setValidity(el, ok, errEl) {
    if (!el) return;
    el.classList.toggle('invalid', !ok);
    el.classList.toggle('valid', ok);
    if (errEl) errEl.style.display = ok ? 'none' : 'inline';
  }

  function validateNoc() {
    const nOc = byId('nOc');
    const nOcError = byId('nOcError');
    if (!nOc) return;
    nOc.value = nOc.value.toUpperCase();
    const ok = /^6C\d{4}$/.test(nOc.value);
    setValidity(nOc, ok, nOcError);
  }

  function validateDate() {
    const el = byId('date');
    const err = byId('dateError');
    if (!el) return;
    const ok = nonEmpty(el.value); // rely on native date input
    setValidity(el, ok, err);
  }

  function validateOcorrencia() {
    const el = byId('ocorrencia');
    const err = byId('ocorrenciaError');
    if (!el) return;
    el.value = el.value.toUpperCase();
    const ok = nonEmpty(el.value);
    setValidity(el, ok, err);
  }

  function wireValidators() {
    const map = {
      nOc: validateNoc,
      ocorrencia: validateOcorrencia,
      date: validateDate,
    };
    Object.entries(map).forEach(([id, fn]) => {
      const el = byId(id);
      if (el) el.addEventListener('blur', fn);
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Modal (notes)                                                            */
  /* ------------------------------------------------------------------------ */
  function wireModal() {
    const modal = byId('modal');
    const notesBtn = byId('notes');
    if (!modal || !notesBtn) return;

    notesBtn.addEventListener('click', () => modal.classList.add('show'));
    modal.addEventListener('click', (evt) => {
      const content = $('.modal-content', modal) || modal;
      if (!content.contains(evt.target)) modal.classList.remove('show');
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Date helpers                                                             */
  /* ------------------------------------------------------------------------ */
  function formatPtBrDate(yyyyMmDd) {
    if (!nonEmpty(yyyyMmDd)) return '';
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    if (!y || !m || !d) return '';
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('pt-BR').toUpperCase();
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
  /* Template loader                                                          */
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
  /* Generate Word (Docxtemplater + PizZip)                                   */
  /* ------------------------------------------------------------------------ */
  async function handleGenerateWord() {
    try {
      const nOc = (byId('nOc')?.value || '').toUpperCase();
      const ocorrencia = (byId('ocorrencia')?.value || '').toUpperCase();
      const dateRaw = (byId('date')?.value || '');
      const inicio = (byId('inicio')?.value || '');
      let termino = (byId('termino')?.value || '');
      const logradouro = (byId('logradouro')?.value || '').toUpperCase();
      let numero = (byId('numero')?.value || '').toUpperCase();
      const bairro = (byId('bairro')?.value || '').toUpperCase();
      const inicioFato = (byId('inicioFato')?.value || '').trim().toUpperCase();
      let motivo = (byId('motivo')?.value || '').trim().toUpperCase();
      let respObra = (byId('respObra')?.value || '').trim().toUpperCase();
      let desviosbc = (byId('desviosbc')?.value || '').trim().toUpperCase();
      let desvioscb = (byId('desvioscb')?.value || '').trim().toUpperCase();
      let linhasAfetadas = (byId('linhasAfetadas')?.value || '').trim().toUpperCase();
      let alerta = (byId('alerta')?.value || '').toUpperCase();
      let linha = (byId('linha')?.value || '').toUpperCase();
      let ocSptrans = (byId('ocSptrans')?.value || '').toUpperCase();
      let contato = (byId('contato')?.value || '').toUpperCase();
      const cco = (byId('cco')?.value || '').toUpperCase();
      let operacional = (byId('operacional')?.value || '').toUpperCase();

      // Required checks (same messages as original)
      if (!nOc) return alert('Insira um numero de ocorrência. Ex: 6C1234');
      if (!ocorrencia) return alert('Insira um tipo de ocorrência. Ex: Instabilidade Sistema SIM...');
      const dateFmt = formatPtBrDate(dateRaw);
      if (!dateFmt) return alert('Insira uma data válida para a ocorrência');
      if (!inicio) return alert('Insira o horário no qual a interferência se iniciou');
      if (!logradouro) return alert('Insira um endereço para o ocorrido');
      if (!numero) return alert('Insira um numero para o logradouro');
      if (!bairro) return alert('Insira um bairro para o logradouro');
      if (!inicioFato) return alert('Insira corpo da ocorrência');
      if (!cco) return alert('Insira o nome do responsável do CCO pela elaboração da ocorrência');

      // Defaults as per original logic
      if (!linha) linha = 'NÃO HOUVE';
      if (!termino) termino = '-';
      if (!motivo) motivo = 'NÃO CABE';
      if (!respObra) respObra = 'NÃO CABE';
      if (!desviosbc) desviosbc = 'NÃO HOUVE';
      if (!desvioscb) desvioscb = 'NÃO HOUVE';
      if (!linhasAfetadas) linhasAfetadas = 'NÃO HOUVE';
      if (!ocSptrans) ocSptrans = 'NÃO HOUVE';
      if (!contato) contato = 'NÃO HOUVE';
      if (!alerta) alerta = 'NÃO HOUVE';
      if (!operacional) operacional = 'NÃO HOUVE';

      // Load template & render
      const content = await loadTemplate();
      const zip = new PizZip(content);
      const doc = new docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      const year = getYearSuffix(dateRaw);

      doc.setData({
        nOc: `${nOc}/${year}`,
        ocorrencia,
        date: dateFmt,
        inicio, termino,
        logradouro, numero, bairro,
        inicioFato, motivo, respObra,
        desviosbc, desvioscb, linhasAfetadas,
        alerta, linha, ocSptrans, contato,
        cco, operacional,
      });

      doc.render();

      const blob = new Blob(
        [doc.getZip().generate({ type: 'arraybuffer' })],
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      );

      const nomeOcorrencia =
        `${nOc} - ${dateFmt.replace(/\//g, '.').slice(0, 5)}${linha !== 'NÃO HOUVE' ? ' - ' + linha : ''} - ${ocorrencia} - ${logradouro}`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${nomeOcorrencia}.docx`;
      link.click();

      // Preview table
      setText('td-nOc', `${nOc}/${year}`);
      setText('td-date', dateFmt);
      setText('td-alerta', alerta);
      setText('td-ocorrencia', ocorrencia);
      setText('td-logradouro', logradouro);
      setText('td-operacional', operacional);
      setText('td-ocSptrans', ocSptrans);
      setText('td-contato', contato);
      setText('td-termino', termino);
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
  /* Wire buttons / actions                                                   */
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
  /* Init                                                                     */
  /* ------------------------------------------------------------------------ */
  function init() {
    wirePersistence();
    wireValidators();
    wireModal();
    wireActions();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
