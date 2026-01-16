const database = require('../database');
const driveService = require('./driveService');
const FileScanner = require('./fileScanner');
const HTMLtoDOCX = require('html-to-docx');
const path = require('path');
const fs = require('fs');

class DocGenerator {
    /**
     * Generate a document for a specific template and date.
     * @param {number|string} templateId - The ID of the template.
     * @param {Date} dateTarget - The target date for dynamic folders.
     * @returns {Promise<Buffer>} - The generated DOCX file buffer.
     */
    static async generateDocument(templateId, dateTarget) {
        const db = database.db;
        // 1. Fetch Template and Project
        const template = this.getTemplate(templateId);
        if (!template) throw new Error(`Template not found: ${templateId}`);

        const project = this.getProject(template.project_id);
        if (!project) throw new Error(`Project not found for template: ${templateId}`);
        if (!project.local_path) throw new Error(`Project ${project.name} does not have a local_path configured.`);

        // 2. Prepare Date Folder
        // Format: YYYY-MM-DD
        const year = dateTarget.getFullYear();
        const month = String(dateTarget.getMonth() + 1).padStart(2, '0');
        const day = String(dateTarget.getDate()).padStart(2, '0');
        const dateFolder = `${year}-${month}-${day}`;

        // 3. Resolve Drive Folders
        if (!project.drive_folder_id) throw new Error("Project Google Drive Folder ID not configured.");

        console.log(`[DocGen] Checking Date Folder '${dateFolder}' in Project Folder '${project.drive_folder_id}'...`);

        let driveDateFolderId = null;
        // Check for folder existence ONLY. Do not create.
        try {
            const list = await driveService.listFiles(project.drive_folder_id);
            const foundDateFolder = list.folders.find(f => f.name === dateFolder);

            if (!foundDateFolder) {
                console.warn(`[DocGen] Date folder '${dateFolder}' NOT FOUND.`);
                // Throw specific error to be caught by backend route
                throw new Error(`Date Folder not found: ${dateFolder}`);
            }
            driveDateFolderId = foundDateFolder.id;
            console.log(`[DocGen] Found Date Folder ID: ${driveDateFolderId}`);
        } catch (e) {
            console.error("[DocGen] Folder Resolution Failed:", e);
            throw e;
        }

        // Helper to find file in Drive recursively (Moved to module scope)
        // const findFileInDrive = ... (Removed)

        // 4. Process HTML Content
        let htmlContent = template.content;
        const missingFiles = []; // Track missing files

        // --- EMAIL METADATA INJECTION ---
        // Replace {{date}} or {{date:FORMAT}} in subject
        let subject = template.email_subject || "";
        if (subject) {
            subject = subject.replace(/{{date(:([^}]+))?}}/gi, (match, _, format) => {
                const y = dateTarget.getFullYear();
                const m = String(dateTarget.getMonth() + 1).padStart(2, '0');
                const d = String(dateTarget.getDate()).padStart(2, '0');

                if (format) {
                    // Simple Format Replacer
                    return format
                        .replace('YYYY', y)
                        .replace('MM', m)
                        .replace('DD', d);
                }

                // Default YYYY-MM-DD
                return `${y}-${m}-${d}`;
            });
        }

        const emailMetadata = {
            to: template.email_to || "",
            cc: template.email_cc || "",
            from: template.email_from || "",
            subject: subject
        };

        // Prepend Metadata as HTML Comment
        const metaBlock = `<!-- EMAIL_METADATA_START\n${JSON.stringify(emailMetadata, null, 2)}\nEMAIL_METADATA_END -->\n`;

        // --- VISIBLE METADATA (Added per user request) ---
        htmlContent = metaBlock + htmlContent;

        // Remove contenteditable="false" attributes for clean DOCX
        htmlContent = htmlContent.replace(/contenteditable="false"/gi, "");

        // --- PRE-PROCESSING: Font Sizes & Layout ---
        const sizeMap = {
            '1': '8pt', '2': '10pt', '3': '12pt', '4': '14pt', '5': '18pt', '6': '24pt', '7': '36pt'
        };

