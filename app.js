// ==========================================
// STATE MANAGEMENT
// ==========================================
let tickets = [];
let currentView = 'list';
let currentTheme = 'dark';
let selectedTicketId = null;
let statusChart = null;
let priorityChart = null;

// ==========================================
// UTILITY: Debounce function
// ==========================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==========================================
// SECURITY UTILITIES (Rails Security Guide Compliant)
// ==========================================
/**
 * Escape HTML to prevent XSS attacks
 * Replaces &, <, >, ", ' with HTML entities
 * Following Rails html_escape() / h() method principles
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitize text input (removes all HTML tags)
 * Permitted list approach - only allows plain text
 */
function sanitizeText(input) {
    if (typeof input !== 'string') {
        return '';
    }
    // Remove all HTML tags completely
    return input.replace(/<[^>]*>/g, '');
}

/**
 * Validate and sanitize ticket title
 * Max length enforcement to prevent DoS
 */
function sanitizeTicketTitle(title) {
    const MAX_TITLE_LENGTH = 200;
    const sanitized = sanitizeText(title).trim();
    return sanitized.substring(0, MAX_TITLE_LENGTH);
}

/**
 * Validate and sanitize ticket description
 * Max length enforcement
 */
function sanitizeTicketDescription(desc) {
    const MAX_DESC_LENGTH = 2000;
    const sanitized = sanitizeText(desc).trim();
    return sanitized.substring(0, MAX_DESC_LENGTH);
}

/**
 * Validate and sanitize comment text
 */
function sanitizeComment(comment) {
    const MAX_COMMENT_LENGTH = 1000;
    const sanitized = sanitizeText(comment).trim();
    return sanitized.substring(0, MAX_COMMENT_LENGTH);
}

/**
 * Validate assignee name (restricted to alphanumeric, space, and Turkish characters)
 */
function sanitizeAssignee(name) {
    if (typeof name !== 'string') {
        return '';
    }
    // Whitelist: letters, numbers, spaces, Turkish characters
    const sanitized = name.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9\s]/g, '').trim();
    return sanitized.substring(0, 100);
}

/**
 * Validate file name to prevent path traversal
 */
function sanitizeFileName(filename) {
    if (typeof filename !== 'string') {
        return 'unnamed_file';
    }
    // Remove path separators and dangerous characters
    return filename.replace(/[\\/]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
}


/**
 * PII Masking: Redact sensitive information (API Keys, Passwords)
 * Prevents accidental exposure of secrets in ticket history
 */
function maskSensitiveData(text) {
    if (typeof text !== 'string') return text;
    // Patterns for common secrets
    const patterns = [
        { regex: /([a-f0-9]{32,})/gi, label: '[REDACTED_API_KEY]' }, // Hex keys
        { regex: /(password|sifre|şifre)\s*[:=]\s*[^\s,;]+/gi, label: '$1: [REDACTED_SECRET]' },
        { regex: /\b(?:\d[ -]*?){13,16}\b/g, label: '[REDACTED_CARD_NUMBER]' }
    ];
    let sanitized = text;
    patterns.forEach(p => {
        sanitized = sanitized.replace(p.regex, p.label);
    });
    return sanitized;
}

/**
 * SecurityGuardian: Simulated CSRF and Integrity Protection
 * Following Rails Authenticity Token principles
 */
const SecurityGuardian = {
    _token: null,
    _auditLog: [],

    generateToken() {
        this._token = 'TKT-' + Math.random().toString(36).substring(2, 15);
        return this._token;
    },

    verifyToken(token) {
        return token === this._token;
    },

    audit(event, details, severity = 'info') {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            event,
            details: escapeHtml(details),
            severity
        };
        this._auditLog.unshift(entry);
        console.log(`[SECURITY AUDIT] [${severity.toUpperCase()}] ${event}: ${details}`);
        if (this._auditLog.length > 100) this._auditLog.pop(); // Cap log
        this.saveAuditLog();
        // Audit logs are rendered exclusively in audit.html via localStorage
    },

    saveAuditLog() {
        localStorage.setItem('security_audit_log', JSON.stringify(this._auditLog));
    },

    loadAuditLog() {
        const saved = localStorage.getItem('security_audit_log');
        if (saved) this._auditLog = JSON.parse(saved);
    },

    renderAuditUI() {
        const list = document.getElementById('securityAuditList');
        if (!list) return;
        list.innerHTML = '';
        this._auditLog.forEach(log => {
            const div = document.createElement('div');
            div.className = `audit-entry audit-${log.level}`;
            div.innerHTML = `
                <span class="audit-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="audit-event">${log.event}</span>
                <p class="audit-details">${log.detail}</p>
            `;
            list.appendChild(div);
        });
    }
};

/**
 * Safe createElement with text content (prevents XSS)
 */
function createSafeElement(tagName, textContent = '', className = '') {
    const element = document.createElement(tagName);
    if (textContent) {
        element.textContent = textContent; // textContent is safe, not innerHTML
    }
    if (className) {
        element.className = className;
    }
    return element;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function generateId() {
    return 'TKT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}

function handleSpotlightMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('tr-TR', options);
}

function getElapsedTime(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays} gün ${diffHours % 24} saat`;
    }
    return `${diffHours} saat`;
}

// ==========================================
// SLA MANAGEMENT
// ==========================================
function getSLATargetMinutes(priority) {
    const targets = {
        'critical': 120,  // 2 hours
        'high': 240,      // 4 hours
        'medium': 480,    // 8 hours
        'low': 1440       // 24 hours
    };
    return targets[priority] || 480;
}

function calculateSLA(ticket) {
    if (!ticket || !ticket.createdAt) {
        return { status: 'completed', percentage: 100, remainingSeconds: 0, isBreached: false };
    }

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
        return { status: 'completed', percentage: 100, remainingSeconds: 0, isBreached: false };
    }

    // Candidate tickets use the same SLA as a medium priority ticket by default
    const effectivePriority = ticket.status === 'candidate' ? 'medium' : ticket.priority;
    const targetMinutes = getSLATargetMinutes(effectivePriority);

    let createdAt;
    try {
        createdAt = new Date(ticket.createdAt);
        if (isNaN(createdAt.getTime())) throw new Error('Invalid date');
    } catch (e) {
        createdAt = new Date(); // Fallback to now if date is corrupted
    }

    const now = new Date();
    const elapsedSeconds = Math.floor((now - createdAt) / 1000);
    const targetSeconds = Math.max(1, targetMinutes * 60);
    const remainingSeconds = targetSeconds - elapsedSeconds;
    const percentage = Math.min(100, Math.max(0, (elapsedSeconds / targetSeconds) * 100));

    let status = 'on-track';
    if (remainingSeconds <= 0) {
        status = 'breached';
    } else if (percentage >= 80) {
        status = 'warning';
    } else if (percentage >= 50) {
        status = 'warning';
    }

    return {
        status,
        percentage,
        remainingSeconds: Math.max(0, remainingSeconds),
        targetMinutes,
        isBreached: remainingSeconds <= 0
    };
}

function formatSLATime(seconds) {
    if (seconds === undefined || seconds === null || isNaN(seconds)) return '--:--:--';
    if (seconds <= 0) return 'Time Expired';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m left`;
    return `${mins}m ${secs}s left`;
}

function showToast(message, type = 'info') {
    // Robustness check: Prevent "undefined" or empty notifications
    if (!message || message === 'undefined' || typeof message !== 'string') {
        console.warn('showToast blocked invalid message:', message);
        return;
    }

    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
        success: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        error: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>',
        info: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="2"/><path d="M12 16V12M12 8H12.01" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${iconMap[type] || ''}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000); // Slightly longer duration
}

// ==========================================
// LOCAL STORAGE
// ==========================================
function saveToLocalStorage() {
    try {
        localStorage.setItem('tickets', JSON.stringify(tickets));
        localStorage.setItem('theme', currentTheme);
    } catch (e) {
        console.error('CRITICAL: LocalStorage save failed. Possibly circular structure or exceeded quota.', e);
        showToast('Veri kaydetme hatası: Tarayıcı hafızası dolu veya hatalı veri.', 'error');
    }
}

function loadFromLocalStorage() {
    const savedTickets = localStorage.getItem('tickets');
    const savedTheme = localStorage.getItem('theme');

    try {
        if (savedTickets && savedTickets !== 'undefined' && savedTickets !== 'null') {
            tickets = JSON.parse(savedTickets);
        }
    } catch (e) {
        console.error('Failed to parse tickets from localStorage:', e);
        tickets = [];
    }

    // Force initialization for this version (v2-fixed)
    if (!localStorage.getItem('ticketowsky_v2_fixed') || !Array.isArray(tickets) || tickets.length < 50) {
        console.warn('Rebuilding database for v2-fixed...');
        localStorage.clear(); // Clean state
        createSampleData();
        localStorage.setItem('ticketowsky_v2_fixed', 'true');
    }

    if (savedTheme) {
        currentTheme = savedTheme;
        if (currentTheme === 'light') {
            document.body.classList.add('light-theme');
        }
    }
}

