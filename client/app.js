const state = { token: null, user: null, services: [] };
const show = (id, yes = true) => document.getElementById(id).classList.toggle('hidden', !yes);
const setMessage = (text, type = 'success') => { const el = document.getElementById('message'); el.textContent = text; el.className = `message show ${type}`; setTimeout(() => el.className = 'message', 4000); };
const fetchJson = async (url, opts = {}) => {
    const base = '/api';
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    const res = await fetch(base + url, { ...opts, headers });
    let data = null;
    const text = await res.text();
    if (text) {
        try { data = JSON.parse(text); } catch (e) { data = null; }
    }
    if (!res.ok) {
        const errMsg = data?.error || data?.message || `Request failed: ${res.status}`;
        throw new Error(errMsg || 'Network error');
    }
    return data;
};

const setAuthToken = (token) => {
    state.token = token;
    if (token) localStorage.setItem('utilToken', token);
    else localStorage.removeItem('utilToken');
};

const showPanel = (panel) => {
    ['register', 'login', 'forgot'].forEach(p => show(`${p}-panel`, p === panel));
    document.querySelectorAll('#auth-tabs button').forEach(b => b.classList.toggle('active', b.id === `tab-${panel}`));
};

const loadProfile = async () => {
    const data = await fetchJson('/profile', {
        headers: { Authorization: `Bearer ${state.token}` }
    });
    state.user = data.user;
    return data.user;
};

const renderDashboard = async () => {
    const dashBody = document.getElementById('dash-body');
    dashBody.innerHTML = '';
    const user = await loadProfile();
    document.getElementById('dash-title').textContent = user.role === 'provider' ? 'Service Provider Dashboard' : 'User Dashboard';
    const info = document.createElement('div');
    info.innerHTML = `<p><strong>${user.name}</strong> (${user.email}) - Role: ${user.role}</p><p>Bank: $${user.bankBalance} | Util Coins: ${user.coins}</p>`;
    dashBody.appendChild(info);

    if (user.role === 'user') {
        const buyDiv = document.createElement('div');
        buyDiv.innerHTML = `<h3>Buy Util Coins</h3><input id="buy-coins-amt" placeholder="Amount to buy from bank" type="number"/><button id="buy-coins">Buy Coins</button>`;
        dashBody.appendChild(buyDiv);
        buyDiv.querySelector('#buy-coins').onclick = async () => {
            try {
                const amt = Number(document.getElementById('buy-coins-amt').value);
                const r = await fetchJson('/wallet/buy-coins', { method: 'POST', body: JSON.stringify({ amount: amt }), headers: { Authorization: `Bearer ${state.token}` } });
                setMessage(r.message, 'success');
                renderDashboard();
            } catch (e) { setMessage(e.message, 'error'); }
        };

        const list = document.createElement('div');
        list.innerHTML = '<h3>Book a Service</h3><div id="service-list"></div>';
        dashBody.appendChild(list);
        const services = await fetchJson('/services');
        state.services = services;
        const container = document.getElementById('service-list');
        container.innerHTML = '';
        services.forEach(s => {
            const card = document.createElement('div'); card.className = 'service-card';
            card.innerHTML = `<strong>${s.category}</strong> by ${s.provider}<br/><small>Price: $${s.price}</small><br/><select id="pay-${s.id}"><option value="coins">Util Coins</option><option value="card">Bank Card</option></select><button id="book-${s.id}">Book</button>`;
            container.appendChild(card);
            card.querySelector(`#book-${s.id}`).onclick = async () => {
                const method = card.querySelector(`#pay-${s.id}`).value;
                try {
                    const result = await fetchJson('/book', { method: 'POST', headers: { Authorization: `Bearer ${state.token}` }, body: JSON.stringify({ serviceId: s.id, paymentMethod: method, date: new Date().toISOString() }) });
                    setMessage(`Booked ${s.category} with ${method}.`, 'success');
                    renderDashboard();
                } catch (e) { setMessage(e.message, 'error'); }
            };
        });

        const bookData = await fetchJson('/bookings', { headers: { Authorization: `Bearer ${state.token}` } });
        const bTable = document.createElement('div');
        bTable.innerHTML = `<h3>Your Bookings</h3><table class="table"><thead><tr><th>Service</th><th>Provider</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>${bookData.map(b => `<tr><td>${b.service.category}</td><td>${b.service.provider}</td><td>$${b.amount}</td><td>${b.paymentMethod}</td><td>${b.status}</td></tr>`).join('')}</tbody></table>`;
        dashBody.appendChild(bTable);
    } else {
        const allBookings = await fetchJson('/bookings', { headers: { Authorization: `Bearer ${state.token}` } });
        const list = document.createElement('div');
        list.innerHTML = `<h3>All Bookings</h3><table class="table"><thead><tr><th>User</th><th>Service</th><th>Provider</th><th>Amount</th><th>Status</th></tr></thead><tbody>${allBookings.map(b => `<tr><td>${(b.userId)}</td><td>${b.service.category}</td><td>${b.service.provider}</td><td>$${b.amount}</td><td>${b.status}</td></tr>`).join('')}</tbody></table>`;
        dashBody.appendChild(list);
    }
};