        htmlContent = htmlContent.replace(/<font([^>]+)>/gi, (match, attrs) => {
            let style = "";
            const sizeMatch = attrs.match(/size=["']?(\d)["']?/i);
            if (sizeMatch && sizeMap[sizeMatch[1]]) {
                style += `font-size: ${sizeMap[sizeMatch[1]]}; `;
            }
            const colorMatch = attrs.match(/color=["']?([^"'\s>]+)["']?/i);
            if (colorMatch) {
                style += `color: ${colorMatch[1]}; `;
            }
            return `<span style="${style}">`;
        });
        htmlContent = htmlContent.replace(/<\/font>/gi, "</span>");

        // Strip Lists
        htmlContent = htmlContent.replace(/<ul[^>]*>/gi, "<div>");
        htmlContent = htmlContent.replace(/<\/ul>/gi, "</div>");
        htmlContent = htmlContent.replace(/<li[^>]*>/gi, "<br>");
        htmlContent = htmlContent.replace(/<\/li>/gi, "");
        htmlContent = htmlContent.replace(/<ol[^>]*>/gi, "<div>");
        htmlContent = htmlContent.replace(/<\/ol>/gi, "</div>");


        // --- PROCESS DYNAMIC CONTENT ---

        // --- PROCESS DYNAMIC CONTENT ---

        // 1. Process Images (Support both new SPAN wrapper and legacy IMG tag)
        const imageReplacements = [];

        // Pattern A: New Atomic Span Wrapper 
        // <span ... data-dynamic-type="image" ...><img ...></span>
        const spanImgRegex = /<span [^>]*data-dynamic-type=["']image["'][^>]*>.*?<\/span>/gi;

        // Pattern B: Legacy Raw Img Tag 
        // <img ... data-dynamic-type="image" ...>
        const rawImgRegex = /<img [^>]*data-dynamic-type=["']image["'][^>]*>/gi;

        const processImageMatch = async (fullTag, isSpan) => {
            const pathMatch = fullTag.match(/data-path=["']([^"']*)["']/);
            const wildcardMatch = fullTag.match(/data-wildcard=["']([^"']*)["']/);

            if (pathMatch && wildcardMatch) {
                let subPath = pathMatch[1].trim();
                if (subPath.startsWith('/') || subPath.startsWith('\\')) subPath = subPath.substring(1);
                const wildcard = wildcardMatch[1];

                console.log(`[DocGen] [TYPE: IMAGE] Processing Block: Path='${subPath}', Pattern='${wildcard}' (Source: ${isSpan ? 'SPAN' : 'IMG'})`);

                // User explicitly mentioned expecting to find it in "IO" if configured.
                // We trust the subPath from the tag data.

                const fileId = await findFileInDrive(driveDateFolderId, subPath, wildcard);

                if (fileId) {
                    try {
                        console.log(`[DocGen] [TYPE: IMAGE] Downloading ID: ${fileId}...`);
                        const buffer = await driveService.getFileContent(fileId);
                        console.log(`[DocGen] [TYPE: IMAGE] Downloaded. Size: ${buffer.length} bytes`);

                        const base64Image = buffer.toString('base64');
                        let mimeType = 'image/jpeg';
                        if (wildcard.toLowerCase().includes('.png')) mimeType = 'image/png';

                        // Use CSS for styling to preserve aspect ratio in HTML
                        const newImgTag = `<img src="data:${mimeType};base64,${base64Image}" style="max-width: 100%; height: auto;" />`;
                        return { original: fullTag, new: newImgTag };
                    } catch (err) {
                        console.error(`[DocGen] [TYPE: IMAGE] Failed to download ${fileId}:`, err);
                    }
                } else {
                    console.warn(`[DocGen] [TYPE: IMAGE] SKIPPING: File not found for pattern '${wildcard}' in '${subPath}'.`);
                    missingFiles.push(`Image: ${subPath}/${wildcard}`);
                }
            } else {
                console.warn(`[DocGen] [TYPE: IMAGE] Invalid format: ${fullTag}`);
            }
            return null;
        };

        // Execute Pattern A (Spans)
        let match;
        while ((match = spanImgRegex.exec(htmlContent)) !== null) {
            const result = await processImageMatch(match[0], true);
            if (result) imageReplacements.push(result);
        }

        // Execute Pattern B (Legacy Imgs) - Only if not already replaced?
        // Actually, if we replaced spans they are gone from string? No, we iterate string first.
        // But wait, the rawImgRegex might match the img INSIDE the span if we are not careful.
        // However, we plan to replace the WHOLE span.
        // Safest is to do Span replacement first, update htmlContent, then do Img replacement?
        // Or just collect all replacements and apply. But overlaps are tricky.
        // Let's do Span first, Apply, then Img.

        // APPLY SPAN REPLACEMENTS
        for (const rep of imageReplacements) {
            htmlContent = htmlContent.replace(rep.original, rep.new);
        }

        // NOW check for remaining raw images (that weren't inside the replaced spans)
        const legacyReplacements = [];
        while ((match = rawImgRegex.exec(htmlContent)) !== null) {
            // Ensure this img wasn't part of a span we just handled (though replace logic should handle it)
            // If the span was replaced, the img tag inside is gone.
            // So we can safely run this on the *updated* htmlContent.
            const result = await processImageMatch(match[0], false);
            if (result) legacyReplacements.push(result);
        }

        // APPLY LEGACY REPLACEMENTS
        for (const rep of legacyReplacements) {
            htmlContent = htmlContent.replace(rep.original, rep.new);
        }

        // Process Text
        // Text Wrapper: <span ... data-dynamic-type="text" ...>...</span>
        const textWrapperRegex = /<span [^>]*data-dynamic-type=["']text["'][^>]*>.*?<\/span>/gi;
        const textReplacements = [];

        while ((match = textWrapperRegex.exec(htmlContent)) !== null) {
            const fullSpan = match[0];
            const pathMatch = fullSpan.match(/data-path=["']([^"']*)["']/);
            const wildcardMatch = fullSpan.match(/data-wildcard=["']([^"']*)["']/);

            const colorMatch = fullSpan.match(/data-style-color=["']([^"']*)["']/);
            const sizeMatch = fullSpan.match(/data-style-size=["']([^"']*)["']/);
            const lhMatch = fullSpan.match(/data-style-lh=["']([^"']*)["']/);

            if (pathMatch && wildcardMatch) {
                let subPath = pathMatch[1].trim();
                if (subPath.startsWith('/') || subPath.startsWith('\\')) subPath = subPath.substring(1);
                const wildcard = wildcardMatch[1];

                const fileId = await findFileInDrive(driveDateFolderId, subPath, wildcard);

                if (fileId) {
                    try {
                        const buffer = await driveService.getFileContent(fileId);
                        let textContent = buffer.toString('utf-8');
                        textContent = textContent
                            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                            .replace(/\r\n/g, "<br>").replace(/\n/g, "<br>");

                        const color = colorMatch ? colorMatch[1] : 'black';
                        const fontSize = sizeMatch ? sizeMatch[1] : '12pt';
                        const lineHeight = lhMatch ? lhMatch[1] : '1.2';

                        // Apply the styles to the NEW span that contains the text
                        // CHANGED: Removed display: block to allow inline text flow
                        const styledSpan = `<span style="color: ${color}; font-size: ${fontSize}; line-height: ${lineHeight};">${textContent}</span>`;
                        textReplacements.push({ original: fullSpan, new: styledSpan });

                    } catch (err) {
                        console.error(`Failed to download text file ${fileId}:`, err);
                        missingFiles.push(`Text (Download Error): ${subPath}/${wildcard}`);
                    }
                } else {
                    missingFiles.push(`Text: ${subPath}/${wildcard}`);
                }
            }
        }

        for (const rep of textReplacements) {
            htmlContent = htmlContent.replace(rep.original, rep.new);
        }

        // Process Excel
        // Excel Wrapper: <span ... data-dynamic-type="excel" ...>...</span>
        const excelWrapperRegex = /<span [^>]*data-dynamic-type=["']excel["'][^>]*>.*?<\/span>/gi;
        const excelReplacements = [];

        while ((match = excelWrapperRegex.exec(htmlContent)) !== null) {
            const fullSpan = match[0];
            const pathMatch = fullSpan.match(/data-path=["']([^"']*)["']/);
            const wildcardMatch = fullSpan.match(/data-wildcard=["']([^"']*)["']/);

            if (pathMatch && wildcardMatch) {
                let subPath = pathMatch[1].trim();
                if (subPath.startsWith('/') || subPath.startsWith('\\')) subPath = subPath.substring(1);
                const wildcard = wildcardMatch[1];

                const fileId = await findFileInDrive(driveDateFolderId, subPath, wildcard);

                if (fileId) {
                    try {
                        const buffer = await driveService.getFileContent(fileId);

                        // Parse Excel with ExcelJS
                        console.log("[DocGen] VERSION: EXCELJS-DEBUG-3 (Active)");
                        // Also redefine logDebug to use this path
                        const logDebug = (msg) => { console.log(`[ExcelJS Debug] ${msg}`); };
                        const ExcelJS = require('exceljs');
                        const workbook = new ExcelJS.Workbook();
                        await workbook.xlsx.load(buffer);

                        const worksheet = workbook.worksheets[0];

                        // Helper to resolve colors (ARGB or Theme)
                        const resolveColor = (colorObj) => {
                            if (!colorObj) return null;
                            if (colorObj.argb) {
                                // ARGB to Hex (strip Alpha if starts with FF, else keep)
                                let argb = colorObj.argb;
                                if (argb.length === 8) return '#' + argb.substring(2);
                                return '#' + argb;
                            }
                            if (colorObj.theme !== undefined) {
                                // Basic Theme Map (Standard Office)
                                const themes = {
                                    0: '#FFFFFF', 1: '#000000', 2: '#E7E6E6', 3: '#44546A',
                                    4: '#4472C4', 5: '#ED7D31', 6: '#A5A5A5', 7: '#FFC000',
                                    8: '#5B9BD5', 9: '#70AD47'
                                };
                                return themes[colorObj.theme] || '#000000';
                            }
                            return null;
                        };

                        if (worksheet) {
                            // 1. Map Images to Cells
                            const imageMap = {}; // "row,col" -> html_string
                            if (worksheet.getImages) {
                                const images = worksheet.getImages();
                                console.log(`[DocGen] Found ${images.length} images in ${wildcard}`);
                                logDebug(`Found ${images.length} images in ${wildcard}`);

                                for (const img of images) {
                                    try {
                                        // Safe Log
                                        const rangeStr = (img.range) ?
                                            `tl:[${img.range.tl?.nativeRow},${img.range.tl?.nativeCol}]-${img.range.tl?.row},${img.range.tl?.col}` : 'N/A';

                                        logDebug(`Processing Img ID: ${img.imageId}, Type: ${img.type}, Range: ${rangeStr}`);

                                        // 1. Get Image Content
                                        let imgBuffer = null;
                                        let extension = 'png';

                                        // Try standard API
                                        if (workbook.getImage) {
                                            const imgData = workbook.getImage(img.imageId);
                                            if (imgData) {
                                                imgBuffer = imgData.buffer;
                                                extension = imgData.extension || 'png';
                                                logDebug(`  -> Got Buffer via getImage (${imgBuffer.length} bytes)`);
                                            } else {
                                                logDebug(`  -> getImage(${img.imageId}) returned null`);
                                            }
                                        }

                                        // Fallback to model.media lookup if needed
                                        if (!imgBuffer && workbook.model && workbook.model.media) {
                                            const media = workbook.model.media.find(m => m.index === img.imageId);
                                            if (media) {
                                                imgBuffer = media.buffer;
                                                extension = media.extension || 'png';
                                                logDebug(`  -> Got Buffer via model.media (${imgBuffer.length} bytes)`);
                                            }
                                        }

                                        if (imgBuffer) {
                                            // 2. Determine Position
                                            // Handling different property names for row/col
                                            let r = -1, c = -1;

                                            // ExcelJS range usually has tl (top-left) and br (bottom-right)
                                            // We prefer 'nativeRow'/'nativeCol' (0-indexed) if available, else 'row'/'col'
                                            if (img.range && img.range.tl) {
                                                // Check for native props first
                                                if (img.range.tl.nativeRow !== undefined) r = img.range.tl.nativeRow;
                                                else if (img.range.tl.row !== undefined) r = img.range.tl.row;

                                                if (img.range.tl.nativeCol !== undefined) c = img.range.tl.nativeCol;
                                                else if (img.range.tl.col !== undefined) c = img.range.tl.col;
                                            }

                                            logDebug(`  -> Resolved r=${r}, c=${c}`);

                                            if (r >= 0 && c >= 0) {
                                                // We use 0-indexed keys for map
                                                const key = `${Math.floor(r)},${Math.floor(c)}`;

                                                const b64 = imgBuffer.toString('base64');
                                                const mime = extension === 'png' ? 'image/png' : 'image/jpeg';

                                                const imgTag = `<div style="margin: 2px;"><img src="data:${mime};base64,${b64}" style="max-width: 100%; height: auto; display: block;" /></div>`;
                                                imageMap[key] = (imageMap[key] || "") + imgTag;

                                                console.log(`[DocGen] Mapped Image ${img.imageId} at [${r},${c}]`);
                                                logDebug(`  -> Mapped Image ${img.imageId} at [${r},${c}] key=${key}`);
                                            } else {
                                                logDebug(`  -> SKIPPED: Invalid coords r=${r}, c=${c}`);
                                            }
                                        } else {
                                            logDebug(`  -> SKIPPED: No Buffer found for ID ${img.imageId}`);
                                        }
                                    } catch (imgErr) {
                                        console.warn(`[DocGen] Failed to process image ${img.imageId}:`, imgErr);
                                        logDebug(`  -> ERROR: ${imgErr.message}`);
                                    }
                                }
                            }

                            // 2. Build HTML Table
                            let html = '<table style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 10pt; border: 1px solid #ddd;">';

                            // Initialize dimensions with data bounds
                            let maxRow = worksheet.rowCount;
                            let maxCol = worksheet.columnCount;

                            // Update dimensions based on image positions
                            // imageMap keys are "r,c" (0-indexed)
                            Object.keys(imageMap).forEach(k => {
                                const [ir, ic] = k.split(',').map(Number);
                                if (ir + 1 > maxRow) maxRow = ir + 1;
                                if (ic + 1 > maxCol) maxCol = ic + 1;
                            });

                            // If maxCol is still 0 (empty sheet with no images?), default to something or skip?
                            // If maxRow is 0, loop won't run.

                            logDebug(`Building Table: maxRow=${maxRow}, maxCol=${maxCol}`);

                            // Iterate rows 1 to maxRow
                            for (let r = 1; r <= maxRow; r++) {
                                html += '<tr>';
                                const row = worksheet.getRow(r);

                                // Reset maxC for this row? 
                                // To make a grid, valid HTML tables usually should have same number of cells per row,
                                // or use colspan. But simple grid is checking global maxCol.
                                // However, row.cellCount gives us data range.
                                // If we want a uniform grid, we should loop to maxCol.
                                // If we want sparse, we might miss the image if it is beyond cellCount.
                                // Let's loop to maxCol to guarantee coverage.

                                for (let c = 1; c <= maxCol; c++) {
                                    const cell = row.getCell(c);

                                    // STYLE
                                    let style = "border: 1px solid #ddd; padding: 4px; vertical-align: top;";

                                    // Background
                                    if (cell.fill && cell.fill.type === 'pattern' && cell.fill.fgColor) {
                                        const bg = resolveColor(cell.fill.fgColor);
                                        if (bg) style += `background-color: ${bg}; `;
                                    }

                                    // Font
                                    if (cell.font) {
                                        if (cell.font.bold) style += "font-weight: bold; ";
                                        if (cell.font.italic) style += "font-style: italic; ";
                                        if (cell.font.size) style += `font-size: ${cell.font.size}pt; `;
                                        if (cell.font.color) {
                                            const fc = resolveColor(cell.font.color);
                                            if (fc) style += `color: ${fc}; `;
                                        }
                                    }

                                    html += `<td style="${style}">`;

                                    // 1. Layout Image - r is 1-indexed, c is 1-indexed
                                    // Map uses 0-indexed keys
                                    const imgKey = `${r - 1},${c - 1}`;
                                    if (imageMap[imgKey]) {
                                        html += imageMap[imgKey];
                                        logDebug(`  -> Inserting Image at Row ${r}, Col ${c}`);
                                    }

                                    // 2. Text
                                    let text = "";
                                    if (cell.value !== null && cell.value !== undefined) {
                                        if (typeof cell.value === 'object' && cell.value.richText) {
                                            text = cell.value.richText.map(rt => rt.text).join('');
                                        } else if (typeof cell.value === 'object' && cell.value.text) {
                                            text = cell.value.text;
                                        } else {
                                            text = String(cell.value);
                                        }
                                    }

                                    if (text) text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
                                    html += text;

                                    html += '</td>';
                                }
                                html += '</tr>';
                            }

                            html += '</table>';

                            excelReplacements.push({ original: fullSpan, new: html });

                        } else {
                            missingFiles.push(`Excel (Empty): ${subPath}/${wildcard}`);
                        }

                    } catch (err) {
                        console.error(`Failed to download/parse excel file ${fileId} with ExcelJS:`, err);
                        missingFiles.push(`Excel (Download Error): ${subPath}/${wildcard}`);
                    }
                } else {
                    missingFiles.push(`Excel: ${subPath}/${wildcard}`);
                }
            }
        }

        for (const rep of excelReplacements) {
            htmlContent = htmlContent.replace(rep.original, rep.new);
        }

        // PRE-PROCESSING: Token-Based Cleanup to force Inline
        // 1. Extract Date Spans and mask them
        const preDateRegex = /<span [^>]*data-dynamic-type=["']date["'][^>]*>.*?<\/span>/gi;
        const dateMatches = htmlContent.match(preDateRegex) || [];

        dateMatches.forEach((spanHtml, index) => {
            // Use a specific token that won't conflict. 
            // Note: replace only replaces the first instance, which is what we want if we iterate correctly, 
            // but if duplicate spans exist, consistent ordering matters.
            // Using split/join or safer replace is better if duplicates exist, but here spans are likely unique by content/attributes.
            htmlContent = htmlContent.replace(spanHtml, `___DATE_TOKEN_${index}___`);
        });

        if (dateMatches.length > 0) {
            // 2. Aggressively strip block tags around the tokens
            // Remove closing/opening divs/ps/brs immediately before the token
            // We replace with a space to ensure word separation
            htmlContent = htmlContent.replace(/(?:<\/?(?:div|p|br)[^>]*>\s*)+(___DATE_TOKEN_\d+___)/gi, ' $1');

            // Remove closing/opening divs/ps/brs immediately after the token
            htmlContent = htmlContent.replace(/(___DATE_TOKEN_\d+___)(?:\s*<\/?(?:div|p|br)[^>]*>)+/gi, '$1 ');

            // 3. Restore Spans
            dateMatches.forEach((spanHtml, index) => {
                htmlContent = htmlContent.replace(`___DATE_TOKEN_${index}___`, spanHtml);
            });
        }

        // Date Wrapper: <span ... data-dynamic-type="date" ...>...</span>
        const dateWrapperRegex = /<span [^>]*data-dynamic-type=["']date["'][^>]*>.*?<\/span>/gi;
        const dateReplacements = [];

        while ((match = dateWrapperRegex.exec(htmlContent)) !== null) {
            const fullSpan = match[0];
            const dateFormatMatch = fullSpan.match(/data-date-format=["']([^"']*)["']/);
            const colorMatch = fullSpan.match(/data-style-color=["']([^"']*)["']/);
            const sizeMatch = fullSpan.match(/data-style-size=["']([^"']*)["']/);
            const lhMatch = fullSpan.match(/data-style-lh=["']([^"']*)["']/);

            if (dateFormatMatch) {
                const format = dateFormatMatch[1]; // e.g., 'MM-DD', 'YYYY-MM-DD'
                let dateStr = '';

                // Simple Date Formatting logic
                const y = dateTarget.getFullYear();
                const m = String(dateTarget.getMonth() + 1).padStart(2, '0');
                const d = String(dateTarget.getDate()).padStart(2, '0');

                // We can support specific tokens like YYYY, MM, DD
                if (format.includes('YYYY') || format.includes('MM') || format.includes('DD')) {
                    dateStr = format
                        .replace('YYYY', y)
                        .replace('MM', m)
                        .replace('DD', d);
                } else {
                    // Fallback to simple logic if not token based
                    if (format === 'MM-DD') dateStr = `${m}-${d}`;
                    else if (format === 'YYYY-MM-DD') dateStr = `${y}-${m}-${d}`;
                    else dateStr = `${y}/${m}/${d}`; // Default
                }

                const color = colorMatch ? colorMatch[1] : 'black';
                let fontSize = sizeMatch ? sizeMatch[1] : '12pt';
                // Append 'pt' if unit is missing
                if (fontSize && /^\d+$/.test(fontSize)) {
                    fontSize += 'pt';
                }
                const lineHeight = lhMatch ? lhMatch[1] : '1.2';

                // Render as inline span
                const styledSpan = `<span style="color: ${color}; font-size: ${fontSize}; line-height: ${lineHeight};">${dateStr}</span>`;
                dateReplacements.push({ original: fullSpan, new: styledSpan });
            }
        }

        for (const rep of dateReplacements) {
            htmlContent = htmlContent.replace(rep.original, rep.new);
        }

        // 5. Generate DOCX
        const fs = require('fs');
        const path = require('path');
        // Write to project root
        const debugPath = path.join(__dirname, '../../debug_output.html');
        try { fs.writeFileSync(debugPath, htmlContent); } catch (e) { console.error('Debug write failed', e); }
        console.log(`[DocGen] Debug HTML written to: ${debugPath}`);

        // 5. Generate Output (HTML)
        // CHANGED: User requested HTML output for email compatibility

        // Append Completeness Status
        const statusComment = `\n<!-- DOCUMENT_COMPLETENESS_STATUS: ${missingFiles.length === 0 ? 'COMPLETE' : 'INCOMPLETE'} -->`;
        const missingComment = `\n<!-- MISSING_FILES: ${JSON.stringify(missingFiles)} -->`;

        // --- VISIBLE ALERTS (Added per user request) ---
        if (missingFiles.length > 0) {
            const warningBlock = `
                <div style="margin-top: 30px; padding: 15px; background-color: #fff4f4; border: 1px solid #ffcccc; border-radius: 4px; font-family: sans-serif;">
                    <h3 style="color: #cc0000; margin-top: 0;">⚠️ Document Incomplete: Missing Files</h3>
                    <ul style="color: #cc0000;">
                        ${missingFiles.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                    <p style="font-size: 12px; color: #666;">Please check the source folder for the missing files or update the template configuration.</p>
                </div>
            `;
            htmlContent += warningBlock;
        }


        htmlContent += statusComment + missingComment;

        // Ensure full structure for email
        if (!/<html>/i.test(htmlContent)) {
            htmlContent = `<!DOCTYPE html><html><body>${htmlContent}</body></html>`;
        }

        const fileBuffer = Buffer.from(htmlContent);

        // 6. Filename & Upload
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const filename = `${template.name.replace(/[^a-z0-9]/gi, '_')}_${dateFolder}_${timeStr}.html`;

        console.log(`[DocGen] Generated. Uploading to Drive (ID: ${driveDateFolderId})...`);

        let driveId = null;
        try {
            const base64Content = fileBuffer.toString('base64');
            driveId = await driveService.uploadFile(base64Content, filename, 'text/html', driveDateFolderId);
            console.log(`[DocGen] Upload Success, File ID: ${driveId}`);

            // 7. Insert into Local Database (File Visibility)
            try {
                const db = database.db;
                console.log(`[DocGen] Inserting into 'files' table...`);

                // We need to resolve the DB Folder ID (Integer) from the Drive Folder ID
                // The sync service or previous logic might have created this folder.
                // If it doesn't exist in DB, we should probably create it or put it in root?
                // Ideally, Sync runs and creates folders. But here we might be ahead of sync.
                // Let's try to find it.
                const folderRow = db.prepare("SELECT id FROM folders WHERE drive_folder_id = ?").get(driveDateFolderId);
                let dbFolderId = folderRow ? folderRow.id : null;

                // If folder doesn't exist in DB, we should probably just use NULL (Root) 
                // OR create a placeholder logic? For now, NULL if not synced yet.
                // Or better: The file is in a Date Folder. If that date folder isn't in DB,
                // the file will appear in "Root" or "Unsorted" if we use NULL.
                // Let's leave it as NULL (Root) if not found, to avoid complex recursion here.

                const uploaderId = 0;

                db.prepare(`INSERT INTO files (project_id, filename, drive_file_id, mime_type, size, uploader_id, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
                    template.project_id,
                    filename,
                    driveId,
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    fileBuffer.length,
                    uploaderId,
                    dbFolderId
                );
                console.log(`[DocGen] Database Record Created for '${filename}' in DB Folder ID: ${dbFolderId}`);
            } catch (dbErr) {
                console.error(`[DocGen] Failed to insert file record into DB:`, dbErr);
                // We don't throw here, because the file WAS generated and uploaded. 
                // It just might need a manual sync to show up.
            }

        } catch (e) {
            console.error("[DocGen] Drive Upload Failed:", e);
            throw e;
        }

        return {
            path: "Google Drive Only",
            filename,
            driveFolderId: driveDateFolderId,
            driveFileId: driveId,
            complete: missingFiles.length === 0,
            missing: missingFiles,
            htmlContent,
            emailMetadata
        };
    }

    static getTemplate(id) {
        const db = database.db;
        const stmt = db.prepare("SELECT * FROM templates WHERE id = ?");
        const res = stmt.get(id);
        return res;
    }

    static getProject(id) {
        const db = database.db;
        const stmt = db.prepare("SELECT * FROM projects WHERE id = ?");
        const res = stmt.get(id);
        return res;
    }
    static async validateTemplate(templateId, dateTarget) {
        // 1. Setup Context (Similar to generate)
        const template = this.getTemplate(templateId);
        if (!template) throw new Error("Template not found");
        const project = this.getProject(template.project_id);
        if (!project || !project.drive_folder_id) throw new Error("Project not configured");

        const year = dateTarget.getFullYear();
        const month = String(dateTarget.getMonth() + 1).padStart(2, '0');
        const day = String(dateTarget.getDate()).padStart(2, '0');
        const dateFolder = `${year}-${month}-${day}`;

        // Resolve Date Folder
        let driveDateFolderId = null;
        try {
            const list = await driveService.listFiles(project.drive_folder_id);
            const found = list.folders.find(f => f.name === dateFolder);
            if (!found) return { complete: false, missing: [`Date Folder '${dateFolder}' not found`] };
            driveDateFolderId = found.id;
        } catch (e) {
            return { complete: false, missing: [`Drive Error: ${e.message}`] };
        }

        const missing = [];
        const htmlContent = template.content;

        // Check Images
        const spanImgRegex = /<span [^>]*data-dynamic-type=["']image["'][^>]*>.*?<\/span>/gi;
        const rawImgRegex = /<img [^>]*data-dynamic-type=["']image["'][^>]*>/gi;

        // Check Text
        const textWrapperRegex = /<span [^>]*data-dynamic-type=["']text["'][^>]*>.*?<\/span>/gi;

        // Check Excel
        const excelWrapperRegex = /<span [^>]*data-dynamic-type=["']excel["'][^>]*>.*?<\/span>/gi;

        const checkTag = async (fullTag, type) => {
            const pathMatch = fullTag.match(/data-path=["']([^"']*)["']/);
            const wildcardMatch = fullTag.match(/data-wildcard=["']([^"']*)["']/);
            if (pathMatch && wildcardMatch) {
                let subPath = pathMatch[1].trim();
                if (subPath.startsWith('/') || subPath.startsWith('\\')) subPath = subPath.substring(1);
                const wildcard = wildcardMatch[1];

                const fileId = await findFileInDrive(driveDateFolderId, subPath, wildcard);
                if (!fileId) {
                    missing.push(`Missing ${type}: ${subPath}/${wildcard}`);
                }
            }
        };

        const promises = [];
        let match;

        // Scan all tags
        while ((match = spanImgRegex.exec(htmlContent)) !== null) promises.push(checkTag(match[0], 'Image'));
        while ((match = rawImgRegex.exec(htmlContent)) !== null) promises.push(checkTag(match[0], 'Image'));
        while ((match = textWrapperRegex.exec(htmlContent)) !== null) promises.push(checkTag(match[0], 'Text'));
        while ((match = excelWrapperRegex.exec(htmlContent)) !== null) promises.push(checkTag(match[0], 'Excel'));

        await Promise.all(promises);

        await Promise.all(promises);

        return {
            complete: missing.length === 0,
            missing: missing
        };
    }
}

// Module Scope Helper
const findFileInDrive = async (rootFolderId, relativePath, wildcardPattern) => {
    // console.log(`[DocGen] findFileInDrive: Root=${rootFolderId}, Path=${relativePath}, Pattern=${wildcardPattern}`);
    let currentFolderId = rootFolderId;
    const pathParts = relativePath ? relativePath.split(/[/\\]/).filter(p => p.trim() !== '') : [];

    for (const part of pathParts) {
        const list = await driveService.listFiles(currentFolderId);
        const sub = list.folders.find(f => f.name.toLowerCase() === part.toLowerCase());
        if (sub) {
            currentFolderId = sub.id;
        } else {
            return null;
        }
    }

    const list = await driveService.listFiles(currentFolderId);
    const regexStr = "^" + wildcardPattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$";
    const regex = new RegExp(regexStr, "i");

    const match = list.files.find(f => regex.test(f.name));
    return match ? match.id : null;
};

module.exports = DocGenerator;
