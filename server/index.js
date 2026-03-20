import express from 'express';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [], services: [], bookings: [] });
await db.read();
if (!db.data || Object.keys(db.data).length === 0) {
    db.data = {
        users: [],
        services: [
            { id: 's1', category: 'Barber', provider: 'Clipper King', price: 30 },
            { id: 's2', category: 'Massage', provider: 'Relax Therapies', price: 45 },
            { id: 's3', category: 'Pedicure', provider: 'Nail Studio', price: 25 },
            { id: 's4', category: 'Manicure', provider: 'Nail Studio', price: 28 },
            { id: 's5', category: 'Stylist', provider: 'Fashion Pro', price: 50 },
            { id: 's6', category: 'Makeup', provider: 'Glow Art', price: 60 },
            { id: 's7', category: 'Cook', provider: 'Home Chef', price: 80 },
            { id: 's8', category: 'Plumber', provider: 'FixIt Plumbers', price: 70 },
            { id: 's9', category: 'Electrician', provider: 'Power Solutions', price: 65 },
            { id: 's10', category: 'Laundry', provider: 'CleanWave', price: 35 },
            { id: 's11', category: 'Carpenter', provider: 'WoodWorks', price: 90 },
            { id: 's12', category: 'Airport Pickup', provider: 'Air Shuttle', price: 120 },
            { id: 's13', category: 'CCTV', provider: 'Secure Vision', price: 90 }
        ],
        bookings: []
    };
    await db.write();
}

const JWT_SECRET = 'util-secret-key-2026';
const authMiddleware = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth' });
    const token = auth.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const user = db.data.users.find(u => u.id === payload.id);
        if (!user) return res.status(403).json({ error: 'Invalid user' });
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

app.post('/api/register', async (req, res) => {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password || !phone || !role) return res.status(400).json({ error: 'Missing fields' });
    const existing = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const user = {
        id: nanoid(),
        name,
        email: email.toLowerCase(),
        password: hash,
        phone,
        role: role === 'provider' ? 'provider' : 'user',
        verified: true,
        resetToken: null,
        resetTokenExpires: null,
        coins: 0,
        bankBalance: 1000,
        linkedBankAccount: '1111222233334444'
    };
    db.data.users.push(user);
    await db.write();
    return res.json({ message: 'Registered successfully. You can login now.' });
});

app.post('/api/verify-otp', async (req, res) => {
    return res.json({ message: 'OTP verification disabled. Login directly.' });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Need email/password' });
    const user = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, coins: user.coins, bankBalance: user.bankBalance } });
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(400).json({ error: 'User not found' });
    user.resetToken = nanoid(24);
    user.resetTokenExpires = Date.now() + 1000 * 60 * 20;
    await db.write();
    return res.json({ message: 'Reset token generated (simulated).', resetToken: user.resetToken });
});

app.post('/api/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    const user = db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.resetToken !== token || user.resetTokenExpires < Date.now()) return res.status(400).json({ error: 'Invalid token' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await db.write();
    res.json({ message: 'Password changed' });
});

app.get('/api/services', (req, res) => {
    res.json(db.data.services);
});

app.get('/api/profile', authMiddleware, (req, res) => {
    const user = req.user;
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, coins: user.coins, bankBalance: user.bankBalance, linkedBankAccount: user.linkedBankAccount } });
});

app.post('/api/wallet/buy-coins', authMiddleware, async (req, res) => {
    const { amount } = req.body;
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Only users can buy coins' });
    const num = Number(amount);
    if (!num || num <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (req.user.bankBalance < num) return res.status(400).json({ error: 'Insufficient bank balance' });
    req.user.bankBalance -= num;
    req.user.coins += num;
    await db.write();
    res.json({ message: 'Coins purchased', coins: req.user.coins, bankBalance: req.user.bankBalance });
});

app.post('/api/book', authMiddleware, async (req, res) => {
    const { serviceId, date, paymentMethod } = req.body;
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Only users can book' });
    const service = db.data.services.find(s => s.id === serviceId);
    if (!service) return res.status(400).json({ error: 'Service not found' });
    const cost = service.price;
    if (paymentMethod === 'coins') {
        if (req.user.coins < cost) return res.status(400).json({ error: 'Insufficient coins' });
        req.user.coins -= cost;
    } else if (paymentMethod === 'card') {
        if (req.user.bankBalance < cost) return res.status(400).json({ error: 'Insufficient linked bank balance' });
        req.user.bankBalance -= cost;
    } else {
        return res.status(400).json({ error: 'Invalid payment method' });
    }
    const booking = {
        id: nanoid(),
        userId: req.user.id,
        serviceId,
        service,
        date: date || new Date().toISOString(),
        paymentMethod,
        amount: cost,
        status: 'confirmed',
        createdAt: new Date().toISOString()
    };
    db.data.bookings.push(booking);
    await db.write();
    res.json({ message: 'Booking confirmed', booking, coins: req.user.coins, bankBalance: req.user.bankBalance });
});

app.get('/api/bookings', authMiddleware, (req, res) => {
    if (req.user.role === 'user') {
        const userBookings = db.data.bookings.filter(b => b.userId === req.user.id);
        return res.json(userBookings);
    }
    const all = db.data.bookings;
    res.json(all);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server started on http://localhost:${port}`));
