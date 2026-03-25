// Global Error Monitor — extracted from inline script for CSP compliance
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error('--- TICKETOWSKY GLOBAL ERROR ---', { msg, url, lineNo, columnNo, error });
    if (typeof showToast === 'function') {
        showToast('Kritik Hata: ' + msg, 'error');
    }
    return false;
};