function createSampleData() {
    const sampleTickets = [
        // CRITICAL & HIGH PRIORITY (1-10)
        {
            id: generateId(),
            title: 'Critical Down: Login Service 500 Error',
            description: 'Kullanıcılar sisteme giriş yapamıyor. Backend loglarında NullPointerException dönüyor. System Tray bazlı bildirimler de blocklanmış durumda. Acil aksiyon bekleniyor.',
            status: 'in-progress',
            priority: 'critical',
            category: 'bug',
            assignee: 'Ahmet Yılmaz',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 4,
            comments: [{ id: 1, author: 'Ayşe Demir', text: 'Auth service katmanında bottleneck olabilir.', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() }],
            attachments: [],
            timeline: [{ action: 'Bilet oluşturuldu', user: 'System', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() }]
        },
        {
            id: generateId(),
            title: 'Mali Müşavirlik Portalı Connectivity Issue',
            description: 'Portal üzerinden yapılan veri gönderimlerinde timeout alınıyor. Connectivity down durumda. Proxy ayarları check edilmeli.',
            status: 'open',
            priority: 'critical',
            category: 'bug',
            assignee: '',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 2,
            comments: [],
            attachments: [],
            timeline: []
        },
        {
            id: generateId(),
            title: 'Registry Configuration Rollback Required',
            description: 'Son patch sonrası registry ayarları bozulmuş. Business-critical app\'ler çalışmıyor. Rollback handle edilmeli.',
            status: 'candidate',
            priority: 'high',
            category: 'task',
            assignee: 'Sistem (AI)',
            createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 1,
            comments: [],
            attachments: [],
            timeline: []
        },
        {
            id: generateId(),
            title: 'Database Deadlock: Inventory Update',
            description: 'Stok güncellemeleri sırasında SQL deadlock yaşanıyor. Indexleme tune edilmeli. Impact çok yüksek.',
            status: 'in-progress',
            priority: 'high',
            category: 'bug',
            assignee: 'Caner Öz',
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 6,
            comments: [],
            attachments: [],
            timeline: []
        },
        {
            id: generateId(),
            title: 'VPN Bandwidth Optimization',
            description: 'Uzaktan çalışma trafiği nedeniyle VPN bottleneck yaşıyor. Latency değerlerini minimize etmemiz lazım.',
            status: 'open',
            priority: 'high',
            category: 'task',
            assignee: 'Melisa Can',
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 8,
            comments: [],
            attachments: [],
            timeline: []
        },
        {
            id: generateId(),
            title: 'Firewall Brute-Force Probe Detected',
            description: 'Loglarda anormal login denemeleri var. IP blocklama aksiyonu alınmalı. Cyber security katmanı alarmda.',
            status: 'resolved',
            priority: 'critical',
            category: 'bug',
            assignee: 'Sistem (AI)',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 1,
            comments: [],
            attachments: [],
            timeline: []
        },
        {
            id: generateId(),
            title: 'SSL Certificate Expiry Alarm',
            description: 'Ana domain sertifikası 24 saat içinde expire olacak. Renew edilmezse tüm servisler down olur.',
            status: 'open',
            priority: 'critical',
            category: 'task',
            assignee: '',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 1,
            comments: [],
            attachments: [],
            timeline: []
        },
        {
            id: generateId(),
            title: 'Executive Dashboard Performance Issue',
            description: 'C-level dashboard rendering çok slow. Query optimizasyonu ve frontend tune şart.',
            status: 'in-progress',
            priority: 'high',
            category: 'bug',
            assignee: 'Zeynep Öz',
            createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 5,
            comments: [],
            attachments: [],
            timeline: []
        },
        {
            id: generateId(),
            title: 'ERP Integration Handshake Failure',
            description: 'SAP entegrasyonu tarafında handshake hatası alınıyor. Middleware katmanını check edelim.',
            status: 'open',
            priority: 'high',
            category: 'support',
            assignee: '',
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 4,
            comments: [],
            attachments: [],
            timeline: []
        },
        {
            id: generateId(),
            title: 'Active Directory Sync Bottleneck',
            description: 'Kullanıcı yetkilendirmeleri yavaş yansıyor. Domain controller sync gecikmesi yaşanıyor.',
            status: 'open',
            priority: 'high',
            category: 'bug',
            assignee: 'Caner Öz',
            createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            estimatedHours: 12,
            comments: [],
            attachments: [],
            timeline: []
        },

        // TICKETS 11-50 (Diverse scenarios)
        ...[
            { t: 'Outlook Add-in Crash', d: 'Office 365 güncellemesi sonrası eklenti crash oluyor.', p: 'medium', c: 'bug' },
            { t: 'New Feature: Bulk User Export', d: 'Admin paneline Excel export yeteneği eklenmesi lazım.', p: 'low', c: 'feature' },
            { t: 'Hardware Maintenance: Server Rack 4', d: 'Fiziksel disk değişimi ve kablolama düzenlemesi.', p: 'medium', c: 'task' },
            { t: 'Shadow IT Search: Unapproved Tools', d: 'Şirket ağında kullanılan izinsiz yazılımların tespiti.', p: 'medium', c: 'support' },
            { t: 'Sentiment Analysis: Low Satisfaction', d: 'Canlı destek biletlerinde stres seviyesi yüksek kullanıcı tespiti.', p: 'low', c: 'support' },
            { t: 'Cloud Migration: S3 Bucket Setup', d: 'Yeni arşiv katmanı için bucket konfigürasyonu yapılacak.', p: 'medium', c: 'task' },
            { t: 'Network Latency in Istanbul Branch', d: 'Şube hattında drop yaşanıyor. ISP ile görüşülmeli.', p: 'high', c: 'bug' },
            { t: 'Printer Driver Mass Deployment', d: 'Tüm departmanlara yeni nesil sürücülerin itilmesi.', p: 'low', c: 'task' },
            { t: 'Security Patch: CVE-2026-001', d: 'Zero-day açığı için acil yamalama çalışması.', p: 'critical', c: 'bug' },
            { t: 'User Onboarding: Sales Team', d: 'Yeni başlayan 5 kişi için account ve donanım hazırlığı.', p: 'medium', c: 'task' },
            { t: 'Mobile App Store Upload', d: 'iOS/Android buildlerinin store\'a submitt edilmesi.', p: 'medium', c: 'task' },
            { t: 'Legacy App Support: Windows XP VM', d: 'Custom app için kullanılan VM erişim hatası.', p: 'low', c: 'support' },
            { t: 'Teams Integration Webhook Issue', d: 'Bildirimler kanal gelmiyor. Webhook expire olmuş olabilir.', p: 'medium', c: 'bug' },
            { t: 'Data Warehouse Daily Job Failure', d: 'Morning report dataları gelmedi. ETL job down.', p: 'high', c: 'bug' },
            { t: 'Software Audit: License Registry', d: 'Yıllık lisans check and compliance raporu.', p: 'low', c: 'task' },
            { t: 'Wi-Fi Coverage Gap: Meeting Room 5', d: 'Access point konumlandırması veya sinyal güçlendirme.', p: 'medium', c: 'task' },
            { t: 'GitHub Action Run timeout', d: 'CI/CD pipeline bazen timeout oluyor. Runner optimizasyonu.', p: 'medium', c: 'bug' },
            { t: 'Docker Container OOM Kill', d: 'Microservice RAM aşımı nedeniyle restart oluyor.', p: 'high', c: 'bug' },
            { t: 'Password Reset Request (CEO)', d: 'VIP kullanıcı şifre sıfırlama talebi. Bypass MFA.', p: 'critical', c: 'support' },
            { t: 'Kubernetes Node Unschedulable', d: 'Cluster kapasite sorunu. Yeni node eklenecek.', p: 'high', c: 'task' },
            { t: 'Redis Cache Eviction Policy', d: 'Cache doluluğu nedeniyle performans düşüşü.', p: 'medium', c: 'bug' },
            { t: 'Slack Bot unresponsive', d: 'Internal bot komutlara cevap vermiyor.', p: 'low', c: 'bug' },
            { t: 'API Gateway Rate Limit Adjust', d: 'Partner erişim limiti artırılacak.', p: 'medium', c: 'feature' },
            { t: 'Dev Environment Refresh', d: 'Staging datalarının dev ortamına klonlanması.', p: 'low', c: 'task' },
            { t: 'Nginx Config Syntax Error', d: 'Reload sonrası konfigürasyon hatası alındı.', p: 'high', c: 'bug' },
            { t: 'Disk Space Alert: Log Server', d: 'Loglar diski doldurmuş. Temizlik handle edilmeli.', p: 'medium', c: 'bug' },
            { t: 'HR System Integration issue', d: 'Workday verileri ERP\'ye eksik geçiyor.', p: 'high', c: 'support' },
            { t: 'Macbook Battery Replacement', d: 'Donanım arızası - Batarya şişmesi tespiti.', p: 'medium', c: 'task' },
            { t: 'Phishing Simulation Report', d: 'Son yapılan testin metriclerinin analizi.', p: 'low', c: 'support' },
            { t: 'Backup Tape Rotation', d: 'Fiziksel yedeklerin off-site depoya gönderimi.', p: 'medium', c: 'task' },
            { t: 'Terraform State Lock issue', d: 'Deployment blocklanmış durumda. Lock kaldırılmalı.', p: 'high', c: 'bug' },
            { t: 'Grafana Dashboard: CPU Spike', d: 'Anlık CPU artışı uyarısı sonrası inceleme.', p: 'medium', c: 'support' },
            { t: 'Zoom Connector failure', d: 'Takvim entegrasyonu düzgün çalışmıyor.', p: 'low', c: 'bug' },
            { t: 'Inventory Audit: Laptop Serial Nos', d: 'Seri no doğrulama ve envanter güncelleme.', p: 'low', c: 'task' },
            { t: 'Azure AD Conditional Access', d: 'Yeni lokasyon bazlı erişim politikası tanımı.', p: 'medium', c: 'feature' },
            { t: 'Monitor Flicker: Call Center', d: 'Kablo veya donanım bazlı ekran titremesi.', p: 'low', c: 'support' },
            { t: 'Elasticsearch Heap Size Increase', p: 'high', c: 'task', d: 'Search performansını handle etmek için RAM artırımı.' },
            { t: 'Vulnerability Scan: Branch Office', d: 'Şube ağı için güvenlik taraması başlatılacak.', p: 'medium', c: 'task' },
            { t: 'Mail Relay Delay', d: 'Dış maillerde 5-10 dk gecikme yaşanıyor.', p: 'high', c: 'bug' },
            { t: 'Bitlocker Recovery Key request', d: 'Kilitlenen cihaz için key temini.', p: 'medium', c: 'support' }
        ].map((info, i) => {
            const titlePool = [
                'Zombi Process: updater.exe (v1.2) - High CPU', 'WPA3 Handshake Failure - Wi-Fi AP #12', 'Print Spooler - Service hang (Local Admin context)',
                'Domain Controller - Sync Latency > 300ms', 'Suspicious PowerShell - EncodedCommand detected', 'Mali Müşavirlik Portalı - SSL Handshake Error',
                'Registry Key modification: ProxyServer forced', 'Hardware Predict: NVMe Temp reaching 85°C', 'Bitlocker status: Partitions decrypted unsafely',
                'VPN Tunnel - Packet loss > 15%', 'Docker Desktop - Vmmem exhaustion', 'Teams.exe - Heavy signaling loop detected',
                'Firewall Reject: Port 3389 (RDP) Brute-force', 'Ghost process: auto-clicker.exe identified', 'Sentiment Alert: User frustration level HIGH',
                'Silent Crash: background_worker.js - OOM', 'Anomalous login: CEO Account (IP: Unknown)', 'Hardware: SSD SMART Status - Failing soon',
                'Shadow IT: Tor Browser connection attempt', 'Service Monitor: Database connection pool full', 'Registry: Unauthorized GPO override attempt',
                'System: Multiple Explorer.exe restarts detected', 'Kernel Panic - Non-pageable area violation', 'Disk Queue Length > 5.0 - I/O Bottleneck'
            ];
            const descPool = [
                'Sistem loglarında kritik seviyede anomali tespit edildi. Hızlı aksiyon gerekiyor.',
                'Kullanıcı deneyimi olumsuz etkileniyor. Donanım veya yazılım kaynaklı olabilir.',
                'Güvenlik politikaları ihlali şüphesi. Detaylı analiz ve karantina önerilir.',
                'Network katmanında paket kaybı ve yüksek latans gözlemlendi.',
                'Uygulama belleği (OOM) sınırda geziyor. Memory leak kontrolü yapılmalı.',
                'Kayıt defteri ayarlarında yetkisiz değişiklik girişimi engellendi.'
            ];

            return {
                id: generateId(),
                title: info.t || titlePool[i % titlePool.length],
                description: info.d || descPool[i % descPool.length] + `\n\n[Sistem Notu: Bilet #${i + 11} otomatik olarak zenginleştirildi.]`,
                status: i % 4 === 0 ? 'open' : (i % 4 === 1 ? 'in-progress' : (i % 4 === 2 ? 'candidate' : 'closed')),
                priority: info.p,
                category: info.c,
                assignee: ['Ahmet Yılmaz', 'Melisa Can', 'Caner Öz', 'Zeynep Öz', 'Sistem (AI)'][i % 5],
                createdAt: new Date(Date.now() - (i + 1) * 12 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date().toISOString(),
                estimatedHours: (i % 5) + 2,
                comments: [],
                attachments: [],
                timeline: []
            };
        })
    ];

    tickets = sampleTickets;
    saveToLocalStorage();
}

// ==========================================
// TICKET PASSING (Collaboration)
// ==========================================
function passTicket(ticketId, targetUser) {
    const ticket = getTicket(ticketId);
    if (!ticket) return;

    const actionText = `Bilet ${targetUser} kullanıcısına paslandı.`;
    const updatedTimeline = [...ticket.timeline, {
        action: actionText,
        user: 'System',
        timestamp: new Date().toISOString()
    }];

    updateTicket(ticketId, {
        assignee: targetUser,
        timeline: updatedTimeline,
        authenticity_token: SecurityGuardian._token
    });

    showToast(actionText, 'success');
    render();
    if (selectedTicketId === ticketId) renderDetailPanel(ticketId);
}


// ==========================================
// TICKET CRUD OPERATIONS
// ==========================================
/**
 * PERMITTED_PARAMS: White-list for mass assignment protection (Rails Guide)
 */
const PERMITTED_PARAMS = ['title', 'description', 'status', 'priority', 'category', 'assignee', 'estimatedHours', 'authenticity_token'];

function createTicket(ticketData) {
    // 🛡️ SECURITY: Verify CSRF Token (Simulated)
    if (!SecurityGuardian.verifyToken(ticketData.authenticity_token)) {
        const msg = `Token Mismatch: Expected="${SecurityGuardian._token}", Got="${ticketData.authenticity_token}"`;
        SecurityGuardian.audit('CSRF Failure', msg, 'critical');
        showToast('Güvenlik Hatası: Geçersiz işlem tokenı.', 'error');
        console.error('[SECURITY] CSRF Check Failed:', msg);
        return null;
    }

    // 🛡️ SECURITY: Strong Parameters (ignore unpermitted fields)
    const ticket = {
        id: generateId(),
        title: sanitizeTicketTitle(ticketData.title || ''),
        description: maskSensitiveData(sanitizeTicketDescription(ticketData.description || '')), // PII Masking
        status: ticketData.status || 'open',
        priority: ticketData.priority || 'medium',
        category: ticketData.category || 'task',
        assignee: sanitizeAssignee(ticketData.assignee || ''),
        estimatedHours: parseFloat(ticketData.estimatedHours) || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: [],
        attachments: [],
        timeline: [{
            action: 'Ticket oluşturuldu (Secure)',
            user: 'Kullanıcı',
            timestamp: new Date().toISOString()
        }]
    };

    tickets.push(ticket);
    SecurityGuardian.audit('Ticket Created', `ID: ${ticket.id} (${ticket.title})`, 'info');
    saveToLocalStorage();
    return ticket;
}


function updateTicket(id, updates) {
    // 🛡️ SECURITY: Verify CSRF Token (Simulated)
    // For local operations, we allow system-level updates if token is specifically provided or if it's an internal call
    if (updates.authenticity_token && !SecurityGuardian.verifyToken(updates.authenticity_token)) {
        SecurityGuardian.audit('CSRF Failure', `Unauthorized update attempted for Ticket ID: ${id}`, 'critical');
        showToast('Güvenlik Hatası: Token doğrulaması başarısız.', 'error');
        return null;
    }

    const ticketIndex = tickets.findIndex(t => t.id === id);
    if (ticketIndex === -1) {
        SecurityGuardian.audit('IDOR Attempt', `Access denied to non-existent or restricted Ticket ID: ${id}`, 'warning');
        return null;
    }

    const oldTicket = { ...tickets[ticketIndex] };
    const sanitizedUpdates = {};

    // 🛡️ SECURITY: Mass Assignment Protection
    PERMITTED_PARAMS.forEach(key => {
        if (updates[key] !== undefined && key !== 'authenticity_token') {
            if (key === 'title') sanitizedUpdates.title = sanitizeTicketTitle(updates.title);
            else if (key === 'description') sanitizedUpdates.description = maskSensitiveData(sanitizeTicketDescription(updates.description));
            else if (key === 'assignee') sanitizedUpdates.assignee = sanitizeAssignee(updates.assignee);
            else if (key === 'estimatedHours') sanitizedUpdates.estimatedHours = parseFloat(updates.estimatedHours) || null;
            else sanitizedUpdates[key] = updates[key]; // status, priority, category are controlled dropdowns
        }
    });

    const changes = [];
    if (sanitizedUpdates.status && sanitizedUpdates.status !== oldTicket.status) {
        changes.push({
            action: `Durum değişti: ${getStatusLabel(oldTicket.status)} → ${getStatusLabel(sanitizedUpdates.status)}`,
            user: 'Kullanıcı',
            timestamp: new Date().toISOString()
        });
    }

    tickets[ticketIndex] = {
        ...oldTicket,
        ...sanitizedUpdates,
        updatedAt: new Date().toISOString(),
        timeline: [...oldTicket.timeline, ...changes]
    };

    SecurityGuardian.audit('Ticket Updated', `ID: ${id}`, 'info');
    saveToLocalStorage();
    return tickets[ticketIndex];
}

function deleteTicket(id) {
    tickets = tickets.filter(t => t.id !== id);
    saveToLocalStorage();
}

function getTicket(id) {
    return tickets.find(t => t.id === id);
}

function addComment(ticketId, commentText) {
    const ticket = getTicket(ticketId);
    if (!ticket) return;

    // SECURITY: Sanitize comment text
    const sanitizedText = sanitizeComment(commentText);

    if (!sanitizedText) {
        return; // Don't add empty comments
    }

    const comment = {
        id: Date.now(),
        author: 'Kullanıcı',
        text: sanitizedText,
        timestamp: new Date().toISOString()
    };

    const updatedComments = [...ticket.comments, comment];
    const updatedTimeline = [...ticket.timeline, {
        action: 'Yorum eklendi',
        user: 'Kullanıcı',
        timestamp: new Date().toISOString()
    }];

    updateTicket(ticketId, {
        comments: updatedComments,
        timeline: updatedTimeline,
        authenticity_token: SecurityGuardian._token // 🛡️ Fix CSRF
    });
    return comment;
}

function addAttachment(ticketId, file) {
    const ticket = getTicket(ticketId);
    if (!ticket) return;

    // SECURITY: Sanitize filename to prevent path traversal
    const safeName = sanitizeFileName(file.name);

    const attachment = {
        id: Date.now(),
        name: safeName,
        type: file.type,
        data: file.data
    };

    const updatedAttachments = [...ticket.attachments, attachment];
    const updatedTimeline = [...ticket.timeline, {
        action: `Dosya eklendi: ${safeName}`,
        user: 'Kullanıcı',
        timestamp: new Date().toISOString()
    }];

    updateTicket(ticketId, {
        attachments: updatedAttachments,
        timeline: updatedTimeline,
        authenticity_token: SecurityGuardian._token // 🛡️ Fix CSRF
    });
    return attachment;
}

// ==========================================
// LABEL HELPERS
// ==========================================
function getStatusLabel(status) {
    const labels = {
        'open': 'Açık',
        'in-progress': 'Devam Eden',
        'resolved': 'Çözüldü',
        'closed': 'Kapalı',
        'candidate': 'Aday (Ghost)'
    };
    return labels[status] || status || 'Bilinmiyor';
}

function getPriorityLabel(priority) {
    const labels = {
        'low': 'Düşük',
        'medium': 'Orta',
        'high': 'Yüksek',
        'critical': 'Kritik'
    };
    return labels[priority] || priority || 'Bilinmiyor';
}

function getCategoryLabel(category) {
    const labels = {
        'bug': 'Bug',
        'feature': 'Özellik',
        'task': 'Görev',
        'support': 'Destek'
    };
    return labels[category] || category || 'Belirsiz';
}

// ==========================================
// STATISTICS
// ==========================================
function updateStatistics() {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in-progress' || t.status === 'candidate').length;
    const critical = tickets.filter(t => t.priority === 'critical').length;

    document.getElementById('totalTickets').textContent = total;
    document.getElementById('openTickets').textContent = open;
    document.getElementById('inProgressTickets').textContent = inProgress;
    document.getElementById('criticalTickets').textContent = critical;
}

function initCharts() {
    // Status Chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    const statusData = {
        labels: ['Açık', 'Devam Eden', 'Aday (Ghost)', 'Çözüldü', 'Kapalı'],
        datasets: [{
            data: [
                tickets.filter(t => t.status === 'open').length,
                tickets.filter(t => t.status === 'in-progress').length,
                tickets.filter(t => t.status === 'candidate').length,
                tickets.filter(t => t.status === 'resolved').length,
                tickets.filter(t => t.status === 'closed').length
            ],
            backgroundColor: [
                'rgba(255, 77, 0, 0.8)', // Open: Molten Orange
                'rgba(255, 204, 0, 0.8)', // In Progress: Hazard Yellow
                'rgba(0, 217, 255, 0.8)', // Candidate: Electric Blue
                'rgba(204, 255, 0, 0.8)', // Resolved: Hazard Lime
                'rgba(107, 114, 112, 0.8)' // Closed: Industrial Grey
            ],
            borderWidth: 0
        }]
    };

    if (statusChart) {
        statusChart.destroy();
    }

    statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: statusData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary'),
                        padding: 15,
                        font: { size: 12 }
                    }
                }
            }
        }
    });

    // Priority Chart
    const priorityCtx = document.getElementById('priorityChart').getContext('2d');
    const priorityData = {
        labels: ['Düşük', 'Orta', 'Yüksek', 'Kritik'],
        datasets: [{
            label: 'Tickets',
            data: [
                tickets.filter(t => t.priority === 'low').length,
                tickets.filter(t => t.priority === 'medium').length,
                tickets.filter(t => t.priority === 'high').length,
                tickets.filter(t => t.priority === 'critical').length
            ],
            backgroundColor: [
                'rgba(204, 255, 0, 0.8)', // Low: Hazard Lime
                'rgba(0, 217, 255, 0.8)', // Medium: Electric Blue
                'rgba(255, 77, 0, 0.8)', // High: Molten Orange
                'rgba(255, 34, 0, 0.8)'  // Critical: Heat Red
            ],
            borderWidth: 0
        }]
    };

    if (priorityChart) {
        priorityChart.destroy();
    }

    priorityChart = new Chart(priorityCtx, {
        type: 'bar',
        data: priorityData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                        stepSize: 1
                    },
                    grid: {
                        color: getComputedStyle(document.body).getPropertyValue('--border-color')
                    }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-secondary')
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ==========================================
// RENDERING
// ==========================================

function renderListView() {
    const tbody = document.getElementById('ticketsTableBody');
    tbody.innerHTML = ''; // Clear existing content safely

    const filtered = getFilteredTickets();

    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 9;
        td.style.textAlign = 'center';
        td.style.padding = '2rem';
        td.style.color = 'var(--text-muted)';
        td.textContent = 'Ticket bulunamadı';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    filtered.forEach((ticket, index) => {
        const sla = calculateSLA(ticket);
        const tr = document.createElement('tr');
        tr.dataset.id = ticket.id;
        tr.style.cursor = 'pointer';
        tr.style.animation = `staggerInput 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards`;
        tr.style.animationDelay = `${index * 0.05}s`;
        tr.style.opacity = '0';
        tr.style.transform = 'translateY(10px)';

        if (ticket.priority === 'critical') tr.classList.add('status-critical');
        if (ticket.status === 'candidate') tr.classList.add('ticket-candidate');

        // ID
        const tdId = document.createElement('td');
        const strongId = document.createElement('strong');
        strongId.textContent = ticket.id;
        tdId.appendChild(strongId);
        tr.appendChild(tdId);

        // Title
        const tdTitle = document.createElement('td');
        tdTitle.textContent = ticket.title;
        tr.appendChild(tdTitle);

        // Status
        const tdStatus = document.createElement('td');
        const spanStatus = document.createElement('span');
        spanStatus.className = `badge badge-status-${ticket.status}`;
        spanStatus.textContent = getStatusLabel(ticket.status);
        tdStatus.appendChild(spanStatus);
        tr.appendChild(tdStatus);

        // Priority
        const tdPriority = document.createElement('td');
        const spanPriority = document.createElement('span');
        spanPriority.className = `badge badge-priority-${ticket.priority}`;
        spanPriority.textContent = getPriorityLabel(ticket.priority);
        tdPriority.appendChild(spanPriority);
        tr.appendChild(tdPriority);

        // Category
        const tdCategory = document.createElement('td');
        const spanCategory = document.createElement('span');
        spanCategory.className = `badge badge-category-${ticket.category}`;
        spanCategory.textContent = getCategoryLabel(ticket.category);
        tdCategory.appendChild(spanCategory);
        tr.appendChild(tdCategory);

        // SLA
        const tdSLA = document.createElement('td');
        const divSLA = document.createElement('div');
        divSLA.className = `sla-indicator sla-${sla.status}`;

        const divProgress = document.createElement('div');
        divProgress.className = 'sla-progress';
        divProgress.style.width = `${sla.percentage}%`;

        const spanTime = document.createElement('span');
        spanTime.className = 'sla-text sla-digital-clock';
        spanTime.dataset.id = ticket.id;
        spanTime.textContent = formatSLATime(sla.remainingSeconds);

        divSLA.appendChild(divProgress);
        divSLA.appendChild(spanTime);
        tdSLA.appendChild(divSLA);
        tr.appendChild(tdSLA);

        // Assignee
        const tdAssignee = document.createElement('td');
        tdAssignee.textContent = ticket.assignee || '-';
        tr.appendChild(tdAssignee);

        // Created At
        const tdCreated = document.createElement('td');
        tdCreated.textContent = formatDate(ticket.createdAt);
        tr.appendChild(tdCreated);

        // Actions
        const tdActions = document.createElement('td');
        const divActions = document.createElement('div');
        divActions.className = 'ticket-actions';

        const actions = [
            { icon: '✓', action: 'resolve', title: 'Çözüldü olarak işaretle' },
            { icon: '👤', action: 'assign', title: 'Bana ata' },
            { icon: '🗑️', action: 'delete', title: 'Sil' }
        ];

        actions.forEach(act => {
            const btn = document.createElement('button');
            btn.textContent = act.icon;
            btn.dataset.action = act.action;
            btn.dataset.id = ticket.id;
            btn.title = act.title;
            divActions.appendChild(btn);
        });

        tdActions.appendChild(divActions);
        tr.appendChild(tdActions);

        // Click handler for opening detail panel
        tr.onclick = (e) => {
            // Don't open if clicking on action buttons
            if (e.target.closest('.ticket-actions')) return;
            openDetailPanel(ticket.id);
        };

        tbody.appendChild(tr);
    });
}


function renderKanbanView() {
    const statuses = ['open', 'in-progress', 'resolved', 'closed'];
    const filtered = getFilteredTickets();

    statuses.forEach(status => {
        const column = document.getElementById(`${status === 'in-progress' ? 'inProgress' : status}Column`);
        const count = document.getElementById(`${status === 'in-progress' ? 'inProgress' : status}Count`);
        const statusTickets = filtered.filter(t => t.status === status);

        count.textContent = statusTickets.length;
        column.innerHTML = ''; // Safe clear

        if (statusTickets.length === 0) {
            const p = document.createElement('p');
            p.style.color = 'var(--text-muted)';
            p.style.textAlign = 'center';
            p.style.padding = '1rem';
            p.textContent = 'Ticket yok';
            column.appendChild(p);
            return;
        }

        statusTickets.forEach((ticket, index) => {
            const sla = calculateSLA(ticket);

            const card = document.createElement('div');
            card.className = `kanban-card sla-${sla.status}`;
            if (ticket.priority === 'critical') card.classList.add('status-critical');

            card.draggable = true;
            card.dataset.id = ticket.id;

            // Animation styles
            card.style.animation = 'staggerInput 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            card.style.animationDelay = `${index * 0.05}s`;
            card.style.opacity = '0';
            card.style.transform = 'translateY(10px)';
            card.style.cursor = 'pointer';

            // SLA Ring (SVG cannot be easily created with createElement, using innerHTML safely here for just the SVG structure if content is static)
            // But to be 100% strict, let's build it or use a helper. 
            // For simplicity and safety, we will use a small helper or just innerHTML for the SVG part ONLY since it contains no user input.
            const slaRing = document.createElement('div');
            slaRing.className = `sla-ring sla-${sla.status}`;
            slaRing.innerHTML = `
                <svg viewBox="0 0 36 36" class="sla-circle">
                    <path class="sla-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                    <path class="sla-circle-progress" stroke-dasharray="${sla.percentage}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                </svg>
            `;
            const slaText = document.createElement('div');
            slaText.className = 'sla-ring-text sla-digital-clock';
            slaText.dataset.id = ticket.id;
            slaText.textContent = formatSLATime(sla.remainingSeconds);
            slaRing.appendChild(slaText);
            card.appendChild(slaRing);

            // Header
            const header = document.createElement('div');
            header.className = 'kanban-card-header';

            const spanId = document.createElement('span');
            spanId.className = 'kanban-card-id';
            spanId.textContent = ticket.id;

            const spanPriority = document.createElement('span');
            spanPriority.className = `badge badge-priority-${ticket.priority}`;
            spanPriority.textContent = getPriorityLabel(ticket.priority);

            header.appendChild(spanId);
            header.appendChild(spanPriority);
            card.appendChild(header);

            // Title
            const title = document.createElement('h4');
            title.className = 'kanban-card-title';
            title.textContent = ticket.title;
            card.appendChild(title);

            // Description
            const desc = document.createElement('p');
            desc.className = 'kanban-card-description';
            desc.textContent = ticket.description;
            card.appendChild(desc);

            // Footer
            const footer = document.createElement('div');
            footer.className = 'kanban-card-footer';

            const spanCategory = document.createElement('span');
            spanCategory.className = `badge badge-category-${ticket.category}`;
            spanCategory.textContent = getCategoryLabel(ticket.category);
            footer.appendChild(spanCategory);

            if (ticket.assignee) {
                const spanAssignee = document.createElement('span');
                spanAssignee.style.fontSize = '0.875rem';
                spanAssignee.style.color = 'var(--text-muted)';
                spanAssignee.textContent = `👤 ${ticket.assignee}`;
                footer.appendChild(spanAssignee);
            }

            card.appendChild(footer);
            column.appendChild(card);

            // Event Listeners
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
            card.addEventListener('mousemove', handleSpotlightMove);

            // Click handler for opening detail panel
            card.onclick = () => openDetailPanel(ticket.id);
        });
    });
}

function renderDetailPanel(ticketId) {
    try {
        const ticket = getTicket(ticketId);
        if (!ticket) return;

        document.getElementById('detailTitle').textContent = ticket.title;
        document.getElementById('detailStatus').className = `badge badge-status-${ticket.status}`;
        document.getElementById('detailStatus').textContent = getStatusLabel(ticket.status);
        document.getElementById('detailPriority').className = `badge badge-priority-${ticket.priority}`;
        document.getElementById('detailPriority').textContent = getPriorityLabel(ticket.priority);
        document.getElementById('detailCategory').className = `badge badge-category-${ticket.category}`;
        document.getElementById('detailCategory').textContent = getCategoryLabel(ticket.category);
        document.getElementById('detailDescription').textContent = ticket.description;

        // Metadata Population
        document.getElementById('detailId').textContent = ticket.id;
        document.getElementById('detailCreated').textContent = formatDate(ticket.createdAt);
        document.getElementById('detailUpdated').textContent = ticket.updatedAt ? formatDate(ticket.updatedAt) : '-';
        document.getElementById('detailEstimatedHours').textContent = ticket.estimatedHours ? `${ticket.estimatedHours}h` : '-';

        // Elapsed time calculation
        const elapsed = Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60)); // in minutes
        document.getElementById('detailElapsedTime').textContent = elapsed > 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`;

        // Assignee and Passing
        const wrapper = document.getElementById('assigneeWrapper');
        wrapper.innerHTML = ''; // Clear

        const spanAssignee = document.createElement('span');
        spanAssignee.id = 'detailAssignee';
        spanAssignee.textContent = ticket.assignee || 'Atanmamış';
        wrapper.appendChild(spanAssignee);

        const select = document.createElement('select');
        select.className = 'pass-select';

        // Default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        defaultOption.textContent = 'Pasla...';
        select.appendChild(defaultOption);

        // Add Digital Twin Button dynamically
        const actionsDiv = document.querySelector('.detail-actions');
        if (actionsDiv) {
            const existingBtn = document.getElementById('openSandboxBtn');
            if (existingBtn) existingBtn.remove();

            const btn = document.createElement('button');
            btn.id = 'openSandboxBtn';
            btn.className = 'btn-primary btn-sm';
            btn.style.background = 'linear-gradient(135deg, #ff4d00 0%, #ff0000 100%)';
            btn.innerHTML = '🧬 Otomatik İkiz';
            btn.onclick = () => openSandbox();
            actionsDiv.appendChild(btn);
        }

        const users = ['Ahmet Yılmaz', 'Melisa Can', 'Caner Öz', 'Zeynep Öz', 'Ben'];
        users.forEach(user => {
            const opt = document.createElement('option');
            opt.value = user.startsWith('Ben') ? 'Ben' : user;
            opt.textContent = user;
            select.appendChild(opt);
        });

        // Secure Event Listener
        select.addEventListener('change', function () {
            if (this.value) {
                passTicket(ticket.id, this.value); // passTicket likely not defined in snippet but assuming existence or I need to check
            }
        });

        wrapper.appendChild(select);

        // SLA Clock initialization
        const sla = calculateSLA(ticket);
        const slaEl = document.getElementById('detailSLA');
        slaEl.dataset.id = ticket.id;
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
            slaEl.textContent = 'TAMAMLANDI';
            slaEl.className = 'sla-badge status-completed';
        } else {
            slaEl.textContent = formatSLATime(sla.remainingSeconds);
            slaEl.className = `sla-badge status-${sla.status} sla-digital-clock`;
        }

        // Timeline - SECURITY: escape event actions
        const timeline = document.getElementById('detailTimeline');
        timeline.innerHTML = ticket.timeline.map(event => `
        <div class="timeline-event">
            <div class="timeline-event-time">${formatDate(event.timestamp)}</div>
            <div class="timeline-event-text">${escapeHtml(event.action)}${event.user ? ` - ${escapeHtml(event.user)}` : ''}</div>
        </div>
    `).join('');

        // Comments - SECURITY: escape comment text and author
        const comments = document.getElementById('detailComments');
        if (ticket.comments.length === 0) {
            comments.innerHTML = '<p style="color: var(--text-muted);">Henüz yorum yok</p>';
        } else {
            comments.innerHTML = ticket.comments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(comment.author)}</span>
                    <span class="comment-time">${formatDate(comment.timestamp)}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
            </div>
        `).join('');
        }

        // Attachments
        const attachments = document.getElementById('detailAttachments');
        if (ticket.attachments.length === 0) {
            attachments.innerHTML = '';
        } else {
            attachments.innerHTML = ticket.attachments.map(att => {
                if (att.type.startsWith('image/')) {
                    return `
                    <div class="attachment">
                        <img src="${att.data}" alt="${att.name}">
                        <div class="attachment-name">${att.name}</div>
                    </div>
                `;
                } else {
                    return `
                    <div class="attachment">
                        <div style="padding: 1rem; text-align: center;">
                            <svg width="40" height="40" fill="var(--text-muted)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6"/></svg>
                        </div>
                        <div class="attachment-name">${att.name}</div>
                    </div>
                `;
                }
            }).join('');
        }
    } catch (error) {
        console.error('renderDetailPanel error:', error);
        showToast('Bilet detayları yüklenirken bir hata oluştu.', 'error');
    }
}

