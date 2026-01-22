const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const approvalService = require('../services/approvalService');
const dbExports = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'erp_update_system_secret_key_2024';

function renderResult(res, title, message, color = '#28a745') {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
            body { font-family: 'Arial', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f4f6f8; }
            .card { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 500px; width: 90%; }
            .icon { font-size: 48px; margin-bottom: 20px; color: ${color}; }
            h1 { color: #333; margin-bottom: 10px; }
            p { color: #666; font-size: 16px; }
            .btn { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #333; color: white; text-decoration: none; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">${color === '#28a745' ? '✅' : '⚠️'}</div>
            <h1>${title}</h1>
            <p>${message}</p>
        </div>
    </body>
    </html>
    `;
    res.send(html);
}

// Middleware to verify token and fetch user
async function verifyApprovalToken(req, res, next) {
    const { token } = req.query;
    if (!token) {
        return renderResult(res, 'Error', 'Token is missing.', '#dc3545');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // decoded: { userId, requestId, action }

        req.tokenData = decoded;

        // Fetch full user to ensure we have permissions
        const { db } = dbExports;
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);

        if (!user) {
            return renderResult(res, 'Error', 'User not found.', '#dc3545');
        }

        req.user = user;
        next();
    } catch (e) {
        console.error('Token Verify Error:', e.message);
        return renderResult(res, 'Error', 'Invalid or expired token.', '#dc3545');
    }
}

router.get('/approve', verifyApprovalToken, async (req, res) => {
    const { requestId, action } = req.tokenData;

    // Safety check: Token action must match route?
    if (action !== 'approve') {
        return renderResult(res, 'Error', 'Invalid token action.', '#dc3545');
    }

    try {
        await approvalService.processRequestAction({
            requestId: requestId,
            user: req.user,
            action: 'approve',
            isPublic: true
        });

        renderResult(res, 'Success', 'The request has been successfully approved.', '#28a745');
    } catch (e) {
        console.error('Approval Error:', e);
        renderResult(res, 'Failed', e.message || 'Approval failed.', '#dc3545');
    }
});

router.get('/reject', verifyApprovalToken, async (req, res) => {
    const { requestId, action } = req.tokenData;

    if (action !== 'reject') {
        return renderResult(res, 'Error', 'Invalid token action.', '#dc3545');
    }

    try {
        // For rejection, we ideally want a comment.
        // But for magic link, maybe we accept "No Comment" or "Rejected via Email Link"?
        await approvalService.processRequestAction({
            requestId: requestId,
            user: req.user,
            action: 'reject',
            comment: 'Rejected via Email Link',
            isPublic: true
        });

        renderResult(res, 'Success', 'The request has been successfully rejected.', '#28a745');
    } catch (e) {
        console.error('Rejection Error:', e);
        renderResult(res, 'Failed', e.message || 'Rejection failed.', '#dc3545');
    }
});

module.exports = router;
