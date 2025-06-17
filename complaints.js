// Complaint Management Module
class ComplaintManager {
    constructor() {
        this.complaints = this.loadComplaints();
    }

    loadComplaints() {
        const complaints = localStorage.getItem('complaints');
        return complaints ? JSON.parse(complaints) : [];
    }

    saveComplaints() {
        localStorage.setItem('complaints', JSON.stringify(this.complaints));
    }

    generateComplaintId() {
        const prefix = 'ADU';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substr(2, 3).toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }

    createComplaint(complaintData) {
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

        this.complaints.push(newComplaint);
        this.saveComplaints();
        return newComplaint;
    }

    getStudentComplaints(studentId) {
        return this.complaints.filter(complaint => complaint.studentId === studentId);
    }

    getAllComplaints() {
        return this.complaints;
    }

    updateComplaintStatus(complaintId, newStatus) {
        const complaint = this.complaints.find(c => c.id === complaintId);
        if (complaint) {
            complaint.status = newStatus;
            complaint.updatedAt = new Date().toISOString();
            this.saveComplaints();
            return complaint;
        }
        return null;
    }

    getComplaintById(complaintId) {
        return this.complaints.find(c => c.id === complaintId);
    }

    filterComplaints(filters) {
        let filtered = this.complaints;

        if (filters.status && filters.status !== '') {
            filtered = filtered.filter(c => c.status === filters.status);
        }

        if (filters.category && filters.category !== '') {
            filtered = filtered.filter(c => c.category === filters.category);
        }

        return filtered;
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

    loadStudentComplaints() {
        if (!authManager.isStudent()) return;

        const complaints = this.getStudentComplaints(authManager.getCurrentUser().id);
        const container = document.getElementById('studentComplaintsList');
        
        if (complaints.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #718096;">
                    <p>Tiada aduan ditemui.</p>
                </div>
            `;
        } else {
            // Sort by creation date (newest first)
            complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            container.innerHTML = complaints.map(complaint => 
                this.renderStudentComplaint(complaint)
            ).join('');
        }
    }
}

// Initialize Complaint Manager
const complaintManager = new ComplaintManager();

// Event Listeners for Student Complaint Features
document.addEventListener('DOMContentLoaded', function() {
    // New Complaint Button
    document.getElementById('newComplaintBtn').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.remove('hidden');
        document.getElementById('studentComplaints').classList.add('hidden');
    });

    // View Complaints Button
    document.getElementById('viewComplaintsBtn').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.add('hidden');
        document.getElementById('studentComplaints').classList.remove('hidden');
        complaintManager.loadStudentComplaints();
    });

    // Cancel New Complaint
    document.getElementById('cancelComplaint').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.add('hidden');
        document.getElementById('complaintFormElement').reset();
    });

    // Submit New Complaint
    document.getElementById('complaintFormElement').addEventListener('submit', function(e) {
        e.preventDefault();

        if (!authManager.isStudent()) {
            alert('Hanya pelajar boleh membuat aduan');
            return;
        }

        const category = document.getElementById('complaintCategory').value;
        const title = document.getElementById('complaintTitle').value;
        const description = document.getElementById('complaintDescription').value;

        try {
            const newComplaint = complaintManager.createComplaint({
                category,
                title,
                description
            });

            alert(`Aduan berjaya dihantar!\nID Aduan: ${newComplaint.id}`);
            
            // Reset form and hide it
            this.reset();
            document.getElementById('newComplaintForm').classList.add('hidden');
            
            // Show complaints list
            document.getElementById('studentComplaints').classList.remove('hidden');
            complaintManager.loadStudentComplaints();
            
        } catch (error) {
            alert('Ralat: ' + error.message);
        }
    });
});