// ==========================================
// FILTERING
// ==========================================
function getFilteredTickets() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;

    return tickets.filter(ticket => {
        const matchesSearch = ticket.title.toLowerCase().includes(search) ||
            ticket.description.toLowerCase().includes(search);
        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
        const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
}

// ==========================================
// DRAG & DROP
// ==========================================
let draggedTicketId = null;

function handleDragStart(e) {
    draggedTicketId = e.target.dataset.id;
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const newStatus = e.currentTarget.parentElement.dataset.status;
    if (draggedTicketId && newStatus) {
        updateTicket(draggedTicketId, {
            status: newStatus,
            authenticity_token: SecurityGuardian._token
        });
        renderKanbanView();
        updateStatistics();
        initCharts();
        showToast('Ticket durumu güncellendi', 'success');
    }
}

// ==========================================
// QUICK ACTIONS
// ==========================================
// DELETED: Secondary definitions moved to global scope or merged

// ==========================================
// MODAL MANAGEMENT
// ==========================================
function openModal(ticketId = null) {
    const modal = document.getElementById('ticketModal');
    const form = document.getElementById('ticketForm');
    const title = document.getElementById('modalTitle');

    form.reset();

    if (ticketId) {
        const ticket = getTicket(ticketId);
        if (ticket) {
            title.textContent = 'Ticket Düzenle';
            document.getElementById('ticketId').value = ticket.id;
            document.getElementById('ticketTitle').value = ticket.title;
            document.getElementById('ticketDescription').value = ticket.description;
            document.getElementById('ticketPriority').value = ticket.priority;
            document.getElementById('ticketCategory').value = ticket.category;
            document.getElementById('ticketAssignee').value = ticket.assignee || '';
            document.getElementById('ticketEstimatedHours').value = ticket.estimatedHours || '';
            document.getElementById('ticketStatus').value = ticket.status;
        }
    } else {
        title.textContent = 'Yeni Ticket Oluştur';
        document.getElementById('ticketId').value = '';
    }

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('ticketModal').classList.remove('active');
}

// ==========================================
// DETAIL PANEL
// ==========================================
function openDetailPanel(ticketId) {
    try {
        console.log('Opening detail panel for:', ticketId);
        selectedTicketId = ticketId;

        // 🛡️ SECURITY: IDOR Guard (Simulated)
        // In a real app, we check if current_user can see this ticketId
        const ticket = getTicket(ticketId);
        if (!ticket) {
            SecurityGuardian.audit('IDOR Attempt', `Unauthorized access to Ticket ID: ${ticketId}`, 'critical');
            showToast('Erişim Reddedildi: Bu bileti görüntüleme yetkiniz yok.', 'error');
            return;
        }

        renderDetailPanel(ticketId);
        try {
            if (typeof generateShadowITReport === 'function') {
                generateShadowITReport(ticketId);
            }
        } catch (e) {
            console.error('Shadow IT Report failed:', e);
        }

        const panel = document.getElementById('detailPanel');
        if (panel) {
            panel.classList.add('active');
        }
    } catch (error) {
        console.error('openDetailPanel error:', error);
        showToast('Hata: Detay paneli açılamadı', 'error');
    }
}

function closeDetailPanel() {
    document.getElementById('detailPanel').classList.remove('active');
    selectedTicketId = null;
}

// ==========================================
// THEME TOGGLE
// ==========================================
function toggleTheme() {
    if (currentTheme === 'dark') {
        currentTheme = 'light';
        document.body.classList.add('light-theme');
    } else {
        currentTheme = 'dark';
        document.body.classList.remove('light-theme');
    }
    saveToLocalStorage();
    // Refresh charts with new colors
    initCharts();
}

// ==========================================
// RENDER & REFRESH
// ==========================================
function render() {
    updateStatistics();
    initCharts();

    if (currentView === 'list') {
        renderListView();
    } else {
        renderKanbanView();
    }
}


// ==========================================
// EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 🛡️ Initialize Security Guardian (Fortress Mode)
    SecurityGuardian.loadAuditLog();
    SecurityGuardian.generateToken();
    SecurityGuardian.audit('System Start', 'Fortress Security Engine engaged', 'info');
    // Audit UI is rendered exclusively in audit.html

    loadFromLocalStorage();
    render();

    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // New Ticket Button
    document.getElementById('newTicketBtn').addEventListener('click', () => openModal());

    // Modal Controls
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelModal').addEventListener('click', closeModal);

    // Force Reset Logic
    document.getElementById('forceResetBtn').addEventListener('click', () => {
        if (confirm('DİKKAT: Tüm yerel veriler silinecek. Onaylıyor musunuz?')) {
            localStorage.clear();
            window.location.reload(true);
        }
    });

    // Ticket Form Submit
    document.getElementById('ticketForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const id = document.getElementById('ticketId').value;
        const ticketData = {
            title: document.getElementById('ticketTitle').value,
            description: document.getElementById('ticketDescription').value,
            priority: document.getElementById('ticketPriority').value,
            category: document.getElementById('ticketCategory').value,
            assignee: document.getElementById('ticketAssignee').value,
            estimatedHours: parseFloat(document.getElementById('ticketEstimatedHours').value) || null,
            status: document.getElementById('ticketStatus').value,
            authenticity_token: SecurityGuardian._token // 🛡️ CSRF Token
        };

        if (id) {
            updateTicket(id, ticketData);
            showToast('Ticket güncellendi', 'success');
        } else {
            createTicket(ticketData);
            showToast('Yeni ticket oluşturuldu', 'success');
        }

        closeModal();
        render();
        if (selectedTicketId === id) renderDetailPanel(id);
    });

    // Detail Panel Controls
    document.getElementById('closePanel').addEventListener('click', closeDetailPanel);

    document.getElementById('editTicketBtn').addEventListener('click', () => {
        if (selectedTicketId) openModal(selectedTicketId);
    });

    document.getElementById('deleteTicketBtn').addEventListener('click', () => {
        if (selectedTicketId && confirm('Bu ticket\'ı silmek istediğinizden emin misiniz?')) {
            // Log the delete action as a security event
            SecurityGuardian.audit('Manual Delete', `User requested deletion of Ticket ID: ${selectedTicketId}`, 'warning');
            deleteTicket(selectedTicketId);
            closeDetailPanel();
            render();
            showToast('Ticket silindi', 'info');
        }
    });

    // Comment Form
    document.getElementById('commentForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = document.getElementById('commentText').value;
        if (text && selectedTicketId) {
            addComment(selectedTicketId, text);
            document.getElementById('commentText').value = '';
            renderDetailPanel(selectedTicketId);
            showToast('Yorum eklendi', 'success');
        }
    });

    // View Switcher (Turbo: Only render active view)
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.view;
            currentView = view;

            if (view === 'list') {
                document.getElementById('listView').classList.remove('hidden');
                document.getElementById('kanbanView').classList.add('hidden');
                renderListView();
            } else {
                document.getElementById('listView').classList.add('hidden');
                document.getElementById('kanbanView').classList.remove('hidden');
                renderKanbanView();
            }
        });
    });

    // Global Action Delegation (Turbo & Security)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.action) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'resolve' && id) {
            updateTicket(id, { status: 'resolved', authenticity_token: SecurityGuardian._token });
            render();
            if (selectedTicketId === id) renderDetailPanel(id);
        } else if (action === 'assign' && id) {
            updateTicket(id, { assignee: 'Ben', authenticity_token: SecurityGuardian._token });
            render();
            if (selectedTicketId === id) renderDetailPanel(id);
        } else if (action === 'delete' && id) {
            if (confirm('Bileti silmek istiyor musunuz?')) {
                SecurityGuardian.audit('Quick Delete', `Ticket ID: ${id}`, 'warning');
                deleteTicket(id);
                render();
            }
        }
    });

    // Filters with Debounce for search (Turbo)
    const debouncedRender = debounce(render, 250);
    document.getElementById('searchInput').addEventListener('input', debouncedRender);
    document.getElementById('statusFilter').addEventListener('change', render);
    document.getElementById('priorityFilter').addEventListener('change', render);
    document.getElementById('categoryFilter').addEventListener('change', render);

    document.getElementById('clearFilters').addEventListener('click', () => {
        ['searchInput', 'statusFilter', 'priorityFilter', 'categoryFilter'].forEach(id => {
            document.getElementById(id).value = id.includes('Filter') ? 'all' : '';
        });
        render();
    });

    // Kanban Drop Zone Initial Listeners
    document.querySelectorAll('.column-content').forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
        column.addEventListener('dragleave', handleDragLeave);
    });

    // Initialize spotlight for static stat cards
    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('mousemove', handleSpotlightMove);
    });


    // ==========================================
    // REVOLUTIONARY FEATURES HELPERS
    // ==========================================

    // 1. Ghost Ticket Preventer
    document.getElementById('smartScanBtn').addEventListener('click', async () => {
        const btn = document.getElementById('smartScanBtn');
        const status = document.getElementById('scanStatus');

        // Simulation Animation
        btn.disabled = true;
        btn.innerHTML = `<span class="pulse-dot"></span> Taranıyor...`;
        status.textContent = 'Ekran ve Loglar Kontrol Ediliyor...';
        status.style.color = '#fbbf24';

        await new Promise(r => setTimeout(r, 2000)); // Simulate work

        status.textContent = 'Hata Tespit Edildi';
        status.style.color = '#34d399';

        // Auto-fill context
        const desc = document.getElementById('ticketDescription');
        const currentText = desc.value;
        const autoContext = `\n\n[SISTEM TARA-FINDAN EKLEDI]\nTespit Edilen Hata Kodu: 0x80070057\nİlgili İşlem: explorer.exe (PID: 4520)\nSon Eylem: Dosya Kopyalama\nEkran Görüntüsü: Otomatik Eklendi`;

        if (!currentText.includes(autoContext)) {
            desc.value = currentText + autoContext;
        }

        // Reset button
        btn.innerHTML = `✅ Bilet Zenginleştirildi`;

        showToast('Ghost Preventer: Hata bağlamı eklendi!', 'success');

        // New: Hardware Health Check
        scanHardwareHealth();
    });

    // 2. Sentiment & Stress Analysis
    const descInput = document.getElementById('ticketDescription');
    let lastKeyTime = Date.now();
    let backspaceCount = 0;
    let charTimings = [];

    descInput.addEventListener('keydown', (e) => {
        const now = Date.now();
        const timeDiff = now - lastKeyTime;
        lastKeyTime = now;

        if (e.key === 'Backspace') {
            backspaceCount++;
        }

        // Calculate Check
        if (charTimings.length > 10) charTimings.shift();
        charTimings.push(timeDiff);

        // Panic Detection Logic
        const avgSpeed = charTimings.reduce((a, b) => a + b, 0) / charTimings.length;
        const panicKeywords = ['acil', 'yandık', 'çöktü', 'hata', 'yardım', 'bittik', 'yavaş', 'bozuk'];
        const text = descInput.value.toLowerCase();
        const hasKeyword = panicKeywords.some(k => text.includes(k));

        if ((avgSpeed < 100 && backspaceCount > 5) || hasKeyword) {
            const prioritySelect = document.getElementById('ticketPriority');
            if (prioritySelect.value !== 'critical') {
                prioritySelect.value = 'critical';

                // Visual Feedback
                if (!document.querySelector('.stress-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'stress-badge';
                    badge.textContent = '⚠️ YÜKSEK STRES ALGILANDI';
                    descInput.parentElement.style.position = 'relative';
                    descInput.parentElement.appendChild(badge);

                    showToast('Stres Analizi: Öncelik "Kritik" olarak güncellendi.', 'error');
                }
            }
        }
    });

    // 3. System Restore (Time Machine)
    document.getElementById('restoreBtn').addEventListener('click', async () => {
        const btn = document.getElementById('restoreBtn');
        btn.disabled = true;
        btn.textContent = 'Geri Yükleniyor...';

        await new Promise(r => setTimeout(r, 2500));

        btn.textContent = 'Başarılı';
        btn.style.background = 'rgba(16, 185, 129, 0.5)';

        showToast('Zaman Makinesi: Sistem 14:30 durumuna geri döndürüldü.', 'success');

        // Logic: If in sandbox and there are risks, "restore" might mitigate them
        if (selectedTicketId) {
            const ticket = getTicket(selectedTicketId);
            if (ticket && ticket.sandboxSession) {
                const terminal = document.getElementById('sandboxTerminal');
                terminal.innerHTML += `<div class="line terminal-line-cmd">PS C:\\> Restore-SystemState -Point "PRE_ERROR"</div>`;
                terminal.innerHTML += `<div class="line success">Sanal ikiz durumu geri yüklendi. Tüm riskler sıfırlandı.</div>`;

                // Clear impact results UI and state
                document.getElementById('impactResults').innerHTML = '<div class="impact-safe">✅ Geri Yükleme Başarılı: Riskler bertaraf edildi.</div>';
                document.getElementById('deployFixBtn').disabled = false;

                saveSandboxSession(selectedTicketId);
            }
        }

        setTimeout(() => {
            btn.textContent = 'Geri Yükle';
            btn.disabled = false;
            btn.style.background = '';
        }, 3000);
    });

    // 4. Silent Monitor (Sessiz Çığlık)
    const silentBtn = document.getElementById('silentMonitorBtn');
    let silentInterval = null;

    silentBtn.addEventListener('click', () => {
        if (silentInterval) {
            // Stop
            clearInterval(silentInterval);
            silentInterval = null;
            silentBtn.classList.remove('active');
            silentBtn.querySelector('.monitor-text').textContent = 'Sessiz Mod: KAPALI';
            showToast('Sessiz İzleme Durduruldu', 'info');
        } else {
            // Start
            silentBtn.classList.add('active');
            silentBtn.querySelector('.monitor-text').textContent = 'Sessiz Mod: AÇIK';
            showToast('Sessiz İzleme Başlatıldı - Anomaliler Takip Ediliyor...', 'success');

            // Simulate finding anomalies
            silentInterval = setInterval(() => {
                if (Math.random() > 0.7) { // 30% chance every check
                    createAnomalyTicket();
                }
            }, 5000); // Check every 5 seconds
        }
    });

    function createAnomalyTicket() {
        const anomalies = [
            'Excel.exe - Stack Buffer Overflow (0x0000005)',
            'Ctrl+Z serisi tespit edildi - Potansiyel Veri Kaybı',
            'Outlook.exe - Yüksek Memory consumption (2.4GB RAM)',
            'System Tray / Shell Experience Host - unresponsive',
            'BGP Flapping detected in Core Switch #4',
            'Shadow IT Detection: Unapproved Dropbox process',
            'Kernel Panic - Non-pageable area violation',
            'Disk Queue Length > 5.0 - I/O Bottleneck',
            'Zombi Process: updater.exe (v1.2) - High CPU',
            'WPA3 Handshake Failure - Wi-Fi AP #12',
            'Print Spooler - Service hang (Local Admin context)',
            'Domain Controller - Sync Latency > 300ms',
            'Suspicious PowerShell - EncodedCommand detected',
            'Mali Müşavirlik Portalı - SSL Handshake Error',
            'Registry Key modification: ProxyServer forced',
            'Hardware Predict: NVMe Temp reaching 85°C',
            'Bitlocker status: Partitions decrypted unsafely',
            'VPN Tunnel - Packet loss > 15%',
            'Docker Desktop - Vmmem exhaustion',
            'Teams.exe - Heavy signaling loop detected',
            'Firewall Reject: Port 3389 (RDP) Brute-force',
            'Ghost process: auto-clicker.exe identified',
            'Sentiment Alert: User frustration level HIGH',
            'Silent Crash: background_worker.js - OOM',
            'Anomalous login: CEO Account (IP: Unknown)',
            'Hardware: SSD SMART Status - Failing soon',
            'Shadow IT: Tor Browser connection attempt',
            'Service Monitor: Database connection pool full',
            'Registry: Unauthorized GPO override attempt',
            'System: Multiple Explorer.exe restarts detected'
        ];
        const anomaly = anomalies[Math.floor(Math.random() * anomalies.length)];

        // Create Candidate Ticket
        const ticket = createTicket({
            title: `[OTOMATİK] ${anomaly}`,
            description: `Sessiz İzleme Modu tarafından otonom olarak tespit edildi.\n\nAnaliz:\n- OS: Windows 11 Enterprise\n- Anomali Skoru: ${Math.floor(Math.random() * 40) + 60}/100\n- Plaza dili: "Bu issue'yu hızlıca handle edelim."\n\nOtomatik Log:\n[${new Date().toLocaleTimeString()}] Monitoring başladı\n[${new Date().toLocaleTimeString()}] Pattern eklendi\n[${new Date().toLocaleTimeString()}] Ticket otomatik olarak passlandı`,
            priority: Math.random() > 0.5 ? 'high' : 'medium',
            category: 'support',
            status: 'candidate',
            assignee: 'Sistem (AI)',
            authenticity_token: SecurityGuardian._token // 🛡️ Fix: Add CSRF token
        });

        if (ticket) {
            render();
            showToast(`⚠️ Anomali Tespit Edildi: ${ticket.title}`, 'warning');

            // Notification Sound Effect (Optional visual cue)
            silentBtn.style.transform = "scale(1.2)";
            setTimeout(() => silentBtn.style.transform = "scale(1)", 200);
        }
    }

    // 5. Digital Twin Sandbox

    // Sandbox Controls
    // Event listeners setup - run once only
    if (!window._sandboxListenersInitialized) {
        window._sandboxListenersInitialized = true;
        document.getElementById('closeSandbox').addEventListener('click', () => {
            document.getElementById('sandboxModal').classList.remove('active');
        });

        document.getElementById('simulateFixBtn').addEventListener('click', () => {
            runSimulation();
        });

        document.getElementById('deployFixBtn').addEventListener('click', () => {
            const targetId = selectedTicketId;

            if (!targetId) {
                showToast('Hata: Bilet kimliği bulunamadı.', 'error');
                return;
            }

            const btn = document.getElementById('deployFixBtn');
            btn.disabled = true;
            btn.innerHTML = '🚀 Uygulanıyor...';

            showToast('🚀 Çözüm Ana Makineye Gönderiliyor...', 'info');

            setTimeout(() => {
                const ticket = getTicket(targetId);
                if (ticket) {
                    updateTicket(targetId, {
                        status: 'resolved',
                        authenticity_token: SecurityGuardian._token,
                        timeline: [...ticket.timeline, {
                            action: '🚀 Çözüm canlı sistemlere başarıyla uygulandı.',
                            user: 'System (AI)',
                            timestamp: new Date().toISOString()
                        }],
                        sandboxSession: null
                    });
                    showToast('✅ Uygulandı! Bilet Çözüldü.', 'success');

                    // Reset sandbox modal UI state fully before closing
                    try {
                        const impactCard = document.getElementById('impactAnalysisCard');
                        if (impactCard) impactCard.style.display = 'none';
                        const impactResults = document.getElementById('impactResults');
                        if (impactResults) impactResults.innerHTML = '<div class="impact-placeholder">Analiz için çözümü simüle edin...</div>';
                        const altActions = document.getElementById('alternativeActions');
                        if (altActions) { altActions.innerHTML = ''; altActions.style.display = 'none'; }
                    } catch (e) {
                        console.error('Error resetting sandbox UI:', e);
                    }

                    document.getElementById('sandboxModal').classList.remove('active');
                    render();
                    // Don't closeDetailPanel immediately, let the user see the resolved state or manually close
                    renderDetailPanel(targetId);
                } else {
                    showToast('Hata: Bilet bulunamadı.', 'error');
                }
                btn.innerHTML = '🚀 Kaynağa Uygula (Canlı)';
                btn.disabled = false;
            }, 2000);
        });

    }

    window.addEventListener('open-sandbox', (e) => {
        selectedTicketId = e.detail;
        openSandbox();
    });

    // 6. Ghostwriter (IT'ci Tercümanı)
    document.getElementById('humanizeBtn').addEventListener('click', async () => {
        const textarea = document.getElementById('commentText');
        const btn = document.getElementById('humanizeBtn');
        const originalText = textarea.value;

        if (!originalText) {
            showToast('Lütfen öncelikle teknik bir not giriniz.', 'warning');
            return;
        }

        btn.classList.add('translating');
        btn.innerHTML = '🔮 Tercüme ediliyor...';

        await new Promise(r => setTimeout(r, 1500)); // Simulate AI processing

        const humanText = humanizeTechnicalText(originalText);
        textarea.value = humanText;

        btn.classList.remove('translating');
        btn.innerHTML = '🔮 Ghostwriter (Tercüman)';
        showToast('Tercüme Tamamlandı! Kullanıcı dostu hale getirildi.', 'success');
    });

});

