class AppController {
    constructor() {
        this.notifications = [];
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.checkAuthStatus();
            this.setupKeyboardShortcuts();
            this.setupTouchEvents();
            this.setupIntroJs();
            this.setupAnalyticsChart();
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('form-container') && e.target === e.currentTarget) {
                this.handleEscapeKey();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });

        window.addEventListener('popstate', () => {
            this.handleBrowserNavigation();
        });

        const complaintForm = document.getElementById('complaintFormElement');
        if (complaintForm) {
            this.setupAutoSave(complaintForm);
        }

        const searchInput = document.getElementById('complaintSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.searchComplaints();
            }, 300));
        }

        const notificationBtn = document.getElementById('viewNotificationsBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.toggleNotificationHistory();
            });
        }
    }

    setupTouchEvents() {
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            if (touchEndX - touchStartX > 50 && authManager.isStudent()) {
                document.getElementById('newComplaintBtn').click();
            } else if (touchStartX - touchEndX > 50 && authManager.isStudent()) {
                document.getElementById('viewComplaintsBtn').click();
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', async (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && authManager.isStudent()) {
                e.preventDefault();
                document.getElementById('newComplaintBtn').click();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                await this.refreshCurrentView();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'l' && authManager.isLoggedIn()) {
                e.preventDefault();
                document.getElementById('logoutBtn').click();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.searchComplaints();
            }
        });
    }

    setupIntroJs() {
        if (typeof introJs !== 'undefined') {
            const intro = introJs();
            intro.setOptions({
                steps: [
                    {
                        element: document.querySelector('.header'),
                        intro: 'Ini adalah header sistem. Gunakan butang navigasi untuk log masuk, daftar, atau log keluar.'
                    },
                    {
                        element: document.getElementById('newComplaintBtn'),
                        intro: 'Klik di sini untuk membuat aduan baru (pelajar sahaja).'
                    },
                    {
                        element: document.getElementById('viewComplaintsBtn'),
                        intro: 'Klik di sini untuk melihat senarai aduan anda.'
                    },
                    {
                        element: document.getElementById('viewAllComplaintsBtn'),
                        intro: 'Klik di sini untuk melihat semua aduan (admin sahaja).'
                    },
                    {
                        element: document.getElementById('complaintSearch'),
                        intro: 'Gunakan bar carian ini untuk mencari aduan berdasarkan ID, tajuk, atau butiran.'
                    }
                ],
                showProgress: true,
                exitOnOverlayClick: true
            });
            document.getElementById('startTutorial').addEventListener('click', () => {
                intro.start();
            });
        }
    }

    setupAnalyticsChart() {
        if (authManager.isAdmin()) {
            const ctx = document.getElementById('analyticsChart');
            if (ctx) {
                const complaints = complaintManager.getAllComplaints();
                const categories = ['akademik', 'kemudahan', 'kantin', 'perpustakaan', 'pengangkutan', 'asrama', 'lain-lain'];
                const categoryCounts = categories.map(cat => 
                    complaints.filter(c => c.category === cat).length
                );

                new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: categories.map(cat => complaintManager.getCategoryText(cat)),
                        datasets: [{
                            data: categoryCounts,
                            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF']
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Taburan Aduan Mengikut Kategori'
                            }
                        }
                    }
                });
            }
        }
    }

    handleEscapeKey() {
        const visibleForms = document.querySelectorAll('.form-container:not(.hidden)');
        visibleForms.forEach(form => {
            if (form.id !== 'loginForm' && form.id !== 'registerForm') {
                form.classList.add('hidden');
            }
        });

        const filterOptions = document.getElementById('filterOptions');
        if (filterOptions && !filterOptions.classList.contains('hidden')) {
            filterOptions.classList.add('hidden');
        }

        const notificationHistory = document.getElementById('notificationHistory');
        if (notificationHistory && !notificationHistory.classList.contains('hidden')) {
            notificationHistory.classList.add('hidden');
        }
    }

    handleBrowserNavigation() {
        this.checkAuthStatus();
    }

    checkAuthStatus() {
        if (authManager.isLoggedIn()) {
            authManager.showDashboard();
            this.refreshCurrentView();
        } else {
            authManager.showWelcomeScreen();
        }
    }

    async refreshCurrentView() {
        if (authManager.isAdmin()) {
            await adminManager.loadAllComplaints();
            this.setupAnalyticsChart();
        } else if (authManager.isStudent()) {
            await complaintManager.loadStudentComplaints();
        }
    }

    setupAutoSave(form) {
        const formElements = form.querySelectorAll('input, select, textarea, input[type="file"]');
        const draftKey = 'complaint_draft';

        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
            const draft = JSON.parse(savedDraft);
            Object.keys(draft).forEach(key => {
                const element = form.querySelector(`[id="${key}"]`);
                if (element && element.type !== 'file') {
                    element.value = draft[key];
                }
            });
        }

        formElements.forEach(element => {
            element.addEventListener('input', () => {
                const draft = {};
                formElements.forEach(el => {
                    if (el.value && el.type !== 'file') {
                        draft[el.id] = el.value;
                    }
                });
                localStorage.setItem(draftKey, JSON.stringify(draft));
            });
        });

        form.addEventListener('submit', () => {
            localStorage.removeItem(draftKey);
        });
    }

    validateForm(formElement) {
        const requiredFields = formElement.querySelectorAll('[required]');
        let isValid = true;
        let firstInvalidField = null;

        requiredFields.forEach(field => {
            if (!field.value.trim() && field.type !== 'file') {
                field.style.borderColor = '#e53e3e';
                field.style.boxShadow = '0 0 0 3px rgba(229, 62, 62, 0.1)';
                isValid = false;
                if (!firstInvalidField) {
                    firstInvalidField = field;
                }
            } else {
                field.style.borderColor = '#e2e8f0';
                field.style.boxShadow = 'none';
            }
        });

        const fileInput = formElement.querySelector('input[type="file"]');
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const maxSize = 5 * 1024 * 1024;
            const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

            if (file.size > maxSize) {
                this.showNotification('Fail terlalu besar. Maksimum 5MB.', 'error');
                isValid = false;
            } else if (!allowedTypes.includes(file.type)) {
                this.showNotification('Jenis fail tidak disokong. Hanya imej (JPEG, PNG) atau PDF dibenarkan.', 'error');
                isValid = false;
            }
        }

        if (firstInvalidField) {
            firstInvalidField.focus();
            this.showNotification('Sila isi semua medan yang diperlukan', 'error');
        }

        return isValid;
    }

    showNotification(message, type = 'info', duration = 3000) {
        this.notifications.push({
            id: Date.now(),
            message,
            type,
            timestamp: new Date().toISOString()
        });

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        Object.assign(notification.style, {
            position: 'fixed',
            bottom: '1rem',
            right: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            width: '200px',
            maxHeight: '60px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            overflowY: 'auto'
        });

        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#10b981';
                break;
            case 'error':
                notification.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                notification.style.backgroundColor = '#f59e0b';
                break;
            default:
                notification.style.backgroundColor = '#3b82f6';
        }

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    notifyUsers(complaint, message) {
        console.log(`Notifying users about complaint ${complaint.id}: ${message}`);
        this.showNotification(`Notifikasi: ${message} (ID Aduan: ${complaint.id})`, 'info', 5000);
    }

    toggleNotificationHistory() {
        const container = document.getElementById('notificationHistory');
        if (!container) return;

        if (container.classList.contains('hidden')) {
            container.classList.remove('hidden');
            container.innerHTML = this.notifications.length > 0
                ? this.notifications.map(n => `
                    <div class="notification-item notification-${n.type}">
                        <span>${n.message}</span>
                        <span style="font-size: 0.8rem; color: #718096;">
                            ${complaintManager.formatDate(n.timestamp)}
                        </span>
                    </div>
                `).join('')
                : '<div style="text-align: center; padding: 20px; color: #718096;">Tiada pemberitahuan.</div>';
        } else {
            container.classList.add('hidden');
        }
    }

    searchComplaints() {
        const searchInput = document.getElementById('complaintSearch');
        const query = searchInput.value.trim().toLowerCase();
        if (authManager.isAdmin()) {
            adminManager.loadAllComplaints({ search: query });
        } else if (authManager.isStudent()) {
            complaintManager.loadStudentComplaints({ search: query });
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    debounce(func, wait) {
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

    checkOnlineStatus() {
        const updateOnlineStatus = () => {
            if (navigator.onLine) {
                this.showNotification('Sambungan internet dipulihkan', 'success', 2000);
            } else {
                this.showNotification('Tiada sambungan internet', 'warning', 5000);
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
    }

    async printComplaints() {
        if (!authManager.isAdmin()) {
            this.showNotification('Hanya admin boleh mencetak laporan', 'error');
            return;
        }

        const complaints = await complaintManager.getAllComplaints();
        if (complaints.length === 0) {
            this.showNotification('Tiada aduan untuk dicetak', 'warning');
            return;
        }

        const printWindow = window.open('', '_blank');
        const printContent = this.generatePrintContent(complaints);
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    }

    generatePrintContent(complaints) {
        const currentDate = new Date().toLocaleDateString('ms-MY');
        const stats = {
            total: complaints.length,
            baru: complaints.filter(c => c.status === 'baru').length,
            dibaca: complaints.filter(c => c.status === 'dibaca').length,
            diproses: complaints.filter(c => c.status === 'diproses').length,
            selesai: complaints.filter(c => c.status === 'selesai').length
        };

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Laporan Aduan Pelajar - ${currentDate}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; text-align: center; }
                    .stats { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
                    .complaint { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
                    .complaint-header { font-weight: bold; margin-bottom: 10px; }
                    .status { padding: 3px 8px; border-radius: 3px; font-size: 0.8em; }
                    .status-baru { background: #fed7d7; color: #c53030; }
                    .status-dibaca { background: #feebc8; color: #dd6b20; }
                    .status-diproses { background: #bee3f8; color: #2b6cb0; }
                    .status-selesai { background: #c6f6d5; color: #2f855a; }
                    .priority-low { color: #38a169; }
                    .priority-medium { color: #dd6b20; }
                    .priority-high { color: #c53030; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <h1>Laporan Aduan Pelajar</h1>
                <p><strong>Tarikh:</strong> ${currentDate}</p>
                
                <div class="stats">
                    <h3>Ringkasan</h3>
                    <p>Jumlah Aduan: ${stats.total}</p>
                    <p>Baru: ${stats.baru} | Dibaca: ${stats.dibaca} | Diproses: ${stats.diproses} | Selesai: ${stats.selesai}</p>
                </div>

                ${complaints.map(complaint => `
                    <div class="complaint">
                        <div class="complaint-header">
                            ${complaint.title} 
                            <span class="status status-${complaint.status}">
                                ${complaintManager.getStatusText(complaint.status)}
                            </span>
                            <span class="priority priority-${complaint.priority}">
                                Keutamaan: ${complaintManager.getPriorityText(complaint.priority)}
                            </span>
                        </div>
                        <p><strong>ID:</strong> ${complaint.id}</p>
                        <p><strong>Pelajar:</strong> ${complaint.student_name || 'Unknown'} (${complaint.student_email || 'Unknown'})</p>
                        <p><strong>Kategori:</strong> ${complaintManager.getCategoryText(complaint.category)}</p>
                        <p><strong>Tarikh:</strong> ${complaintManager.formatDate(complaint.created_at)}</p>
                        <p><strong>Butiran:</strong> ${complaint.description}</p>
                        ${complaint.attachment ? `<p><strong>Lampiran:</strong> <a href="${complaint.attachment}" target="_blank">${complaint.attachment}</a></p>` : ''}
                        ${complaint.admin_notes ? `<p><strong>Nota Admin:</strong> ${complaint.admin_notes}</p>` : ''}
                        ${complaint.feedback ? `<p><strong>Maklum Balas:</strong> ${complaint.feedback}</p>` : ''}
                    </div>
                `).join('')}
            </body>
            </html>
        `;
    }

    logAudit(action, details) {
        if (!authManager.isAdmin()) return;

        const auditLog = {
            user_id: authManager.getCurrentUser().id,
            action,
            details,
            timestamp: new Date().toISOString()
        };

        this.database.ref('audit_logs').push(auditLog);
    }
}

// Initialize Firebase
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project-id.firebaseapp.com",
    databaseURL: "https://your-project-id.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};

firebase.initializeApp(firebaseConfig);
const app = new AppController();

// Override default alert and confirm for better UX
window.originalAlert = window.alert;
window.originalConfirm = window.confirm;

window.alert = function(message) {
    if (typeof app !== 'undefined') {
        app.showNotification(message, 'info', 4000);
    } else {
        window.originalAlert(message);
    }
};

window.confirm = function(message) {
    if (typeof app !== 'undefined') {
        app.showNotification(message, 'warning', 4000);
        return window.originalConfirm(message);
    }
    return window.originalConfirm(message);
};

// Add print button to admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('adminDashboard')) {
        const printBtn = document.createElement('button');
        printBtn.textContent = 'Cetak Laporan';
        printBtn.className = 'action-btn';
        printBtn.style.backgroundColor = '#718096';
        printBtn.addEventListener('click', async () => {
            await app.printComplaints();
            app.logAudit('Print Laporan', 'Admin mencetak laporan aduan');
        });
        
        setTimeout(() => {
            const adminActions = document.getElementById('adminActions');
            if (adminActions) {
                adminActions.appendChild(printBtn);
            } else {
                const dashboard = document.getElementById('adminDashboard');
                if (dashboard) {
                    dashboard.appendChild(printBtn);
                }
            }
        }, 500);
    }
});