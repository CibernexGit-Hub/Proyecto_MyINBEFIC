(() => {
  const loginPath = '/inicio%20de%20sesi%C3%B3n%20ultima%20version.html';
  const labels = {
    directora: 'Directora',
    subdirectora: 'Subdirectora',
    docente: 'Docente',
    estudiante: 'Estudiante',
    secretaria: 'Secretaría'
  };
  const profileFieldLabels = {
    nombres: 'Nombres registrados',
    apellidos: 'Apellidos registrados',
    nacimiento: 'Fecha de nacimiento',
    genero: 'Sexo',
    telefono: 'Teléfono',
    correo: 'Correo electrónico de contacto',
    dui: 'DUI',
    institucion: 'Institución educativa',
    codigo: 'Código de infraestructura',
    nivel: 'Nivel educativo',
    estudios: 'Último grado académico',
    anios: 'Años de experiencia o en el cargo',
    area: 'Área de trabajo',
    turno: 'Turno',
    especialidad: 'Especialidad o asignaturas',
    grado_guia: 'Grado como docente guía',
    seccion_guia: 'Sección guía',
    nie: 'NIE',
    grado: 'Grado que cursa',
    seccion: 'Sección',
    resp_nombre: 'Nombre del responsable',
    parentesco: 'Parentesco',
    resp_tel: 'Teléfono del responsable',
    resp_dui: 'DUI del responsable'
  };

  function showError(message) {
    const topbar = document.querySelector('.topbar, .top');
    if (!topbar) return;
    let notice = document.getElementById('accountNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'accountNotice';
      notice.setAttribute('role', 'alert');
      notice.style.cssText = 'color:#a72f3f;font-size:13px;padding:8px 12px;';
      topbar.appendChild(notice);
    }
    notice.textContent = message;
  }

  function addProfileSection(user) {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main.main, main');
    const contentArea = document.querySelector('.content-area');
    const directorSections = document.querySelector('.section#inicio');
    const isDirector = Boolean(directorSections && typeof window.go === 'function');
    const parent = isDirector ? main : contentArea;

    if (!sidebar || !parent) throw new Error('No se encontró el menú o el área de contenido del perfil.');

    let navigation = sidebar.querySelector('[data-page="mi-perfil"]');
    if (!navigation) {
      navigation = document.createElement(isDirector ? 'button' : 'a');
      navigation.className = isDirector ? '' : 'nav-item';
      if (isDirector) navigation.type = 'button';
      navigation.dataset.page = 'mi-perfil';
      if (!isDirector) navigation.href = '#page-mi-perfil';
      navigation.setAttribute('aria-controls', isDirector ? 'mi-perfil' : 'page-mi-perfil');
      navigation.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg><span>Mi perfil</span>';
      sidebar.append(navigation);
    }

    let section = document.getElementById(isDirector ? 'mi-perfil' : 'page-mi-perfil');
    if (!section) {
      section = document.createElement('section');
      section.id = isDirector ? 'mi-perfil' : 'page-mi-perfil';
      section.className = isDirector ? 'section account-profile-page' : 'page-section account-profile-page';
      section.setAttribute('aria-labelledby', 'account-profile-title');
      section.innerHTML = `
      <div class="account-profile-heading">
        <span class="account-profile-eyebrow">Cuenta INBEFIC</span>
        <h2 id="account-profile-title">Mi perfil</h2>
        <p>Información asociada a la cuenta que utilizaste al registrarte.</p>
      </div>
      <article class="account-profile-card">
        <div class="account-profile-identity">
          <div class="account-profile-avatar" aria-hidden="true"></div>
          <div>
            <h3 class="account-profile-name"></h3>
            <span class="account-profile-role"></span>
          </div>
        </div>
        <dl class="account-profile-details"></dl>
        <p class="account-profile-note"></p>
      </article>`;
      const footer = isDirector ? null : parent.querySelector('.sc-foot');
      if (footer) parent.insertBefore(section, footer);
      else parent.append(section);

      navigation.addEventListener('click', event => {
        event.preventDefault();
        if (isDirector) {
          window.go('mi-perfil', navigation);
        } else {
          document.querySelectorAll('.page-section').forEach(page => page.classList.remove('active'));
          const home = document.getElementById('homeSection');
          if (home) home.style.display = 'none';
          section.classList.add('active');
          document.querySelectorAll('.nav-item[data-page]').forEach(item => item.classList.remove('active'));
          navigation.classList.add('active');
          window.scrollTo(0, 0);
        }
        const sidebarBackdrop = document.getElementById('sidebarBackdrop');
        sidebar.classList.remove('abierto');
        sidebarBackdrop?.classList.remove('activo');
      });
    }

    const roleKey = new URLSearchParams(window.location.search).get('cargo');
    const role = user ? labels[user.role] : labels[roleKey] || document.querySelector('.profile-block .role')?.textContent || 'Perfil';
    const fullName = user ? String(user.fullName || '') : 'Inicia sesión para ver tu perfil';
    const email = user ? String(user.email || '') : 'Disponible al iniciar sesión';
    const initials = fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toLocaleUpperCase())
      .join('');
    section.querySelector('.account-profile-avatar').textContent = initials;
    section.querySelector('.account-profile-name').textContent = fullName;
    section.querySelector('.account-profile-role').textContent = role;

    const details = section.querySelector('.account-profile-details');
    details.replaceChildren();
    const profile = user?.profile && typeof user.profile === 'object' && !Array.isArray(user.profile)
      ? user.profile
      : {};
    const entries = [
      ['Nombre completo de Google', fullName],
      ['Correo verificado de Google', email],
      ['Cargo del perfil', role],
      ...Object.entries(profile)
        .filter(([key, value]) => profileFieldLabels[key] && typeof value === 'string' && value.trim())
        .map(([key, value]) => [profileFieldLabels[key], value])
    ];
    entries.forEach(([label, value]) => {
      const item = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      item.append(term, description);
      details.append(item);
    });
    section.querySelector('.account-profile-note').textContent = user
      ? Object.keys(profile).length
        ? 'Estos datos se consultan desde tu cuenta y no se modifican desde esta pantalla.'
        : 'Tu cuenta se creó antes de solicitar los datos adicionales; esos campos aparecerán después de completar un registro actualizado.'
      : 'Para mostrar la información de tu registro, abre la aplicación e inicia sesión con Google.';
  }

  async function loadProfile() {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) {
      window.location.replace(loginPath);
      return;
    }
    if (!response.ok) throw new Error('No se pudo comprobar la sesión.');
    const { user } = await response.json();
    if (!user || !labels[user.role]) throw new Error('El perfil de esta sesión no es válido.');

    const name = document.querySelector('.profile-block .name');
    const role = document.querySelector('.profile-block .role');
    if (name) name.textContent = user.fullName;
    if (role) role.textContent = labels[user.role];
    addProfileSection(user);

    const topbar = document.querySelector('.topbar, .top-actions');
    if (!topbar || document.getElementById('accountLogout')) return;
    const button = document.createElement('button');
    button.id = 'accountLogout';
    button.type = 'button';
    button.textContent = 'Cerrar sesión';
    button.setAttribute('aria-label', `Cerrar sesión de ${user.email}`);
    button.style.cssText = 'margin-left:12px;padding:9px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#26324b;font:inherit;font-size:14px;font-weight:600;cursor:pointer;flex:none;';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const logout = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!logout.ok) throw new Error('El servidor no pudo cerrar la sesión.');
        window.location.replace(loginPath);
      } catch (error) {
        console.error('No se pudo cerrar la sesión.', error);
        button.disabled = false;
        showError('No se pudo cerrar la sesión. Comprueba tu conexión e inténtalo de nuevo.');
      }
    });
    topbar.appendChild(button);
  }

  const profileStyles = document.createElement('style');
  profileStyles.textContent = `
    .account-profile-page{color:#172b3a}
    .account-profile-heading{margin-bottom:20px}
    .account-profile-eyebrow{color:#52717c;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    .account-profile-heading h2{margin:5px 0;color:#153b52;font-size:clamp(24px,3vw,32px)}
    .account-profile-heading p{margin:0;color:#657982}
    .account-profile-card{max-width:820px;padding:24px;border:1px solid #dce5eb;border-radius:18px;background:#fff;box-shadow:0 10px 28px rgba(27,52,68,.08)}
    .account-profile-identity{display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:1px solid #e6edf0}
    .account-profile-avatar{display:grid;width:68px;height:68px;flex:none;place-items:center;border-radius:50%;background:linear-gradient(135deg,#153b52,#27846d);color:#fff;font-size:22px;font-weight:800}
    .account-profile-name{margin:0 0 5px;color:#153b52;font-size:21px}
    .account-profile-role{display:inline-block;padding:5px 10px;border-radius:999px;background:#eaf4f1;color:#17604f;font-size:13px;font-weight:700}
    .account-profile-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:20px 0}
    .account-profile-details div{min-width:0;padding:14px;border:1px solid #e6edf0;border-radius:12px;background:#f8fafb}
    .account-profile-details dt{margin-bottom:5px;color:#657982;font-size:12px;font-weight:700;text-transform:uppercase}
    .account-profile-details dd{margin:0;overflow-wrap:anywhere;color:#172b3a;font-size:15px;font-weight:600}
    .account-profile-note{margin:0;color:#657982;font-size:13px}
    body.modo-oscuro .account-profile-card{border-color:#33354a;background:#22242f}
    body.modo-oscuro .account-profile-heading h2,body.modo-oscuro .account-profile-name,body.modo-oscuro .account-profile-details dd{color:#eceef1}
    body.modo-oscuro .account-profile-details div{border-color:#33354a;background:#262838}
    body.modo-oscuro .account-profile-role{background:#263c3a;color:#a8e7d0}
    @media(max-width:600px){.account-profile-card{padding:18px}.account-profile-details{grid-template-columns:1fr}}
  `;
  document.head.append(profileStyles);

  addProfileSection();
  if (window.location.protocol === 'file:') return;
  loadProfile().catch(error => {
    console.error('No se pudo cargar el perfil de Google.', error);
    const note = document.querySelector('.account-profile-note');
    if (note) note.textContent = 'No se pudo cargar la información del registro. Comprueba tu sesión y vuelve a intentarlo.';
    showError('No se pudo verificar tu perfil. Recarga la página o inicia sesión de nuevo.');
  });
})();
