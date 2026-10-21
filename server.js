const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'ROBUX_KAROBAR_DENIS_ADMIN_2026';

app.use(express.json());
app.use(cookieParser());

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir));

const dbFile = path.join(__dirname, 'database.json');
let db = { users: [], history: [], withdrawals: [], total_spins_done: 0 };
const saveDb = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));

const ADMIN_PASS_PLAIN = 'DLCDenis!';

if (fs.existsSync(dbFile)) {
    try {
        db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        if (!db.users) db.users = [];
        if (!db.history) db.history = [];
        if (!db.withdrawals) db.withdrawals = [];
        if (db.total_spins_done === undefined) db.total_spins_done = db.history.length;
    } catch (e) {
        db = { users: [], history: [], withdrawals: [], total_spins_done: 0 };
    }
}

// Ensure Admin account exists with hashed password
const adminHash = bcrypt.hashSync(ADMIN_PASS_PLAIN, 10);
let adminUser = db.users.find(u => u.is_admin === 1);
if (adminUser) {
    adminUser.password = adminHash;
} else {
    db.users.push({
        id: 1,
        roblox_user: 'DenisAdmin',
        password: adminHash,
        spins: 999,
        balance: 0,
        is_admin: 1
    });
}
saveDb();

const PRIZES = [
    { id: 0, name: 'Try Again ❌', robux: 0, weight: 32, color: '#334155', rarity: 'common' },
    { id: 1, name: 'Virtual Selroti 🥮', robux: 0, weight: 20, color: '#475569', rarity: 'common' },
    { id: 2, name: 'Virtual Momo 🥟', robux: 0, weight: 15, color: '#475569', rarity: 'common' },
    { id: 3, name: 'Dashain Tika 🌺', robux: 0, weight: 11, color: '#64748b', rarity: 'common' },
    { id: 4, name: '+1 Free Spin 🎟️', robux: 0, freeSpin: 1, weight: 8, color: '#0284c7', rarity: 'uncommon' },
    { id: 5, name: '1 Robux 💎', robux: 1, weight: 11.497, color: '#16a34a', rarity: 'rare' },
    { id: 6, name: '5 Robux 💎', robux: 5, weight: 2.0, color: '#9333ea', rarity: 'epic' },
    { id: 7, name: '10 Robux 💎', robux: 10, weight: 0.5, color: '#db2777', rarity: 'epic' },
    { id: 8, name: '20 Robux 🔥', robux: 20, weight: 0.1, color: '#ea580c', rarity: 'legendary' },
    { id: 9, name: '50 Robux ⚡', robux: 50, weight: 0.01, color: '#eab308', rarity: 'legendary' },
    { id: 10, name: '100 Robux 👑', robux: 100, weight: 0.0001, color: '#ef4444', rarity: 'jackpot' }
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
    const { roblox_user, password, agreedTerms } = req.body;
    if (!agreedTerms) return res.status(400).json({ error: 'Please agree to the Terms & Policies.' });
    if (!roblox_user || !roblox_user.trim()) return res.status(400).json({ error: 'Roblox Username is required!' });
    if (!password || password.length < 4) return res.status(400).json({ error: 'Please create a site password (at least 4 characters)!' });

    const cleanRoblox = roblox_user.trim();
    if (cleanRoblox.toLowerCase() === 'denisadmin' || cleanRoblox.toLowerCase() === 'denislamichhane900@gmail.com') {
        return res.status(400).json({ error: 'Reserved Admin Username! Please use the Login tab.' });
    }

    const exists = db.users.find(u => u.roblox_user && u.roblox_user.toLowerCase() === cleanRoblox.toLowerCase());
    if (exists) {
        return res.status(400).json({ error: 'Username already registered! Switch to the Login tab.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), roblox_user: cleanRoblox, password: hash, spins: 5, balance: 0, is_admin: 0 };
    db.users.push(newUser);
    saveDb();

    const token = jwt.sign({ id: newUser.id, roblox_user: newUser.roblox_user, is_admin: 0 }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Registered with 5 FREE Spins!' });
});

app.post('/api/login', async (req, res) => {
    const { roblox_user, password } = req.body;
    if (!roblox_user || !roblox_user.trim() || !password) {
        return res.status(400).json({ error: 'Enter both your Roblox Username and Site Password!' });
    }

    const cleanRoblox = roblox_user.trim();

    if (cleanRoblox.toLowerCase() === 'denisadmin' || cleanRoblox.toLowerCase() === 'denislamichhane900@gmail.com') {
        let aUser = db.users.find(u => u.is_admin === 1);
        if (!aUser || !(await bcrypt.compare(password, aUser.password))) {
            return res.status(400).json({ error: 'Invalid Admin credentials!' });
        }
        const token = jwt.sign({ id: aUser.id, roblox_user: aUser.roblox_user, is_admin: 1 }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true });
        return res.json({ message: 'Admin Logged In!' });
    }

    const user = db.users.find(u => u.roblox_user && u.roblox_user.toLowerCase() === cleanRoblox.toLowerCase());
    if (!user) return res.status(400).json({ error: 'Username not found! Please Register first.' });

    // If an older account had no password set yet, save their new password on login
    if (!user.password) {
        user.password = await bcrypt.hash(password, 10);
    } else {
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ error: 'Incorrect password!' });
    }

    if (user.balance === undefined) user.balance = 0;
    saveDb();

    const token = jwt.sign({ id: user.id, roblox_user: user.roblox_user, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Logged in!' });
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/me', auth, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(401).json({ error: 'Not found' });
    if (user.balance === undefined) user.balance = 0;
    const history = db.history.filter(h => h.user_id === user.id).slice(-20).reverse();
    const withdrawals = db.withdrawals.filter(w => w.user_id === user.id).reverse();
    res.json({
        user: { roblox_user: user.roblox_user, spins: user.spins, balance: user.balance, is_admin: user.is_admin },
        history,
        withdrawals,
        prizes: PRIZES
    });
});

app.post('/api/spin', auth, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || user.spins <= 0) return res.status(400).json({ error: '0 Spins left! DM robuxkarobar on TikTok for more spins.' });

    const total = PRIZES.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * total;
    let won = PRIZES[0];
    for (const p of PRIZES) {
        if (rand < p.weight) { won = p; break; }
        rand -= p.weight;
    }

    if (user.balance === undefined) user.balance = 0;

    if (!won.freeSpin) {
        user.spins -= 1;
    }

    let status = 'Completed (Fun Item)';
    if (won.freeSpin) {
        status = 'Completed (+1 Free Spin)';
    } else if (won.robux > 0) {
        user.balance += won.robux;
        status = '+' + won.robux + ' R$ Added to Balance';
    }

    db.history.push({
        id: Date.now(),
        user_id: user.id,
        roblox_user: user.roblox_user,
        prize: won.name,
        robux: won.robux,
        status,
        won_at: new Date().toISOString()
    });

    db.total_spins_done = (db.total_spins_done || 0) + 1;
    saveDb();

    res.json({
        wonPrize: won,
        remainingSpins: user.spins,
        newBalance: user.balance
    });
});

