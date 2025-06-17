// Authentication Module
class AuthManager {
    constructor() {
        // Initialize Firebase with provided config
        this.firebaseApp = firebase.initializeApp({
            apiKey: "AIzaSyBPR9IxriX802nvwt8l9GRtizysyPFJm2g",
            authDomain: "sistem-aduan-pelajar.firebaseapp.com",
            databaseURL: "https://sistem-aduan-pelajar-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "sistem-aduan-pelajar",
            storageBucket: "sistem-aduan-pelajar.firebasestorage.app",
            messagingSenderId: "589619482946",
            appId: "1:589619482946:web:e9091d8c79f08bccfaf8db",
            measurementId: "G-00JCJ21BWN"
        });
        this.auth = firebase.auth();
        this.database = firebase.database();
        this.currentUser = null;
        this.init();
    }

    init() {
        // Listen for authentication state changes
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Fetch additional user data from Realtime Database
                const userData = await this.getUserData(user.uid);
                if (userData) {
                    this.currentUser = {
                        id: user.uid,
                        email: user.email,
                        name: userData.name,
                        role: userData.role,
                        studentId: userData.studentId || null,
                        registeredAt: userData.registeredAt
                    };
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    this.showDashboard();
                    // Load appropriate data
                    if (this.isAdmin()) {
                        adminManager.loadAllComplaints();
                    } else if (this.isStudent()) {
                        complaintManager.loadStudentComplaints();
                    }
                } else {
                    // If no user data found, log out
                    this.logout();
                }
            } else {
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            this.showWelcomeScreen();
        }
        });
    }

    async getUserData(uid) {
        try {
            const snapshot = await this.database.ref(`users/${uid}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Error fetching user data:', error);
            return null;
        }
    }

    async saveUserData(userId, userData) {
        try {
            await this.database.ref(`users/${userId}`).set(userData);
        } catch (error) {
            console.error('Error saving user data:', error);
            throw error;
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async register(userData) {
        try {
            // Check if email already exists
            const snapshot = await this.database.ref('users').orderByChild('email').equalTo(userData.email).once('value');
            if (snapshot.exists()) {
                throw new Error('Email sudah wujud dalam sistem');
            }

            // Create user in Firebase Authentication
            const userCredential = await this.auth.createUserWithEmailAndPassword(userData.email, userData.password);
            const userId = userCredential.user.uid;

            // Save additional user data in Realtime Database
            const newUser = {
                id: userId,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                studentId: userData.studentId || null,
                registeredAt: new Date().toISOString()
            };
            await this.saveUserData(userId, newUser);

            return newUser;
        } catch (error) {
            throw new Error(error.message || 'Ralat semasa pendaftaran');
        }
    }

    async login(email, password, role) {
        try {
            // Sign in with Firebase Authentication
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            const userId = userCredential.user.uid;

            // Verify role
            const userData = await this.getUserData(userId);
            if (!userData || userData.role !== role) {
                await this.auth.signOut();
                throw new Error('Peranan tidak sah');
            }

            this.currentUser = {
                id: userId,
                email: userData.email,
                name: userData.name,
                role: userData.role,
                studentId: userData.studentId || null,
                registeredAt: userData.registeredAt
            };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            return this.currentUser;
        } catch (error) {
            throw new Error(error.message || 'Email atau kata laluan tidak sah');
        }
    }

    async logout() {
        try {
            await this.auth.signOut();
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            this.showWelcomeScreen();
        } catch (error) {
            console.error('Error during logout:', error);
        }
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

// Initialize Auth Manager
const authManager = new AuthManager();

// Event Listeners for Authentication
document.addEventListener('DOMContentLoaded', function() {
    // Login Form Events
    document.getElementById('loginBtn').addEventListener('click', () => {
        authManager.showLoginForm();
    });

    document.getElementById('cancelLogin').addEventListener('click', () => {
        authManager.showWelcomeScreen();
    });

    document.getElementById('loginFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const role = document.getElementById('loginRole').value;

        try {
            await authManager.login(email, password, role);
            this.reset();
            app.showNotification('Berjaya log masuk!', 'success');
        } catch (error) {
            app.showNotification('Ralat: ' + error.message, 'error');
        }
    });

    // Register Form Events
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

    document.getElementById('registerFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const role = document.getElementById('registerRole').value;
        const studentId = document.getElementById('registerStudentId').value;

        try {
            await authManager.register({
                name,
                email,
                password,
                role,
                studentId
            });
            this.reset();
            app.showNotification('Berjaya mendaftar! Sila log masuk.', 'success');
            authManager.showLoginForm();
        } catch (error) {
            app.showNotification('Ralat: ' + error.message, 'error');
        }
    });

    // Logout Event
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('Adakah anda pasti ingin log keluar?')) {
            await authManager.logout();
        }
    });
});