const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'ROBUX_KAROBAR_DENIS_ADMIN_2026';

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir));

const dbFile = path.join(__dirname, 'database.json');
let db = { users: [], history: [], total_spins_done: 0 };
const saveDb = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));

const adminEmail = 'denislamichhane900@gmail.com';
const adminPassPlain = 'DLCDenis!';

if (fs.existsSync(dbFile)) {
    db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    if (!db.history) db.history = [];
    if (db.total_spins_done === undefined) db.total_spins_done = db.history.length;
    let adminUser = db.users.find(u => u.email === adminEmail);
    const hashedAdminPass = bcrypt.hashSync(adminPassPlain, 10);
    if (adminUser) {
        adminUser.is_admin = 1;
        adminUser.password = hashedAdminPass;
    } else {
        db.users.push({ id: 1, email: adminEmail, roblox_user: 'DenisAdmin', password: hashedAdminPass, spins: 999, is_admin: 1 });
    }
    saveDb();
} else {
    const hashedAdminPass = bcrypt.hashSync(adminPassPlain, 10);
    db.users.push({ id: 1, email: adminEmail, roblox_user: 'DenisAdmin', password: hashedAdminPass, spins: 999, is_admin: 1 });
    saveDb();
}

const PRIZES = [
    { id: 0, name: 'Try Again', weight: 45 },
    { id: 1, name: 'Virtual Selroti 🥮', weight: 20 },
    { id: 2, name: '+1 Free Spin', weight: 15 },
    { id: 3, name: 'Virtual Fanta 🥤', weight: 12 },
    { id: 4, name: 'Better Luck', weight: 6.9998 },
    { id: 5, name: 'Dashain Blessing 🙏', weight: 0.0001 },
    { id: 6, name: '50 Robux', weight: 0.0001 },
    { id: 7, name: '100 Robux', weight: 0.0001 }
];

function auth(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not logged in' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid session' });
        req.user = decoded;
        next();
    });
}

function adminOnly(req, res, next) {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
}

app.post('/api/register', async (req, res) => {
    const { email, roblox_user, password, agreedTerms } = req.body;
    if (!agreedTerms) return res.status(400).json({ error: 'Please agree to the Terms & Policies.' });
    if (!email || !password || !roblox_user) return res.status(400).json({ error: 'All fields are required!' });

    const cleanEmail = email.toLowerCase().trim();
    const cleanRoblox = roblox_user.trim();

    if (db.users.find(u => u.email === cleanEmail)) {
        return res.status(400).json({ error: 'Email already registered!' });
    }
    if (db.users.find(u => u.roblox_user.toLowerCase() === cleanRoblox.toLowerCase())) {
        return res.status(400).json({ error: 'Roblox Username already linked!' });
    }

    const hash = await bcrypt.hash(password, 10);
    const isAdminUser = cleanEmail === adminEmail ? 1 : 0;
    const newUser = { id: Date.now(), email: cleanEmail, roblox_user: cleanRoblox, password: hash, spins: 5, is_admin: isAdminUser };
    db.users.push(newUser);
    saveDb();

    const token = jwt.sign({ id: newUser.id, email: newUser.email, is_admin: newUser.is_admin }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Registered with 5 FREE Spins!' });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = email?.toLowerCase().trim();
    const user = db.users.find(u => u.email === cleanEmail);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'Invalid email or password!' });
    }
    if (cleanEmail === adminEmail) user.is_admin = 1;
    saveDb();
    const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Logged in!' });
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/me', auth, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(401).json({ error: 'Not found' });
    const history = db.history.filter(h => h.user_id === user.id).reverse();
    res.json({ user: { email: user.email, roblox_user: user.roblox_user, spins: user.spins, is_admin: user.is_admin }, history });
});

app.post('/api/spin', auth, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || user.spins <= 0) return res.status(400).json({ error: '0 Spins left! DM robuxkarobar on tiktok.' });

    const total = PRIZES.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * total;
    let won = PRIZES[0];
    for (const p of PRIZES) {
        if (rand < p.weight) { won = p; break; }
        rand -= p.weight;
    }

    user.spins += (won.name === '+1 Free Spin' ? 1 : -1);
    const isFunOrFree = (won.name === 'Try Again' || won.name === 'Better Luck' || won.name === '+1 Free Spin' || won.name.includes('Virtual') || won.name.includes('Dashain'));
    const status = isFunOrFree ? 'Completed (Free Spin Added)' : 'Pending Robux Payout';

    db.history.push({
        id: Date.now(), user_id: user.id, email: user.email, roblox_user: user.roblox_user,
        prize: won.name, status, won_at: new Date().toISOString()
    });

    if (db.total_spins_done === undefined) db.total_spins_done = 0;
    db.total_spins_done += 1;

    saveDb();
    res.json({ prizeIndex: won.id, prizeName: won.name, remainingSpins: user.spins });
});

app.post('/api/cancel-request', auth, (req, res) => {
    const { id } = req.body;
    const h = db.history.find(x => x.id === Number(id) && x.user_id === req.user.id);
    if (h && h.status === 'Pending Robux Payout') {
        h.status = 'Cancelled by User';
        saveDb();
        return res.json({ message: 'Request cancelled.' });
    }
    res.status(400).json({ error: 'Unable to cancel.' });
});

app.get('/api/admin/data', auth, adminOnly, (req, res) => {
    const users = db.users.map(u => ({ email: u.email, roblox_user: u.roblox_user, spins: u.spins })).reverse();
    const prizes = db.history.filter(h => h.prize.includes('Robux')).reverse();
    const totalSpins = db.total_spins_done !== undefined ? db.total_spins_done : db.history.length;
    res.json({ users, prizes, totalSpins });
});

app.post('/api/admin/add-spins', auth, adminOnly, (req, res) => {
    const { email, spinsToAdd } = req.body;
    const u = db.users.find(x => x.email === email?.toLowerCase().trim());
    if (!u) return res.status(404).json({ error: 'User not found' });
    u.spins += Number(spinsToAdd);
    saveDb();
    res.json({ message: 'Added spins successfully.' });
});

app.post('/api/admin/deliver-prize', auth, adminOnly, (req, res) => {
    const item = db.history.find(h => h.id === Number(req.body.historyId));
    if (item && item.status === 'Pending Robux Payout') { 
        item.status = 'Robux Sent ✅'; 
        saveDb(); 
    }
    res.json({ ok: true });
});

app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));