// ==========================================
// REVOLUTIONARY FEATURES HELPERS (Global Scope)
// ==========================================

const SCENARIO_LIBRARY = {
    'database': {
        name: 'Database Recovery & Optimization',
        steps: [
            'Attaching to SQL Instance...',
            'Checking for transaction log corruption...',
            'Detected uncommitted records in table [UserSecrets]',
            'Running: DBCC CHECKDB with repair_allow_data_loss...',
            'Rebuilding indexes for table [Tickets]...',
            'Database consistency check: [PASS]'
        ],
        risks: [{
            type: 'warning',
            msg: '<strong>⚠️ VERİ RİSKİ:</strong> Index rebuilding sırasında tablo kilitlenebilir.',
            alt: 'Tabloyu Online Rebuild Et (Low Priority)',
            script: 'ALTER INDEX ALL ON [Users] REBUILD WITH (ONLINE = ON)'
        }]
    },
    'network': {
        name: 'DDoS Mitigation & Firewall Hardening',
        steps: [
            'Analyzing inbound traffic spike (45GB/s)...',
            'Applying Geo-IP blocking rules for known Botnet IPs...',
            'Deploying Cloudflare Tunnel v2.1...',
            'Enabling Layer 7 rate limiting (Limit: 500 req/s)...',
            'Validating WAF signature database...',
            'Network Posture: Under Control.'
        ],
        risks: [{
            type: 'warning',
            msg: '<strong>⚠️ TRAFİK KISITLAMASI:</strong> Agresif rate limiting gerçek kullanıcıları da engelleyebilir.',
            alt: 'Akıllı Analiz Modu (Adaptive)',
            script: 'Set-FirewallPolicy -Mode Adaptive -SecurityLevel High'
        }]
    },
    'security': {
        name: 'SSL Certificate Expiry & Renewal',
        steps: [
            'Checking certificate chain for *.ticketowsky.com...',
            'Detected expired Root CA (Let\'s Encrypt ISRG Root X1)...',
            'Initiating ACME v2 renewal protocol...',
            'Pushing new PEM files to Nginx clusters...',
            'Restarting web-balancing nodes...',
            'Validation: HTTPS Secure (Valid until 2027).'
        ],
        risks: [{
            type: 'critical',
            msg: '<strong>🚫 KESİNTİ RİSKİ:</strong> Web servislerinin yeniden başlatılması 502 hatalarına yol açabilir.',
            alt: 'Kademeli Reload (Zero-Downtime)',
            script: 'nginx -s reload --mode seamless --graceful'
        }]
    },
    'adsync': {
        name: 'Active Directory Sync Recovery',
        steps: [
            'Monitoring DirSync status on Azure AD Connect...',
            'Detected schema mismatch in [extensionAttribute12]...',
            'Running delta synchronization manually...',
            'Mapping local SID to Cloud immutableID...',
            'Pushing identity updates to Microsoft Graph...',
            'AD Synchronized successfully.'
        ],
        risks: [{
            type: 'warning',
            msg: '<strong>⚠️ KİMLİK ÇAKIŞMASI:</strong> Mevcut oturumların geçersiz kılınması ihtimali var.',
            alt: 'Session Persistence Modu',
            script: 'Sync-Identity -Flags PreserveSessions -Mode Safe'
        }]
    },
    'fileserver': {
        name: 'Ransomware Detection & Remediation',
        steps: [
            'Heuristic scan detected encryption pattern on FileServer-01...',
            'Isolating affected network segment (VLAN 44)...',
            'Terminating process: lockbit.exe...',
            'Restoring from Shadow Copy [VOL_12_FEB]...',
            'Removing IOC persistence from registry...',
            'System integrity restored.'
        ],
        risks: [{
            type: 'critical',
            msg: '<strong>🛑 VERİ KAYBI:</strong> Shadow Copy %100 güncel olmayabilir.',
            alt: 'Offline Backup\'dan Kısmi Kurtar',
            script: 'Restore-Data -Source ColdStorage -Target "CriticalShares"'
        }]
    },
    'ui': {
        name: 'Advanced UX Refactoring & Hydration',
        steps: [
            'Analyzing React component tree hydration state...',
            'Detected layout shift in [DynamicHero] component...',
            'Recalculating CSS Grid areas (Fr-units adjustment)...',
            'Injecting prioritized font-loading strategy...',
            'Minifying critical path CSS variables...',
            'UX Audit: 100/100 Lighthouse score.'
        ],
        risks: [{
            type: 'safe',
            msg: '<strong>✅ GÜVENLİ:</strong> Bu işlem sadece tarayıcı tarafında CSS ve JS günceller.',
            alt: 'Shadow DOM İzolasyonu Uygula',
            script: 'Add-Styles --isolation shadow --target "LegacyHeader"'
        }]
    },
    'hardware': {
        name: 'Predictive Hardware Maintenance',
        steps: [
            'Querying SSD NVMe S.M.A.R.T attributes...',
            'Detected rising Reallocated Sector Count on Disk 0...',
            'Analyzing thermal throttling on P-Cores (Current: 92°C)...',
            'Applying undervolt profile to reduce TDP...',
            'Scheduling background defrag for ColdStorage...',
            'Hardware Health: Stabilized (Requires monitor).'
        ],
        risks: [{
            type: 'warning',
            msg: '<strong>🔥 SICAKLIK UYARISI:</strong> Undervolting sistem kararlılığını anlık etkileyebilir.',
            alt: 'Throttle Limitlerini Sıkılaştır',
            script: 'Set-CPUConfig -TempLimit 85C -Priority Economy'
        }]
    },
    'loadbalancer': {
        name: 'L7 Load-Balancer Dynamic Weighting',
        steps: [
            'Monitoring health check endpoints for Cluster B...',
            'Detected 503 latency spikes on Node-04...',
            'Removing Node-04 from production rotation...',
            'Purging Varnish edge configuration...',
            'Updating SSL/TLS cipher suites (TLS 1.3 only)...',
            'Traffic Flow: Rebalanced.'
        ],
        risks: [{
            type: 'warning',
            msg: '<strong>⚠️ TRAFİK KESİNTİSİ:</strong> Varnish temizleme anlık gecikme yaratabilir.',
            alt: 'Kademeli Geçiş (Blue/Green)',
            script: 'Switch-Traffic -Target "Green" -Weight 10 -Step 5'
        }]
    },
    'encryption': {
        name: 'Master Key Rotation & Vault Sync',
        steps: [
            'Initiating HashiCorp Vault key rotation...',
            'Rotating Master Key [MK-992-ALPHA]...',
            'Updating client-side decryption libraries...',
            'Re-sealing database field [AuthTokens]...',
            'Syncing secrets to K8s ConfigMaps...',
            'Key Rotation: SUCCESS.'
        ],
        risks: [{
            type: 'critical',
            msg: '<strong>🛑 ŞİFRELEME RİSKİ:</strong> Yanlış key senkronizasyonu tüm datayı erişilmez kılar.',
            alt: 'Dual-Key Modu (Legacy Support)',
            script: 'Set-VaultPolicy -SupportLegacyKeys $true -Duration 48h'
        }]
    }
};

