(() => {
  function initialize() {
    const section = document.getElementById('page-notas');
    if (!section) return;
    const card = document.createElement('section');
    card.style.cssText = 'background:#fff;color:#243547;border-radius:16px;padding:20px;margin:0 auto 24px;max-width:1100px;box-shadow:0 6px 24px #102f5218';
    card.innerHTML = `
      <h2 style="margin:0 0 6px;font-size:1.35rem">Mis calificaciones</h2>
      <p data-enrollment style="margin:0 0 16px;color:#667085"></p>
      <div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:520px">
        <thead><tr><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Asignatura</th><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Período</th><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Nota</th><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Docente</th><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Comentario</th></tr></thead>
        <tbody data-grades></tbody>
      </table></div>
      <p data-status role="status" style="margin:12px 0 0;color:#667085"></p>`;
    section.prepend(card);

    const status = card.querySelector('[data-status]');
    const table = card.querySelector('[data-grades]');
    const enrollment = card.querySelector('[data-enrollment]');
    const appendCell = (row, value, strong = false) => {
      const cell = document.createElement('td');
      cell.style.cssText = 'padding:9px;border-bottom:1px solid #eee';
      if (strong) {
        const label = document.createElement('strong');
        label.textContent = value ?? '';
        cell.append(label);
      } else {
        cell.textContent = value ?? '';
      }
      row.append(cell);
    };

    async function refresh() {
      const response = await fetch('/api/student/portal', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar tus datos académicos.');
      enrollment.textContent = `Grado: ${result.student.grade || 'Sin asignar'} · Sección: ${result.student.section || 'Sin asignar'} · Docente guía: ${result.teacher ? result.teacher.name : 'Aún no asignado'}`;
      table.replaceChildren();
      for (const grade of result.grades) {
        const row = document.createElement('tr');
        appendCell(row, grade.subject);
        appendCell(row, grade.period);
        appendCell(row, grade.score, true);
        appendCell(row, grade.teacherName);
        appendCell(row, grade.comment);
        table.append(row);
      }
      if (!result.grades.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.style.cssText = 'padding:12px;color:#667085';
        cell.textContent = 'Todavía no tienes calificaciones publicadas.';
        row.append(cell);
        table.append(row);
      }
      status.textContent = `Última actualización: ${new Date().toLocaleTimeString()}`;
    }

    refresh().catch(error => {
      status.textContent = error.message;
      console.error('No se pudieron actualizar las calificaciones del estudiante.', error);
    });
    window.setInterval(() => refresh().catch(error => {
      status.textContent = error.message;
      console.error('No se pudieron actualizar las calificaciones del estudiante.', error);
    }), 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
