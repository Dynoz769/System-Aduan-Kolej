class AdminManager {
    constructor() {
        this.currentFilter = { status: '', category: '', priority: '' };
        this.charts = {};
        this.complaintsRef = firebase.database().ref('complaints');
    }

    async markAsRead(complaintId) {
        if (!authManager.isAdmin()) {
            app.showNotification('Hanya admin boleh mengubah status aduan', 'error');
            return;
        }

        const complaintRef = this.complaintsRef.child(complaintId);
        await complaintRef.update({ status: 'dibaca', updatedAt: new Date().toISOString() });
        app.showNotification('Aduan telah ditanda sebagai dibaca', 'success');
        await this.loadAllComplaints();
    }

    async markAsProcessing(complaintId) {
        if (!authManager.isAdmin()) {
            app.showNotification('Hanya admin boleh mengubah status aduan', 'error');
            return;
        }

        const complaintRef = this.complaintsRef.child(complaintId);
        await complaintRef.update({ status: 'diproses', updatedAt: new Date().toISOString() });
        app.showNotification('Aduan telah ditanda sebagai diproses', 'success');
        await this.loadAllComplaints();
    }

    async markAsCompleted(complaintId) {
        if (!authManager.isAdmin()) {
            app.showNotification('Hanya admin boleh mengubah status aduan', 'error');
            return;
        }

        const complaintRef = this.complaintsRef.child(complaintId);
        await complaintRef.update({ status: 'selesai', updatedAt: new Date().toISOString() });
        app.showNotification('Aduan telah ditanda sebagai selesai', 'success');
        await this.loadAllComplaints();
    }

    async setPriority(complaintId, priority) {
        if (!authManager.isAdmin()) {
            app.showNotification('Hanya admin boleh mengubah keutamaan aduan', 'error');
            return;
        }

        const complaintRef = this.complaintsRef.child(complaintId);
        await complaintRef.update({ priority, updatedAt: new Date().toISOString() });
        app.showNotification(`Keutamaan aduan ditetapkan sebagai ${complaintManager.getPriorityText(priority)}`, 'success');
        await this.loadAllComplaints();
    }

    async loadAllComplaints(options = {}) {
        if (!authManager.isAdmin()) return;

        const snapshot = await this.complaintsRef.once('value');
        let complaints = Object.values(snapshot.val() || {});
        const searchQuery = document.getElementById('adminSearch').value || options.search;
        if (searchQuery) {
            complaints = complaintManager.searchComplaints(searchQuery, complaints);
        }

        if (this.currentFilter.status || this.currentFilter.category || this.currentFilter.priority) {
            complaints = await complaintManager.filterComplaints(this.currentFilter, complaints);
        }

        const container = document.getElementById('adminComplaintsList');
        if (complaints.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #718096;">
                    <p>Tiada aduan ditemui.</p>
                </div>
            `;
        } else {
            const statusPriority = { 'baru': 0, 'dibaca': 1, 'diproses': 2, 'selesai': 3 };
            const priorityOrder = { 'tinggi': 0, 'sederhana': 1, 'rendah': 2 };
            complaints.sort((a, b) => {
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                if (statusPriority[a.status] !== statusPriority[b.status]) {
                    return statusPriority[a.status] - statusPriority[b.status];
                }
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            container.innerHTML = complaints.map(complaint => 
                complaintManager.renderAdminComplaint(complaint)
            ).join('');
        }

        await this.updateComplaintStats();
    }

    async updateComplaintStats() {
        const snapshot = await this.complaintsRef.once('value');
        const allComplaints = Object.values(snapshot.val() || {});
        const stats = {
            total: allComplaints.length,
            baru: allComplaints.filter(c => c.status === 'baru').length,
            dibaca: allComplaints.filter(c => c.status === 'dibaca').length,
            diproses: allComplaints.filter(c => c.status === 'diproses').length,
            selesai: allComplaints.filter(c => c.status === 'selesai').length,
            rendah: allComplaints.filter(c => c.priority === 'rendah').length,
            sederhana: allComplaints.filter(c => c.priority === 'sederhana').length,
            tinggi: allComplaints.filter(c => c.priority === 'tinggi').length
        };

        const complaintsHeader = document.querySelector('#adminComplaints h3');
        if (complaintsHeader) {
            complaintsHeader.innerHTML = `
                Senarai Aduan 
                <span style="font-size: 0.8rem; color: #718096;">
                    (Jumlah: ${stats.total} | Baru: ${stats.baru} | Dibaca: ${stats.dibaca} | 
                    Diproses: ${stats.diproses} | Selesai: ${stats.selesai} | 
                    Rendah: ${stats.rendah} | Sederhana: ${stats.sederhana} | Tinggi: ${stats.tinggi})
                </span>
            `;
        }
    }

    async loadAnalytics() {
        if (!authManager.isAdmin()) return;

        const snapshot = await this.complaintsRef.once('value');
        const complaints = Object.values(snapshot.val() || {});
        const categoryCounts = {};
        const statusCounts = {};

        complaints.forEach(complaint => {
            categoryCounts[complaint.category] = (categoryCounts[complaint.category] || 0) + 1;
            statusCounts[complaint.status] = (statusCounts[complaint.status] || 0) + 1;
        });

        const categoryData = {
            labels: Object.keys(categoryCounts).map(category => complaintManager.getCategoryText(category)),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF']
            }]
        };

        const statusData = {
            labels: Object.keys(statusCounts).map(status => complaintManager.getStatusText(status)),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#fed7d7', '#feebc8', '#bee3f8', '#c6f6d5']
            }]
        };

        if (this.charts.categoryChart) {
            this.charts.categoryChart.destroy();
        }
        if (this.charts.statusChart) {
            this.charts.statusChart.destroy();
        }

        this.charts.categoryChart = new Chart(document.getElementById('categoryChart'), {
            type: 'pie',
            data: categoryData,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Taburan Aduan Mengikut Kategori' }
                }
            }
        });

        this.charts.statusChart = new Chart(document.getElementById('statusChart'), {
            type: 'pie',
            data: statusData,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Taburan Aduan Mengikut Status' }
                }
            }
        });
    }

    async loadAuditLogs() {
        if (!authManager.isAdmin()) return;

        const snapshot = await firebase.database().ref('audit_logs').once('value');
        const auditLogs = Object.values(snapshot.val() || {});
        const container = document.getElementById('auditLogList');
        if (auditLogs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #718096;">
                    <p>Tiada log audit ditemui.</p>
                </div>
            `;
        } else {
            container.innerHTML = auditLogs.map(log => `
                <div class="audit-log-item">
                    <strong>Tindakan:</strong> ${log.action}<br>
                    <strong>Pengguna:</strong> ${log.userId}<br>
                    <strong>Butiran:</strong> ${log.details}<br>
                    <strong>Tarikh:</strong> ${complaintManager.formatDate(log.timestamp)}
                </div>
            `).join('');
        }
    }

    async applyFilter() {
        const statusFilter = document.getElementById('filterStatus').value;
        const categoryFilter = document.getElementById('filterCategory').value;
        const priorityFilter = document.getElementById('filterPriority').value;

        this.currentFilter = {
            status: statusFilter,
            category: categoryFilter,
            priority: priorityFilter
        };

        await this.loadAllComplaints();

        let filterText = 'Semua Aduan';
        if (statusFilter || categoryFilter || priorityFilter) {
            filterText = 'Aduan Ditapis';
            if (statusFilter) {
                filterText += ` (Status: ${complaintManager.getStatusText(statusFilter)})`;
            }
            if (categoryFilter) {
                filterText += ` (Kategori: ${complaintManager.getCategoryText(categoryFilter)})`;
            }
            if (priorityFilter) {
                filterText += ` (Keutamaan: ${complaintManager.getPriorityText(priorityFilter)})`;
            }
        }

        const filterHeader = document.querySelector('#filterOptions h3');
        if (filterHeader) {
            filterHeader.textContent = 'Tapis Aduan - ' + filterText;
        }
    }

    clearFilter() {
        this.currentFilter = { status: '', category: '', priority: '' };
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterCategory').value = '';
        document.getElementById('filterPriority').value = '';
        this.loadAllComplaints();

        const filterHeader = document.querySelector('#filterOptions h3');
        if (filterHeader) {
            filterHeader.textContent = 'Tapis Aduan';
        }
    }

    async exportComplaints() {
        if (!authManager.isAdmin()) {
            app.showNotification('Hanya admin boleh eksport data aduan', 'error');
            return;
        }

        const snapshot = await this.complaintsRef.once('value');
        const complaints = Object.values(snapshot.val() || {});
        if (complaints.length === 0) {
            app.showNotification('Tiada aduan untuk dieksport', 'warning');
            return;
        }

        const headers = ['ID Aduan', 'Nama Pelajar', 'Email', 'Kategori', 'Keutamaan', 'Tajuk', 'Butiran', 'Status', 'Nota Admin', 'Tarikh Dibuat', 'Tarikh Dikemaskini'];
        const csvContent = [
            headers.join(','),
            ...complaints.map(complaint => [
                complaint.id,
                `"${complaint.studentName || 'Unknown'}"`,
                complaint.studentEmail || 'Unknown',
                complaintManager.getCategoryText(complaint.category),
                complaintManager.getPriorityText(complaint.priority),
                `"${complaint.title.replace(/"/g, '""')}"`,
                `"${(complaint.description || '').replace(/"/g, '""')}"`,
                complaintManager.getStatusText(complaint.status),
                `"${(complaint.adminNotes || '').replace(/"/g, '""')}"`,
                complaintManager.formatDate(complaint.createdAt),
                complaintManager.formatDate(complaint.updatedAt || complaint.createdAt)
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `aduan_pelajar_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        app.showNotification('Data aduan telah dieksport ke fail CSV', 'success');
        authManager.logAudit('Data aduan dieksport', authManager.getCurrentUser().id);
    }
}

const adminManager = new AdminManager();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('viewAllComplaintsBtn').addEventListener('click', async () => {
        document.getElementById('filterOptions').classList.add('hidden');
        document.getElementById('analyticsContainer').classList.add('hidden');
        document.getElementById('auditLog').classList.add('hidden');
        document.getElementById('adminComplaints').classList.remove('hidden');
        await adminManager.loadAllComplaints();
    });

    document.getElementById('filterComplaintsBtn').addEventListener('click', () => {
        const filterOptions = document.getElementById('filterOptions');
        document.getElementById('analyticsContainer').classList.add('hidden');
        document.getElementById('auditLog').classList.add('hidden');
        document.getElementById('adminComplaints').classList.remove('hidden');
        if (filterOptions.classList.contains('hidden')) {
            filterOptions.classList.remove('hidden');
        } else {
            filterOptions.classList.add('hidden');
        }
    });

    document.getElementById('analyticsBtn').addEventListener('click', () => {
        document.getElementById('filterOptions').classList.add('hidden');
        document.getElementById('adminComplaints').classList.add('hidden');
        document.getElementById('auditLog').classList.add('hidden');
        document.getElementById('analyticsContainer').classList.remove('hidden');
        adminManager.loadAnalytics();
    });

    document.getElementById('auditLogBtn').addEventListener('click', () => {
        document.getElementById('filterOptions').classList.add('hidden');
        document.getElementById('adminComplaints').classList.add('hidden');
        document.getElementById('analyticsContainer').classList.add('hidden');
        document.getElementById('auditLog').classList.remove('hidden');
        adminManager.loadAuditLogs();
    });

    document.getElementById('applyFilter').addEventListener('click', async () => {
        await adminManager.applyFilter();
    });

    const clearFilterBtn = document.createElement('button');
    clearFilterBtn.textContent = 'Kosongkan Tapisan';
    clearFilterBtn.type = 'button';
    clearFilterBtn.style.marginLeft = '10px';
    clearFilterBtn.addEventListener('click', () => {
        adminManager.clearFilter();
    });
    document.getElementById('applyFilter').parentNode.appendChild(clearFilterBtn);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Eksport Data';
    exportBtn.className = 'action-btn';
    exportBtn.style.backgroundColor = '#805ad5';
    exportBtn.addEventListener('click', async () => {
        await adminManager.exportComplaints();
    });
    document.querySelector('#adminDashboard .dashboard-actions').appendChild(exportBtn);

    document.getElementById('adminSearch').addEventListener('input', app.debounce(() => {
        adminManager.loadAllComplaints();
    }, 300));

    setInterval(async () => {
        if (authManager.isAdmin() && !document.getElementById('adminDashboard').classList.contains('hidden')) {
            await adminManager.loadAllComplaints();
        }
    }, 30000);
});