const VAULT = {
    'database': 'DB_ADMIN',
    'network': 'NET_ADMIN',
    'security': 'SEC_ADMIN',
    'adsync': 'SYS_ADMIN',
    'fileserver': 'SYS_ADMIN',
    'ui': 'UX_DEV',
    'hardware': 'SYS_ADMIN',
    'loadbalancer': 'NET_ADMIN',
    'encryption': 'SEC_ADMIN'
};

function openSandbox() {
    console.log('Attempting to open sandbox for ticket:', selectedTicketId);

    if (!selectedTicketId) {
        console.error('openSandbox failed: No ticket selected.');
        showToast('Hata: Önce bir bilet seçmelisiniz.', 'error');
        return;
    }

    const ticket = getTicket(selectedTicketId);
    if (!ticket) {
        console.error('openSandbox failed: Ticket not found for ID', selectedTicketId);
        showToast('Hata: Seçili bilet verisi yüklenemedi.', 'error');
        return;
    }

    const terminal = document.getElementById('sandboxTerminal');
    const impactResults = document.getElementById('impactResults');
    const impactCard = document.getElementById('impactAnalysisCard');
    const alternativeActions = document.getElementById('alternativeActions');

    // Defensive check
    if (!terminal || !impactResults || !impactCard) {
        console.error('openSandbox failed: Vital DOM elements missing.');
        showToast('Hata: Sandbox arayüzü yüklenemedi.', 'error');
        return;
    }

    // STATE MANAGEMENT: Check if ticket has a saved sandbox state
    if (!ticket.sandboxSession) {
        console.log('Starting fresh sandbox session for ticket:', selectedTicketId);
        const scenarios = Object.values(SCENARIO_LIBRARY);
        const scenarioKey = Object.keys(SCENARIO_LIBRARY)[Math.floor(Math.random() * Object.keys(SCENARIO_LIBRARY).length)];
        const scenario = SCENARIO_LIBRARY[scenarioKey];

        terminal.dataset.currentScenario = scenarioKey;
        terminal.innerHTML = `
            <div class="line terminal-line-cmd">PS C:\\Users\\Administrator> Initializing-DigitalTwin -Target "${ticket.id}"</div>
            <div class="line">Connecting to Cloud Clone (Instance ID: ${ticket.id})...</div>
            <div class="line success">Connection Established.</div>
            <div class="line">----------------------------------------</div>
            <div class="line">Scenario Detected: <strong>${scenario.name}</strong></div>
            <div class="line">Snapshot Data:</div>
            <div class="line">- Target Ticket: ${ticket.title}</div>
            <div class="line">- System Context: Windows 11 Enterprise (22H2)</div>
            <div class="line">- Assigned Agent: Antigravity AI</div>
            <div class="line">----------------------------------------</div>
            <div class="line type-writer">_</div>
        `;

        impactCard.style.display = 'none';
        impactResults.innerHTML = '<div class="impact-placeholder">Analiz için çözümü simüle edin...</div>';
        if (alternativeActions) {
            alternativeActions.innerHTML = '';
            alternativeActions.style.display = 'none';
        }

        document.getElementById('deployFixBtn').disabled = true;
    } else {
        console.log('Resuming existing sandbox session for ticket:', selectedTicketId);
        terminal.innerHTML = ticket.sandboxSession.terminalHTML;
        terminal.dataset.currentScenario = ticket.sandboxSession.scenarioKey;

        if (ticket.sandboxSession.impactResultsHTML) {
            impactCard.style.display = 'block';
            impactResults.innerHTML = ticket.sandboxSession.impactResultsHTML;
            if (alternativeActions) {
                alternativeActions.innerHTML = ticket.sandboxSession.alternativeActionsHTML || '';
                alternativeActions.style.display = ticket.sandboxSession.alternativeActionsHTML ? 'block' : 'none';
            }
            document.getElementById('deployFixBtn').disabled = ticket.sandboxSession.deployDisabled;
        } else {
            impactCard.style.display = 'none';
        }
    }

    document.getElementById('sandboxModal').classList.add('active');
    console.log('Sandbox modal opened successfully.');
}

