// DOM Elements
const messageEl = document.getElementById('message');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const forgotForm = document.getElementById('forgot-form');
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const forgotTrigger = document.getElementById('forgot-trigger');
const backToLogin = document.getElementById('back-to-login');
const signupRoleSelect = document.getElementById('signup-role');
const bankGroup = document.getElementById('bank-group');
const resetSection = document.getElementById('reset-section');
const confirmResetBtn = document.getElementById('confirm-reset');

// API Helper
const api = {
    post: async (url, body) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return { ok: res.ok, status: res.status, body: await res.json() };
    },
    get: async (url) => {
        const res = await fetch(url);
        return { ok: res.ok, status: res.status, body: await res.json() };
    },
};

// Message Display
function showMessage(text, type = 'success') {
    messageEl.textContent = text;
    messageEl.className = `message show ${type}`;
    setTimeout(() => messageEl.classList.remove('show'), 5000);
}

// Tab Switching
function switchTab(form) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    form.classList.add('active');
    if (form === loginForm) loginTab.classList.add('active');
    else if (form === signupForm) signupTab.classList.add('active');
}

// Show/Hide Bank Account Field
signupRoleSelect.addEventListener('change', () => {
    if (signupRoleSelect.value === 'provider') {
        bankGroup.style.display = 'block';
    } else {
        bankGroup.style.display = 'none';
    }
});

// Tab Click Handlers
loginTab.addEventListener('click', () => switchTab(loginForm));
signupTab.addEventListener('click', () => switchTab(signupForm));

// Forgot Password Trigger
forgotTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(forgotForm);
    document.querySelector('.tabs-container').style.display = 'none';
});

// Back to Login
backToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(loginForm);
    document.querySelector('.tabs-container').style.display = 'flex';
    resetSection.style.display = 'none';
    document.getElementById('forgot-email').value = '';
    document.getElementById('reset-token').value = '';
    document.getElementById('reset-password').value = '';
});

// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showMessage('All fields are required', 'error');
        return;
    }

    const { ok, body } = await api.post('/api/login', { email, password });
    if (!ok) {
        showMessage(body.error || 'Login failed', 'error');
        return;
    }

    localStorage.setItem('token', body.token);
    localStorage.setItem('role', body.user.role);
    showMessage('Login successful! Redirecting...');
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 1500);
});

// Signup Handler
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    const bankAccount = document.getElementById('signup-bank').value.trim();

    if (!name || !email || !phone || !password) {
        showMessage('All required fields must be filled', 'error');
        return;
    }

    const { ok, body } = await api.post('/api/register', {
        name,
        email,
        phone,
        password,
        role,
        bankAccount,
    });

    if (!ok) {
        showMessage(body.error || 'Signup failed', 'error');
        return;
    }

    localStorage.setItem('token', body.token);
    localStorage.setItem('role', body.user.role);
    showMessage('Account created successfully! Redirecting...');
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 1500);
});

// Forgot Password Handler
forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();

    if (!email) {
        showMessage('Email is required', 'error');
        return;
    }

    const { ok, body } = await api.post('/api/forgot-password', { email });
    if (!ok) {
        showMessage(body.error || 'Request failed', 'error');
        return;
    }

    showMessage(`Reset token sent! Check your email or use: ${body.resetToken}`);
    resetSection.style.display = 'block';
});

// Confirm Reset Handler
confirmResetBtn.addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim();
    const token = document.getElementById('reset-token').value.trim();
    const newPassword = document.getElementById('reset-password').value;

    if (!email || !token || !newPassword) {
        showMessage('All fields are required', 'error');
        return;
    }

    const { ok, body } = await api.post('/api/reset-password', {
        email,
        token,
        newPassword,
    });

    if (!ok) {
        showMessage(body.error || 'Reset failed', 'error');
        return;
    }

    showMessage('Password reset successful! Redirecting to login...');
    setTimeout(() => {
        switchTab(loginForm);
        document.querySelector('.tabs-container').style.display = 'flex';
        resetSection.style.display = 'none';
        forgotForm.reset();
    }, 1500);
});

// Check if already logged in
window.addEventListener('load', () => {
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = 'dashboard.html';
    }
});