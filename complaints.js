class ComplaintManager {
    constructor() {
        this.database = firebase.database();
    }

    async processAttachment(file) {
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Saiz fail melebihi 5MB');
        }
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    async createComplaint(complaintData) {
        let attachment = null;
        if (complaintData.attachment) {
            attachment = await this.processAttachment(complaintData.attachment);
        }

        const id = `ADU${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
        const newComplaint = {
            student_id: authManager.getCurrentUser().id,
            student_name: authManager.getCurrentUser().name,
            student_email: authManager.getCurrentUser().email,
            title: complaintData.title,
            description: complaintData.description,
            category: complaintData.category,
            attachment,
            status: 'baru',
            priority: 'rendah',
            admin_notes: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        await this.database.ref('complaints/' + id).set(newComplaint);
        app.notifyUsers({ id }, 'Aduan baharu telah dihantar');
        return { id };
    }

    async getStudentComplaints(studentId) {
        const snapshot = await this.database.ref('complaints').orderByChild('student_id').equalTo(studentId).once('value');
        const complaints = snapshot.val() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
        return complaints;
    }

    async getAllComplaints() {
        const snapshot = await this.database.ref('complaints').once('value');
        return snapshot.val() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
    }

    async updateComplaintStatus(complaintId, newStatus) {
        const complaintRef = this.database.ref('complaints/' + complaintId);
        const complaint = (await complaintRef.once('value')).val();
        if (complaint) {
            await complaintRef.update({ status: newStatus, updated_at: new Date().toISOString() });
            app.notifyUsers({ id: complaintId }, `Status aduan ${complaintId} telah dikemas kini ke ${this.getStatusText(newStatus)}`);
            return { id: complaintId, status: newStatus };
        }
        return null;
    }

    async updateComplaintPriority(complaintId, newPriority) {
        const complaintRef = this.database.ref('complaints/' + complaintId);
        const complaint = (await complaintRef.once('value')).val();
        if (complaint) {
            await complaintRef.update({ priority: newPriority, updated_at: new Date().toISOString() });
            return { id: complaintId, priority: newPriority };
        }
        return null;
    }

    async updateAdminNotes(complaintId, notes) {
        const complaintRef = this.database.ref('complaints/' + complaintId);
        const complaint = (await complaintRef.once('value')).val();
        if (complaint) {
            await complaintRef.update({ admin_notes: notes, updated_at: new Date().toISOString() });
            app.showNotification('Nota admin telah disimpan', 'success');
            return { id: complaintId, admin_notes: notes };
        }
        return null;
    }

    async addFeedback(complaintId, feedbackText) {
        const complaintRef = this.database.ref('complaints/' + complaintId);
        const complaint = (await complaintRef.once('value')).val();
        if (!complaint || complaint.status !== 'selesai') {
            throw new Error('Maklum balas hanya boleh diberikan untuk aduan yang telah selesai');
        }
        const id = `ADU${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
        const feedback = {
            id,
            complaint_id: complaintId,
            student_id: authManager.getCurrentUser().id,
            feedback_text: feedbackText,
            created_at: new Date().toISOString()
        };
        await this.database.ref('feedbacks/' + id).set(feedback);
        app.notifyUsers(complaint, `Maklum balas telah diterima untuk aduan ${complaintId}`);
        return feedback;
    }

    async getFeedbacks(complaintId) {
        const snapshot = await this.database.ref('feedbacks').orderByChild('complaint_id').equalTo(complaintId).once('value');
        return snapshot.val() ? Object.values(snapshot.val()) : [];
    }

    searchComplaints(query, complaints) {
        query = query.toLowerCase();
        return complaints.filter(complaint =>
            complaint.id.toLowerCase().includes(query) ||
            complaint.title.toLowerCase().includes(query) ||
            complaint.description.toLowerCase().includes(query)
        );
    }

    filterComplaints(filters, complaints) {
        let filtered = [...complaints];

        if (filters.status && filters.status !== '') {
            filtered = filtered.filter(c => c.status === filters.status);
        }

        if (filters.category && filters.category !== '') {
            filtered = filtered.filter(c => c.category === filters.category);
        }

        if (filters.priority && filters.priority !== '') {
            filtered = filtered.filter(c => c.priority === filters.priority);
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

    getPriorityText(priority) {
        const priorityMap = {
            'rendah': 'Rendah',
            'sederhana': 'Sederhana',
            'tinggi': 'Tinggi'
        };
        return priorityMap[priority] || priority;
    }

    async editComplaint(complaintId, updatedData) {
        const complaintRef = this.database.ref('complaints/' + complaintId);
        const complaint = (await complaintRef.once('value')).val();
        if (!complaint) return null;

        const currentUserId = authManager.getCurrentUser().id;
        const isStudent = authManager.isStudent();
        const isAdmin = authManager.isAdmin();

        if (isStudent && (complaint.student_id !== currentUserId || !['baru', 'dibaca'].includes(complaint.status))) {
            app.showNotification('Hanya boleh mengedit aduan anda sendiri yang belum diproses atau dibaca', 'error');
            return null;
        }

        if (isAdmin || (isStudent && complaint.student_id === currentUserId)) {
            const editableFields = ['title', 'description', 'category', 'priority'];
            const updates = {};
            editableFields.forEach(field => {
                if (updatedData[field] !== undefined) {
                    updates[field] = updatedData[field];
                }
            });

            if (updatedData.attachment) {
                updates.attachment = await this.processAttachment(updatedData.attachment);
            }

            updates.updated_at = new Date().toISOString();
            await complaintRef.update(updates);
            const action = isAdmin ? 'Aduan dikemas kini oleh admin' : 'Aduan dikemas kini oleh pelajar';
            authManager.logAudit(action, currentUserId, `ID Aduan: ${complaintId}`);
            app.notifyUsers({ id: complaintId }, `Aduan ${complaintId} telah dikemas kini`);
            return { id: complaintId, ...updates };
        }
        return null;
    }

    async deleteComplaint(complaintId) {
        const complaintRef = this.database.ref('complaints/' + complaintId);
        const complaint = (await complaintRef.once('value')).val();
        if (!complaint) return false;

        const currentUserId = authManager.getCurrentUser().id;
        const isStudent = authManager.isStudent();
        const isAdmin = authManager.isAdmin();

        if (isStudent && (complaint.student_id !== currentUserId || !['baru', 'dibaca'].includes(complaint.status))) {
            app.showNotification('Hanya boleh memadam aduan anda sendiri yang belum diproses atau dibaca', 'error');
            return false;
        }

        if (isAdmin || (isStudent && complaint.student_id === currentUserId)) {
            await complaintRef.remove();
            const action = isAdmin ? 'Aduan dipadam oleh admin' : 'Aduan dipadam oleh pelajar';
            authManager.logAudit(action, currentUserId, `ID Aduan: ${complaintId}`);
            app.notifyUsers(complaint, `Aduan ${complaintId} telah dipadam`);
            return true;
        }
        return false;
    }

    renderStudentComplaint(complaint) {
        const canEditDelete = authManager.isStudent() && ['baru', 'dibaca'].includes(complaint.status) && complaint.student_id === authManager.getCurrentUser().id;
        const feedbacks = this.getFeedbacks(complaint.id);
        return `
            <div class="complaint-item" data-complaint-id="${complaint.id}">
                <div class="complaint-header">
                    <div class="complaint-title">${complaint.title}</div>
                    <div class="complaint-status status-${complaint.status}">
                        ${this.getStatusText(complaint.status)}
                    </div>
                </div>
                <div class="complaint-meta">
                    <span><strong>ID:</strong> ${complaint.id}</span>
                    <span><strong>Kategori:</strong> ${this.getCategoryText(complaint.category)}</span>
                    <span><strong>Keutamaan:</strong> ${this.getPriorityText(complaint.priority)}</span>
                    <span><strong>Tarikh:</strong> ${this.formatDate(complaint.created_at)}</span>
                </div>
                <div class="complaint-description">
                    ${complaint.description}
                </div>
                ${complaint.attachment ? 
                    `<div class="complaint-attachment">
                        <a href="${complaint.attachment}" target="_blank">Lihat Lampiran</a>
                    </div>` : ''
                }
                ${complaint.admin_notes ? 
                    `<div class="complaint-description">
                        <strong>Nota Admin:</strong> ${complaint.admin_notes}
                    </div>` : ''
                }
                ${feedbacks.length > 0 ? 
                    `<div class="complaint-description">
                        <strong>Maklum Balas:</strong> ${feedbacks.map(f => f.feedback_text).join('<br>')}
                    </div>` : ''
                }
                ${canEditDelete ? `
                    <div class="complaint-actions">
                        <button class="action-btn" onclick="complaintManager.openEditForm('${complaint.id}')">Edit</button>
                        <button class="action-btn" style="background-color: #ef4444;" onclick="complaintManager.deleteComplaint('${complaint.id}'); complaintManager.loadStudentComplaints();">Padam</button>
                    </div>` : ''
                }
                ${complaint.updated_at !== complaint.created_at ? 
                    `<div style="font-size: 0.8rem; color: #718096; margin-top: 10px;">
                        Dikemaskini: ${this.formatDate(complaint.updated_at)}
                    </div>` : ''
                }
            </div>
        `;
    }

    renderAdminComplaint(complaint) {
        const feedbacks = this.getFeedbacks(complaint.id);
        return `
            <div class="complaint-item" data-complaint-id="${complaint.id}">
                <div class="complaint-header">
                    <div class="complaint-title">${complaint.title}</div>
                    <div class="complaint-status status-${complaint.status}">
                        ${this.getStatusText(complaint.status)}
                    </div>
                </div>
                <div class="complaint-meta">
                    <span><strong>ID:</strong> ${complaint.id}</span>
                    <span><strong>Pelajar:</strong> ${complaint.student_name}</span>
                    <span><strong>Email:</strong> ${complaint.student_email}</span>
                    <span><strong>Kategori:</strong> ${this.getCategoryText(complaint.category)}</span>
                    <span><strong>Keutamaan:</strong> ${this.getPriorityText(complaint.priority)}</span>
                    <span><strong>Tarikh:</strong> ${this.formatDate(complaint.created_at)}</span>
                </div>
                <div class="complaint-description">
                    ${complaint.description}
                </div>
                ${complaint.attachment ? 
                    `<div class="complaint-attachment">
                        <a href="${complaint.attachment}" target="_blank">Lihat Lampiran</a>
                    </div>` : ''
                }
                <div class="complaint-description">
                    <strong>Nota Admin:</strong>
                    <textarea class="admin-notes" data-complaint-id="${complaint.id}">${complaint.admin_notes || ''}</textarea>
                    <button class="status-btn" onclick="complaintManager.saveAdminNotes('${complaint.id}', this.previousElementSibling.value)">Simpan Nota</button>
                </div>
                ${feedbacks.length > 0 ? 
                    `<div class="complaint-description">
                        <strong>Maklum Balas:</strong> ${feedbacks.map(f => f.feedback_text).join('<br>')}
                    </div>` : ''
                }
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
                    <button class="priority-btn priority-btn-rendah" onclick="adminManager.setPriority('${complaint.id}', 'rendah')">Rendah</button>
                    <button class="priority-btn priority-btn-sederhana" onclick="adminManager.setPriority('${complaint.id}', 'sederhana')">Sederhana</button>
                    <button class="priority-btn priority-btn-tinggi" onclick="adminManager.setPriority('${complaint.id}', 'tinggi')">Tinggi</button>
                    <button class="action-btn" onclick="complaintManager.openEditForm('${complaint.id}')">Edit</button>
                    <button class="action-btn" style="background-color: #ef4444;" onclick="complaintManager.deleteComplaint('${complaint.id}'); adminManager.loadAllComplaints();">Padam</button>
                </div>
                ${complaint.updated_at !== complaint.created_at ? 
                    `<div style="font-size: 0.8rem; color: #718096; margin-top: 10px;">
                        Dikemaskini: ${this.formatDate(complaint.updated_at)}
                    </div>` : ''
                }
            </div>
        `;
    }

    async saveAdminNotes(complaintId, notes) {
        await this.updateAdminNotes(complaintId, notes);
    }

    openEditForm(complaintId) {
        const complaintRef = this.database.ref('complaints/' + complaintId);
        complaintRef.once('value').then((snapshot) => {
            const complaint = snapshot.val();
            if (!complaint) {
                app.showNotification('Aduan tidak ditemui', 'error');
                return;
            }

            const form = document.createElement('form');
            form.id = 'editComplaintForm';
            form.className = 'form-container';
            form.innerHTML = `
                <h2>Kemaskini Aduan</h2>
                <div class="form-group">
                    <label for="editTitle">Tajuk:</label>
                    <input type="text" id="editTitle" value="${complaint.title}" required>
                </div>
                <div class="form-group">
                    <label for="editDescription">Butiran:</label>
                    <textarea id="editDescription" required>${complaint.description}</textarea>
                </div>
                <div class="form-group">
                    <label for="editCategory">Kategori:</label>
                    <select id="editCategory" required>
                        <option value="akademik" ${complaint.category === 'akademik' ? 'selected' : ''}>Akademik</option>
                        <option value="kemudahan" ${complaint.category === 'kemudahan' ? 'selected' : ''}>Kemudahan</option>
                        <option value="kantin" ${complaint.category === 'kantin' ? 'selected' : ''}>Kantin</option>
                        <option value="perpustakaan" ${complaint.category === 'perpustakaan' ? 'selected' : ''}>Perpustakaan</option>
                        <option value="pengangkutan" ${complaint.category === 'pengangkutan' ? 'selected' : ''}>Pengangkutan</option>
                        <option value="asrama" ${complaint.category === 'asrama' ? 'selected' : ''}>Asrama</option>
                        <option value="lain-lain" ${complaint.category === 'lain-lain' ? 'selected' : ''}>Lain-lain</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="editPriority">Keutamaan:</label>
                    <select id="editPriority" required>
                        <option value="rendah" ${complaint.priority === 'rendah' ? 'selected' : ''}>Rendah</option>
                        <option value="sederhana" ${complaint.priority === 'sederhana' ? 'selected' : ''}>Sederhana</option>
                        <option value="tinggi" ${complaint.priority === 'tinggi' ? 'selected' : ''}>Tinggi</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="editAttachment">Lampiran Baru (Opsyen):</label>
                    <input type="file" id="editAttachment" accept="image/jpeg,image/png,application/pdf">
                </div>
                <button type="submit">Simpan Kemaskini</button>
                <button type="button" onclick="document.getElementById('editComplaintForm').remove()">Batal</button>
            `;

            document.body.appendChild(form);

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!app.validateForm(form)) return;

                const updatedData = {
                    title: document.getElementById('editTitle').value,
                    description: document.getElementById('editDescription').value,
                    category: document.getElementById('editCategory').value,
                    priority: document.getElementById('editPriority').value
                };

                const attachmentInput = document.getElementById('editAttachment');
                if (attachmentInput.files.length > 0) {
                    updatedData.attachment = await this.processAttachment(attachmentInput.files[0]);
                }

                const result = await this.editComplaint(complaintId, updatedData);
                if (result) {
                    app.showNotification(`Aduan ${complaintId} telah dikemas kini`, 'success');
                    form.remove();
                    if (authManager.isStudent()) {
                        this.loadStudentComplaints();
                    } else if (authManager.isAdmin()) {
                        adminManager.loadAllComplaints();
                    }
                }
            });
        });
    }

    async loadStudentComplaints(searchQuery = '') {
        if (!authManager.isStudent()) return;

        let complaints = await this.getStudentComplaints(authManager.getCurrentUser().id);
        if (searchQuery) {
            complaints = this.searchComplaints(searchQuery, complaints);
        }

        const container = document.getElementById('studentComplaints');
        if (complaints.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #718096;">
                    <p>Tiada aduan ditemui.</p>
                </div>
            `;
        } else {
            complaints.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            container.innerHTML = complaints.map(complaint => 
                this.renderStudentComplaint(complaint)
            ).join('');
        }
    }
}

const complaintManager = new ComplaintManager();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loginBtn').addEventListener('click', () => {
        document.getElementById('loginForm').classList.remove('hidden');
    });

    document.getElementById('registerBtn').addEventListener('click', () => {
        document.getElementById('registerForm').classList.remove('hidden');
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        authManager.logout();
    });

    document.getElementById('newComplaintBtn').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.remove('hidden');
        document.getElementById('studentComplaints').classList.add('hidden');
        document.getElementById('feedbackForm').classList.add('hidden');
    });

    document.getElementById('viewComplaintsBtn').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.add('hidden');
        document.getElementById('feedbackForm').classList.add('hidden');
        document.getElementById('studentComplaints').classList.remove('hidden');
        complaintManager.loadStudentComplaints();
    });

    document.getElementById('viewFeedbackBtn').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.add('hidden');
        document.getElementById('studentComplaints').classList.add('hidden');
        document.getElementById('feedbackForm').classList.remove('hidden');
    });

    document.getElementById('cancelComplaint').addEventListener('click', () => {
        document.getElementById('newComplaintForm').classList.add('hidden');
        document.getElementById('complaintFormElement').reset();
    });

    document.getElementById('cancelFeedback').addEventListener('click', () => {
        document.getElementById('feedbackForm').classList.add('hidden');
        document.getElementById('feedbackFormElement').reset();
    });

    document.getElementById('complaintFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!authManager.isStudent()) {
            app.showNotification('Hanya pelajar boleh membuat aduan', 'error');
            return;
        }
        if (!app.validateForm(this)) return;

        const category = document.getElementById('complaintCategory').value;
        const title = document.getElementById('complaintTitle').value;
        const description = document.getElementById('complaintDescription').value;
        const attachment = document.getElementById('complaintAttachment').files[0];

        try {
            const newComplaint = await complaintManager.createComplaint({
                category,
                title,
                description,
                attachment
            });

            app.showNotification(`Aduan berjaya dihantar!\nID Aduan: ${newComplaint.id}`, 'success');
            this.reset();
            document.getElementById('newComplaintForm').classList.add('hidden');
            document.getElementById('studentComplaints').classList.remove('hidden');
            complaintManager.loadStudentComplaints();
        } catch (error) {
            app.showNotification('Ralat: ' + error.message, 'error');
        }
    });

    document.getElementById('feedbackFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!authManager.isStudent()) {
            app.showNotification('Hanya pelajar boleh memberikan maklum balas', 'error');
            return;
        }
        if (!app.validateForm(this)) return;

        const complaintId = document.getElementById('feedbackComplaintId').value;
        const feedbackText = document.getElementById('feedbackText').value;

        try {
            await complaintManager.addFeedback(complaintId, feedbackText);
            app.showNotification('Maklum balas berjaya dihantar', 'success');
            this.reset();
            document.getElementById('feedbackForm').classList.add('hidden');
            document.getElementById('studentComplaints').classList.remove('hidden');
            complaintManager.loadStudentComplaints();
        } catch (error) {
            app.showNotification('Ralat: ' + error.message, 'error');
        }
    });

    document.getElementById('loginFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!app.validateForm(this)) return;

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const user = await authManager.login(email, password);
        if (user) {
            app.showNotification('Log masuk berjaya!', 'success');
            document.getElementById('loginForm').classList.add('hidden');
            this.reset();
        }
    });

    document.getElementById('registerFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!app.validateForm(this)) return;

        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const role = document.getElementById('registerRole').value;

        const user = await authManager.register(name, email, password, role);
        if (user) {
            app.showNotification('Daftar berjaya! Sila log masuk.', 'success');
            document.getElementById('registerForm').classList.add('hidden');
            this.reset();
        }
    });

    document.getElementById('studentSearch').addEventListener('input', app.debounce(() => {
        complaintManager.loadStudentComplaints(document.getElementById('studentSearch').value);
    }, 300));
});