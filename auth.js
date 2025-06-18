class AuthManager {
    constructor() {
        this.currentUser = null;
        this.users = this.loadUsers();
        this.init();
    }

    init() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showDashboard();
            this.logAudit('Log masuk automatik', this.currentUser.id);
        }
    }

    loadUsers() {
        const users = localStorage.getItem('users');
        if (users) {
            return JSON.parse(users);
        } else {
            const defaultUsers = [
                {
                    id: 'admin001',
                    name: 'Admin Sistem',
                    email: 'admin@sekolah.edu.my',
                    password: 'admin123',
                    role: 'admin'
                }
            ];
            this.saveUsers(defaultUsers);
            return defaultUsers;
        }
    }

    saveUsers(users) {
        localStorage.setItem('users', JSON.stringify(users));
        this.users = users;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    register(userData) {
        const existingUser = this.users.find(user => user.email === userData.email);
        if (existingUser) {
            throw new Error('Email sudah wujud dalam sistem');
        }

        const newUser = {
            id: this.generateId(),
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.role,
            studentId: userData.studentId || null,
            registeredAt: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveUsers(this.users);
        this.logAudit('Pendaftaran pengguna baharu', newUser.id, `Email: ${newUser.email}, Peranan: ${newUser.role}`);
        app.showNotification('Pendaftaran berjaya! Sila log masuk.', 'success');
        return newUser;
    }

    login(email, password, role) {
        const user = this.users.find(u => 
            u.email === email && 
            u.password === password && 
            u.role === role
        );

        if (!user) {
            throw new Error('Email, kata laluan atau peranan tidak sah');
        }

        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.logAudit('Log masuk', user.id, `Email: ${user.email}, Peranan: ${user.role}`);
        app.showNotification('Berjaya log masuk!', 'success');
        return user;
    }

    logout() {
        if (this.currentUser) {
            this.logAudit('Log keluar', this.currentUser.id);
        }
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.showWelcomeScreen();
        app.showNotification('Berjaya log keluar', 'success');
    }

    logAudit(action, userId, details = '') {
        const auditLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
        auditLogs.push({
            id: this.generateId(),
            action,
            userId,
            details,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('auditLogs', JSON.stringify(auditLogs));
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    isStudent() {
        return this.currentUser && this.currentUser.role === 'student';
    }

    showWelcomeScreen() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('mainContent').classList.add('hidden');
        document.getElementById('studentDashboard').classList.add('hidden');
        document.getElementById('adminDashboard').classList.add('hidden');
        document.getElementById('welcomeScreen').classList.remove('hidden');
        document.getElementById('loginBtn').classList.remove('hidden');
        document.getElementById('registerBtn').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        if (this.isAdmin()) {
            document.getElementById('adminDashboard').classList.remove('hidden');
            document.getElementById('studentDashboard').classList.add('hidden');
        } else if (this.isStudent()) {
            document.getElementById('studentDashboard').classList.remove('hidden');
            document.getElementById('adminDashboard').classList.add('hidden');
        }
        document.getElementById('loginBtn').classList.add('hidden');
        document.getElementById('registerBtn').classList.add('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
    }

    showLoginForm() {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    }

    showRegisterForm() {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    }
}

const authManager = new AuthManager();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loginBtn').addEventListener('click', () => {
        authManager.showLoginForm();
    });

    document.getElementById('cancelLogin').addEventListener('click', () => {
        authManager.showWelcomeScreen();
    });

    document.getElementById('loginFormElement').addEventListener('submit', function(e) {
        e.preventDefault();
        if (!app.validateForm(this)) return;

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const role = document.getElementById('loginRole').value;

        try {
            authManager.login(email, password, role);
            authManager.showDashboard();
            this.reset();
            if (authManager.isAdmin()) {
                adminManager.loadAllComplaints();
            } else if (authManager.isStudent()) {
                complaintManager.loadStudentComplaints();
            }
        } catch (error) {
            app.showNotification('Ralat: ' + error.message, 'error');
        }
    });

    document.getElementById('registerBtn').addEventListener('click', () => {
        authManager.showRegisterForm();
    });

    document.getElementById('cancelRegister').addEventListener('click', () => {
        authManager.showWelcomeScreen();
    });

    document.getElementById('registerRole').addEventListener('change', function() {
        const studentIdGroup = document.getElementById('studentIdGroup');
        const studentIdInput = document.getElementById('registerStudentId');
        if (this.value === 'student') {
            studentIdGroup.style.display = 'block';
            studentIdInput.required = true;
        } else {
            studentIdGroup.style.display = 'none';
            studentIdInput.required = false;
        }
    });

    document.getElementById('registerFormElement').addEventListener('submit', function(e) {
        e.preventDefault();
        if (!app.validateForm(this)) return;

        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const role = document.getElementById('registerRole').value;
        const studentId = document.getElementById('registerStudentId').value;

        try {
            authManager.register({
                name,
                email,
                password,
                role,
                studentId
            });
            this.reset();
            authManager.showLoginForm();
        } catch (error) {
            app.showNotification('Ralat: ' + error.message, 'error');
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Adakah anda pasti ingin log keluar?')) {
            authManager.logout();
        }
    });
});