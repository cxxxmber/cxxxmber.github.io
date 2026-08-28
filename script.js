const clock = document.querySelector('#clock');
const statusDate = document.querySelector('#status-date');
const batteryPercent = document.querySelector('#battery-percent');
const desktop = document.querySelector('.desktop');
const folderField = document.querySelector('.folder-field');

function updateClock() {
  const now = new Date();
  clock.textContent = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(now);
  statusDate.textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  }).format(now);
}
updateClock();
setInterval(updateClock, 30000);

function updateBattery(battery) {
  batteryPercent.textContent = `${Math.round(battery.level * 100)}%`;
}

if ('getBattery' in navigator) {
  navigator.getBattery().then((battery) => {
    updateBattery(battery);
    battery.addEventListener('levelchange', () => updateBattery(battery));
  });
}

let activeDrag = null;
let pendingFolderDrag = null;
const folderLongPressDelay = 350;

function startDrag(element, clientX, clientY, bounds, onClick) {
  const rect = element.getBoundingClientRect();
  const desktopRect = desktop.getBoundingClientRect();
  activeDrag = {
    element,
    bounds,
    offsetX: clientX - rect.left,
    offsetY: clientY - rect.top,
    moved: false,
    onClick
  };
  element.style.left = `${rect.left - desktopRect.left}px`;
  element.style.top = `${rect.top - desktopRect.top}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.zIndex = 5;
}

function moveDrag(clientX, clientY) {
  if (!activeDrag) return;
  const { element, bounds, offsetX, offsetY } = activeDrag;
  const desktopRect = desktop.getBoundingClientRect();
  const area = bounds();
  const left = Math.max(area.left, Math.min(area.right - element.offsetWidth, clientX - desktopRect.left - offsetX));
  const top = Math.max(area.top, Math.min(area.bottom - element.offsetHeight, clientY - desktopRect.top - offsetY));
  activeDrag.moved = true;
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

function endDrag(pointerId) {
  if (!activeDrag || pointerId !== activeDrag.pointerId) return;
  const drag = activeDrag;
  activeDrag = null;
  drag.element.style.zIndex = '';
  if (drag.moved && drag.element.classList.contains('folder')) {
    drag.element.dataset.dragged = 'true';
  }
  if (!drag.moved && drag.onClick) drag.onClick();
}

function folderBounds() {
  const fieldRect = folderField.getBoundingClientRect();
  const desktopRect = desktop.getBoundingClientRect();
  return {
    left: fieldRect.left - desktopRect.left,
    top: fieldRect.top - desktopRect.top,
    right: fieldRect.right - desktopRect.left,
    bottom: fieldRect.bottom - desktopRect.top
  };
}

function desktopBounds() {
  return { left: 0, top: 34, right: desktop.clientWidth, bottom: desktop.clientHeight };
}

document.querySelectorAll('.folder').forEach((folder) => {
  folder.addEventListener('pointerdown', (event) => {
    pendingFolderDrag = {
      folder,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
      timer: setTimeout(() => {
        if (!pendingFolderDrag || pendingFolderDrag.pointerId !== event.pointerId || pendingFolderDrag.moved) return;
        const drag = pendingFolderDrag;
        pendingFolderDrag = null;
        activeDrag = null;
        startDrag(drag.folder, drag.clientX, drag.clientY, folderBounds, null);
        activeDrag.pointerId = drag.pointerId;
      }, folderLongPressDelay)
    };
    try {
      folder.setPointerCapture(event.pointerId);
    } catch {}
  });
  folder.addEventListener('click', (event) => {
    if (folder.dataset.dragged) {
      event.preventDefault();
      delete folder.dataset.dragged;
      return;
    }
    folder.classList.add('is-open');
    setTimeout(() => folder.classList.remove('is-open'), 900);
  });
});

const quickLinks = document.querySelector('.quick-links');
quickLinks.addEventListener('pointerdown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('a, button, [contenteditable="true"]')) return;
  event.preventDefault();
  activeDrag = null;
  startDrag(quickLinks, event.clientX, event.clientY, desktopBounds, null);
  activeDrag.pointerId = event.pointerId;
});

window.addEventListener('pointermove', (event) => {
  if (floatingWindowDrag && event.pointerId === floatingWindowDrag.pointerId) {
    event.preventDefault();
    scheduleFloatingWindowMove(event.clientX, event.clientY);
    return;
  }
  if (pendingFolderDrag && event.pointerId === pendingFolderDrag.pointerId) {
    const pending = pendingFolderDrag;
    const distance = Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY);
    if (distance > 5) {
      clearTimeout(pending.timer);
      pendingFolderDrag = null;
      activeDrag = null;
      startDrag(pending.folder, pending.clientX, pending.clientY, folderBounds, null);
      activeDrag.pointerId = pending.pointerId;
      moveDrag(event.clientX, event.clientY);
    }
  }
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
  event.preventDefault();
  moveDrag(event.clientX, event.clientY);
}, { passive: false });
window.addEventListener('pointerup', (event) => {
  if (floatingWindowDrag && event.pointerId === floatingWindowDrag.pointerId) {
    if (floatingWindowDrag.frame) cancelAnimationFrame(floatingWindowDrag.frame);
    floatingWindowDrag = null;
    return;
  }
  if (pendingFolderDrag && event.pointerId === pendingFolderDrag.pointerId) {
    clearTimeout(pendingFolderDrag.timer);
    if (pendingFolderDrag.moved) pendingFolderDrag.folder.dataset.dragged = 'true';
    pendingFolderDrag = null;
  }
  endDrag(event.pointerId);
});
window.addEventListener('pointercancel', (event) => {
  if (floatingWindowDrag && event.pointerId === floatingWindowDrag.pointerId) {
    if (floatingWindowDrag.frame) cancelAnimationFrame(floatingWindowDrag.frame);
    floatingWindowDrag = null;
    return;
  }
  if (pendingFolderDrag && event.pointerId === pendingFolderDrag.pointerId) {
    clearTimeout(pendingFolderDrag.timer);
    pendingFolderDrag = null;
  }
  endDrag(event.pointerId);
});

document.querySelector('.add-link').addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = '#';
  link.addEventListener('click', (event) => event.preventDefault());
  link.innerHTML = '<span contenteditable="true" spellcheck="false">new link</span><b>↗</b>';
  document.querySelector('.quick-links').insertBefore(link, document.querySelector('.add-link'));
  link.querySelector('span').focus();
  document.execCommand('selectAll', false, null);
});

document.querySelectorAll('.dock-icon').forEach((icon) => {
  icon.addEventListener('click', () => {
    document.querySelectorAll('.dock-icon').forEach((item) => item.classList.remove('selected'));
    icon.classList.add('selected');
  });
});

const terminalWindow = document.querySelector('.terminal-window');
const terminalTitlebar = document.querySelector('.terminal-titlebar');
const terminalButton = document.querySelector('.dock-icon.terminal');
const notesWindow = document.querySelector('.notes-window');
const notesButton = document.querySelector('.dock-icon.notes');
const notesTitlebar = document.querySelector('.notes-titlebar');
const trashButton = document.querySelector('.dock-icon.trash');
const terminalForm = document.querySelector('.terminal-content');
const passwordInput = document.querySelector('#terminal-password');
const terminalStatus = document.querySelector('.terminal-status');
const statusDot = document.querySelector('.status-dot');
const addNoteButton = document.querySelector('.add-note');
const noteComposer = document.querySelector('.note-composer');
const noteTitleInput = document.querySelector('.note-title-input');
const noteBodyInput = document.querySelector('.note-body-input');
const cancelNoteButton = document.querySelector('.cancel-note');
const blogNote = document.querySelector('.blog-note');
const notesList = document.querySelector('.notes-list');
const notesCount = document.querySelector('.notes-count');
const noteMenu = document.querySelector('.note-menu');
const deleteNoteButton = document.querySelector('.delete-note');
const terminalCloseButton = document.querySelector('.terminal-window .window-close');
const notesCloseButton = document.querySelector('.notes-window .window-close');
let isAdminMode = false;
let floatingWindowDrag = null;
const notesStorageKey = 'ars33nio-blog-notes';
const defaultNotes = [{ id: 'welcome', date: 'AUG 28, 2026', title: 'Making room for the next idea', body: ['Some days start as noise: a loop, a sketch, a half-written thought. Give it a little space and it starts to become a direction.', 'Today I am collecting the small pieces, following the rhythm, and leaving the door open for whatever comes next.'] }];
let notes = loadNotes();
let selectedNoteId = notes[0].id;

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(notesStorageKey));
    return Array.isArray(saved) && saved.length ? saved : defaultNotes;
  } catch {
    return defaultNotes;
  }
}

function saveNotes() {
  localStorage.setItem(notesStorageKey, JSON.stringify(notes));
}

function renderNotes() {
  notesList.replaceChildren();
  notes.forEach((note) => {
    const entry = document.createElement('button');
    entry.className = 'note-list-item';
    entry.type = 'button';
    entry.dataset.noteId = note.id;
    entry.innerHTML = '<span></span><strong></strong><small></small>';
    entry.querySelector('span').textContent = note.date.replace(', 2026', '');
    entry.querySelector('strong').textContent = note.title;
    entry.querySelector('small').textContent = note.body[0];
    entry.addEventListener('click', () => selectNote(note.id));
    notesList.appendChild(entry);
  });
  notesCount.textContent = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`;
  if (notes.length) selectNote(selectedNoteId, false);
  else {
    selectedNoteId = null;
    blogNote.innerHTML = '<p class="blog-date">NO NOTES</p>';
  }
}

