import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, List, Image, Type as TypeIcon, Palette, ChevronDown, Calendar, FileSpreadsheet } from 'lucide-react';

interface SimpleRichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    className?: string;
}

const COLORS = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
    '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
    '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
    '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
    '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'
];

const FONT_SIZES = [
    { label: '8', value: '1' },
    { label: '10', value: '2' },
    { label: '12', value: '3' },
    { label: '14', value: '4' },
    { label: '18', value: '5' },
    { label: '24', value: '6' },
    { label: '36', value: '7' },
];

export const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({ value, onChange, className }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isLocked = useRef(false);
    const [savedRange, setSavedRange] = useState<Range | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [currentColor, setCurrentColor] = useState('#000000');
    const [currentFontSize, setCurrentFontSize] = useState('3'); // Default 12pt (3)

    // Close color picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showColorPicker && !(event.target as Element).closest('.color-picker-container')) {
                setShowColorPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showColorPicker]);

    useEffect(() => {
        if (editorRef.current && !isLocked.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            isLocked.current = true;
            onChange(editorRef.current.innerHTML);
            saveSelection();
            setTimeout(() => isLocked.current = false, 100);
        }
    };

    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (editorRef.current?.contains(range.commonAncestorContainer)) {
                setSavedRange(range.cloneRange());

                // Sync Toolbar State
                const size = document.queryCommandValue('fontSize');
                if (size) setCurrentFontSize(size);
            }
        }
    };

    const restoreSelection = () => {
        if (savedRange && window.getSelection) {
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(savedRange);
            }
        } else {
            editorRef.current?.focus();
        }
    };

    const exec = (command: string, value: string = '') => {
        restoreSelection();
        document.execCommand(command, false, value);
        handleInput();
        editorRef.current?.focus();
    };

    const insertDynamic = (type: 'image' | 'text' | 'date' | 'excel', path: string, wildcard: string, styles?: any, isEdit: boolean = false) => {
        // Create the element
        const span = document.createElement('span');
        span.contentEditable = 'false';

        if (type === 'image') {
            span.dataset.dynamicType = 'image';
            span.dataset.path = path;
            span.dataset.wildcard = wildcard;
            span.className = 'dynamic-block-image inline-block mx-1 align-middle select-none cursor-pointer hover:ring-2 hover:ring-blue-300 rounded';
            span.innerHTML = `<img src="https://placehold.co/100x100?text=Dynamic+Image" alt="Dynamic Image: ${wildcard}" style="border: 2px dashed blue; display: block;" />`;
        } else if (type === 'excel') {
            span.dataset.dynamicType = 'excel';
            span.dataset.path = path;
            span.dataset.wildcard = wildcard;

            span.className = 'dynamic-block-excel inline-flex items-center gap-1 select-none cursor-pointer hover:ring-2 hover:ring-green-400 rounded transition-all';
            span.style.cssText = `display: inline-flex; vertical-align: middle; background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 4px 8px; margin: 0 2px; color: #166534; font-size: 12px; font-weight: bold;`;
            span.innerHTML = `<span style="pointer-events: none;">📊 Excel: ${wildcard}</span>`;
        } else if (type === 'date') {
            const styleStr = `color: ${styles?.color || 'black'}; font-size: ${styles?.fontSize || '12pt'}; line-height: ${styles?.lineHeight || '1.2'};`;
            const dateFormat = styles?.dateFormat || 'MM-DD';

            span.dataset.dynamicType = 'date';
            span.dataset.dateFormat = dateFormat;
            if (styles?.color) span.dataset.styleColor = styles.color;
            if (styles?.fontSize) span.dataset.styleSize = styles.fontSize;
            if (styles?.lineHeight) span.dataset.styleLh = styles.lineHeight;

            // Use inline-flex for atomic styling, vertical-align to align with text baseline or middle
            span.className = 'dynamic-block-date inline-flex items-center align-bottom select-none cursor-pointer transition-colors hover:ring-2 hover:ring-purple-300';
            // Explicit inline styles to ensure no block display overrides
            span.style.cssText = `display: inline-flex; vertical-align: text-bottom; white-space: nowrap; background-color: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 4px; padding: 0 4px; margin: 0 2px; font-family: monospace; ${styleStr}`;
            span.textContent = `📅 ${dateFormat}`;
        } else {
            const styleStr = `color: ${styles?.color || 'black'}; font-size: ${styles?.fontSize || '12pt'}; line-height: ${styles?.lineHeight || '1.2'};`;

            span.dataset.dynamicType = 'text';
            span.dataset.path = path;
            span.dataset.wildcard = wildcard;
            if (styles?.color) span.dataset.styleColor = styles.color;
            if (styles?.fontSize) span.dataset.styleSize = styles.fontSize;
            if (styles?.lineHeight) span.dataset.styleLh = styles.lineHeight;

            span.className = 'dynamic-block-text inline-flex items-center gap-1 select-none cursor-pointer hover:bg-blue-100 hover:border-blue-300 transition-colors';
            span.style.cssText = `background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 0.125rem 0.5rem; font-family: monospace; ${styleStr}`;
            span.textContent = `📂 ${wildcard}`;
        }

        // EDIT MODE
        if (isEdit && editorRef.current) {
            const editingBlock = editorRef.current.querySelector('[data-editing="true"]');
            if (editingBlock) {
                editingBlock.replaceWith(span);
                // Move cursor after
                const range = document.createRange();
                range.setStartAfter(span);
                range.collapse(true);
                const sel = window.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                handleInput();
                return;
            }
        }

        // INSERT MODE via Range API (avoids execCommand issues)
        restoreSelection();
        if (savedRange) {
            savedRange.deleteContents();
            savedRange.insertNode(span);

            // Insert a zero-width space or normal space after so cursor is not trapped
            const spacer = document.createTextNode('\u00A0');
            savedRange.setStartAfter(span);
            savedRange.insertNode(spacer);

            // Move caret after the spacer
            savedRange.setStartAfter(spacer);
            savedRange.collapse(true);

            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(savedRange);
            }
            handleInput();
        } else {
            // Fallback if no range (append to end)
            editorRef.current?.appendChild(span);
            handleInput();
        }
    };

    const handleBlockClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const block = target.closest('[data-dynamic-type]') as HTMLElement;
        if (block) {
            e.preventDefault();
            e.stopPropagation();

            // Clean up other marks
            if (editorRef.current) {
                editorRef.current.querySelectorAll('[data-editing]').forEach(el => el.removeAttribute('data-editing'));
            }
            // Mark this block
            block.setAttribute('data-editing', 'true');

            const type = block.getAttribute('data-dynamic-type') as 'image' | 'text' | 'date' | 'excel';
            const path = block.getAttribute('data-path') || '';
            const wildcard = block.getAttribute('data-wildcard') || '';

            const detail: any = { type, path, wildcard, isEdit: true };
            if (type === 'text' || type === 'date') {
                detail.styles = {
                    color: block.getAttribute('data-style-color'),
                    fontSize: block.getAttribute('data-style-size'),
                    lineHeight: block.getAttribute('data-style-lh'),
                    dateFormat: block.getAttribute('data-date-format')
                };
            }

            // Select it visually just in case, but we rely on data-editing now
            const range = document.createRange();
            range.selectNode(block);
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
                setSavedRange(range.cloneRange());
            }

            document.dispatchEvent(new CustomEvent('open-dynamic-modal', { detail }));
        }
    };

    useEffect(() => {
        const handleCustomInsert = (e: CustomEvent) => {
            const { type, path, wildcard, isEdit, ...styles } = e.detail;
            insertDynamic(type, path, wildcard, styles, isEdit);
        };
        document.addEventListener('insert-dynamic-block', handleCustomInsert as EventListener);
        return () => document.removeEventListener('insert-dynamic-block', handleCustomInsert as EventListener);
    }, [savedRange]);

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    return (
        <div className={`border border-slate-300 rounded-lg overflow-hidden flex flex-col ${className || ''} bg-white transition-all focus-within:ring-2 focus-within:ring-blue-100`}>
            {/* Toolbar */}
            <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-1 flex-wrap items-center shadow-sm z-20 relative">
                {/* Basic Formatting */}
                <div className="flex bg-white border border-slate-200 rounded p-0.5">
                    <button onClick={() => exec('bold')} className="p-1.5 hover:bg-slate-100 rounded text-slate-700" title="粗體"><Bold size={16} /></button>
                    <button onClick={() => exec('italic')} className="p-1.5 hover:bg-slate-100 rounded text-slate-700" title="斜體"><Italic size={16} /></button>
                    <button onClick={() => exec('underline')} className="p-1.5 hover:bg-slate-100 rounded text-slate-700" title="底線"><Underline size={16} /></button>
                </div>

                <div className="w-px h-6 bg-slate-300 mx-1"></div>

                {/* Font Size */}
                <div className="relative flex items-center">
                    <select
                        value={currentFontSize}
                        onChange={(e) => {
                            exec('fontSize', e.target.value);
                            setCurrentFontSize(e.target.value);
                        }}
                        className="h-8 border border-slate-300 rounded px-2 text-sm bg-white hover:bg-slate-50 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8 w-20"
                        title="字體大小"
                    >
                        {FONT_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 text-slate-500 pointer-events-none" />
                </div>

                {/* Color Picker */}
                <div className="relative color-picker-container">
                    <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="flex items-center gap-1 border border-slate-300 rounded px-2 h-8 bg-white hover:bg-slate-50"
                        title="文字顏色"
                    >
                        <div className="w-4 h-4 rounded border border-slate-200" style={{ backgroundColor: currentColor }}></div>
                        <ChevronDown size={12} className="text-slate-500" />
                    </button>
                    {showColorPicker && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-300 shadow-xl rounded-lg p-2 w-64 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <div className="mb-2 text-xs font-semibold text-slate-500 px-1">標準色彩</div>
                            <div className="grid grid-cols-10 gap-1">
                                {COLORS.map(color => (
                                    <button
                                        key={color}
                                        className="w-5 h-5 rounded hover:scale-110 transition-transform ring-1 ring-slate-100"
                                        style={{ backgroundColor: color }}
                                        onClick={() => {
                                            setCurrentColor(color);
                                            exec('foreColor', color);
                                            setShowColorPicker(false);
                                        }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-6 bg-slate-300 mx-1"></div>

                {/* Lists */}
                <div className="flex bg-white border border-slate-200 rounded p-0.5">
                    <button onClick={() => exec('insertOrderedList')} className="p-1.5 hover:bg-slate-100 rounded text-slate-700" title="有序列表"><List size={16} /></button>
                    <button onClick={() => exec('insertUnorderedList')} className="p-1.5 hover:bg-slate-100 rounded text-slate-700" title="無序列表"><List size={16} /></button>
                </div>

                <div className="flex-1"></div>

                {/* Dynamic Content */}
                <div className="flex gap-2">
                    <button
                        onMouseDown={(e) => { e.preventDefault(); saveSelection(); document.dispatchEvent(new CustomEvent('open-dynamic-modal', { detail: { type: 'image' } })); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-xs font-bold hover:bg-blue-100 transition-colors shadow-sm"
                    >
                        <Image size={14} /> 插入動態圖片
                    </button>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); saveSelection(); document.dispatchEvent(new CustomEvent('open-dynamic-modal', { detail: { type: 'text' } })); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 border border-green-200 rounded-md text-xs font-bold hover:bg-green-100 transition-colors shadow-sm"
                    >
                        <TypeIcon size={14} /> 插入動態文字
                    </button>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); saveSelection(); document.dispatchEvent(new CustomEvent('open-dynamic-modal', { detail: { type: 'date' } })); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-md text-xs font-bold hover:bg-purple-100 transition-colors shadow-sm"
                    >
                        <Calendar size={14} /> 插入動態日期
                    </button>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); saveSelection(); document.dispatchEvent(new CustomEvent('open-dynamic-modal', { detail: { type: 'excel' } })); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md text-xs font-bold hover:bg-emerald-100 transition-colors shadow-sm"
                    >
                        <FileSpreadsheet size={14} /> 插入動態 Excel
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onPaste={handlePaste}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onBlur={saveSelection}
                onClick={handleBlockClick}
                className="flex-1 p-6 outline-none prose prose-slate max-w-none bg-white text-slate-900 overflow-y-auto"
                style={{ lineHeight: '1.6' }}
            />
        </div>
    );
};
