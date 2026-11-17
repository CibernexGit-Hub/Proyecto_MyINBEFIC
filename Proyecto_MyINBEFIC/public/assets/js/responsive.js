(() => {
  const maxCardColumns = 14;

  function enhanceTable(table) {
    const headerRow = table.tHead?.rows[table.tHead.rows.length - 1];
    if (!headerRow) return;

    const headers = Array.from(headerRow.cells);
    if (headers.some(header => header.colSpan !== 1)) return;

    const labels = headers.map((header, index) => {
      const label = header.innerText.replace(/\s+/g, ' ').trim();
      return label || `Dato ${index + 1}`;
    });

    if (labels.length <= maxCardColumns && !table.hasAttribute('data-mobile-scroll')) {
      table.classList.add('mobile-card-table');
    } else {
      table.classList.remove('mobile-card-table');
    }

    Array.from(table.rows).forEach(row => {
      if (row.parentElement === table.tHead) return;
      Array.from(row.cells).forEach((cell, index) => {
        if (cell.colSpan !== 1) return;
        const label = labels[index];
        if (label && cell.dataset.label !== label) cell.dataset.label = label;
      });
    });

    const wrapper = table.parentElement;
    if (wrapper && wrapper !== document.body) wrapper.classList.add('table-responsive');
  }

  function enhanceTables(root = document) {
    if (root instanceof HTMLTableElement) enhanceTable(root);
    root.querySelectorAll?.('table').forEach(enhanceTable);
  }

  function enhanceChangedNode(node) {
    if (!(node instanceof Element)) return;
    const parentTable = node.closest('table');
    if (parentTable) enhanceTable(parentTable);
    enhanceTables(node);
  }

  function start() {
    enhanceTables();
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(enhanceChangedNode);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
