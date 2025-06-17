// Complaint Management Module
class ComplaintManager {
    constructor() {
        this.database = firebase.database();
        this.complaintsRef = this.database.ref('complaints');
    }

    async loadComplaints() {
        try {
            const snapshot = await this.complaintsRef.once('value');
            const complaints = [];
            snapshot.forEach(child => {
                complaints.push({ id: child.key, ...child.val() });
            });
            return complaints;
        } catch (error) {
            console.error('Error loading complaints:', error);
            return [];
        }
    }

    async saveComplaint(complaint) {
        try {
            await this.complaintsRef.child(complaint.id).set(complaint);
        } catch (error) {
            console.error('Error saving complaint:', error);
            throw error;
        }
    }

    generateComplaintId() {
        const prefix = 'ADU';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substr(2, 3).toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }

    async createComplaint(complaintData) {
        const newComplaint = {
            id: this.generateComplaintId(),
            studentId: authManager.getCurrentUser().id,
            studentName: authManager.getCurrentUser().name,
            studentEmail: authManager.getCurrentUser().email,
            category: complaintData.category,
            title: complaintData.title,
            description: complaintData.description,
            status: 'baru',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.saveComplaint(newComplaint);
        return newComplaint;
    }

    async getStudentComplaints(studentId) {
        try {
            const snapshot = await this.complaintsRef.orderByChild('studentId').equalTo(studentId).once('value');
            const complaints = [];
            snapshot.forEach(child => {
                complaints.push({ id: child.key, ...child.val() });
            });
            return complaints;
        } catch (error) {
            console.error('Error fetching student complaints:', error);
            return [];
        }
    }

    async getAllComplaints() {
        return await this.loadComplaints();
    }

    async updateComplaintStatus(complaintId, newStatus) {
        try {
            const updates = {
                status: newStatus,
                updatedAt: new Date().toISOString()
            };
            await this.complaintsRef.child(complaintId).update(updates);
            const snapshot = await this.complaintsRef.child(complaintId).once('value');
            return snapshot.val() ? { id: complaintId, ...snapshot.val() } : null;
        } catch (error) {
            console.error('Error updating complaint status:', error);
            return null;
        }
    }

    async editComplaint(complaintId, updatedData) {
        try {
            const snapshot = await this.complaintsRef.child(complaintId).once('value');
            if (!snapshot.exists()) {
                throw new Error('Aduan tidak ditemui');
            }
            const complaint = snapshot.val();
            if (complaint.status !== 'baru') {
                throw new Error('Aduan hanya boleh diedit jika statusnya "Baru"');
            }
            const updates = {
                category: updatedData.category,
                title: updatedData.title,
                description: updatedData.description,
                updatedAt: new Date().toISOString()
            };
            await this.complaintsRef.child(complaintId).update(updates);
            const updatedSnapshot = await this.complaintsRef.child(complaintId).once('value');
            return { id: complaintId, ...updatedSnapshot.val() };
        } catch (error) {
            console.error('Error editing complaint:', error);
            throw error;
        }
    }

    async deleteComplaint(complaintId) {
        try {
            const snapshot = await this.complaintsRef.child(complaintId).once('value');
            if (!snapshot.exists()) {
                return false;
            }
            await this.complaintsRef.child(complaintId).remove();
            return true;
        } catch (error) {
            console.error('Error deleting complaint:', error);
            return false;
        }
    }

    async getComplaintById(complaintId) {
        try {
            const snapshot = await this.complaintsRef.child(complaintId).once('value');
            return snapshot.val() ? { id: complaintId, ...snapshot.val() } : null;
        } catch (error) {
            console.error('Error fetching complaint by ID:', error);
            return null;
        }
    }

    async filterComplaints(filters) {
        let complaints = await this.loadComplaints();
        if (filters.status && filters.status !== '') {
            complaints = complaints.filter(c => c.status === filters.status);
        }
        if (filters.category && filters.category !== '') {
            complaints = complaints.filter(c => c.category === filters.category);
        }
        return complaints;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ms-MY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getStatusText(status) {
        const statusMap = {
            'baru': 'Baru',
            'dibaca': 'Dibaca',
            'diproses': 'Diproses',
            'selesai': 'Selesai'
        };
        return statusMap[status] || status;
    }

    getCategoryText(category) {
        const categoryMap = {
            'akademik': 'Akademik',
            'kemudahan': 'Kemudahan',
            'kantin': 'Kantin',
            'perpustakaan': 'Perpustakaan',
            'pengangkutan': 'Pengangkutan',
            'asrama': 'Asrama',
            'lain-lain': 'Lain-lain'
        };
        return categoryMap[category] || category;
    }

    renderStudentComplaint(complaint) {
        const isEditable = complaint.status === 'baru';
        return `
            <div class="complaint-item">
                <div class="complaint-header">
                    <div class="complaint-title">${complaint.title}</div>
                    <div class="complaint-status status-${complaint.status}">
                        ${this.getStatusText(complaint.status)}
                    </div>
                </div>
                <div class="complaint-meta">
                    <span><strong>ID:</strong> ${complaint.id}</span>
                    <span><strong>Kategori:</strong> ${this.getCategoryText(complaint.category)}</span>
                    <span><strong>Tarikh:</strong> ${this.formatDate(complaint.createdAt)}</span>
                </div>
                <div class="complaint-description">
                    ${complaint.description}
                </div>
                ${complaint.updatedAt !== complaint.createdAt ? 
                    `<div style="font-size: 0.8rem; color: #718096; margin-top: 10px;">
                        Dikemaskini: ${this.formatDate(complaint.updatedAt)}
                    </div>` : ''
                }
                <div class="complaint-actions">
                    ${isEditable ? 
                        `<button class="action-btn edit-btn" onclick="complaintManager.showEditComplaintForm('${complaint.id}')">Edit</button>
                        <button class="action-btn delete-btn" onclick="complaintManager.confirmDeleteComplaint('${complaint.id}')">Padam</button>` 
                        : ''
                    }
                </div>
            </div>
        `;
    }

    renderAdminComplaint(complaint) {
        return `
            <div class="complaint-item">
                <div class="complaint-header">
                    <div class="complaint-title">${complaint.title}</div>
                    <div class="complaint-status status-${complaint.status}">
                        ${this.getStatusText(complaint.status)}
                    </div>
                </div>
                <div class="complaint-meta">
                    <span><strong>ID:</strong> ${complaint.id}</span>
                    <span><strong>Pelajar:</strong> ${complaint.studentName}</span>
                    <span><strong>Email:</strong> ${complaint.studentEmail}</span>
                    <span><strong>Kategori:</strong> ${this.getCategoryText(complaint.category)}</span>
                    <span><strong>Tarikh:</strong> ${this.formatDate(complaint.createdAt)}</span>
                </div>
                <div class="complaint-description">
                    ${complaint.description}
                </div>
                <div class="complaint-actions">
                    ${complaint.status === 'baru' ? 
                        `<button class="status-btn read-btn" onclick="adminManager.markAsRead('${complaint.id}')">
                            Tanda Dibaca
                        </button>` : ''
                    }
                    ${complaint.status === 'dibaca' ? 
                        `<button class="status-btn process-btn" onclick="adminManager.markAsProcessing('${complaint.id}')">
                            Tanda Diproses
                        </button>` : ''
                    }
                    ${complaint.status === 'diproses' ? 
                        `<button class="status-btn complete-btn" onclick="adminManager.markAsCompleted('${complaint.id}')">
                            Tanda Selesai
                        </button>` : ''
                    }
                </div>
                ${complaint.updatedAt !== complaint.createdAt ? 
                    `<div style="font-size: 0.8rem; color: #718096; margin-top: 10px;">
                        Dikemaskini: ${this.formatDate(complaint.updatedAt)}
                    </div>` : ''
                }
            </div>
        `;
    }

    async loadStudentComplaints() {
        if (!authManager.isStudent()) return;

        const complaints = await this.getStudentComplaints(authManager.getCurrentUser().id);
        const container = document.getElementById('studentComplaintsList');
        
        if (complaints.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #718096;">
                    <p>Tiada aduan ditemui.</p>
                </div>
            `;
        } else {
            complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            container.innerHTML = complaints.map(complaint => 
                this.renderStudentComplaint(complaint)
            ).join('');
        }
    }

    async showEditComplaintForm(complaintId) {
        const complaint = await this.getComplaintById(complaintId);
        if (complaint) {
            document.getElementById('editComplaintId').value = complaint.id;
            document.getElementById('editComplaintCategory').value = complaint.category;
            document.getElementById('editComplaintTitle').value = complaint.title;
            document.getElementById('editComplaintDescription').value = complaint.description;

            document.getElementById('editComplaintForm').classList.remove('hidden');
            document.getElementById('studentComplaints').classList.add('hidden');
            document.getElementById('newComplaintForm').classList.add('hidden');
        }
    }

    async submitEditComplaint() {
        const complaintId = document.getElementById('editComplaintId').value;
        const category = document.getElementById('editComplaintCategory').value;
        const title = document.getElementById('editComplaintTitle').value;
        const description = document.getElementById('editComplaintDescription').value;

        try {
            await this.editComplaint(complaintId, { category, title, description });
            app.showNotification('Aduan berjaya dikemaskini!', 'success');
            this.cancelEditComplaint();
            await this.loadStudentComplaints();
            document.getElementById('studentComplaints').classList.remove('hidden');
        } catch (error) {
            app.showNotification('Ralat: ' + error.message, 'error');
        }
    }

    cancelEditComplaint() {
        document.getElementById('editComplaintForm').classList.add('hidden');
        document.getElementById('editComplaintFormElement').reset();
        document.getElementById('studentComplaints').classList.remove('hidden');
    }

    async confirmDeleteComplaint(complaintId) {
        if (confirm('Adakah anda pasti ingin memadam aduan ini? Tindakan ini tidak boleh diundur.')) {
            try {
                if (await this.deleteComplaint(complaintId)) {
                    app.showNotification('Aduan berjaya dipadam.', 'success');
                    await this.loadStudentComplaints();
                } else {
                    app.showNotification('Ralat: Aduan tidak ditemui atau tidak dapat dipadam.', 'error');
                }
            } catch (error) {
                app.showNotification('Ralat: ' + error.message, 'error');
            }
        }
    }
}

// Initialize Complaint Manager
const complaintManager = new ComplaintManager();

// Event Listeners for Student Complaint Features
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('newComplaintBtn').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.remove('hidden');
        document.getElementById('studentComplaints').classList.add('hidden');
        document.getElementById('editComplaintForm').classList.add('hidden');
    });

    document.getElementById('viewComplaintsBtn').addEventListener('click', async () => {
        document.getElementById('newComplaintForm').classList.add('hidden');
        document.getElementById('editComplaintForm').classList.add('hidden');
        document.getElementById('studentComplaints').classList.remove('hidden');
        await complaintManager.loadStudentComplaints();
    });

    document.getElementById('cancelComplaint').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.add('hidden');
        document.getElementById('complaintFormElement').reset();
    });

    document.getElementById('complaintFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!authManager.isStudent()) {
            app.showNotification('Hanya pelajar boleh membuat aduan', 'error');
            return;
        }

        const category = document.getElementById('complaintCategory').value;
        const title = document.getElementById('complaintTitle').value;
        const description = document.getElementById('complaintDescription').value;

        try {
            const newComplaint = await complaintManager.createComplaint({
                category,
                title,
                description
            });
            app.showNotification(`Aduan berjaya dihantar!\nID Aduan: ${newComplaint.id}`, 'success');
            this.reset();
            document.getElementById('newComplaintForm').classList.add('hidden');
            document.getElementById('studentComplaints').classList.remove('hidden');
            await complaintManager.loadStudentComplaints();
        } catch (error) {
            app.showNotification('Ralat: ' + error.message, 'error');
        }
    });

    document.getElementById('editComplaintFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        await complaintManager.submitEditComplaint();
    });

    document.getElementById('cancelEditComplaint').addEventListener('click', () => {
        complaintManager.cancelEditComplaint();
    });
});