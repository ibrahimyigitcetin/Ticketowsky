// Audit Log Engine — extracted from inline script for CSP compliance (Bug Report v6 §2.5)
(function () {
    let currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
    }

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (currentTheme === 'dark') {
                currentTheme = 'light';
                document.body.classList.add('light-theme');
            } else {
                currentTheme = 'dark';
                document.body.classList.remove('light-theme');
            }
            localStorage.setItem('theme', currentTheme);
        });
    }

    function loadAuditLog() {
        const data = localStorage.getItem('security_audit_log');
        return data ? JSON.parse(data) : [];
    }

    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('tr-TR');
    }

    function renderAuditLog(filter = 'all') {
        const tbody = document.getElementById('auditTableBody');
        if (!tbody) return;

        try {
            console.log("--- SECURITY AUDIT RENDER START ---");
            const rawData = localStorage.getItem('security_audit_log');
            if (!rawData) {
                tbody.innerHTML = '<tr class="empty-state"><td colspan="4">Henüz güvenlik kaydı bulunmamaktadır.</td></tr>';
                return;
            }

            const logs = JSON.parse(rawData);
            if (!Array.isArray(logs)) {
                tbody.innerHTML = '<tr class="error-state"><td colspan="4">Hata: Kayıt formatı geçersiz.</td></tr>';
                return;
            }

            const normalizedLogs = logs.map((log, index) => {
                try {
                    if (!log || typeof log !== 'object') return null;
                    return {
                        timestamp: log.timestamp || new Date().toISOString(),
                        severity: (log.severity || log.level || 'info').toLowerCase(),
                        event: log.event || 'Unknown Event',
                        details: log.details || log.detail || 'No details'
                    };
                } catch (err) {
                    return null;
                }
            }).filter(log => log !== null);

            document.getElementById('totalCount').textContent = normalizedLogs.length;
            document.getElementById('infoCount').textContent = normalizedLogs.filter(l => l.severity === 'info').length;
            document.getElementById('warningCount').textContent = normalizedLogs.filter(l => l.severity === 'warning').length;
            document.getElementById('criticalCount').textContent = normalizedLogs.filter(l => l.severity === 'critical').length;

            const filteredLogs = filter === 'all'
                ? normalizedLogs
                : normalizedLogs.filter(log => log.severity === filter);

            if (normalizedLogs.length > 0 && filteredLogs.length === 0) {
                tbody.innerHTML = `<tr class="empty-state"><td colspan="4">Bu seviyede (${filter}) kayıt bulunmamaktadır. Toplam ${normalizedLogs.length} kayıt var.</td></tr>`;
                return;
            }

            tbody.innerHTML = '';
            [...filteredLogs].reverse().forEach(log => {
                const sevClass = ['info', 'warning', 'critical'].includes(log.severity) ? log.severity : 'info';
                const tr = document.createElement('tr');

                const tdTime = document.createElement('td');
                tdTime.textContent = formatDate(log.timestamp);

                const tdLevel = document.createElement('td');
                const levelSpan = document.createElement('span');
                levelSpan.className = `audit-level ${sevClass}`;
                levelSpan.textContent = log.severity.toUpperCase();
                tdLevel.appendChild(levelSpan);

                const tdEvent = document.createElement('td');
                tdEvent.textContent = log.event;

                const tdDetails = document.createElement('td');
                tdDetails.textContent = log.details;

                tr.append(tdTime, tdLevel, tdEvent, tdDetails);
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error("CRITICAL RENDER ERROR:", error);
            tbody.innerHTML = `<tr class="error-state"><td colspan="4">Kritik Hata: ${error.message}</td></tr>`;
        }
    }

    // Event Listeners
    const filterEl = document.getElementById('levelFilter');
    if (filterEl) {
        filterEl.addEventListener('change', (e) => renderAuditLog(e.target.value));
    }

    const clearBtn = document.getElementById('clearAuditBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Tüm güvenlik kayıtlarını silmek istediğinizden emin misiniz?')) {
                localStorage.removeItem('security_audit_log');
                renderAuditLog();
            }
        });
    }

    const exportBtn = document.getElementById('exportAuditBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const logs = loadAuditLog();
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `security_audit_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Initial render
    renderAuditLog();

    // Listen for changes from other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'security_audit_log') {
            renderAuditLog();
        }
    });
})();
