document.addEventListener('DOMContentLoaded', function () {
    const dialog = document.getElementById('backup-dialog');
    const fileInput = document.getElementById('backup-file');
    const summary = document.getElementById('backup-summary');
    const status = document.getElementById('backup-status');
    const confirmation = document.getElementById('backup-confirm');
    const restoreButton = document.getElementById('backup-restore');
    let pending = null;
    let readVersion = 0;

    function reset() {
        readVersion++;
        pending = null;
        fileInput.value = '';
        summary.textContent = '';
        summary.hidden = true;
        status.textContent = '';
        confirmation.checked = false;
        confirmation.disabled = true;
        restoreButton.disabled = true;
    }

    document.getElementById('backup-open').addEventListener('click', () => {
        reset();
        dialog.showModal();
    });
    document.getElementById('backup-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', reset);

    document.getElementById('backup-export').addEventListener('click', () => {
        try {
            const backup = ConfigBackup.capture(window.localStorage, caucionBackupDefaults, window.ciiuDefaultData);
            const blob = new Blob([JSON.stringify(backup, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Sirius_Respaldo_${backup.createdAt.replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            status.textContent = 'Respaldo generado. Conservá el archivo descargado para restaurar tu configuración.';
        } catch (error) {
            status.textContent = `No se pudo exportar la configuración. ${error.message}`;
        }
    });

    fileInput.addEventListener('change', async () => {
        const version = ++readVersion;
        pending = null;
        confirmation.checked = false;
        confirmation.disabled = true;
        restoreButton.disabled = true;
        summary.hidden = true;
        status.textContent = '';
        const file = fileInput.files[0];
        if (!file) return;
        status.textContent = 'Validando respaldo…';
        try {
            if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB.');
            const parsed = ConfigBackup.parse(await file.text());
            if (version !== readVersion) return;
            pending = parsed;
            const { caucion, artCompanies, artActivities } = parsed.data;
            const count = (number, singular, plural) => `${number} ${number === 1 ? singular : plural}`;
            summary.textContent = `Respaldo del ${new Date(parsed.createdAt).toLocaleString('es-AR')}. `
                + `${count(caucion.companias.length, 'compañía de Caución', 'compañías de Caución')}; impuestos, períodos y sellados; `
                + `${count(caucion.riesgos.length, 'riesgo', 'riesgos')}; ${count(caucion.tiposDocumento.length, 'tipo de documento', 'tipos de documento')}; `
                + `${count(artCompanies.length, 'compañía ART', 'compañías ART')}; ${count(artActivities.official.length, 'actividad oficial', 'actividades oficiales')}, `
                + `${count(artActivities.custom.length, 'personalización', 'personalizaciones')} y ${count(artActivities.deleted.length, 'actividad eliminada', 'actividades eliminadas')}.`;
            summary.hidden = false;
            confirmation.disabled = false;
            status.textContent = 'Archivo válido. Revisá el resumen y confirmá el reemplazo para importar.';
        } catch (error) {
            if (version === readVersion) status.textContent = error.message;
        }
    });

    confirmation.addEventListener('change', () => {
        restoreButton.disabled = !pending || !confirmation.checked;
    });
    restoreButton.addEventListener('click', () => {
        if (!pending || !confirmation.checked) return;
        restoreButton.disabled = true;
        try {
            ConfigBackup.restore(window.localStorage, pending);
            window.location.reload();
        } catch (error) {
            status.textContent = `No se pudo importar la configuración. ${error.message}`;
            restoreButton.disabled = false;
        }
    });
    reset();
});
