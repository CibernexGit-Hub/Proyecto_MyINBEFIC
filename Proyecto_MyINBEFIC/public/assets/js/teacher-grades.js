(() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function initialize() {
    const section = document.getElementById('page-notas');
    if (!section) return;
    const card = document.createElement('section');
    card.className = 'card border-0 shadow-sm mb-4';
    card.style.cssText = 'background:#fff;color:#243547;border-radius:16px;padding:20px;max-width:1100px;margin:0 auto 24px';
    card.innerHTML = `
      <h2 style="margin:0 0 6px;font-size:1.35rem">Calificaciones de estudiantes inscritos</h2>
      <p data-guide style="margin:0 0 16px;color:#667085"></p>
      <form data-guide-form style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end;margin:0 0 18px;padding:14px;background:#f8fafc;border-radius:12px">
        <label>Grado guía<select name="grade" required style="display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></select></label>
        <label>Sección guía<select name="section" required style="display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></select></label>
        <button type="submit" style="border:0;border-radius:8px;padding:11px 16px;background:#475467;color:#fff;font-weight:700">Guardar grupo guía</button>
      </form>
      <form data-form style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end">
        <label>Estudiante<select name="studentId" required style="display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></select></label>
        <label>Asignatura<input name="subject" required maxlength="100" placeholder="Matemática" style="display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></label>
        <label>Período<select name="period" required style="display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px">
          <option value="Primer periodo">Primer período</option><option value="Segundo periodo">Segundo período</option>
          <option value="Tercer periodo">Tercer período</option><option value="Cuarto periodo">Cuarto período</option>
        </select></label>
        <label>Nota (0 a 10)<input name="score" type="number" min="0" max="10" step="0.01" required style="display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></label>
        <label>Comentario opcional<input name="comment" maxlength="500" style="display:block;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></label>
        <button type="submit" style="border:0;border-radius:8px;padding:11px 16px;background:#102f52;color:#fff;font-weight:700">Guardar nota</button>
      </form>
      <p data-status role="status" style="margin:12px 0;color:#475467"></p>
      <div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:520px">
        <thead><tr><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Estudiante</th><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Asignatura</th><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Período</th><th style="text-align:left;padding:9px;border-bottom:1px solid #ddd">Nota</th></tr></thead>
        <tbody data-grades></tbody>
      </table></div>`;
    section.prepend(card);

    const form = card.querySelector('[data-form]');
    const guideForm = card.querySelector('[data-guide-form]');
    const studentSelect = form.elements.studentId;
    const status = card.querySelector('[data-status]');
    let students = [];
    for (const grade of [
      'Parvularia', '1° grado', '2° grado', '3° grado', '4° grado', '5° grado',
      '6° grado', '7° grado', '8° grado', '9° grado', '1° año de bachillerato',
      '2° año de bachillerato', '3° año de bachillerato'
    ]) guideForm.elements.grade.add(new Option(grade, grade));
    for (const group of ['A', 'B', 'C']) guideForm.elements.section.add(new Option(group, group));

    function renderGrades(grades) {
      const byId = new Map(students.map(student => [String(student.id), student]));
      const body = card.querySelector('[data-grades]');
      body.replaceChildren();
      for (const grade of grades) {
        const student = byId.get(String(grade.studentId));
        if (!student) continue;
        const row = document.createElement('tr');
        row.innerHTML = `<td style="padding:9px;border-bottom:1px solid #eee">${escapeHtml(student.name)}</td>
          <td style="padding:9px;border-bottom:1px solid #eee">${escapeHtml(grade.subject)}</td>
          <td style="padding:9px;border-bottom:1px solid #eee">${escapeHtml(grade.period)}</td>
          <td style="padding:9px;border-bottom:1px solid #eee"><strong>${escapeHtml(grade.score)}</strong></td>`;
        body.append(row);
      }
      if (!body.children.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" style="padding:12px;color:#667085">Aún no hay calificaciones guardadas para tus estudiantes guía.</td>';
        body.append(row);
      }
    }

    async function load() {
      const response = await fetch('/api/teacher/students', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los estudiantes inscritos.');
      students = result.students;
      studentSelect.replaceChildren(new Option('Selecciona un estudiante', ''));
      for (const student of students) {
        studentSelect.add(new Option(`${student.name} · NIE ${student.nie}`, String(student.id)));
      }
      const guide = card.querySelector('[data-guide]');
      guide.textContent = result.guide
        ? `Grupo guía: ${result.guide.grade}, sección ${result.guide.section}. Las notas se guardan en la cuenta del estudiante.`
        : 'Configura tu grado y sección guía para que aparezcan tus estudiantes inscritos.';
      if (result.guide) {
        guideForm.elements.grade.value = result.guide.grade;
        guideForm.elements.section.value = result.guide.section.toUpperCase();
      }
      form.querySelector('button').disabled = students.length === 0;
      if (!students.length && result.guide) {
        status.textContent = 'Todavía no hay cuentas de estudiante registradas para este grado y sección.';
      }
      renderGrades(result.grades);
    }

    guideForm.addEventListener('submit', async event => {
      event.preventDefault();
      status.textContent = 'Guardando grupo guía…';
      try {
        const response = await fetch('/api/teacher/guide-assignment', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(guideForm)))
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo guardar el grupo guía.');
        status.textContent = 'Grupo guía guardado.';
        await load();
      } catch (error) {
        status.textContent = error.message;
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      status.textContent = 'Guardando…';
      const payload = Object.fromEntries(new FormData(form));
      payload.score = Number(payload.score);
      payload.studentId = Number(payload.studentId);
      try {
        const response = await fetch('/api/teacher/grades', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo guardar la nota.');
        status.textContent = 'Nota guardada. Ya aparece en el panel del estudiante.';
        await load();
        form.elements.studentId.value = String(payload.studentId);
        form.elements.subject.value = payload.subject;
        form.elements.period.value = payload.period;
        form.elements.score.value = String(payload.score);
        form.elements.comment.value = payload.comment;
      } catch (error) {
        status.textContent = error.message;
      }
    });

    load().catch(error => {
      status.textContent = error.message;
      console.error('No se pudieron cargar estudiantes y calificaciones.', error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
