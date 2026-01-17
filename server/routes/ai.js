const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const geminiService = require('../services/gemini');
const { verifyToken } = require('./auth');

// Setup Multer for temporary storage
const TEMP_DIR = path.join(__dirname, '../temp_context');
if (!fs.existsSync(TEMP_DIR)) {
    try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch (e) { console.error('Failed to create temp dir', e); }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        // Use timestamp to avoid collisions
        cb(null, `ai_analysis_${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ storage });

// POST /api/ai/analyze-sql
router.post('/analyze-sql', verifyToken, upload.array('files'), async (req, res) => {
    try {
        if ((!req.files || req.files.length === 0)
            && (!req.body.existingFiles || req.body.existingFiles.length === 0)
            && (!req.body.existingFilesMetadata)) {
            return res.status(400).json({ error: 'No files provided for analysis' });
        }

        const contextFiles = [];

        // Handle Uploaded Files
        if (req.files) {
            req.files.forEach(file => {
                contextFiles.push({
                    name: file.originalname,
                    path: file.path
                });
            });
        }

        // Handle Existing Server Files (New Metadata Approach)
        if (req.body.existingFilesMetadata) {
            try {
                const metadata = JSON.parse(req.body.existingFilesMetadata);
                if (Array.isArray(metadata)) {
                    metadata.forEach(item => {
                        if (item.path && fs.existsSync(item.path)) {
                            contextFiles.push({
                                name: item.name, // Use provided original name
                                path: item.path,
                                isExisting: true
                            });
                        }
                    });
                }
            } catch (e) { console.error('Failed to parse existingFilesMetadata', e); }
        }
        // Fallback for backward compatibility (raw paths)
        else if (req.body.existingFiles) {
            const existing = Array.isArray(req.body.existingFiles) ? req.body.existingFiles : [req.body.existingFiles];
            existing.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    contextFiles.push({
                        name: path.basename(filePath),
                        path: filePath,
                        isExisting: true
                    });
                }
            });
        }

        const validModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-pro', 'gemini-1.5-flash'];
        const selectedModel = req.body.model && validModels.includes(req.body.model) ? req.body.model : 'gemini-3-flash-preview';

        console.log(`[AI Analysis] Processing ${contextFiles.length} files using model ${selectedModel} for user ${req.user.name}`);

        const systemPrompt = `
你是一位嚴格的 Oracle SQL 語法驗證專家。
你的任務是檢查 SQL 檔案的「語法正確性」與「安全性」。

**絕對禁止事項 (Strict Violations)：**
1. ❌ **嚴禁**輸出一堆 Markdown 大標題符號 (##, ###)，請使用粗體或引言即可。
2. ❌ **嚴禁**提及「已生成檔案」、「文檔」、「PDF」、「下載報告」等毫無關聯的內容。不要說「報告已產生」。
3. ❌ 不要解釋程式碼功能，不要畫圖。

**分析規則 (Target Database: Oracle)：**
1. **語法檢查**：是否符合 Oracle SQL 標準？
2. **相容性**：是否誤用非 Oracle 語法。
3. **安全性**：是否有危險指令。

**輸出格式 (繁體中文，請模仿以下排版，利用 Emoji 與引用來增加閱讀性)：**

> 檔案：**[檔名]**

*   🔴 **狀態：異常 (Error)**  *(或是 🟢 **狀態：通過 (Passed)**)*
*   🔎 **原因：**
    1.  第 **X** 行：關鍵字拼寫錯誤 'ass' 應為 'as'。
    2.  第 **Y** 行：缺少分號 ';'。

-------------------

(針對每個檔案重複上述區塊。如果通過，原因部分請留空或寫「無發現明顯錯誤」。)
`;

        const response = await geminiService.chat(
            selectedModel,
            [], // No history needed
            "請依照系統指示檢查這些 SQL 檔案的語法正確性。",
            contextFiles
        );

        // Cleanup temporary files
        // Cleanup temporary files (Only uploaded ones)
        contextFiles.forEach(file => {
            if (!file.isExisting) {
                try { fs.unlinkSync(file.path); } catch (e) { console.error('Failed to delete temp file:', file.path); }
            }
        });

        res.json({ success: true, analysis: response });

    } catch (error) {
        console.error('AI Analysis Error:', error);
        // Attempt cleanup on error
        if (req.files) {
            req.files.forEach(file => {
                try { fs.unlinkSync(file.path); } catch (e) { }
            });
        }
        res.status(500).json({ error: 'AI Analysis failed: ' + error.message });
    }
});

module.exports = router;
