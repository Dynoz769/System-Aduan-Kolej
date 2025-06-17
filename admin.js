// Admin Management Module
class AdminManager {
    constructor() {
        this.currentFilter = { status: '', category: '' };
    }

    async markAsRead(complaintId) {
        if (!authManager.isAdmin()) {
            app.showNotification('Hanya admin boleh mengubah status aduan', 'error');
            return;
        }

        const complaint = await complaintManager.updateComplaintStatus(complaintId, 'dibaca');
        if (complaint) {
            app.showNotification('Aduan telah ditanda sebagai dibaca', 'success');
            await this.loadAllComplaints();
        }
    }

    async markAsProcessing(complaintId) {
        if (!authManager.isAdmin()) {
            app.showNotification('Hanya admin boleh mengubah status aduan', 'error');
            return;
        }

        const complaint = await complaintManager.updateComplaintStatus(complaintId, 'diproses');
        if (complaint) {
            app.showNotification('Aduan telah ditanda sebagai diproses', 'success');
            await this.loadAllComplaints();
        }
    }

    async markAsCompleted(complaintId) {
        if (!authManager.isAdmin()) {
            app.showNotification('Hanya admin boleh mengubah status aduan', 'error');
            return;
        }

        const complaint = await complaintManager.updateComplaintStatus(complaintId, 'selesai');
        if (complaint) {
            app.showNotification('Aduan telah ditanda sebagai selesai', 'success');
            await this.loadAllComplaints();
        }
    }

    async loadAllComplaints() {
        if (!authManager.isAdmin()) return;

        let complaints = await complaintManager.getAllComplaints();
        
        // Apply current filter
        if (this.currentFilter.status || this.currentFilter.category) {
            complaints = await complaintManager.filterComplaints(this.currentFilter);
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
            complaints.sort((a, b) => {
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
        const allComplaints = await complaintManager.getAllComplaints();
        const stats = {
            total: allComplaints.length,
            baru: allComplaints.filter(c => c.status === 'baru').length,
            dibaca: allComplaints.filter(c => c.status === 'dibaca').length,
            diproses: allComplaints.filter(c => c.status === 'diproses').length,
            selesai: allComplaints.filter(c => c.status === 'selesai').length
        };

        const complaintsHeader = document.querySelector('#adminComplaints h3');
        if (complaintsHeader) {
            complaintsHeader.innerHTML = `
                Senarai Aduan 
                <span style="font-size: 0.8rem; color: #718096;">
                    (Jumlah: ${stats.total} | Baru: ${stats.baru} | Dibaca: ${stats.dibaca} | Diproses: ${stats.diproses} | Selesai: ${stats.selesai})
                </span>
            `;
        }
    }

    async applyFilter() {
        const statusFilter = document.getElementById('filterStatus').value;
        const categoryFilter = document.getElementById('filterCategory').value;

        this.currentFilter = {
            status: statusFilter,
            category: categoryFilter
        };

        await this.loadAllComplaints();

        let filterText = 'Semua Aduan';
        if (statusFilter || categoryFilter) {
            filterText = 'Aduan Ditapis';
            if (statusFilter) {
                filterText += ` (Status: ${complaintManager.getStatusText(statusFilter)})`;
            }
            if (categoryFilter) {
                filterText += ` (Kategori: ${complaintManager.getCategoryText(categoryFilter)})`;
            }
        }

        const filterHeader = document.querySelector('#filterOptions h3');
        if (filterHeader) {
            filterHeader.textContent = 'Tapis Aduan - ' + filterText;
        }
    }

    clearFilter() {
        this.currentFilter = { status: '', category: '' };
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterCategory').value = '';
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

        const complaints = await complaintManager.getAllComplaints();
        if (complaints.length === 0) {
            app.showNotification('Tiada aduan untuk dieksport', 'warning');
            return;
        }

        const headers = ['ID Aduan', 'Nama Pelajar', 'Email', 'Kategori', 'Tajuk', 'Butiran', 'Status', 'Tarikh Dibuat', 'Tarikh Dikemaskini'];
        const csvContent = [
            headers.join(','),
            ...complaints.map(complaint => [
                complaint.id,
                `"${complaint.studentName}"`,
                complaint.studentEmail,
                complaintManager.getCategoryText(complaint.category),
                `"${complaint.title}"`,
                `"${complaint.description.replace(/"/g, '""')}"`,
                complaintManager.getStatusText(complaint.status),
                complaintManager.formatDate(complaint.createdAt),
                complaintManager.formatDate(complaint.updatedAt)
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
    }
}

// Initialize Admin Manager
const adminManager = new AdminManager();

// Event Listeners for Admin Features
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('viewAllComplaintsBtn').addEventListener('click', async () => {
        document.getElementById('filterOptions').classList.add('hidden');
        await adminManager.loadAllComplaints();
    });

    document.getElementById('filterComplaintsBtn').addEventListener('click', () => {
        const filterOptions = document.getElementById('filterOptions');
        if (filterOptions.classList.contains('hidden')) {
            filterOptions.classList.remove('hidden');
        } else {
            filterOptions.classList.add('hidden');
        }
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

    setInterval(async () => {
        if (authManager.isAdmin() && !document.getElementById('adminDashboard').classList.contains('hidden')) {
            await adminManager.loadAllComplaints();
        }
    }, 30000);
});