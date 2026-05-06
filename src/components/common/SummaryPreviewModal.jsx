function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function SummaryPreviewModal({ title, subtitle = "", sections = [], onClose }) {
  const renderPrintSection = (section) => {
    if (section.table) {
      return `
        <section>
          <h2>${escapeHtml(section.label)}</h2>
          <table>
            <thead>
              <tr>
                ${section.table.headers
                  .map((header) => `<th>${escapeHtml(header)}</th>`)
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${section.table.rows
                .map(
                  (row) => `
                    <tr>
                      ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `;
    }

    return `
      <section>
        <h2>${escapeHtml(section.label)}</h2>
        <p>${escapeHtml(section.value)}</p>
      </section>
    `;
  };

  const handlePrintPdf = () => {
    const reportHtml = `
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body {
              margin: 36px;
              color: #1f2a1f;
              font-family: Arial, sans-serif;
              line-height: 1.45;
            }
            h1 {
              margin: 0 0 6px;
              color: #2f7a45;
              font-size: 28px;
            }
            .subtitle {
              margin: 0 0 24px;
              color: #657065;
            }
            section {
              margin: 0 0 18px;
              padding: 14px 0;
              border-top: 1px solid #d9dfd6;
              break-inside: avoid;
            }
            h2 {
              margin: 0 0 8px;
              color: #1f2a1f;
              font-size: 16px;
            }
            p {
              margin: 0;
              color: #3f4a3f;
              white-space: pre-line;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            th,
            td {
              padding: 8px;
              border: 1px solid #cbd5c5;
              text-align: left;
            }
            th {
              color: #2f7a45;
              background: #eef8eb;
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
          ${sections.map(renderPrintSection).join("")}
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="summary-modal-backdrop" onClick={onClose}>
      <section
        className="summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="summary-modal-head">
          <div>
            <p>Preview</p>
            <h2 id="summary-modal-title">{title}</h2>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close summary preview">
            X
          </button>
        </div>

        <div className="summary-modal-body">
          {sections.map((section) => (
            <article key={section.label}>
              <strong>{section.label}</strong>
              {section.table ? (
                <div className="summary-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {section.table.headers.map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row, index) => (
                        <tr key={`${section.label}-${index}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`${section.label}-${index}-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>{section.value}</p>
              )}
            </article>
          ))}
        </div>

        <div className="summary-modal-actions">
          <button type="button" onClick={handlePrintPdf}>
            Download PDF
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export default SummaryPreviewModal;