function selectNote(noteId, hideComposer = true) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) return;
  selectedNoteId = note.id;
  document.querySelectorAll('.note-list-item').forEach((item) => item.toggleAttribute('aria-current', item.dataset.noteId === note.id));
  blogNote.innerHTML = `<p class="blog-date"></p><h2 contenteditable="${isAdminMode}" spellcheck="false"></h2>${note.body.map(() => `<p contenteditable="${isAdminMode}" spellcheck="false"></p>`).join('')}`;
  blogNote.querySelector('.blog-date').textContent = note.date;
  blogNote.querySelector('h2').textContent = note.title;
  blogNote.querySelectorAll('p:not(.blog-date)').forEach((paragraph, index) => { paragraph.textContent = note.body[index]; });
  if (hideComposer) { noteComposer.hidden = true; blogNote.hidden = false; }
}

function setAdminMode(enabled) {
  isAdminMode = enabled;
  statusDot.classList.toggle('is-admin', enabled);
  addNoteButton.hidden = !enabled;
  noteMenu.hidden = !enabled;
  deleteNoteButton.hidden = true;
  document.querySelector('.desktop').classList.toggle('admin-mode', enabled);
  blogNote.querySelectorAll('[contenteditable]').forEach((item) => item.setAttribute('contenteditable', String(enabled)));
}