app.post('/api/withdraw', auth, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.balance || 0) < 150) {
        return res.status(400).json({ error: 'Minimum withdrawal is 150 Robux! You currently have ' + (user.balance || 0) + ' R$.' });
    }

    const amount = user.balance;
    user.balance = 0;

    db.withdrawals.push({
        id: Date.now(),
        user_id: user.id,
        roblox_user: user.roblox_user,
        amount,
        status: 'Pending Payout',
        created_at: new Date().toISOString()
    });

    saveDb();
    res.json({ message: 'Withdrawal request for ' + amount + ' Robux submitted! Admin will send your Robux soon.', newBalance: 0 });
});

app.post('/api/cancel-withdraw', auth, (req, res) => {
    const { id } = req.body;
    const w = db.withdrawals.find(x => x.id === Number(id) && x.user_id === req.user.id);
    if (!w || w.status !== 'Pending Payout') return res.status(400).json({ error: 'Cannot cancel this request.' });

    const user = db.users.find(u => u.id === req.user.id);
    w.status = 'Cancelled (Refunded)';
    if (user) user.balance = (user.balance || 0) + w.amount;
    saveDb();
    res.json({ message: 'Withdrawal cancelled & Robux returned to your balance!' });
});

app.get('/api/admin/data', auth, adminOnly, (req, res) => {
    const users = db.users.map(u => ({ roblox_user: u.roblox_user, spins: u.spins, balance: u.balance || 0 })).reverse();
    const withdrawals = db.withdrawals.slice().reverse();
    const totalSpins = db.total_spins_done !== undefined ? db.total_spins_done : db.history.length;
    res.json({ users, withdrawals, totalSpins });
});

app.post('/api/admin/add-spins', auth, adminOnly, (req, res) => {
    const { roblox_user, spinsToAdd } = req.body;
    const clean = roblox_user?.trim().toLowerCase();
    const u = db.users.find(x => x.roblox_user && x.roblox_user.toLowerCase() === clean);
    if (!u) return res.status(404).json({ error: 'Roblox Username not found! Make sure they registered first.' });
    u.spins += Number(spinsToAdd);
    saveDb();
    res.json({ message: 'Added ' + spinsToAdd + ' spins to @' + u.roblox_user + ' (Total: ' + u.spins + ')' });
});

app.post('/api/admin/deliver-withdraw', auth, adminOnly, (req, res) => {
    const item = db.withdrawals.find(w => w.id === Number(req.body.withdrawId));
    if (item && item.status === 'Pending Payout') {
        item.status = 'Robux Sent ✅';
        saveDb();
    }
    res.json({ ok: true });
});

app.listen(PORT, () => console.log('Robux Karobar Horizontal Unboxer LIVE at http://localhost:' + PORT));