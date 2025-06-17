// Main Application Controller
class AppController {
    constructor() {
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.checkAuthStatus();
            this.setupKeyboardShortcuts();
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('form-container') && e.target === e.currentTarget) {
                // Optional: Close forms on outside click
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
        });
    }

    handleEscapeKey() {
        const visibleForms = document.querySelectorAll('.form-container:not(.hidden)');
        visibleForms.forEach(form => {
            if (form.id !== 'loginForm' && form.id !== 'registerForm') {
                form.classList.add('hidden');
            }
        });

        const filterOptions = document.getElementById('filterOptions');
        if (!filterOptions.classList.contains('hidden')) {
            filterOptions.classList.add('hidden');
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
        } else if (authManager.isStudent()) {
            await complaintManager.loadStudentComplaints();
        }
    }

    setupAutoSave(form) {
        const formElements = form.querySelectorAll('input, select, textarea');
        const draftKey = 'complaint_draft';

        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
            const draft = JSON.parse(savedDraft);
            Object.keys(draft).forEach(key => {
                const element = form.querySelector(`[id="${key}"]`);
                if (element) {
                    element.value = draft[key];
                }
            });
        }

        formElements.forEach(element => {
            element.addEventListener('input', () => {
                const draft = {};
                formElements.forEach(el => {
                    if (el.value) {
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

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            zIndex: '10000',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#48bb78';
                break;
            case 'error':
                notification.style.backgroundColor = '#e53e3e';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ed8936';
                break;
            default:
                notification.style.backgroundColor = '#4299e1';
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

    validateForm(formElement) {
        const requiredFields = formElement.querySelectorAll('[required]');
        let isValid = true;
        let firstInvalidField = null;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
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

        if (firstInvalidField) {
            firstInvalidField.focus();
            this.showNotification('Sila isi semua medan yang diperlukan', 'error');
        }

        return isValid;
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
                        </div>
                        <p><strong>ID:</strong> ${complaint.id}</p>
                        <p><strong>Pelajar:</strong> ${complaint.studentName} (${complaint.studentEmail})</p>
                        <p><strong>Kategori:</strong> ${complaintManager.getCategoryText(complaint.category)}</p>
                        <p><strong>Tarikh:</strong> ${complaintManager.formatDate(complaint.createdAt)}</p>
                        <p><strong>Butiran:</strong> ${complaint.description}</p>
                    </div>
                `).join('')}
            </body>
            </html>
        `;
    }
}

// Initialize Application
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