renderNotes();

function moveFloatingWindow(clientX, clientY) {
  if (!floatingWindowDrag) return;
  const element = floatingWindowDrag.element;
  const desktopRect = desktop.getBoundingClientRect();
  const area = desktopBounds();
  const left = Math.max(area.left, Math.min(area.right - element.offsetWidth, clientX - desktopRect.left - floatingWindowDrag.offsetX));
  const top = Math.max(area.top, Math.min(area.bottom - element.offsetHeight, clientY - desktopRect.top - floatingWindowDrag.offsetY));
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

function scheduleFloatingWindowMove(clientX, clientY) {
  if (!floatingWindowDrag) return;
  floatingWindowDrag.clientX = clientX;
  floatingWindowDrag.clientY = clientY;
  if (floatingWindowDrag.frame) return;
  floatingWindowDrag.frame = requestAnimationFrame(() => {
    if (!floatingWindowDrag) return;
    const drag = floatingWindowDrag;
    drag.frame = null;
    moveFloatingWindow(drag.clientX, drag.clientY);
  });
}

terminalButton.addEventListener('click', () => {
  terminalWindow.classList.add('is-visible');
  terminalWindow.setAttribute('aria-hidden', 'false');
  passwordInput.focus();
});

notesButton.addEventListener('click', () => {
  notesWindow.classList.add('is-visible');
  notesWindow.setAttribute('aria-hidden', 'false');
});

trashButton.addEventListener('click', () => {
  terminalWindow.classList.remove('is-visible');
  terminalWindow.setAttribute('aria-hidden', 'true');
  notesWindow.classList.remove('is-visible');
  notesWindow.setAttribute('aria-hidden', 'true');
});

terminalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const isCorrect = passwordInput.value === 'f777';
  terminalStatus.textContent = isCorrect ? 'password correct' : 'please try again';
  terminalStatus.classList.toggle('is-success', isCorrect);
  if (isCorrect) {
    setAdminMode(true);
  }
  passwordInput.select();
});

