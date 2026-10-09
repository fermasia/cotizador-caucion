const ArtPDF = (() => {
    const model = typeof ArtQuotes !== 'undefined' ? ArtQuotes : require('./art-quotes-model.js');
    const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
    const percent = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

    function prepare(data, validateDocument) {
        const report = {
            takerName: String(data.takerName ?? '').trim(),
            docType: String(data.docType ?? '').trim(),
            docNumber: String(data.docNumber ?? '').trim(),
            activityCode: String(data.activityCode ?? '').trim(),
            activityDescription: String(data.activityDescription ?? '').trim(),
            capitas: Number(data.capitas), payroll: Number(data.payroll),
            result: model.calculate(data.capitas, data.payroll, data.quotes, data.currentIndex ?? null),
            errors: []
        };
        const error = (id, message) => report.errors.push({ id, message });
        if (!report.takerName) error('art-taker-name', 'Ingresá el nombre o razón social del cliente.');
        if (!report.docType) error('art-doc-type', 'Elegí el tipo de documento del cliente.');
        if (!validateDocument(report.docType, report.docNumber)) error('art-doc-number', 'Ingresá un documento válido según el tipo seleccionado.');
        if (!report.activityCode || !report.activityDescription) error('art-activity-search', 'Seleccioná una actividad del catálogo CIIU.');
        for (const key of ['capitas', 'payroll']) {
            if (report.result.errors[key]) error(`art-${key}`, report.result.errors[key]);
        }
        report.result.rows.forEach((row, index) => {
            for (const key of ['company', 'rate']) {
                if (row.errors[key]) error(`art-quote-${key}-${index + 1}`, `Cotización ${index + 1}: ${row.errors[key]}`);
            }
        });
        return report;
    }

    function build(report, { jsPDF, logo = null, date = new Date() }) {
        if (report.errors.length) throw new Error('Completá los datos de ART antes de exportar.');
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const navy = [30, 53, 100];
        const ink = [15, 27, 50];
        const muted = [130, 135, 148];
        const margin = 20;
        const width = 170;
        const quoteNumber = `ART-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
        let y = 62;
        doc.setProperties({ title: 'Cotización de seguro de ART', subject: 'Comparativa de primas ART', author: 'Sirius Broker de Seguros' });

        function header() {
            doc.setFillColor(244, 246, 250);
            doc.rect(0, 0, 210, 42, 'F');
            doc.setFillColor(...navy);
            doc.rect(0, 42, 210, 2, 'F');
            if (logo) doc.addImage(logo, 'PNG', margin, 12, 45, 18);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...navy);
            doc.text('COTIZACIÓN DE SEGURO DE ART', 190, 23, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...muted);
            doc.text(`Cotización N°: ${quoteNumber}   Fecha: ${date.toLocaleDateString('es-AR')}`, 190, 52, { align: 'right' });
        }

        function room(height) {
            if (y + height > 265) { doc.addPage(); header(); y = 62; }
        }

        function section(title) {
            room(30);
            doc.setFillColor(...navy);
            doc.rect(margin, y - 4, 3, 6, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...navy);
            doc.text(title, margin + 6, y);
            doc.setDrawColor(200, 205, 215);
            doc.setLineWidth(0.2);
            doc.line(margin, y + 5, 190, y + 5);
            y += 9;
        }

        function table(options) {
            doc.autoTable({
                startY: y, theme: 'grid', tableWidth: width,
                margin: { left: margin, right: margin, top: 62, bottom: 25 },
                styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, valign: 'middle', overflow: 'linebreak', lineColor: [220, 224, 232], lineWidth: 0.15 },
                headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: 'bold' },
                bodyStyles: { textColor: ink },
                alternateRowStyles: { fillColor: [247, 248, 251] },
                rowPageBreak: 'avoid',
                ...options
            });
            y = doc.lastAutoTable.finalY + 8;
        }

        header();
        section('DATOS DE LA COTIZACIÓN');
        table({
            body: [
                ['Tomador', report.takerName],
                ['Documento', `${report.docType} ${report.docNumber}`],
                ['Actividad CIIU', `${report.activityCode} - ${report.activityDescription}`],
                ['Cápitas', String(report.capitas)],
                ['Masa salarial mensual', money.format(report.payroll)],
                ['Moneda', 'ARS']
            ],
            columnStyles: { 0: { cellWidth: 46, textColor: muted }, 1: { cellWidth: 124, fontStyle: 'bold' } }
        });
        section('COMPARATIVA DE COTIZACIONES');
        const result = report.result;
        table({
            head: [['Compañía', 'Alícuota', 'Prima por cápita / mes', 'Prima mensual total', 'Prima anual total']],
            body: result.rows.map((row, index) => [
                `${index + 1}. ${row.company}${row.current ? '\nActual del cliente' : ''}`,
                `${percent.format(row.rate)}%`, money.format(row.perCapita), money.format(row.monthly), money.format(row.annual)
            ]),
            columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 20, halign: 'right' }, 2: { cellWidth: 32, halign: 'right' }, 3: { cellWidth: 34, halign: 'right' }, 4: { cellWidth: 38, halign: 'right' } },
            didParseCell(data) {
                if (data.section !== 'body') return;
                const row = result.rows[data.row.index];
                if (row.current) {
                    data.cell.styles.fillColor = navy;
                    data.cell.styles.textColor = [255, 255, 255];
                    data.cell.styles.fontStyle = 'bold';
                } else if (row.lowest) {
                    data.cell.styles.fillColor = [240, 248, 243];
                }
            }
        });
        if (result.comparisonAvailable) {
            section(result.currentIndex === null ? 'DIFERENCIAS RESPECTO DE LA MENOR PRIMA' : 'AHORRO RESPECTO DE LA COTIZACIÓN ACTUAL');
            if (result.currentIndex !== null) {
                table({
                    head: [['Propuesta', 'Resultado', 'Mensual', 'Anual', 'Porcentaje']],
                    body: result.rows.filter(row => !row.current).map(row => [
                        row.company,
                        row.monthlySavings > 0 ? 'Ahorro' : row.monthlySavings < 0 ? 'Costo adicional' : 'Sin ahorro',
                        money.format(Math.abs(row.monthlySavings)), money.format(Math.abs(row.annualSavings)),
                        row.savingsPercentage === null ? 'No calculable' : `${percent.format(Math.abs(row.savingsPercentage))}%`
                    ]),
                    columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 28 }, 2: { cellWidth: 34, halign: 'right' }, 3: { cellWidth: 36, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } }
                });
            } else {
                table({
                    head: [['Compañía', 'Prima mensual', 'Diferencia']],
                    body: result.rows.map(row => [row.company, money.format(row.monthly), row.lowest ? 'Menor prima' : row.difference === null ? 'No calculable (base $0)' : `+${percent.format(row.difference)}%`]),
                    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 45, halign: 'right' }, 2: { cellWidth: 45, halign: 'right' } }
                });
            }
        }
        const notes = [
            'Las primas se calculan con la masa salarial mensual y las alícuotas ingresadas. La prima anual equivale a 12 primas mensuales.',
            result.currentIndex !== null ? `Referencia: ${result.rows[result.currentIndex].company} (${money.format(result.referenceMonthly)}/mes). Ahorros y costos adicionales se comparan con la misma masa salarial y cápitas.` : 'Cuando hay varias cotizaciones, las diferencias se calculan respecto de la menor prima mensual.',
            ...(result.zeroBase ? ['La referencia es $0. No se calcula un porcentaje para las alternativas con costo positivo.'] : []),
            'Los valores están sujetos a las condiciones específicas de la póliza. Esta cotización no implica aceptación del riesgo ni compromiso de emisión por parte de la compañía.'
        ];
        table({ body: [['IMPORTANTE', notes.join('\n')]], columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold', textColor: navy }, 1: { cellWidth: 142, fontSize: 8, textColor: [100, 108, 122] } } });
        const pages = doc.internal.getNumberOfPages();
        for (let page = 1; page <= pages; page++) {
            doc.setPage(page);
            header();
            doc.setDrawColor(200, 205, 215);
            doc.line(margin, 278, 190, 278);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...navy);
            doc.text('SIRIUS BROKER DE SEGUROS', 105, 284, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...muted);
            doc.text(`Página ${page} de ${pages}`, 105, 290, { align: 'center' });
        }
        return { doc, filename: `Cotizacion_${quoteNumber}.pdf` };
    }

    return { prepare, build };
})();
if (typeof module !== 'undefined') module.exports = ArtPDF;
