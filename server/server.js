require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const oracleRoutes = require('./routes/oracle');
const http = require('http');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
});
require('./sockets/terminalSocket')(io);
const PORT = process.env.PORT || 3003;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Auth Rate Limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many login attempts, please try again later.'
});
app.use('/api/auth', authLimiter);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Import Routes
const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const uploadRoutes = require('./routes/upload');
const deployRoutes = require('./routes/deploy');
const adminRoutes = require('./routes/admin');
const docRoutes = require('./routes/docs');
const groupsRoutes = require('./routes/groups');
const erpRoutes = require('./routes/erp');
const compileRoutes = require('./routes/compile');
const departmentsRoutes = require('./routes/departments');
const filesRoutes = require('./routes/files'); // Ensure this file exists, list_dir confirmed it
const usersRoutes = require('./routes/users');
const logsRoutes = require('./routes/logs');

const publicApprovalRoutes = require('./routes/public_approval'); // New Public Approval

// Register Routes
app.use('/api/auth', authRoutes.router);
app.use('/api/files', filesRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/erp-modules', erpRoutes);
app.use('/api/oracle', oracleRoutes);
app.use('/api/compile', compileRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/mail', require('./routes/mail'));
app.use('/api/file-browser', require('./routes/fileBrowser'));
app.use('/api/ai', require('./routes/ai'));

app.use('/api/public', publicApprovalRoutes); // Register Public Routes

// Serve static files in production
if (process.env.NODE_ENV === 'production' || true) {
    const publicPath = fs.existsSync(path.join(__dirname, 'public'))
        ? path.join(__dirname, 'public')
        : path.join(__dirname, '../client/dist');

    app.use(express.static(publicPath));

    // Fix for SPA routing
    app.get('*', (req, res) => {
        if (req.url.startsWith('/api')) return res.status(404).json({ error: 'API Not Found' });

        const indexPath = path.join(publicPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send('Not Found');
        }
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Initialize Database
db.init().then(() => {
    console.log("Database initialized");

    // Initialize Scheduler (Background Tasks)
    const scheduler = require('./services/scheduler');
    scheduler.init();

    // Initialize Backup Service
    const backupService = require('./services/backupService');
    backupService.init();

    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Access URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
});
