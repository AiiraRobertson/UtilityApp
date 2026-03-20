const messageEl = document.getElementById("message");
const authSection = document.getElementById("auth-section");
const dashboard = document.getElementById("dashboard");

const tabs = {
    register: document.getElementById("show-register"),
    login: document.getElementById("show-login"),
};
const registerForm = document.getElementById("register");
const loginForm = document.getElementById("login");
const forgotForm = document.getElementById("forgot");

tabs.register.addEventListener("click", () => showTab("register"));
tabs.login.addEventListener("click", () => showTab("login"));

document.getElementById("show-forgot").addEventListener("click", () => {
    loginForm.classList.add("hidden");
    forgotForm.classList.remove("hidden");
});

function showTab(name) {
    registerForm.classList.toggle("hidden", name !== "register");
    loginForm.classList.toggle("hidden", name !== "login");
    forgotForm.classList.add("hidden");
    tabs.register.classList.toggle("active", name === "register");
    tabs.login.classList.toggle("active", name === "login");
}

function showMessage(text, type = "info") {
    messageEl.textContent = text;
    messageEl.className = "message show";
    messageEl.style.background = type === "error" ? "#fee2e2" : "#d1fae5";
    messageEl.style.color = type === "error" ? "#991b1b" : "#065f46";
    setTimeout(() => messageEl.classList.remove("show"), 7000);
}

const api = {
    post: async (url, body, token) => {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(body),
        });
        return { ok: res.ok, status: res.status, body: await res.json() };
    },
    get: async (url, token) => {
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        return { ok: res.ok, status: res.status, body: await res.json() };
    },
};

async function register() {
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const password = document.getElementById("reg-password").value;
    const role = document.getElementById("reg-role").value;
    const bankAccount = document.getElementById("reg-bank").value.trim();
    const { ok, body } = await api.post("/api/register", { name, email, phone, password, role, bankAccount });
    if (!ok) return showMessage(body.error || "Register failed", "error");
    showMessage(`Registered. OTP: ${body.otp}. Verify OTP below`);
}

async function verifyOtp() {
    const email = document.getElementById("otp-email").value.trim();
    const otp = document.getElementById("otp-code").value.trim();
    const { ok, body } = await api.post("/api/verify-otp", { email, otp });
    if (!ok) return showMessage(body.error || "OTP verify failed", "error");
    showMessage(body.message);
}

async function login() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const { ok, body } = await api.post("/api/login", { email, password });
    if (!ok) return showMessage(body.error || "Login failed", "error");
    localStorage.setItem("token", body.token);
    localStorage.setItem("role", body.user.role);
    showMessage("Logged in successfully");
    showDashboard();
}

async function sendForgot() {
    const email = document.getElementById("forgot-email").value.trim();
    const { ok, body } = await api.post("/api/forgot-password", { email });
    if (!ok) return showMessage(body.error || "Request failed", "error");
    showMessage(`Reset token: ${body.resetToken}`);
}

async function resetPassword() {
    const email = document.getElementById("forgot-email").value.trim();
    const token = document.getElementById("reset-token").value.trim();
    const password = document.getElementById("reset-password").value;
    const { ok, body } = await api.post("/api/reset-password", { email, token, newPassword: password });
    if (!ok) return showMessage(body.error || "Reset failed", "error");
    showMessage(body.message);
}

async function fetchDashboard() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const role = localStorage.getItem("role") || "user";
    const endpoint = role === "provider" ? "/api/provider-dashboard" : "/api/dashboard";
    const { ok, body } = await api.get(endpoint, token);
    if (!ok) {
        localStorage.removeItem("token");
        return null;
    }
    return { role, body };
}

