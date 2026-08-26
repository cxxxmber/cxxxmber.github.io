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
  if (pendingFolderDrag && event.pointerId === pendingFolderDrag.pointerId) {
    clearTimeout(pendingFolderDrag.timer);
    if (pendingFolderDrag.moved) pendingFolderDrag.folder.dataset.dragged = 'true';
    pendingFolderDrag = null;
  }
  endDrag(event.pointerId);
});
window.addEventListener('pointercancel', (event) => {
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
