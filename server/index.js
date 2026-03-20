import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 4000;
app.use(express.json());

const dbFile = path.resolve(__dirname, "db.json");
const adapter = new JSONFile(dbFile);
const defaults = {
    users: [],
    services: [],
    providers: [],
    bookings: [],
};
const db = new Low(adapter, defaults);
await db.read();
db.data = db.data || defaults;

const defaultServices = [
    "Barber", "Massage", "Pedicure", "Manicure", "Stylist", "Makeup Artist",
    "Cook", "Plumber", "Electrician", "Laundry", "Furniture/Carpenter", "Airport Pickup", "CCTV Engineer"
];
if (!db.data.services.length) {
    db.data.services = defaultServices.map((name, idx) => ({ id: `svc-${idx + 1}`, name }));
}

if (!db.data.providers.length) {
    db.data.providers = [
        { id: "prov-1", name: "Daniel Barber", service: "Barber", phone: "0700000001", price: 2500 },
        { id: "prov-2", name: "Olivia Massage", service: "Massage", phone: "0700000002", price: 4000 },
        { id: "prov-3", name: "Joy Stylist", service: "Stylist", phone: "0700000003", price: 3000 },
        { id: "prov-4", name: "Henry Electric", service: "Electrician", phone: "0700000004", price: 6000 },
        { id: "prov-5", name: "Grace Cleaner", service: "Laundry", phone: "0700000005", price: 2000 },
        { id: "prov-6", name: "CCTV Pro", service: "CCTV Engineer", phone: "0700000006", price: 7000 },
    ];
}

await db.write();

function sendJson(res, data) { return res.json(data); }

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
    const token = auth.split(" ")[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

app.post("/api/register", async (req, res) => {
    const { name, email, password, phone, role = "user", bankAccount = "" } = req.body;
    if (!name || !email || !password || !phone) {
        return res.status(400).json({ error: "name, email, password, phone are required" });
    }
    await db.read();
    const existing = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const user = {
        id: nanoid(),
        name,
        email: email.toLowerCase(),
        password: hash,
        phone,
        role,
        verified: false,
        otp,
        otpExpires: Date.now() + 1000 * 60 * 10,
        coins: 0,
        bankAccount,
        resetToken: null,
        favorites: [],
        createdAt: new Date().toISOString(),
    };
    db.data.users.push(user);
    await db.write();
    return sendJson(res, { message: "Registered. Please verify OTP sent.", otp });
});

app.post("/api/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "email and otp required" });
    await db.read();
    const user = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.verified) return res.json({ message: "Already verified" });
    if (user.otp !== otp || Date.now() > user.otpExpires) return res.status(400).json({ error: "Invalid or expired OTP" });
    user.verified = true;
    user.otp = null;
    user.otpExpires = null;
    await db.write();
    return sendJson(res, { message: "OTP verified successfully" });
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    await db.read();
    const user = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(404).json({ error: "Invalid credentials" });
    if (!user.verified) return res.status(403).json({ error: "Account not verified by OTP" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    return sendJson(res, { token, user: { name: user.name, email: user.email, role: user.role, coins: user.coins } });
});

app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    await db.read();
    const user = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(404).json({ error: "User not found" });
    const token = nanoid(20);
    user.resetToken = token;
    user.resetExpires = Date.now() + 1000 * 60 * 30;
    await db.write();
    return sendJson(res, { message: "Password reset token created", resetToken: token });
});

app.post("/api/reset-password", async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) return res.status(400).json({ error: "email, token, newPassword required" });
    await db.read();
    const user = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.resetToken !== token || Date.now() > user.resetExpires) return res.status(400).json({ error: "Invalid or expired reset token" });
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetExpires = null;
    await db.write();
    return sendJson(res, { message: "Password reset success" });
});

app.get("/api/services", async (req, res) => {
    await db.read();
    return sendJson(res, { services: db.data.services });
});

app.get("/api/providers", async (req, res) => {
    await db.read();
    return sendJson(res, { providers: db.data.providers });
});

app.get("/api/user", authMiddleware, async (req, res) => {
    await db.read();
    const user = db.data.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return sendJson(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role, coins: user.coins, phone: user.phone, bankAccount: user.bankAccount } });
});

app.post("/api/buy-coins", authMiddleware, async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "amount required" });
    await db.read();
    const user = db.data.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.bankAccount) return res.status(400).json({ error: "Link bank account first" });
    user.coins += Number(amount);
    await db.write();
    return sendJson(res, { message: `Bought ${amount} util coins`, coins: user.coins });
});

app.post("/api/book", authMiddleware, async (req, res) => {
    const { providerId, serviceId, date, time, paymentMethod, amount } = req.body;
    if (!providerId || !serviceId || !date || !time || !paymentMethod || !amount) {
        return res.status(400).json({ error: "providerId, serviceId, date, time, paymentMethod, amount required" });
    }
    await db.read();
    const user = db.data.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (paymentMethod === "coins" && user.coins < amount) return res.status(400).json({ error: "Not enough coins" });
    if (paymentMethod === "coins") user.coins -= amount;
    const provider = db.data.providers.find((p) => p.id === providerId);
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    const service = db.data.services.find((s) => s.id === serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const booking = {
        id: nanoid(),
        userId: user.id,
        providerId,
        serviceId,
        date,
        time,
        paymentMethod,
        amount,
        status: "confirmed",
        createdAt: new Date().toISOString(),
    };
    db.data.bookings.push(booking);
    await db.write();
    return sendJson(res, { message: "Booking confirmed", booking, coins: user.coins });
});

app.get("/api/dashboard", authMiddleware, async (req, res) => {
    await db.read();
    const user = db.data.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const bookings = db.data.bookings.filter((b) => b.userId === user.id).map((bk) => {
        const provider = db.data.providers.find((p) => p.id === bk.providerId);
        const service = db.data.services.find((s) => s.id === bk.serviceId);
        return { ...bk, provider: provider?.name || "Unknown", service: service?.name || "Unknown" };
    });
    return sendJson(res, { user: { name: user.name, email: user.email, coins: user.coins }, bookings });
});

app.get("/api/provider-dashboard", authMiddleware, async (req, res) => {
    await db.read();
    const user = db.data.users.find((u) => u.id === req.user.id);
    if (!user || user.role !== "provider") return res.status(403).json({ error: "Provider access only" });
    const provider = db.data.providers.find((p) => p.email === user.email) || { id: "none", name: user.name, service: "General" };
    const bookings = db.data.bookings.filter((b) => b.providerId === provider.id).map((bk) => {
        const u = db.data.users.find((x) => x.id === bk.userId);
        const service = db.data.services.find((s) => s.id === bk.serviceId);
        return { ...bk, user: u?.name || "Unknown", service: service?.name || "Unknown" };
    });
    return sendJson(res, { provider: { name: provider.name, service: provider.service }, bookings });
});

app.get("/api/bookings", authMiddleware, async (req, res) => {
    await db.read();
    const bookings = db.data.bookings;
    return sendJson(res, { bookings });
});

app.use(express.static(path.join(__dirname, "..", "client")));
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