async function showDashboard() {
    const result = await fetchDashboard();
    if (!result) { authSection.classList.remove("hidden"); dashboard.classList.add("hidden"); return; }
    authSection.classList.add("hidden"); dashboard.classList.remove("hidden");

    const display = document.getElementById("user-info");
    display.innerHTML = `<p><strong>${result.role === "provider" ? "Provider" : "User"}:</strong> ${result.body.provider?.name || result.body.user?.name} | Coins: ${result.body.user?.coins ?? result.body.provider?.coins ?? 0}</p>`;

    const serviceRow = document.getElementById("service-row");
    const providerRow = document.getElementById("provider-row");
    const bookingRow = document.getElementById("booking-row");
    const coinsRow = document.getElementById("coins-row");

    serviceRow.innerHTML = "";
    providerRow.innerHTML = "";
    bookingRow.innerHTML = "";
    coinsRow.innerHTML = "";

    if (result.role === "provider") {
        providerRow.innerHTML = `<div class="card"><h3>Provider Bookings</h3>${result.body.bookings.map((b) => `<p>${b.service} for ${b.user} on ${b.date} ${b.time} (${b.amount} via ${b.paymentMethod})</p>`).join("")}</div>`;
        return;
    }

    const services = await api.get("/api/services");
    const providers = await api.get("/api/providers");
    const serviceCards = services.body.services.map((s) => `<span class="status-label">${s.name}</span>`).join(" ");
    serviceRow.innerHTML = `<div class="card"><h3>Available Services</h3>${serviceCards}</div>`;
    providerRow.innerHTML = `<div class="card"><h3>Service Providers</h3>${providers.body.providers.map((p) => `<p>${p.name} (${p.service}) - ${p.price} NGN <button data-provider='${p.id}' data-service='${p.service}' data-price='${p.price}'>Book</button></p>`).join("")}</div>`;

    providerRow.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const providerId = btn.dataset.provider;
            const serviceName = btn.dataset.service;
            const amount = Number(btn.dataset.price);
            const service = services.body.services.find((s) => s.name === serviceName);
            if (!service) return showMessage("Service not available", "error");
            const date = prompt("Booking date (e.g. 2026-04-20)");
            const time = prompt("Booking time (e.g. 15:00)");
            const method = prompt("Payment method: card or coins", "card");
            const { ok, body } = await api.post("/api/book", { providerId, serviceId: service.id, date, time, paymentMethod: method === "coins" ? "coins" : "card", amount });
            if (!ok) return showMessage(body.error || "Booking failed", "error");
            showMessage("Booking confirmed");
            showDashboard();
        });
    });

    bookingRow.innerHTML = `<div class="card"><h3>Your Bookings</h3>${result.body.bookings.length ? result.body.bookings.map((b) => `<p>${b.service} with ${b.provider} on ${b.date} ${b.time} amount ${b.amount} (${b.paymentMethod})</p>`).join("") : "No bookings yet"}</div>`;

    coinsRow.innerHTML = `<div class="card"><h3>Util Coins</h3><p>Current coins: ${result.body.user.coins}</p><input id="buy-coins" placeholder="Buy coins amount" type="number" min="100" /><button id="btn-buy">Buy Coins</button></div>`;
    document.getElementById("btn-buy").addEventListener("click", async () => {
        const amount = Number(document.getElementById("buy-coins").value);
        const { ok, body } = await api.post("/api/buy-coins", { amount }, localStorage.getItem("token"));
        if (!ok) return showMessage(body.error || "Buy failed", "error");
        showMessage(body.message);
        showDashboard();
    });
}

async function init() {
    document.getElementById("btn-register").addEventListener("click", register);
    document.getElementById("btn-verify-otp").addEventListener("click", verifyOtp);
    document.getElementById("btn-login").addEventListener("click", login);
    document.getElementById("btn-forgot").addEventListener("click", sendForgot);
    document.getElementById("btn-reset").addEventListener("click", resetPassword);
    document.getElementById("btn-logout").addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        dashboard.classList.add("hidden");
        authSection.classList.remove("hidden");
    });
    showTab("register");
    await showDashboard();
}

init();