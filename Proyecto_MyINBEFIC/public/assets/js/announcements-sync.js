(() => {
  const storageKey = 'avisos_modal';
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const postedIds = new Set();
  let announcements = [];
  let sending = Promise.resolve();

  function parseList(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('No se pudieron leer los avisos locales.', error);
      return [];
    }
  }

  function initialize() {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Avisos generales';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.style.cssText = 'position:fixed;right:18px;bottom:82px;z-index:2147483640;border:0;border-radius:999px;padding:12px 18px;background:#102f52;color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 4px 16px #0004;cursor:pointer';

    const panel = document.createElement('section');
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Avisos generales para usuarios');
    panel.style.cssText = 'position:fixed;right:18px;bottom:140px;z-index:2147483640;width:min(420px,calc(100vw - 36px));max-height:min(65vh,560px);overflow:auto;padding:18px;background:#fff;color:#243547;border:1px solid #d9e3eb;border-radius:16px;box-shadow:0 12px 40px #102f5240;font:14px/1.5 system-ui,sans-serif';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px';
    const title = document.createElement('strong');
    title.textContent = 'Avisos para todos los usuarios';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Cerrar';
    close.style.cssText = 'border:0;background:#eef2f6;border-radius:8px;padding:6px 10px;cursor:pointer';
    header.append(title, close);
    const status = document.createElement('p');
    status.style.cssText = 'margin:0 0 8px;color:#667085';
    const list = document.createElement('div');
    list.style.cssText = 'display:grid;gap:10px';
    panel.append(header, status, list);
    document.body.append(panel, toggle);

    const setOpen = open => {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(panel.hidden));
    close.addEventListener('click', () => setOpen(false));

    function render() {
      list.replaceChildren();
      if (!announcements.length) {
        status.textContent = 'Todavía no hay avisos publicados.';
        return;
      }
      status.textContent = `${announcements.length} aviso(s) publicado(s)`;
      for (const notice of announcements) {
        const article = document.createElement('article');
        article.style.cssText = 'padding:12px;border:1px solid #e4e7ec;border-radius:12px;background:#fbfcfd';
        const heading = document.createElement('strong');
        heading.textContent = notice.title || 'Aviso';
        const message = document.createElement('p');
        message.textContent = notice.body || '';
        message.style.cssText = 'margin:6px 0';
        const meta = document.createElement('small');
        const date = notice.createdAt ? new Date(notice.createdAt).toLocaleString() : '';
        meta.textContent = [notice.author, date].filter(Boolean).join(' · ');
        article.append(heading, message, meta);
        const images = notice.payload && notice.payload.imagenes;
        if (Array.isArray(images)) {
          for (const source of images.slice(0, 3)) {
            if (typeof source !== 'string' || !source.startsWith('data:image/')) continue;
            const image = document.createElement('img');
            image.src = source;
            image.alt = '';
            image.loading = 'lazy';
            image.style.cssText = 'display:block;max-width:100%;max-height:180px;object-fit:contain;margin-top:8px;border-radius:8px';
            article.append(image);
          }
        }
        list.append(article);
      }
    }

    async function refresh() {
      const [response, userResponse] = await Promise.all([
        fetch('/api/announcements', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      ]);
      const [result, userResult] = await Promise.all([response.json(), userResponse.json()]);
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los avisos.');
      if (!userResponse.ok) throw new Error(userResult.error || 'Inicia sesión para ver los avisos.');
      announcements = result.announcements || [];
      for (const item of announcements) {
        if (item.sourceId != null && Number(item.authorId) === Number(userResult.user.id)) {
          postedIds.add(String(item.sourceId));
        }
      }
      render();
    }

    async function publish(notice) {
      if (!notice || notice.id == null) return;
      const sourceId = String(notice.id);
      if (postedIds.has(sourceId)) return;
      sending = sending.then(async () => {
        const response = await fetch('/api/announcements', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notice })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo publicar el aviso general.');
        postedIds.add(sourceId);
        await refresh();
      }).catch(error => {
        console.error('No se pudo sincronizar el aviso general.', error);
        status.textContent = error.message;
        setOpen(true);
      });
      await sending;
    }

    async function remove(notice) {
      const sourceId = String(notice.id);
      if (!postedIds.has(sourceId)) return;
      const response = await fetch(`/api/announcements/${encodeURIComponent(sourceId)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('No se pudo retirar el aviso general.');
      postedIds.delete(sourceId);
    }

    const baseline = parseList(localStorage.getItem(storageKey));
    const baselineIds = new Set(baseline.filter(item => item && item.id != null).map(item => String(item.id)));
    let currentIds = new Set(baselineIds);
    let currentNotices = baseline;
    Storage.prototype.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (this !== localStorage || key !== storageKey) return;
      const next = parseList(String(value));
      const nextIds = new Set(next.filter(item => item && item.id != null).map(item => String(item.id)));
      for (const item of next) {
        if (item && item.id != null && !currentIds.has(String(item.id)) && !baselineIds.has(String(item.id))) {
          publish(item);
        }
      }
      for (const item of currentNotices) {
        if (item && item.id != null && currentIds.has(String(item.id)) && !nextIds.has(String(item.id))) {
          remove(item).catch(error => {
            console.error('No se pudo retirar el aviso general.', error);
            status.textContent = error.message;
          });
        }
      }
      currentIds = nextIds;
      currentNotices = next;
    };
    Storage.prototype.removeItem = function(key) {
      originalRemoveItem.call(this, key);
      if (this === localStorage && key === storageKey) {
        currentIds = new Set();
        currentNotices = [];
      }
    };

    refresh().catch(error => {
      console.error('No se pudieron cargar avisos para el usuario.', error);
      status.textContent = 'No se pudieron cargar los avisos.';
    });
    window.setInterval(() => {
      for (const notice of currentNotices) {
        if (notice && notice.id != null &&
            !baselineIds.has(String(notice.id)) &&
            !postedIds.has(String(notice.id))) publish(notice);
      }
      refresh().catch(error => {
        console.error('No se pudo actualizar la lista de avisos.', error);
      });
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
