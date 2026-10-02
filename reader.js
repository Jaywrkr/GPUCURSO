/* Personal study tools. Stored locally, without modifying course content. */
(() => {
  'use strict';
  const key = 'gpu-course-study-v1';
  const positionKey = 'gpu-course-reading-v1';
  const modules = [...document.querySelectorAll('.mod')];
  let store = {version: 1, lessons: {}};
  let storageWorks = true;
  let resume = null;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && saved.version === 1 && saved.lessons && typeof saved.lessons === 'object') store = saved;
    const position = JSON.parse(localStorage.getItem(positionKey) || 'null');
    if (position && modules.some(module => module.id === position.lesson) && Number.isInteger(position.pane) && position.pane >= 0 && position.pane < 3) resume = position;
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
    store.lessons[id].highlights = store.lessons[id].highlights.filter(record => record && typeof record.text === 'string');
    store.lessons[id].highlights.forEach(record => {
      if (!record.id) record.id = crypto.randomUUID();
      if (typeof record.note !== 'string') record.note = '';
      if (record.review !== 'understood') record.review = 'pending';
      record.color = 'yellow';
    });
    return store.lessons[id];
  };
  const active = () => modules.find(module => !module.hidden);
  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(store)); storageWorks = true; return true; }
    catch { storageWorks = false; return false; }
  };
  const tools = make('div', 'reading-tools');
  tools.setAttribute('aria-label', 'Herramientas de lectura');
  const highlight = make('button', 'highlight-mode', 'Resaltador');
  highlight.type = 'button';
  highlight.title = 'Activar o desactivar resaltador · Alt + H';
  highlight.setAttribute('aria-pressed', 'false');
  const summaryButton = make('button', '', 'Mis resaltados'); summaryButton.type = 'button';
  const reviewButton = make('button', '', 'Repasar'); reviewButton.type = 'button';
  const dock = make('div', 'study-dock'); dock.setAttribute('role', 'toolbar'); dock.setAttribute('aria-label', 'Resaltados y repaso');
  dock.append(highlight, summaryButton, reviewButton); document.body.append(dock);
  const continueButton = make('button', 'continue-reading', 'Continuar donde quedé'); continueButton.type = 'button'; continueButton.hidden = !resume;
  const notesButton = make('button', '', 'Mis notas'); notesButton.type = 'button';
  const download = make('button', 'study-download', 'Exportar apuntes'); download.type = 'button';
  const theme = make('button', 'theme-toggle', 'Modo oscuro'); theme.type = 'button';
  const status = make('span', 'reading-status', 'Activa el resaltador y selecciona una frase. Se marca al soltar.');
  status.setAttribute('role', 'status');
  tools.append(continueButton, notesButton, download, theme, status);
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
  let summaryDialog, summaryBody, editDialog, editBody, reviewDialog, reviewBody;
  let highlighterOn = false;
  let lastAdded = [];
  let reviewQueue = [], reviewIndex = 0;
  let restoring = true;
  const simpleExplanations = {
    f1: 'Piensa en un modelo como un programa con muchos controles internos. Aprende ajustándolos con ejemplos. Después usa esos ajustes para responder; no es una persona ni sabe si todo lo que dice es cierto.',
    f2: 'Es como responder un examen con el reglamento a mano: primero buscas el párrafo y después redactas. El chatbot consulta los documentos en cada pregunta; no los aprende por guardarlos.',
    f3: 'La memoria de la GPU es una mesa de trabajo. El modelo ocupa parte de la mesa y las solicitudes necesitan el espacio restante. Guardar números más compactos libera sitio, pero debes comprobar si todavía responde bien.',
    f4: 'Separa dos cosas: cuánto esperas para que empiece la respuesta y cuánto tarda en escribirla. Si llegan muchas preguntas juntas, comparten los recursos y algunas pueden esperar.',
    h1: 'Escoge una GPU como escogerías una herramienta: según el trabajo. Mira qué cabe en su memoria, cuánto consume y cómo puede compartirse; el nombre más caro no garantiza la mejor elección.',
    h2: 'Dos personas haciendo tareas distintas no necesitan intercambiar cada paso. Si ambas resuelven una misma tarea grande, sí importa cómo se comunican. Con las GPUs sucede algo parecido.',
    h3: 'El servidor es la casa de las GPUs. Debe tener sitio, electricidad y ventilación para esas tarjetas concretas. Que una pieza entre físicamente no demuestra que esté soportada.',
    h4: 'El configurador comprueba si las piezas funcionan juntas. Si eliges una GPU muy exigente, puede obligarte a cambiar fuente, posición o servidor. Revisa el conjunto, no cada pieza aislada.',
    h5: 'La red es el camino por donde llegan archivos y preguntas. Un archivo grande tarda más en copiarse. Si el modelo ya está cargado, no vuelve a recorrer ese camino completo por cada pregunta.',
    h6: 'El disco es el armario donde guardas archivos; la memoria es donde trabajas con ellos. Una copia de respaldo debe permitir recuperar el trabajo si pierdes el armario principal.',
    h7: 'Todo lo que consume electricidad genera calor que debes sacar. Suma el equipo completo y comprueba las tomas. Tener espacio vacío en el rack no significa tener energía suficiente.',
    s1: 'La pantalla recibe la pregunta, otro programa ejecuta el modelo y los controladores permiten usar la GPU. Son piezas diferentes de un mismo recorrido; ninguna hace todo sola.',
    s2: 'Compartir puede ser reservar porciones o dar turnos. Una porción reserva recursos; un turno comparte tiempo. Aunque reserves porciones, el equipo físico sigue siendo común.',
    s3: 'Comprar la tarjeta y contratar software con soporte son cosas distintas. Algunas funciones exigen licencia y otras rutas usan herramientas abiertas. Confirma lo que ya viene incluido.',
    s4: 'VMware permite tener varios equipos virtuales en un servidor. Para usar IA, esos equipos también necesitan acceso a la GPU y derechos adecuados. La edición y la versión cumplen papeles distintos.',
    s4b: 'Esta plataforma reúne el catálogo de modelos, su ejecución y la búsqueda de documentos. Es como preparar una cocina completa: tener las herramientas no evita configurar, comprobar y mantener cada parte.',
    s5: 'Kubernetes organiza dónde trabaja cada aplicación. Si hay ocho lugares con GPU y llegan dieciséis trabajos, algunos esperan. El planificador ordena la fila; no fabrica más lugares.',
    s6: 'Publicar un modelo es dejar un servicio al que otras aplicaciones puedan pedir respuestas. El motor ejecuta el modelo; la aplicación muestra el resultado. Cambiar el motor exige probar la integración.',
    s7: 'Necesitas tres cosas además de responder: una copia recuperable, permisos correctos y avisos cuando algo falla. Una gráfica muestra un problema; alguien debe saber qué hacer con ese aviso.',
    c1: 'Empieza por la tarea de la persona. Un chatbot, una cámara y un laboratorio hacen trabajos diferentes. Por eso necesitan diseños distintos aunque todos utilicen GPUs.',
    d1: 'Dimensionar es comprobar si cada trabajo tiene dónde caber y recursos para ejecutarse. La suma total no basta: dos maletas pequeñas no alojan un objeto que no entra en ninguna de ellas.',
    d2: 'Compara lo que pagarías durante el mismo número de años. La compra es solo el inicio: también cuentan electricidad, licencias y personas que operan. La opción barata hoy puede no serlo durante todo el periodo.',
    v1: 'Una oportunidad empieza por un problema concreto que vale la pena resolver. Decir «queremos IA» no dice todavía qué necesita hacer el usuario ni qué equipo comprar.',
    v2: 'Primero entiende la tarea, después los recursos y finalmente la compra. Doscientas personas con acceso no significa doscientas preguntas al mismo tiempo.',
    v3: 'Ofrece un servicio que alguien pueda usar y mantener, no solo una caja. Aclara quién instala, quién atiende fallas, quién respalda y cuánto se paga por cada parte.',
    v4: 'Costo es lo que tú pagas y precio es lo que cobras. El porcentaje cambia según sobre cuál de esos dos calcules. Compara alternativas completas y no sumes equipos que son opciones excluyentes.',
    v5: 'Una objeción es una condición que falta resolver. Pregunta qué preocupa al cliente y compara con datos. No prometas que la nube o un servidor siempre será más barato.',
    v6: 'La entidad debe poder comprobar lo que pide. Describe prestaciones y pruebas, no solo marcas. Si las condiciones se contradicen, acláralas antes de preparar la oferta.',
    i1: 'Haz primero una prueba pequeña con una tarea real. Si funciona según lo acordado, instala y migra por partes. Mantén una forma de volver atrás si algo falla.',
    i2: 'Una casilla significa que lo comprobaste. Instalar el respaldo no basta: intenta recuperar un servicio. Tener la aplicación encendida no basta: haz una petición y revisa el resultado.',
    i3: 'Acuerda antes qué significa funcionar bien. Después prueba con usuarios y datos realistas. Una respuesta rápida de una sola persona no demuestra cómo irá con todos.',
    o1: 'Define quién recibe el problema, quién lo investiga y quién lo soluciona. Que alguien atienda en cuatro horas no significa que cualquier falla estará resuelta en cuatro horas.',
    o2: 'Revisa cómo se usa la plataforma antes de ampliarla. Si la espera viene de otro componente, comprar más GPU puede no ayudar. Programa también actualizaciones y renovaciones.',
    u1: 'La universidad necesita servicios reales y un laboratorio. Deben usar GPUs físicas distintas. Estar conectado al laboratorio no significa tener un trabajo ejecutándose con GPU.',
    u2: 'Acomoda cada modelo dejando sitio para atender solicitudes. Dos GPUs tienen dos memorias separadas: no se convierten automáticamente en una sola memoria grande.',
    u3: 'Traduce cada requisito a una pregunta: ¿cabe?, ¿responde suficientemente rápido?, ¿puede compartirse?, ¿puede instalarse aquí? Una especificación por sí sola no responde todas.',
    u4: 'Con ocho porciones hay sitio para ocho trabajos a la vez. Si llegan dieciséis, el resto espera, salvo que añadas recursos. La cola debe ser aceptada por quienes usan el laboratorio.',
    u5: 'La GPU no trabaja sola: necesita procesador, memoria, disco, red y electricidad. Cada pieza tiene una función. Un disco más grande no aumenta por sí solo la memoria de GPU.',
    u6: 'Dos tareas en el mismo servidor comparten piezas que pueden fallar. Separar academia y producción reduce ese impacto. Todavía debes planear qué pasa si falla producción.',
    u7: 'Sigue una pregunta como un paquete: entra en la aplicación, pasa controles, llega al motor y vuelve como respuesta. La GPU calcula; las otras piezas organizan y protegen el recorrido.',
    u8: 'Cuenta tarjetas físicas, revisa qué licencias incluyen y durante cuánto tiempo. Partir una tarjeta no crea más tarjetas para el conteo. Confirma precios y derechos antes de ofertar.',
    u9: 'Mueve un servicio, compruébalo y solo después sigue con otro. Entrega también instrucciones y práctica para operarlo. Mantén el origen mientras todavía sea necesario para regresar.',
    u10: 'Responde con una razón y un ejemplo que puedas explicar con tus palabras. Si solo recuerdas el nombre de la tarjeta, todavía falta entender qué problema resuelve.'
  };
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
    const beginner = make('details', 'beginner-tip');
    beginner.append(make('summary', '', 'En sencillo'), make('p', '', simpleExplanations[module.id]));
    intro.append(beginner);
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
      if (!restoring) rememberPosition();
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
    const state = {anchors, notes, textarea, list, changePane, panes, tabs}; lessonStates.set(module.id, state);
    data(module.id).highlights.forEach(record => Object.assign(record, sourceFor(module, record)));
    renderHighlights(module);
  });

  function button(text, action, className = '') {
    const element = make('button', className, text); element.type = 'button';
    element.addEventListener('click', action); return element;
  }
  function sourceFor(module, record) {
    const element = lessonStates.get(module.id)?.anchors.get(record.anchor);
    const pane = element?.closest('.lesson-pane');
    const paneNumber = pane ? Number(pane.id.slice(-1)) : Number(record.pane || 0);
    let section = record.section || 'Texto de la lección';
    if (element?.closest('.reading-step')) section = element.closest('.reading-step').querySelector('.step-preview b').textContent;
    else if (element?.closest('.lesson-terms')) section = 'Palabras y siglas · ' + (element.closest('div')?.querySelector('dt')?.textContent || 'Definición');
    else if (element?.closest('.quiz')) section = 'Cuestionario · ' + (element.closest('.q')?.querySelector('p')?.textContent || '').slice(0, 110);
    else if (element?.closest('.reading-reference')) section = 'Detalles técnicos y referencias';
    return {lesson: module.id, lessonNumber: modules.indexOf(module) + 1, lessonTitle: module.querySelector('h2').textContent, pane: paneNumber, section};
  }
  function sourceText(module, record) {
    const source = sourceFor(module, record);
    return 'Lección ' + String(source.lessonNumber).padStart(2, '0') + ' · ' + source.lessonTitle + ' · ' + ['Entender', 'Explorar', 'Comprobar'][source.pane] + ' → ' + source.section;
  }
  function allHighlights() {
    return modules.flatMap(module => data(module.id).highlights.map(record => ({module, record})));
  }
  function refreshCounts() {
    const count = allHighlights().length;
    summaryButton.textContent = 'Mis resaltados' + (count ? ' · ' + count : '');
    reviewButton.disabled = count === 0;
    if (summaryDialog?.open) renderSummary();
  }
  function clearMarks(element) {
    element.querySelectorAll('mark.study-mark').forEach(mark => mark.replaceWith(...mark.childNodes)); element.normalize();
  }
  function paint(element, record, module) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = []; let offset = 0, node;
    while ((node = walker.nextNode())) {
      const next = offset + node.length;
      if (next > record.start && offset < record.end) nodes.push({node, start: Math.max(0, record.start - offset), end: Math.min(node.length, record.end - offset)});
      offset = next;
    }
    nodes.reverse().forEach(piece => {
      const range = document.createRange(); range.setStart(piece.node, piece.start); range.setEnd(piece.node, piece.end);
      const mark = make('mark', 'study-mark study-yellow'); mark.dataset.highlightId = record.id;
      mark.title = 'Añadir una nota o quitar este resaltado'; mark.tabIndex = 0; mark.setAttribute('role', 'button');
      mark.addEventListener('click', event => { event.stopPropagation(); if (!window.getSelection()?.toString()) openEditor(module, record); });
      mark.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(module, record); } });
      range.surroundContents(mark);
    });
  }
  function matchingElement(module, record) {
    const element = lessonStates.get(module.id)?.anchors.get(record.anchor);
    return element && Number.isInteger(record.start) && Number.isInteger(record.end) && record.start >= 0 && record.end > record.start && record.end <= element.textContent.length && element.textContent.slice(record.start, record.end) === record.text ? element : null;
  }
  function highlightCard(module, record) {
    const item = make('li', 'highlight-card');
    item.append(make('p', 'highlight-source', sourceText(module, record)), make('blockquote', '', record.text));
    if (record.note) item.append(make('p', 'highlight-note', 'Mi nota: ' + record.note));
    const actions = make('div', 'study-actions');
    actions.append(button('Volver al texto', () => goToSource(module, record)), button(record.note ? 'Editar nota' : 'Añadir nota', () => openEditor(module, record)), button('Quitar', () => removeHighlight(module, record)));
    item.append(actions); return item;
  }
  function renderHighlights(module) {
    const state = lessonStates.get(module.id); if (!state) return;
    state.anchors.forEach(clearMarks); state.list.replaceChildren();
    const records = data(module.id).highlights;
    if (!records.length) state.list.append(make('li', '', 'Aún no has resaltado texto en esta lección.'));
    records.forEach(record => {
      const element = matchingElement(module, record);
      if (element) paint(element, record, module);
      state.list.append(highlightCard(module, record));
    });
    refreshCounts();
  }
  function removeHighlight(module, record) {
    data(module.id).highlights = data(module.id).highlights.filter(saved => saved.id !== record.id);
    const saved = save(); renderHighlights(module);
    notify(saved ? 'Resaltado eliminado.' : 'No se pudo guardar. Exporta tus apuntes antes de cerrar.');
  }
  function modal(title, id) {
    const dialog = make('dialog', 'study-dialog'); dialog.id = id; dialog.setAttribute('aria-labelledby', id + '-title');
    const header = make('div', 'study-dialog-heading'); header.append(make('h2', '', title)); header.querySelector('h2').id = id + '-title';
    header.append(button('Cerrar', () => dialog.close()));
    const body = make('div', 'study-dialog-body'); dialog.append(header, body); document.body.append(dialog);
    dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
    return {dialog, body};
  }
  ({dialog: summaryDialog, body: summaryBody} = modal('Mis resaltados y notas', 'study-summary'));
  ({dialog: editDialog, body: editBody} = modal('Una nota sobre esta frase', 'highlight-editor'));
  ({dialog: reviewDialog, body: reviewBody} = modal('Repaso con mis resaltados', 'study-review'));
  function renderSummary() {
    summaryBody.replaceChildren(make('p', 'study-description', 'Tus apuntes, agrupados por lección. Cada frase conserva su procedencia y te lleva al texto original. Se guardan en este navegador.'));
    let found = false;
    modules.forEach(module => {
      const lesson = data(module.id); if (!lesson.highlights.length && !lesson.note) return;
      found = true;
      const section = make('section', 'summary-lesson');
      section.append(make('h3', '', 'Lección ' + String(modules.indexOf(module) + 1).padStart(2, '0') + ' · ' + module.querySelector('h2').textContent));
      if (lesson.note) section.append(make('p', 'highlight-note', 'Nota de la lección: ' + lesson.note));
      const list = make('ul', 'study-highlights'); lesson.highlights.forEach(record => list.append(highlightCard(module, record)));
      section.append(list); summaryBody.append(section);
    });
    if (!found) summaryBody.append(make('p', '', 'Activa el resaltador y selecciona una frase para empezar. También puedes escribir notas al final de cada lección.'));
    summaryBody.append(button('Exportar todos mis apuntes', () => download.click()));
  }
  summaryButton.addEventListener('click', () => { renderSummary(); summaryDialog.showModal(); });
  function openEditor(module, record) {
    editBody.replaceChildren(make('p', 'highlight-source', sourceText(module, record)), make('blockquote', '', record.text));
    const label = make('label', '', 'Mi nota sobre esta frase'); label.htmlFor = 'highlight-note-text';
    const input = make('textarea'); input.id = label.htmlFor; input.value = record.note; input.placeholder = '¿Qué quiero recordar o qué no entendí?';
    const noteStatus = make('p', 'study-save-status'); noteStatus.setAttribute('role', 'status');
    input.addEventListener('input', () => { record.note = input.value; noteStatus.textContent = save() ? 'Nota guardada.' : 'No se pudo guardar. Exporta antes de cerrar.'; });
    const actions = make('div', 'study-actions');
    actions.append(button('Volver al texto', () => goToSource(module, record)), button('Quitar resaltado', () => { editDialog.close(); removeHighlight(module, record); }));
    editBody.append(label, input, noteStatus, actions);
    if (!editDialog.open) editDialog.showModal(); input.focus();
  }
  editDialog.addEventListener('close', () => { modules.forEach(module => renderHighlights(module)); });
  function goToSource(module, record) {
    [editDialog, summaryDialog, reviewDialog].forEach(dialog => { if (dialog.open) dialog.close(); });
    const element = matchingElement(module, record);
    if (!element) { notify('El texto del curso cambió. Tu frase y nota siguen en Mis resaltados, pero ya no coinciden con el original.'); return; }
    const link = document.querySelector('.idx a[href="#' + module.id + '"]'); link.click();
    const state = lessonStates.get(module.id); state.changePane(sourceFor(module, record).pane);
    for (let parent = element.parentElement; parent && parent !== module; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    if (element.classList.contains('why')) element.hidden = false;
    requestAnimationFrame(() => {
      element.scrollIntoView({block: 'center'}); element.tabIndex = -1; element.focus({preventScroll: true}); element.classList.add('study-source-focus');
      setTimeout(() => element.classList.remove('study-source-focus'), 1800);
      rememberPosition();
    });
  }
  function startReview(includeAll = false) {
    reviewQueue = allHighlights().filter(({record}) => includeAll || record.review !== 'understood'); reviewIndex = 0;
    renderReview(); if (!reviewDialog.open) reviewDialog.showModal();
  }
  function renderReview() {
    reviewBody.replaceChildren();
    const current = reviewQueue[reviewIndex];
    if (!current) {
      const pending = allHighlights().filter(({record}) => record.review !== 'understood').length;
      reviewBody.append(make('h3', '', reviewQueue.length ? 'Terminaste esta ronda de repaso.' : allHighlights().length ? 'Todo repasado por ahora.' : 'Todavía no tienes textos para repasar.'), make('p', '', pending ? (pending === 1 ? 'Queda una frase que marcaste para revisar después.' : 'Quedan ' + pending + ' frases que marcaste para revisar después.') : 'Puedes volver a leer tus frases sin añadir preguntas ni exámenes.'));
      if (pending) reviewBody.append(button('Repasar pendientes', () => startReview()));
      if (allHighlights().length) reviewBody.append(button('Repasar todos mis resaltados', () => startReview(true)));
      return;
    }
    const {module, record} = current;
    reviewBody.append(make('p', 'review-progress', String(reviewIndex + 1) + ' de ' + reviewQueue.length), make('p', 'highlight-source', sourceText(module, record)), make('blockquote', 'review-quote', record.text));
    if (record.note) reviewBody.append(make('p', 'highlight-note', 'Mi nota: ' + record.note));
    const actions = make('div', 'study-actions');
    ['Lo entiendo', 'Revisar después'].forEach((label, index) => actions.append(button(label, () => {
      record.review = index === 0 ? 'understood' : 'pending';
      if (!save()) notify('El estado de repaso no se pudo guardar.');
      reviewIndex++; renderReview();
    })));
    actions.append(button('Volver al texto', () => goToSource(module, record)));
    reviewBody.append(actions);
  }
  reviewButton.addEventListener('click', () => startReview());

  const toast = make('div', 'study-toast'); toast.hidden = true; toast.setAttribute('role', 'status'); document.body.append(toast);
  let toastTimer;
  function notify(text, undo = false) {
    status.textContent = text; toast.replaceChildren(make('span', '', text));
    if (undo) toast.append(button('Deshacer', () => {
      const touched = new Set();
      lastAdded.forEach(({module, id}) => { data(module.id).highlights = data(module.id).highlights.filter(record => record.id !== id); touched.add(module); });
      lastAdded = []; const saved = save(); touched.forEach(renderHighlights); notify(saved ? 'Último resaltado deshecho.' : 'No se pudo guardar el cambio.');
    }));
    toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 6000);
  }
  function setHighlighter(enabled) {
    highlighterOn = enabled; document.documentElement.classList.toggle('highlighter-active', enabled);
    highlight.setAttribute('aria-pressed', String(enabled)); highlight.textContent = enabled ? 'Resaltador activo' : 'Resaltador';
    notify(enabled ? 'Selecciona texto y suéltalo para resaltar. Escape desactiva el resaltador.' : 'Resaltador desactivado.');
  }
  highlight.addEventListener('click', () => setHighlighter(!highlighterOn));
  document.addEventListener('keydown', event => {
    const editing = event.target.closest('input,textarea,select,[contenteditable="true"]');
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'h' && !editing) { event.preventDefault(); setHighlighter(!highlighterOn); }
    if (event.key === 'Escape' && highlighterOn && !document.querySelector('dialog[open]')) setHighlighter(false);
  });
  let selectedRange = null;
  let touchSelection = matchMedia('(pointer: coarse)').matches;
  const floatingHighlight = button('Resaltar este texto', () => addSelection());
  floatingHighlight.className = 'selection-highlighter'; floatingHighlight.hidden = true; document.body.append(floatingHighlight);
  floatingHighlight.addEventListener('mousedown', event => event.preventDefault());
  const captureSelection = () => {
    const selection = window.getSelection(); const module = active();
    if (selection?.rangeCount && !selection.isCollapsed && !document.querySelector('dialog[open]')) {
      const range = selection.getRangeAt(0);
      if (module?.contains(range.commonAncestorContainer) && !module.querySelector('.study-notes').contains(range.commonAncestorContainer)) {
        selectedRange = range.cloneRange(); floatingHighlight.hidden = highlighterOn && !touchSelection; return;
      }
    }
    selectedRange = null; floatingHighlight.hidden = true;
  };
  document.addEventListener('selectionchange', captureSelection);
  document.addEventListener('pointerdown', event => { touchSelection = event.pointerType === 'touch'; }, {passive: true});
  function addSelection() {
    const module = active(); const state = module && lessonStates.get(module.id);
    if (!selectedRange || !state || !module.contains(selectedRange.commonAncestorContainer)) return;
    const additions = [];
    state.anchors.forEach((element, anchor) => {
      if (!element.getClientRects().length || !selectedRange.intersectsNode(element)) return;
      const range = document.createRange(); range.selectNodeContents(element);
      if (selectedRange.compareBoundaryPoints(Range.START_TO_START, range) > 0) range.setStart(selectedRange.startContainer, selectedRange.startOffset);
      if (selectedRange.compareBoundaryPoints(Range.END_TO_END, range) < 0) range.setEnd(selectedRange.endContainer, selectedRange.endOffset);
      const prefix = document.createRange(); prefix.selectNodeContents(element); prefix.setEnd(range.startContainer, range.startOffset);
      const start = prefix.toString().length, text = range.toString(), end = start + text.length;
      if (!text.trim() || data(module.id).highlights.some(record => record.anchor === anchor && start < record.end && end > record.start)) return;
      const record = {id: crypto.randomUUID(), anchor, start, end, text, color: 'yellow', note: '', review: 'pending'};
      Object.assign(record, sourceFor(module, record)); additions.push(record);
    });
    if (!additions.length) { notify('Selecciona texto de lectura sin un resaltado previo. Los resultados cambiantes de calculadoras no se resaltan.'); return; }
    data(module.id).highlights.push(...additions); lastAdded = additions.map(record => ({module, id: record.id}));
    const saved = save(); window.getSelection().removeAllRanges(); selectedRange = null; floatingHighlight.hidden = true; renderHighlights(module);
    notify(saved ? 'Resaltado guardado. Tócalo para añadir una nota.' : 'No se pudo guardar. Exporta tus apuntes antes de cerrar.', true);
  }
  document.addEventListener('pointerup', event => {
    if (!highlighterOn || event.target.closest('button,input,textarea,select,dialog,.study-dock,.study-notes')) return;
    // Touch selection handles can continue moving after pointerup. Touch uses
    // the same quiet confirmation button, avoiding premature partial highlights.
    if (event.pointerType === 'touch') { captureSelection(); floatingHighlight.hidden = !selectedRange; return; }
    setTimeout(() => { captureSelection(); if (highlighterOn) addSelection(); }, 0);
  });
  document.addEventListener('keyup', event => {
    if (highlighterOn && event.key === 'Shift') { captureSelection(); addSelection(); }
  });
  notesButton.addEventListener('click', () => {
    const state = lessonStates.get(active().id); state.notes.open = true; state.notes.scrollIntoView({block: 'start'}); state.textarea.focus();
  });
  download.addEventListener('click', () => {
    const sections = ['MIS APUNTES · CURSO IA Y GPU'];
    modules.forEach(module => {
      const lesson = data(module.id); if (!lesson.note && !lesson.highlights.length) return;
      sections.push('Lección ' + String(modules.indexOf(module) + 1).padStart(2, '0') + ' · ' + module.querySelector('h2').textContent);
      if (lesson.note) sections.push('Notas de la lección:\n' + lesson.note);
      lesson.highlights.forEach(record => {
        sections.push('Texto resaltado:\n' + record.text + '\nOrigen: ' + sourceText(module, record) + '\nEnlace: ' + location.href.split('#')[0] + '#' + module.id + '\nRepaso: ' + (record.review === 'understood' ? 'Lo entiendo' : 'Pendiente') + (record.note ? '\nMi nota: ' + record.note : ''));
      });
    });
    if (sections.length === 1) { notify('Todavía no tienes apuntes. Resalta una frase o escribe una nota.'); return; }
    const url = URL.createObjectURL(new Blob([sections.join('\n\n') + '\n'], {type: 'text/plain;charset=utf-8'}));
    const link = make('a'); link.href = url; link.download = 'mis-apuntes-gpucurso.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Se descargó una copia de tus apuntes con sus fuentes.');
  });

  function rememberPosition() {
    if (restoring || document.querySelector('dialog[open]')) return;
    const module = active(), state = lessonStates.get(module?.id); if (!state) return;
    const pane = state.panes.findIndex(element => !element.hidden);
    const nearest = [...state.anchors].find(([, element]) => { const rect = element.getBoundingClientRect(); return rect.height && rect.bottom > 100 && rect.top < innerHeight - 100; });
    resume = {lesson: module.id, pane, y: scrollY, anchor: nearest?.[0] || null, offset: nearest?.[1].getBoundingClientRect().top || 0, open: [...module.querySelectorAll('details')].map((element, index) => element.open ? index : -1).filter(index => index >= 0)};
    try { localStorage.setItem(positionKey, JSON.stringify(resume)); } catch {}
    updateContinue();
  }
  function updateContinue() {
    continueButton.hidden = !resume;
    if (!resume) return;
    const module = modules.find(module => module.id === resume.lesson);
    continueButton.textContent = 'Continuar · ' + module.querySelector('h2').textContent;
    continueButton.title = ['Entender', 'Explorar', 'Comprobar'][resume.pane];
  }
  function restorePosition(position) {
    const module = modules.find(module => module.id === position.lesson); if (!module) return;
    restoring = true;
    document.querySelector('.idx a[href="#' + module.id + '"]').click();
    const state = lessonStates.get(module.id); state.changePane(position.pane);
    [...module.querySelectorAll('details')].forEach((element, index) => element.open = Array.isArray(position.open) && position.open.includes(index));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = state.anchors.get(position.anchor);
      const visible = element?.getClientRects().length;
      scrollTo({top: visible ? scrollY + element.getBoundingClientRect().top - Number(position.offset || 0) : Number(position.y || 0)});
      setTimeout(() => restoring = false, 100);
    }));
  }
  continueButton.addEventListener('click', () => { if (resume) restorePosition({...resume}); });
  let positionTimer;
  window.addEventListener('scroll', () => { clearTimeout(positionTimer); positionTimer = setTimeout(rememberPosition, 200); }, {passive: true});
  document.addEventListener('toggle', event => { if (event.target.closest?.('.mod')) rememberPosition(); }, true);
  window.addEventListener('pagehide', rememberPosition);
  const lessonChanged = () => {
    selectedRange = null; floatingHighlight.hidden = true;
    index.dataset.mobileOpen = 'false'; index.scrollTop = 0; updateIndex();
    status.textContent = highlighterOn ? 'Resaltador activo: selecciona una frase y suéltala.' : 'Activa el resaltador y selecciona una frase. Se marca al soltar.';
    if (!restoring) rememberPosition();
  };
  window.addEventListener('hashchange', lessonChanged);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && modules.some(module => '#' + module.id === link.getAttribute('href'))) lessonChanged();
  });
  updateContinue(); refreshCounts();
  if (resume && (!location.hash || location.hash.slice(1) === resume.lesson)) restorePosition({...resume});
  else requestAnimationFrame(() => { restoring = false; });
  if (allHighlights().length) save(); // Persist metadata added to earlier saved highlights.
  if (!storageWorks) status.textContent = 'No se pueden guardar apuntes aquí. Puedes usarlos durante esta sesión y exportarlos.';
})();