addNoteButton.addEventListener('click', () => {
  if (!isAdminMode) return;
  noteComposer.hidden = false;
  blogNote.hidden = true;
  noteTitleInput.focus();
});

cancelNoteButton.addEventListener('click', () => {
  noteComposer.hidden = true;
  blogNote.hidden = false;
  noteComposer.reset();
});

noteComposer.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!isAdminMode) return;
  const title = noteTitleInput.value.trim();
  const body = noteBodyInput.value.trim();
  if (!title || !body) return;
  const newNote = { id: `note-${Date.now()}`, date: 'AUG 28, 2026', title, body: [body] };
  notes.push(newNote);
  selectedNoteId = newNote.id;
  saveNotes();
  renderNotes();
  noteComposer.hidden = true;
  blogNote.hidden = false;
  noteComposer.reset();
});

blogNote.addEventListener('input', () => {
  if (!isAdminMode) return;
  const note = notes.find((item) => item.id === selectedNoteId);
  if (!note) return;
  note.title = blogNote.querySelector('h2').textContent.trim();
  note.body = [...blogNote.querySelectorAll('p:not(.blog-date)')].map((item) => item.textContent.trim());
  saveNotes();
  const selectedEntry = notesList.querySelector(`[data-note-id="${selectedNoteId}"]`);
  if (selectedEntry) {
    selectedEntry.querySelector('strong').textContent = note.title;
    selectedEntry.querySelector('small').textContent = note.body[0];
  }
});

noteMenu.addEventListener('click', () => {
  if (isAdminMode) deleteNoteButton.hidden = !deleteNoteButton.hidden;
});

deleteNoteButton.addEventListener('click', () => {
  if (!isAdminMode) return;
  notes = notes.filter((note) => note.id !== selectedNoteId);
  selectedNoteId = notes[0]?.id || null;
  saveNotes();
  renderNotes();
});

statusDot.addEventListener('click', () => setAdminMode(false));
terminalCloseButton.addEventListener('click', () => { terminalWindow.classList.remove('is-visible'); terminalWindow.setAttribute('aria-hidden', 'true'); });
notesCloseButton.addEventListener('click', () => { notesWindow.classList.remove('is-visible'); notesWindow.setAttribute('aria-hidden', 'true'); });
[terminalCloseButton, notesCloseButton].forEach((button) => button.addEventListener('pointerdown', (event) => event.stopPropagation()));

terminalTitlebar.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  const rect = terminalWindow.getBoundingClientRect();
  const desktopRect = desktop.getBoundingClientRect();
  floatingWindowDrag = {
    element: terminalWindow,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  terminalWindow.style.left = `${rect.left - desktopRect.left}px`;
  terminalWindow.style.top = `${rect.top - desktopRect.top}px`;
  terminalWindow.style.right = 'auto';
  terminalWindow.style.bottom = 'auto';
  terminalWindow.classList.add('is-dragging');
  try {
    terminalTitlebar.setPointerCapture(event.pointerId);
  } catch {}
});

notesTitlebar.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  const rect = notesWindow.getBoundingClientRect();
  const desktopRect = desktop.getBoundingClientRect();
  floatingWindowDrag = {
    element: notesWindow,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  notesWindow.style.left = `${rect.left - desktopRect.left}px`;
  notesWindow.style.top = `${rect.top - desktopRect.top}px`;
  notesWindow.style.right = 'auto';
  notesWindow.style.bottom = 'auto';
  notesWindow.classList.add('is-dragging');
  try {
    notesTitlebar.setPointerCapture(event.pointerId);
  } catch {}
});

// Keep editable bookmark text from turning a click into accidental navigation.
document.querySelectorAll('[contenteditable="true"]').forEach((label) => {
  label.addEventListener('click', (event) => event.stopPropagation());
  label.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      label.blur();
    }
  });
});