async function runSimulation(alternativeScript = null) {
    const term = document.getElementById('sandboxTerminal');
    const simulateBtn = document.getElementById('simulateFixBtn');
    const deployBtn = document.getElementById('deployFixBtn');
    const ticketId = selectedTicketId; // Localize ID to prevent cross-ticket pollution if global changes
    const ticket = getTicket(ticketId);

    if (!ticket) {
        showToast('Hata: Simülasyon için geçerli bir bilet seçilmedi.', 'error');
        return;
    }

    try {
        simulateBtn.disabled = true;
        deployBtn.disabled = true;

        if (alternativeScript) {
            term.innerHTML += `<div class="line terminal-line-cmd">PS C:\\Users\\Administrator> Invoke-Fix -Script "${alternativeScript}"</div>`;
            term.innerHTML += `<div class="line terminal-line-iterative">🔄 Alternatif çözüm uygulanıyor: ${alternativeScript}...</div>`;
        } else {
            term.innerHTML += `<div class="line terminal-line-cmd">PS C:\\Users\\Administrator> .\\fix_v2.ps1 -Source "DigitalTwin"</div>`;
        }

        const scenarioKey = term.dataset.currentScenario || 'database';
        const scenario = SCENARIO_LIBRARY[scenarioKey];

        if (!scenario || !scenario.steps) {
            throw new Error(`Senaryo verisi eksik: ${scenarioKey}`);
        }

        const lines = alternativeScript ? [alternativeScript, ...scenario.steps] : [
            'Running diagnostic script fix_v2.ps1...',
            ...scenario.steps
        ];

        for (const line of lines) {
            await new Promise(r => setTimeout(r, 400 + Math.random() * 800));
            // Check if modal is still active AND if we are still on the same ticket
            if (!document.getElementById('sandboxModal').classList.contains('active') || selectedTicketId !== ticketId) {
                console.log('Simulation aborted: Modal closed or ticket changed');
                return;
            }

            term.innerHTML += `<div class="line">${line}</div>`;
            term.scrollTop = term.scrollHeight;
        }

        await new Promise(r => setTimeout(r, 800));
        term.innerHTML += `<div class="line success">✅ SIMULATION COMPLETE - STABILITY VERIFIED</div>`;
        term.scrollTop = term.scrollHeight;

        analyzeImpact(lines, scenarioKey);
    } catch (error) {
        console.error('Simulation Error:', error);
        term.innerHTML += `<div class="line terminal-line-error">🛑 HATA: Simülasyon sırasında bir aksaklık oluştu: ${error.message}</div>`;
        showToast('Simülasyon Hatası: ' + error.message, 'error');
    } finally {
        simulateBtn.disabled = false;
        deployBtn.disabled = false;
        saveSandboxSession(ticketId);
    }
}

