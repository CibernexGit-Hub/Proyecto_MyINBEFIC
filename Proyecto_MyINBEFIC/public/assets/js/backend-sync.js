(() => {
  const keyPrefixes = ['inbefic:', 'convivencia-', 'secretaria-', 'docente-', 'sec_', 'educa_', 'notas-docente', 'cuadro-notas-'];
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let synchronizing = false;
  let sharedDataAccessDenied = false;
  let writeQueue = Promise.resolve();
  let writeErrorShown = false;

  function isSharedKey(key) {
    return typeof key === 'string' &&
      key.length <= 120 &&
      /^[A-Za-z0-9:_-]+$/.test(key) &&
      keyPrefixes.some(prefix => key.startsWith(prefix));
  }

  function localValue(key, raw) {
    if (key === 'docente-seccion') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  function rawValue(key, value) {
    return key === 'docente-seccion' && typeof value === 'string'
      ? value
      : JSON.stringify(value);
  }

  function localSnapshot() {
    const data = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!isSharedKey(key)) continue;
      const raw = localStorage.getItem(key);
      if (raw !== null) data[key] = localValue(key, raw);
    }
    return data;
  }

  function addLocalExportButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Exportar datos guardados';
    button.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;border:0;border-radius:10px;padding:12px 16px;background:#102f52;color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 4px 16px #0004;cursor:pointer';
    button.addEventListener('click', () => {
      const backup = {
        format: 'inbefic-local-backup-v1',
        exportedAt: new Date().toISOString(),
        data: localSnapshot()
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `inbefic-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
    document.body.append(button);
  }

  function addRemoteImportButton(role) {
    if (role !== 'directora') return;
    const label = document.createElement('label');
    label.textContent = 'Importar respaldo local';
    label.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483646;border:0;border-radius:10px;padding:12px 16px;background:#102f52;color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 4px 16px #0004;cursor:pointer';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        const data = backup && backup.data && typeof backup.data === 'object'
          ? backup.data
          : backup;
        const response = await fetch('/api/app-data/import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo importar el respaldo.');
        showMessage(`Respaldo importado: ${result.imported} claves nuevas; ${result.skipped} ya existían.`);
        if (result.imported) location.reload();
      } catch (error) {
        console.error('Error al importar el respaldo local.', error);
        showMessage(error.message);
      } finally {
        input.value = '';
      }
    });
    label.append(input);
    document.body.append(label);
  }

  function showMessage(message, fatal = false) {
    document.documentElement.classList.remove('inbefic-sync-loading');
    let panel = document.getElementById('inbefic-sync-message');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'inbefic-sync-message';
      panel.setAttribute('role', 'status');
      panel.style.cssText = 'position:fixed;z-index:2147483647;inset:0 0 auto;padding:14px 18px;background:#fff3cd;color:#664d03;border-bottom:1px solid #ffecb5;font:15px/1.45 system-ui,sans-serif;box-shadow:0 2px 8px #0002';
      document.body.prepend(panel);
    }
    panel.textContent = message;
    if (fatal) {
      panel.style.cssText = 'position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;padding:32px;background:#fff;color:#5a2331;font:16px/1.6 system-ui,sans-serif;text-align:center';
    }
  }

  function enqueueWrite(method, key, value) {
    writeQueue = writeQueue.then(async () => {
      const url = `/api/app-data/${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: method === 'PUT' ? JSON.stringify({ value }) : undefined
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `No se guardó ${key} en la base de datos.`);
      }
    }).catch(error => {
      console.error('Error al sincronizar datos con MySQL.', error);
      if (!writeErrorShown) {
        writeErrorShown = true;
        showMessage(`${error.message} El cambio sigue en este navegador; no se sincronizó con el servidor.`);
      }
    });
  }

  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (location.protocol !== 'file:' && this === localStorage && !synchronizing &&
        !sharedDataAccessDenied && isSharedKey(String(key))) {
      enqueueWrite('PUT', String(key), localValue(String(key), String(value)));
    }
  };

  Storage.prototype.removeItem = function(key) {
    originalRemoveItem.call(this, key);
    if (location.protocol !== 'file:' && this === localStorage && !synchronizing &&
        !sharedDataAccessDenied && isSharedKey(String(key))) {
      enqueueWrite('DELETE', String(key));
    }
  };

  if (location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', addLocalExportButton, { once: true });
    return;
  }

  async function synchronize() {
    try {
      let response = await fetch('/api/app-data', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 403) {
        sharedDataAccessDenied = true;
        document.documentElement.classList.remove('inbefic-sync-loading');
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'No se pudo cargar la base de datos.');
      }
      let payload = await response.json();
      const local = localSnapshot();

      if (payload.isEmpty && Object.keys(local).length && payload.role === 'directora') {
        response = await fetch('/api/app-data/import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: local })
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'No se pudieron importar los datos locales.');
        }
        response = await fetch('/api/app-data', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudo volver a cargar la base de datos tras la importación.');
        payload = await response.json();
      }

      let uploadedLocalData = false;
      for (const [key, value] of Object.entries(local)) {
        if (Object.prototype.hasOwnProperty.call(payload.data, key)) continue;
        if (payload.role === 'directora' || payload.role === 'subdirectora' ||
            (payload.role === 'docente' && (
              key.startsWith('inbefic:') || key.startsWith('convivencia-') ||
              key.startsWith('docente-') || key.startsWith('notas-docente') ||
              key.startsWith('cuadro-notas-')
            ))) {
          const save = await fetch(`/api/app-data/${encodeURIComponent(key)}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
          });
          if (!save.ok) throw new Error(`No se pudo guardar el registro local ${key}.`);
          uploadedLocalData = true;
        }
      }

      if (uploadedLocalData) {
        response = await fetch('/api/app-data', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudieron actualizar los datos desde la base de datos.');
        payload = await response.json();
      }

      let changed = false;
      synchronizing = true;
      const existingKeys = [];
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (isSharedKey(key)) existingKeys.push(key);
      }
      for (const key of existingKeys) {
        if (!payload.isEmpty && !Object.prototype.hasOwnProperty.call(payload.data, key)) {
          originalRemoveItem.call(localStorage, key);
          changed = true;
        }
      }
      for (const [key, value] of Object.entries(payload.data)) {
        if (!isSharedKey(key)) continue;
        const raw = rawValue(key, value);
        if (localStorage.getItem(key) !== raw) {
          originalSetItem.call(localStorage, key, raw);
          changed = true;
        }
      }
      synchronizing = false;

      const reloadKey = 'inbefic:backend-sync-reloaded';
      if (changed && sessionStorage.getItem(reloadKey) !== '1') {
        sessionStorage.setItem(reloadKey, '1');
        location.reload();
        return;
      }
      sessionStorage.removeItem(reloadKey);
      document.documentElement.classList.remove('inbefic-sync-loading');
      addRemoteImportButton(payload.role);
    } catch (error) {
      synchronizing = false;
      console.error('No se pudo sincronizar la aplicación con MySQL.', error);
      document.documentElement.classList.remove('inbefic-sync-loading');
    }
  }

  synchronize();
})();
