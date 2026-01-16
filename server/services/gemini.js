const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            console.warn("GEMINI_API_KEY is not set in .env");
        } else {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
        }
    }

    async chat(modelName, history, message, contextFiles = []) {
        if (!this.genAI) {
            throw new Error("Gemini API Key is not configured.");
        }

        const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: "You are a helpful AI assistant. \n\n**STRICT CONTEXT RULES**:\n1. If valid context files are provided, you MUST base your answer primarily on them. Do NOT fabricate information or data that is not present in the files.\n\n**FILE GENERATION RULES**:\nTo create a file, you must use a specify code block header with `language:filename`.\n\n**CORRECT SYNTAX (DO THIS)**:\n```csv_to_xlsx:my_report.xlsx\nName,Age\n...\n```\n\n**WRONG SYNTAX (DO NOT DO THIS)**:\ncsv_to_xlsx:my_report.xlsx\n```csv\n...\n```\n\n**Supported Formats**:\n1. **Excel**: `csv_to_xlsx:filename.xlsx` (Provide CSV content)\n2. **Word**: `html_to_docx:filename.docx` (Provide HTML content)\n3. **PDF**: `text_to_pdf:filename.pdf` (Provide Markdown content)\n\n**CLEAN OUTPUT RULE**: When generating a file, DO NOT show the raw content (CSV/HTML/Markdown) in the readable response. Just provide the specific code block for file generation and a short confirmation message."
        });

        // Prepare history for Gemini
        // Gemini expects: { role: "user" | "model", parts: [{ text: "..." }] }
        const validHistory = history.map(h => ({
            role: h.role === 'ai' ? 'model' : 'user',
            parts: h.parts ? h.parts : [{ text: h.content }]
        }));

        const chat = model.startChat({
            history: validHistory,
        });

        // Prepare message parts (text + files)
        const parts = [];



        // Add context files content
        if (contextFiles && contextFiles.length > 0) {
            for (const file of contextFiles) {
                try {
                    // CASE 1: In-Memory Content (Buffer or String)
                    if (file.content) {
                        const ext = path.extname(file.name).toLowerCase();

                        // PDF In-Memory
                        if (ext === '.pdf') {
                            try {
                                const pdf = require('pdf-parse');
                                const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);

                                // DEBUG: Log PDF Header
                                const header = buffer.slice(0, 100).toString('utf8');
                                console.log(`[Gemini] PDF Header (first 100 bytes): ${header}`);

                                const data = await pdf(buffer);
                                parts.push({ text: `Context from PDF file '${file.name}':\n\`\`\`\n${data.text}\n\`\`\`\n` });
                            } catch (pdfErr) {
                                console.error(`[Gemini] PDF Parse Error for ${file.name}:`, pdfErr);
                                parts.push({ text: `[Error parsing PDF content '${file.name}': ${pdfErr.message}]` });
                            }
                        }
                        // Office In-Memory (Not trivial with office-text-extractor v4 as it expects file path usually)
                        // It supports buffer? verify. The debug script showed 'extractText' method.
                        // Usually receives path. If buffer, we might need temp file fall back logic implemented in `ai.js` (which we did: writes to tempFilePath).
                        // So `file.content` implies IN MEMORY ONLY (failed write to disk).
                        // If writing to disk failed, we cannot use office-text-extractor if it demands a path.
                        // For now, if in-memory and office file, we might fail or need workaround.
                        // But standard flow writes to disk.

                        // Images In-Memory
                        else if (['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'].includes(ext)) {
                            const base64 = Buffer.isBuffer(file.content) ? file.content.toString('base64') : file.content;
                            parts.push({
                                inlineData: {
                                    data: base64,
                                    mimeType: this.getMimeType(ext)
                                }
                            });
                            parts.push({ text: `[Image: ${file.name}]` });
                        }
                        // Default Text (TXT, CS, MD, SVG, HTML, etc)
                        else {
                            const textContent = Buffer.isBuffer(file.content) ? file.content.toString('utf8') : file.content;
                            parts.push({ text: `Context from file '${file.name}':\n\`\`\`\n${textContent}\n\`\`\`\n` });
                        }
                        continue; // Skip path check
                    }

                    // CASE 2: File Path on Disk
                    if (fs.existsSync(file.path)) {
                        const ext = path.extname(file.path).toLowerCase();

                        // Image Handling
                        if (['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'].includes(ext)) {
                            const fileData = fs.readFileSync(file.path);
                            parts.push({
                                inlineData: {
                                    data: fileData.toString('base64'),
                                    mimeType: this.getMimeType(ext)
                                }
                            });
                            parts.push({ text: `[Image: ${file.name}]` });
                        }
                        // Office Documents Handling
                        else if (['.pptx', '.docx', '.xlsx'].includes(ext)) {
                            try {
                                const fileBuffer = fs.readFileSync(file.path);
                                const text = await this.extractTextFromOffice(fileBuffer, ext);
                                console.log(`[Gemini] Extracted ${text.length} chars from Office file: ${file.name}`);
                                parts.push({ text: `Context from ${ext.toUpperCase().substring(1)} file '${file.name}':\n\`\`\`\n${text}\n\`\`\`\n` });
                            } catch (extractErr) {
                                console.error(`Error extracting text from ${file.name}:`, extractErr);
                                parts.push({ text: `[Error reading ${ext} file '${file.name}': ${extractErr.message}]` });
                            }
                        }
                        // PDF Handling
                        else if (ext === '.pdf') {
                            try {
                                const pdf = require('pdf-parse');
                                const dataBuffer = fs.readFileSync(file.path);
                                const data = await pdf(dataBuffer);
                                console.log(`[Gemini] Extracted ${data.text.length} chars from PDF: ${file.name}`);
                                parts.push({ text: `Context from PDF file '${file.name}':\n\`\`\`\n${data.text}\n\`\`\`\n` });
                            } catch (pdfErr) {
                                console.error(`Error extracting text from PDF ${file.name}:`, pdfErr);
                                parts.push({ text: `[Error reading PDF '${file.name}': ${pdfErr.message}]` });
                            }
                        }
                        // Default Text Handling (SVG, CSV, TXT, MD, etc)
                        else {
                            const content = fs.readFileSync(file.path, 'utf8');
                            parts.push({ text: `Context from file '${file.name}':\n\`\`\`\n${content}\n\`\`\`\n` });
                        }
                    }
                } catch (err) {
                    console.error(`Error reading context file ${file.path}:`, err);
                    parts.push({ text: `[Error reading file '${file.name}']` });
                }
            }
        }

        // Add user query
        parts.push({ text: message });

        try {
            const result = await chat.sendMessage(parts);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini Chat Error:", error);
            throw error;
        }
    }

    async extractTextFromOffice(buffer, ext) {
        try {
            const JSZip = require('jszip');
            const zip = await JSZip.loadAsync(buffer);
            let text = '';

            if (ext === '.docx') {
                if (zip.file("word/document.xml")) {
                    const content = await zip.file("word/document.xml").async("string");
                    text = content.replace(/<[^>]+>/g, ' ');
                }
            } else if (ext === '.pptx') {
                const slideFiles = Object.keys(zip.files).filter(f => f.match(/ppt\/slides\/slide\d+\.xml/));
                // Sort slides to maintain order (slide1, slide2...)
                slideFiles.sort((a, b) => {
                    const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                    const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                    return numA - numB;
                });
                for (const slide of slideFiles) {
                    const content = await zip.file(slide).async("string");
                    text += ` [Slide: ${slide}] ` + content.replace(/<[^>]+>/g, ' ') + '\n';
                }
            } else if (ext === '.xlsx') {
                if (zip.file("xl/sharedStrings.xml")) {
                    const content = await zip.file("xl/sharedStrings.xml").async("string");
                    text = content.replace(/<[^>]+>/g, ' ');
                }
                // Optional: Read sheets directly for numbers? SharedStrings is good for text data.
                // For better context, we might want sheet data, but naive XML strip is messy for sheets.
                // Sticking to sharedStrings + basic sheet data if easy?
                // Let's stick to sharedStrings for now as it captures the "text" content.
                // Actually, strict XML stripping of sheets gives a lot of garbage.
            }

            return text.replace(/\s+/g, ' ').trim();
        } catch (e) {
            console.error("Manual Office Extraction Error:", e);
            throw new Error(`Failed to parse ${ext} file manually: ${e.message}`);
        }
    }

    getMimeType(ext) {
        switch (ext) {
            case '.png': return 'image/png';
            case '.jpg': case '.jpeg': return 'image/jpeg';
            case '.webp': return 'image/webp';
            case '.heic': return 'image/heic';
            case '.heif': return 'image/heif';
            default: return 'application/octet-stream';
        }
    }
}

module.exports = new GeminiService();