function saveSandboxSession(ticketId) {
    const ticket = getTicket(ticketId);
    if (!ticket) return;

    const terminal = document.getElementById('sandboxTerminal');
    const impactResults = document.getElementById('impactResults');
    const alternativeActions = document.getElementById('alternativeActions');
    const deployBtn = document.getElementById('deployFixBtn');

    ticket.sandboxSession = {
        terminalHTML: terminal.innerHTML,
        scenarioKey: terminal.dataset.currentScenario,
        impactResultsHTML: impactResults.innerHTML,
        alternativeActionsHTML: alternativeActions.innerHTML,
        deployDisabled: deployBtn.disabled
    };

    saveToLocalStorage();
}

function analyzeImpact(executedSteps, scenarioKey = null) {
    const impactCard = document.getElementById('impactAnalysisCard');
    const results = document.getElementById('impactResults');
    const alternativeActions = document.getElementById('alternativeActions');

    if (!impactCard || !results || !alternativeActions) return;

    impactCard.style.display = 'block';

    // Clear only warnings/messages, preserve alternativeActions
    const existingMessages = results.querySelectorAll('.impact-warning, .impact-safe, .impact-placeholder');
    existingMessages.forEach(msg => msg.remove());

    alternativeActions.innerHTML = '';
    alternativeActions.style.display = 'none';

    const stepsText = executedSteps.join(' ').toLowerCase();
    let risks = [];

    // Add scenario-specific risks if they exist and haven't been bypassed
    if (scenarioKey && SCENARIO_LIBRARY[scenarioKey]) {
        SCENARIO_LIBRARY[scenarioKey].risks.forEach(risk => {
            if (!stepsText.includes(risk.script.toLowerCase())) {
                risks.push(risk);
            }
        });
    }

    if (stepsText.includes('registry') || stepsText.includes('ps1')) {
        // Exclude safe GPO alternative
        if (!stepsText.includes('gpo-safe-config')) {
            risks.push({
                type: 'critical',
                msg: '<strong>⚠️ KRİTİK ETKİ:</strong> Registry değişikliği tespit edildi. Bu işlem "Mali Müşavirlik Portalı" bağlantısını koparabilir!',
                alt: 'GPO tabanlı konfigürasyon (Safe Registry)',
                script: 'Apply GPO-Safe-Config.xml (Bypass Registry Direct Edit)'
            });
        }
    }

    if (stepsText.includes('cache') || stepsText.includes('service')) {
        // Exclude hot reload alternative
        if (!stepsText.includes('hotreload')) {
            risks.push({
                type: 'warning',
                msg: '<strong>⚠️ UYARI:</strong> Servis yeniden başlatılması geçici oturum kayıplarına neden olabilir.',
                alt: 'Yük Devretme (Hot Reload)',
                script: 'Invoke-ServiceHotReload -Mode Seamless'
            });
        }
    }

    if (stepsText.includes('delete') || stepsText.includes('rm -rf')) {
        risks.push({
            type: 'critical',
            msg: '<strong>🚫 TEHLİKE:</strong> Dosya silme işlemi tespit edildi! "Sistem Geri Yükleme" noktası oluşturulmadan devam edilemez.',
            alt: 'Dosyaları Karantinaya Al',
            script: 'Move-To-Quarantine -Source "AffectedFiles" -SafetyCheck $true'
        });
    }

    if (stepsText.includes('port') || stepsText.includes('8080') || stepsText.includes('443')) {
        risks.push({
            type: 'warning',
            msg: '<strong>⚠️ PORT ÇAKIŞMASI:</strong> Port değişikliği "System Tray" notification servislerini etkileyebilir.',
            alt: 'VIRTUAL PORT MAPPING',
            script: 'New-VPortMapping -Source 8080 -Target 8081 -StealthMode'
        });
    }

    results.innerHTML = '';
    alternativeActions.innerHTML = '';

    const scenario = SCENARIO_LIBRARY[scenarioKey];
    const currentRisks = risks.length > 0 ? risks : (scenario ? scenario.risks : []);

    if (currentRisks.length > 0) {
        currentRisks.forEach(risk => {
            const div = document.createElement('div');
            div.className = `impact-result ${risk.type}`;
            div.innerHTML = `<div class="impact-msg">${risk.msg}</div>`;
            results.appendChild(div);

            // Add Alternative Action button
            const altBtn = document.createElement('button');
            altBtn.className = 'btn-alternative';
            altBtn.innerHTML = `<span>🛡️</span> <strong>SAFE PATH:</strong> ${risk.alt}`;
            altBtn.onclick = () => {
                showToast(`Alternatif Yol Simüle Ediliyor...`, 'info');
                runSimulation(risk.script);

                const terminal = document.getElementById('sandboxTerminal');
                const choiceLine = document.createElement('div');
                choiceLine.className = 'line';
                choiceLine.style.color = 'var(--primary)';
                choiceLine.style.fontWeight = 'bold';
                choiceLine.style.marginTop = '10px';
                choiceLine.innerHTML = `[CHOICE] User selected alternative path: ${risk.alt}`;
                terminal.appendChild(choiceLine);
                terminal.scrollTop = terminal.scrollHeight;
            };
            alternativeActions.appendChild(altBtn);
        });

        const generalSugs = [
            { text: '🛠️ Tam Yedek Al', script: 'Backup-System -Full' },
            { text: '📡 Trafiği İzole Et', script: 'Isolate-Network -Segment "DMZ"' }
        ];

        generalSugs.forEach(sug => {
            const btn = document.createElement('button');
            btn.className = 'btn-alternative';
            btn.style.opacity = '0.7';
            btn.innerHTML = `<span>⚙️</span> ${sug.text}`;
            btn.onclick = () => runSimulation(sug.script);
            alternativeActions.appendChild(btn);
        });

        alternativeActions.style.display = 'flex';
    } else {
        results.innerHTML = '<div class="impact-result safe">✅ Bu çözüm için herhangi bir risk tespit edilmedi. Güvenle uygulayabilirsiniz.</div>';
        alternativeActions.style.display = 'none';
    }
}

