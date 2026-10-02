/* Personal study tools. Stored locally, without modifying course content. */
(() => {
  'use strict';
  const key = 'gpu-course-study-v1';
  const modules = [...document.querySelectorAll('.mod')];
  let store = {version: 1, lessons: {}};
  let storageWorks = true;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && saved.version === 1 && saved.lessons && typeof saved.lessons === 'object') store = saved;
  } catch { storageWorks = false; }
  const make = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const index = document.querySelector('.idx');
  const indexToggle = make('button', 'course-index-toggle'); indexToggle.type = 'button';
  index.prepend(indexToggle); index.dataset.mobileOpen = 'false';
  const updateIndex = () => {
    const position = modules.findIndex(module => !module.hidden) + 1;
    const expanded = index.dataset.mobileOpen === 'true';
    indexToggle.textContent = 'Lecciones · ' + String(position).padStart(2, '0') + ' de 43 ' + (expanded ? '−' : '+');
    indexToggle.setAttribute('aria-expanded', String(expanded));
  };
  indexToggle.addEventListener('click', () => { index.dataset.mobileOpen = index.dataset.mobileOpen === 'true' ? 'false' : 'true'; index.scrollTop = 0; updateIndex(); });
  updateIndex();
  const data = id => {
    const lesson = store.lessons[id];
    if (!lesson || !Array.isArray(lesson.highlights) || typeof lesson.note !== 'string') store.lessons[id] = {note: '', highlights: []};
    return store.lessons[id];
  };
  const active = () => modules.find(module => !module.hidden);
  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(store)); storageWorks = true; return true; }
    catch { storageWorks = false; return false; }
  };
  const tools = make('div', 'reading-tools');
  tools.setAttribute('aria-label', 'Herramientas de lectura');
  const highlight = make('button', '', 'Resaltar selección');
  highlight.type = 'button';
  const colorLabel = make('label', '', 'Color');
  const color = make('select');
  color.setAttribute('aria-label', 'Color del resaltado');
  [['yellow', 'Amarillo'], ['green', 'Verde'], ['blue', 'Azul']].forEach(([value, text]) => {
    const option = make('option', '', text); option.value = value; color.append(option);
  });
  colorLabel.append(color);
  const notesButton = make('button', '', 'Mis notas'); notesButton.type = 'button';
  const download = make('button', 'study-download', 'Exportar apuntes'); download.type = 'button';
  const theme = make('button', 'theme-toggle', 'Modo oscuro'); theme.type = 'button';
  const status = make('span', 'reading-status', 'Selecciona una frase para resaltarla. Tus apuntes se guardan en este navegador.');
  status.setAttribute('role', 'status');
  tools.append(highlight, colorLabel, notesButton, download, theme, status);
  document.querySelector('main').prepend(tools);
  let chosenTheme = 'light';
  try { chosenTheme = localStorage.getItem('gpu-course-theme') || 'light'; } catch {}
  function setTheme(value) {
    document.documentElement.dataset.theme = value;
    theme.textContent = value === 'light' ? 'Modo oscuro' : 'Modo claro';
    theme.setAttribute('aria-pressed', String(value === 'dark'));
  }
  setTheme(chosenTheme === 'dark' ? 'dark' : 'light');
  theme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('gpu-course-theme', next); } catch { status.textContent = 'El tema cambió, pero este navegador no permite guardarlo.'; }
  });

  const lessonStates = new Map();
  const activitySelector = '.calc,.pack,.race,.mig,.srvx,.fail,.stackx,.trip,.tabsx,.stepper,.flips,.cklist,.gpick,.tco';
  modules.forEach(module => {
    const body = module.querySelector(':scope > .body');
    const intro = body.querySelector('.lesson-explainer');
    const paragraphs = [...intro.querySelectorAll(':scope > p')];
    intro.querySelector('h3').textContent = 'La idea en tres pasos';
    paragraphs.forEach((paragraph, i) => {
      const text = paragraph.textContent;
      const firstSentence = text.match(/^.*?[.!?](?:\s|$)/);
      const preview = firstSentence ? firstSentence[0].trim() : text;
      const remainder = text.slice(preview.length).trim();
      const step = make('details', 'reading-step');
      if (i === 0) step.open = true;
      const summary = make('summary');
      const number = make('span', 'step-number', String(i + 1)); number.setAttribute('aria-hidden', 'true');
      const caption = make('span', 'step-preview');
      caption.append(make('b', '', ['La idea', 'Cómo entenderla', 'Llévalo a la práctica'][i]), make('span', '', preview));
      summary.append(number, caption);
      step.append(summary);
      paragraph.replaceWith(step);
      if (remainder) { paragraph.textContent = remainder; step.append(paragraph); }
    });
    // The content is divided into reading, practice and quiz, with no information discarded.
    const tabs = make('div', 'lesson-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Secciones de la lección');
    const panes = ['Entender', 'Explorar', 'Comprobar'].map((label, index) => {
      const pane = make('div', 'lesson-pane'); pane.id = module.id + '-pane-' + index;
      pane.setAttribute('role', 'tabpanel'); pane.hidden = index !== 0;
      const tab = make('button', '', label); tab.type = 'button'; tab.id = module.id + '-tab-' + index;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', pane.id); tab.setAttribute('aria-selected', String(index === 0)); tab.tabIndex = index === 0 ? 0 : -1;
      pane.setAttribute('aria-labelledby', tab.id);
      tabs.append(tab); return pane;
    });
    const changePane = (index, focus = false) => {
      [...tabs.children].forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      panes.forEach((pane, i) => pane.hidden = i !== index);
      if (focus) tabs.children[index].focus();
    };
    [...tabs.children].forEach((tab, i) => {
      tab.addEventListener('click', () => changePane(i));
      tab.addEventListener('keydown', e => {
        if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
          changePane(next, true);
        }
      });
    });
    const reference = make('details', 'reading-reference'); reference.append(make('summary', '', 'Ver detalles técnicos y referencias'));
    const references = make('div', 'reference-body'); reference.append(references);
    const terms = body.querySelector('.lesson-terms');
    panes[0].append(intro);
    panes[1].append(make('p', '', 'Prueba una opción a la vez y observa el resultado. Las instrucciones acompañan a cada actividad.'));
    let pendingGuide = null;
    [...body.children].forEach(child => {
      if (child === terms) return;
      if (child.classList.contains('exercise-guide')) { pendingGuide = child; return; }
      const interactive = child.matches(activitySelector) || child.querySelector(activitySelector);
      if (interactive) {
        if (pendingGuide) panes[1].append(pendingGuide);
        panes[1].append(child);
      } else {
        if (pendingGuide) references.append(pendingGuide);
        references.append(child);
      }
      pendingGuide = null;
    });
    if (pendingGuide) references.append(pendingGuide);
    panes[0].append(reference, terms);
    const quiz = module.querySelector(':scope > .quiz');
    panes[2].append(quiz);
    [0, 1].forEach(index => {
      const button = make('button', 'btn pane-next', index === 0 ? 'Ir a los ejemplos →' : 'Comprobar lo aprendido →'); button.type = 'button';
      button.addEventListener('click', () => { changePane(index + 1, true); tabs.scrollIntoView({block: 'start'}); });
      panes[index].append(button);
    });
    body.replaceChildren(...panes); module.insertBefore(tabs, body);

    // Only stable explanatory text can be highlighted; generated calculator output is excluded.
    const anchors = new Map();
    const candidates = [...module.querySelectorAll('.step-preview>span,.reading-step>p,.reference-body p,.reference-body li,.lesson-terms dd,.quiz .q>p')];
    candidates.filter(el => !el.querySelector('p,li,dd') && !el.closest(activitySelector) && !el.closest('.exercise-guide')).forEach((el, index) => {
      el.dataset.studyAnchor = String(index); anchors.set(String(index), el);
    });
    const notes = make('details', 'study-notes'); notes.id = module.id + '-notes';
    notes.append(make('summary', '', 'Mis apuntes de esta lección'));
    notes.append(make('p', '', 'Resalta frases en la lectura o el cuestionario y escribe tus ideas aquí. Se guardan solo en este navegador; exporta una copia para conservarlas fuera de este dispositivo.'));
    const label = make('label', '', 'Notas personales'); label.htmlFor = module.id + '-note-text';
    const textarea = make('textarea'); textarea.id = label.htmlFor; textarea.placeholder = 'Una idea que quiero recordar, una duda o un ejemplo propio…'; textarea.value = data(module.id).note;
    const noteStatus = make('div', 'study-save-status', ''); noteStatus.setAttribute('role', 'status');
    const heading = make('h3', '', 'Textos resaltados'); const list = make('ul', 'study-highlights');
    notes.append(label, textarea, noteStatus, heading, list); body.after(notes);
    textarea.addEventListener('input', () => {
      data(module.id).note = textarea.value;
      noteStatus.textContent = save() ? 'Nota guardada en este navegador.' : 'No se pudo guardar. Exporta tus apuntes antes de cerrar.';
    });
    const state = {anchors, notes, textarea, list, changePane}; lessonStates.set(module.id, state);
    renderHighlights(module);
  });

  function clearMarks(element) {
    element.querySelectorAll('mark.study-mark').forEach(mark => mark.replaceWith(...mark.childNodes)); element.normalize();
  }
  function paint(element, start, end, colorName) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = []; let offset = 0, node;
    while ((node = walker.nextNode())) {
      const next = offset + node.length;
      if (next > start && offset < end) nodes.push({node, start: Math.max(0, start - offset), end: Math.min(node.length, end - offset)});
      offset = next;
    }
    nodes.reverse().forEach(piece => {
      const range = document.createRange(); range.setStart(piece.node, piece.start); range.setEnd(piece.node, piece.end);
      const mark = make('mark', 'study-mark study-' + colorName); range.surroundContents(mark);
    });
  }
  function renderHighlights(module) {
    const state = lessonStates.get(module.id); if (!state) return;
    state.anchors.forEach(clearMarks); state.list.replaceChildren();
    const records = data(module.id).highlights;
    if (!records.length) state.list.append(make('li', '', 'Aún no has resaltado texto en esta lección.'));
    records.forEach((record, index) => {
      const element = state.anchors.get(record.anchor);
      const valid = element && Number.isInteger(record.start) && Number.isInteger(record.end) && record.start >= 0 && record.end > record.start && record.end <= element.textContent.length && element.textContent.slice(record.start, record.end) === record.text && ['yellow', 'green', 'blue'].includes(record.color);
      if (valid) paint(element, record.start, record.end, record.color);
      const item = make('li'); const text = make('span', '', String(record.text || 'Resaltado sin texto'));
      const remove = make('button', '', 'Quitar'); remove.type = 'button'; remove.setAttribute('aria-label', 'Quitar resaltado: ' + String(record.text || '').slice(0, 60));
      remove.addEventListener('click', () => { records.splice(index, 1); const saved = save(); renderHighlights(module); status.textContent = saved ? 'Resaltado eliminado.' : 'No se pudo guardar el cambio. Exporta tus apuntes antes de cerrar.'; });
      item.append(text, remove); state.list.append(item);
    });
  }
  let selectedRange = null;
  const floatingHighlight = make('button', 'selection-highlighter', 'Resaltar este texto');
  floatingHighlight.type = 'button'; floatingHighlight.hidden = true; document.body.append(floatingHighlight);
  floatingHighlight.addEventListener('mousedown', e => e.preventDefault());
  floatingHighlight.addEventListener('click', () => highlight.click());
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const module = active();
      if (module && module.contains(range.commonAncestorContainer) && !module.querySelector('.study-notes').contains(range.commonAncestorContainer)) { selectedRange = range.cloneRange(); floatingHighlight.hidden = false; }
      else { selectedRange = null; floatingHighlight.hidden = true; }
    } else floatingHighlight.hidden = true;
  });
  highlight.addEventListener('mousedown', e => e.preventDefault());
  highlight.addEventListener('click', () => {
    const module = active(); const state = module && lessonStates.get(module.id);
    if (!selectedRange || !state || !module.contains(selectedRange.commonAncestorContainer)) { status.textContent = 'Selecciona primero una frase del texto de la lección.'; return; }
    const additions = [];
    state.anchors.forEach((element, anchor) => {
      if (!element.getClientRects().length || !selectedRange.intersectsNode(element)) return;
      const range = document.createRange(); range.selectNodeContents(element);
      if (selectedRange.compareBoundaryPoints(Range.START_TO_START, range) > 0) range.setStart(selectedRange.startContainer, selectedRange.startOffset);
      if (selectedRange.compareBoundaryPoints(Range.END_TO_END, range) < 0) range.setEnd(selectedRange.endContainer, selectedRange.endOffset);
      const prefix = document.createRange(); prefix.selectNodeContents(element); prefix.setEnd(range.startContainer, range.startOffset);
      const start = prefix.toString().length, text = range.toString(), end = start + text.length;
      if (!text.trim()) return;
      if (data(module.id).highlights.some(record => record.anchor === anchor && start < record.end && end > record.start)) return;
      additions.push({anchor, start, end, text, color: color.value});
    });
    if (!additions.length) { status.textContent = 'Selecciona texto de lectura sin un resaltado previo. Los resultados cambiantes de las calculadoras no se resaltan.'; return; }
    data(module.id).highlights.push(...additions);
    const saved = save(); window.getSelection().removeAllRanges(); selectedRange = null; renderHighlights(module);
    status.textContent = saved ? 'Texto resaltado y guardado. Puedes quitarlo en Mis notas.' : 'Resaltado visible, pero no guardado. Exporta tus apuntes antes de cerrar.';
  });
  notesButton.addEventListener('click', () => {
    const state = lessonStates.get(active().id); state.notes.open = true; state.notes.scrollIntoView({block: 'start'}); state.textarea.focus();
  });
  download.addEventListener('click', () => {
    const sections = ['MIS APUNTES · CURSO IA Y GPU'];
    modules.forEach(module => {
      const lesson = data(module.id);
      if (!lesson.note && !lesson.highlights.length) return;
      sections.push(module.querySelector('h2').textContent);
      if (lesson.note) sections.push('Notas personales:\n' + lesson.note);
      if (lesson.highlights.length) sections.push('Textos resaltados:\n' + lesson.highlights.map(record => '• ' + record.text).join('\n'));
    });
    if (sections.length === 1) { status.textContent = 'Todavía no tienes apuntes. Resalta una frase o escribe una nota antes de exportar.'; return; }
    const url = URL.createObjectURL(new Blob([sections.join('\n\n') + '\n'], {type: 'text/plain;charset=utf-8'}));
    const link = make('a'); link.href = url; link.download = 'mis-apuntes-gpucurso.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Se descargó una copia de tus notas y textos resaltados.';
  });
  const lessonChanged = () => {
    selectedRange = null; floatingHighlight.hidden = true;
    index.dataset.mobileOpen = 'false'; index.scrollTop = 0; updateIndex();
    status.textContent = 'Selecciona una frase para resaltarla. Tus apuntes se guardan en este navegador.';
  };
  window.addEventListener('hashchange', lessonChanged);
  // Course links use history.replaceState, which does not emit hashchange.
  // This listener runs after the existing delegated navigation handler.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && modules.some(module => '#' + module.id === link.getAttribute('href'))) lessonChanged();
  });
  if (!storageWorks) status.textContent = 'El navegador no permite guardar apuntes. Puedes usarlos durante esta sesión y exportarlos.';
})();