const init = () => {
    showPanel('register');
    document.getElementById('tab-register').onclick = () => showPanel('register');
    document.getElementById('tab-login').onclick = () => showPanel('login');
    document.getElementById('tab-forgot').onclick = () => showPanel('forgot');

    document.getElementById('btn-register').onclick = async () => {
        try {
            const payload = {
                name: document.getElementById('reg-name').value,
                email: document.getElementById('reg-email').value,
                phone: document.getElementById('reg-phone').value,
                password: document.getElementById('reg-password').value,
                role: document.getElementById('reg-role').value
            };
            const r = await fetchJson('/register', { method: 'POST', body: JSON.stringify(payload) });
            setMessage(r.message, 'success');
            show('otp-panel', false);
            showPanel('login');
        } catch (e) { setMessage(e.message, 'error'); }
    };

    document.getElementById('btn-verify-otp').onclick = async () => {
        setMessage('OTP verification is disabled. Just login.', 'success');
    };
};

document.getElementById('btn-login').onclick = async () => {
    try {
        const r = await fetchJson('/login', { method: 'POST', body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value }) });
        setAuthToken(r.token);
        state.user = r.user;
        setMessage('Login successful', 'success');
        show('auth', false);
        show('dashboard', true);
        await renderDashboard();
    } catch (e) { setMessage(e.message, 'error'); }
};

document.getElementById('btn-forgot').onclick = async () => {
    try {
        const r = await fetchJson('/forgot-password', { method: 'POST', body: JSON.stringify({ email: document.getElementById('forgot-email').value }) });
        setMessage(`${r.message} token:${r.resetToken}`, 'success');
        show('reset-panel', true);
    } catch (e) { setMessage(e.message, 'error'); }
};

document.getElementById('btn-reset-password').onclick = async () => {
    try {
        await fetchJson('/reset-password', { method: 'POST', body: JSON.stringify({ email: document.getElementById('reset-email').value, token: document.getElementById('reset-token').value, newPassword: document.getElementById('reset-password').value }) });
        setMessage('Password reset done. Login with new password.', 'success');
        show('reset-panel', false);
    } catch (e) { setMessage(e.message, 'error'); }
};

document.getElementById('btn-logout').onclick = () => {
    setAuthToken(null);
    state.user = null;
    show('dashboard', false);
    show('auth', true);
    showPanel('login');
};

const stored = localStorage.getItem('utilToken');
if (stored) {
    state.token = stored;
    show('auth', false);
    show('dashboard', true);
    renderDashboard().catch(() => { show('auth', true); show('dashboard', false); setAuthToken(null); });
}
};

init();
