require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const oracleRoutes = require('./routes/oracle'); // Added for new route

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3003;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable default CSP to avoid breaking React dev scripts/images
    crossOriginEmbedderPolicy: false
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Auth Rate Limiting (Stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Limit login attempts
    message: 'Too many login attempts, please try again later.'
});
app.use('/api/auth', authLimiter);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth').router);
app.use('/api/users', require('./routes/users'));
// app.use('/api/projects', require('./routes/projects')); // Removed
app.use('/api/requests', require('./routes/requests')); // New
app.use('/api/uploads', require('./routes/upload')); // New
app.use('/api/deploy', require('./routes/deploy')); // New Deployment Route
app.use('/api/compile', require('./routes/compile')); // New Compilation Route
// app.use('/api/files', require('./routes/files')); // Removed
// app.use('/api/folders', require('./routes/folders')); // Removed
app.use('/api/admin', require('./routes/admin'));
app.use('/api/departments', require('./routes/departments'));
// app.use('/api/groups', require('./routes/groups')); // Keep if needed? Plan said remove strictly old project stuff.
app.use('/api/erp-modules', require('./routes/erp'));
app.use('/api/oracle', oracleRoutes); // Register Oracle Routes
app.use('/api/mail', require('./routes/mail'));
app.use('/api/file-browser', require('./routes/fileBrowser')); // New File Browser Route
app.use('/api/docs', require('./routes/docs')); // New Documentation Route

// Serve static files in production
if (process.env.NODE_ENV === 'production' || true) {
    const publicPath = fs.existsSync(path.join(__dirname, 'public'))
        ? path.join(__dirname, 'public')
        : path.join(__dirname, '../client/dist');

    app.use(express.static(publicPath));

    app.get('*', (req, res) => {
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

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Access URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
});