// 4. Shadow IT Radar Data Generator
function generateShadowITReport(ticketId) {
    const list = document.getElementById('diagnosticList');
    if (!list) return;

    list.innerHTML = '';

    // Deterministic random based on ticketId
    const seed = ticketId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seededRandom = () => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    };

    const anomalies = [
        { text: '⚠️ Son 10dk: 5 farklı VPN bağlantısı denendi (CyberGhost, NordVPN)', color: '#fbbf24' },
        { text: '🔴 DNS Ayarları manuel değiştirildi: 8.8.8.8 -> 1.1.1.1', color: '#f87171' },
        { text: '🔍 Şüpheli Exe çalışıyor: "Free_RAM_Booster.exe"', color: '#f87171' },
        { text: 'ℹ️ Windows Update servisi devredışı bırakıldı', color: '#60a5fa' },
        { text: '⚠️ Torrent trafiği tespit edildi: "BitTorrent.exe"', color: '#fbbf24' },
        { text: '🔴 Registry modifikasyonu: Local Machine Run key', color: '#f87171' },
        { text: '🔍 Bilinmeyen USB aygıtı bağlandı', color: '#fbbf24' },
        { text: 'ℹ️ RDP (3389) portu üzerinden brute-force denemesi', color: '#f87171' }
    ];

    // Pick 2-3 items based on seed
    const count = 2 + (seed % 2);
    const selected = [];
    const tempAnomalies = [...anomalies];

    for (let i = 0; i < count; i++) {
        const index = (seed + i) % tempAnomalies.length;
        selected.push(tempAnomalies.splice(index, 1)[0]);
    }

    selected.forEach(item => {
        const li = document.createElement('li');
        li.className = 'diagnostic-item';
        li.textContent = item.text;
        li.style.color = item.color;
        list.appendChild(li);
    });
}

// 5. Hardware Health Scanner (Donanım Öngörü Analizi)
function scanHardwareHealth() {
    const widget = document.getElementById('hardwareHealthWidget');
    const results = document.getElementById('healthResults');
    if (!widget || !results) return;

    widget.style.display = 'block';
    results.innerHTML = '<div class="line">Donanım bileşenleri taranıyor...</div>';

    setTimeout(() => {
        // Use selectedTicketId as a seed
        const seed = selectedTicketId ? selectedTicketId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : Math.random();

        const metrics = [
            { label: 'NVMe SSD Sağlığı', value: `%${30 + (seed % 60)}${seed % 3 === 0 ? ' (KRİTİK)' : ' (İyi)'}`, critical: seed % 3 === 0, part: '512GB NVMe SSD' },
            { label: 'CPU Sıcaklığı', value: `${70 + (seed % 25)}°C${seed % 2 === 0 ? ' (Yüksek)' : ' (Normal)'}`, critical: seed % 2 === 0, part: 'Termal Macun & Fan Temizliği' },
            { label: 'Batarya Döngüsü', value: `${500 + (seed % 500)} (Normal)`, critical: false },
            { label: 'Fan Hızı', value: `${3000 + (seed % 3000)} RPM`, critical: false }
        ];

        results.innerHTML = '';
        metrics.forEach(m => {
            const div = document.createElement('div');
            div.className = `health-item ${m.critical ? 'health-critical' : ''}`;
            div.innerHTML = `<span>${m.label}:</span> <span>${m.value}</span>`;
            results.appendChild(div);

            if (m.critical && m.part) {
                const badge = document.createElement('div');
                badge.className = 'health-reserve-badge';
                badge.textContent = `📦 Yedek Parça Rezerve Edildi: ${m.part}`;
                results.appendChild(badge);
            }
        });

        if (metrics.some(m => m.critical)) {
            showToast('Donanım Öngörü Analizi: Kritik sorunlar tespit edildi.', 'warning');
        } else {
            showToast('Donanım Öngörü Analizi: Sorun tespit edilmedi.', 'success');
        }
    }, 1500);
}

// 7. Ghostwriter Utility (Tercüman)
function humanizeTechnicalText(text) {
    const mappings = [
        { tech: /db connection string/gi, human: 'sistem bağlantı ayarları' },
        { tech: /index rebuild/gi, human: 'veritabanı hızlandırma çalışması' },
        { tech: /timeout parametresini/gi, human: 'bekleme süresini' },
        { tech: /30sn'ye çektim/gi, human: 'optimize ettim' },
        { tech: /registry keys/gi, human: 'sistem kayıt dosyaları' },
        { tech: /temp cache/gi, human: 'gereksiz geçici dosyalar' },
        { tech: /clearing/gi, human: 'temizleniyor' },
        { tech: /restart/gi, human: 'yeniden başlatma' }
    ];

    let humanized = text;
    mappings.forEach(m => {
        humanized = humanized.replace(m.tech, m.human);
    });

    // Structural wrapper to make it sound better
    return `[İNSAN DİLİNE TERCÜME]\n\nGerçekleştirilen işlem: ${humanized}\n\nÖzetle: Sistem performansını optimize etmek ve teknik aksaklıkları gidermek adına gerekli düzenlemeler yapılmıştır. Lütfen kontrol eder misiniz?`;
}

// Global SLA Update Interval
setInterval(() => {
    document.querySelectorAll('.sla-digital-clock').forEach(el => {
        const id = el.dataset.id;
        const ticket = getTicket(id);
        if (ticket && ticket.status !== 'resolved' && ticket.status !== 'closed') {
            const sla = calculateSLA(ticket);
            el.textContent = formatSLATime(sla.remainingSeconds);
            el.className = `sla-badge status-${sla.status} sla-digital-clock`;
        }
    });
}, 1000);

function passTicket(id, newAssignee) {
    if (!newAssignee || !id) return;
    const finalAssignee = newAssignee === 'Ben' ? 'Ahmet Yılmaz (Ben)' : newAssignee;
    updateTicket(id, {
        assignee: finalAssignee,
        authenticity_token: SecurityGuardian._token
    });
    render();
    renderDetailPanel(id);
    showToast(`Bilet başarıyla ${finalAssignee} sorumlusuna devredildi.`, 'success');
}

function quickResolve(ticketId) {
    updateTicket(ticketId, { status: 'resolved', authenticity_token: SecurityGuardian._token });
    render();
    showToast('Bilet çözüldü olarak işaretlendi.', 'success');
}

function quickAssign(ticketId) {
    updateTicket(ticketId, { assignee: 'Ben', authenticity_token: SecurityGuardian._token });
    render();
    showToast('Bilet size atandı.', 'success');
}

function quickDelete(ticketId) {
    if (confirm('Bu bileti silmek istediğinizden emin misiniz?')) {
        deleteTicket(ticketId);
        render();
        showToast('Bilet silindi.', 'info');
    }
}
