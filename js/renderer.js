/**
 * 卡片渲染器
 * 使用 marked.js 渲染 Markdown，KaTeX 渲染数学公式，highlight.js 代码高亮
 */

const AppRenderer = (function() {
    // 卡片尺寸常量
    const CARD_WIDTH = 1080;
    const CARD_HEIGHT = 1800;
    const CONTENT_MAX_HEIGHT = 1500; // 内容区域最大高度（留出头尾空间）
    
    // 存储对话数据
    let conversations = [];
    let allCards = []; // 包含封面和所有内容卡片
    let currentCardIndex = 0;
    
    /**
     * 初始化渲染器
     */
    function init() {
        configureMarked();
        bindNavigationButtons();
        bindPreviewButton();
    }
    
    /**
     * 配置 marked.js
     */
    function configureMarked() {
        if (typeof marked === 'undefined') {
            console.error('marked.js 未加载');
            return;
        }
        
        // 自定义渲染器
        const renderer = new marked.Renderer();
        
        // 代码块渲染
        renderer.code = function(code, language) {
            // 处理 marked v12+ 的参数格式
            if (typeof code === 'object') {
                language = code.lang;
                code = code.text;
            }
            
            let highlighted = code;
            if (typeof hljs !== 'undefined' && language && hljs.getLanguage(language)) {
                try {
                    highlighted = hljs.highlight(code, { language }).value;
                } catch (e) {
                    console.warn('代码高亮失败:', e);
                }
            }
            return `<pre><code class="hljs language-${language || 'plaintext'}">${highlighted}</code></pre>`;
        };
        
        marked.setOptions({
            renderer: renderer,
            gfm: true,
            breaks: true
        });
    }
    
    /**
     * 绑定导航按钮
     */
    function bindNavigationButtons() {
        const prevBtn = document.getElementById('prev-card');
        const nextBtn = document.getElementById('next-card');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentCardIndex > 0) {
                    renderPreview(currentCardIndex - 1);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentCardIndex < allCards.length - 1) {
                    renderPreview(currentCardIndex + 1);
                }
            });
        }
    }
    
    /**
     * 绑定预览按钮
     */
    function bindPreviewButton() {
        const previewBtn = document.getElementById('preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                generateAllCards();
                renderPreview(0);
            });
        }
    }
    
    /**
     * 设置对话数据
     */
    function setConversations(convs) {
        conversations = convs;
        generateAllCards();
    }
    
    /**
     * 生成所有卡片（包含封面和分页）
     */
    function generateAllCards() {
        allCards = [];
        
        // 检查是否需要封面
        const exportCover = document.getElementById('export-cover');
        if (exportCover && exportCover.checked) {
            allCards.push({
                type: 'cover',
                role: 'cover'
            });
        }
        
        // 获取选中的对话
        const selectedConvs = getSelectedConversations();
        
        // 为每个对话生成卡片（暂不分页，后续可扩展）
        selectedConvs.forEach((conv, index) => {
            allCards.push({
                type: 'content',
                role: conv.role,
                content: conv.content,
                index: index,
                page: 1,
                totalPages: 1
            });
        });
        
        updateNavigationState();
    }
    
    /**
     * 获取选中的对话
     */
    function getSelectedConversations() {
        const checkboxes = document.querySelectorAll('#conversation-list input[type="checkbox"]:checked');
        const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.convIndex));
        return indices.map(i => conversations[i]).filter(Boolean);
    }
    
    /**
     * 渲染预览卡片
     */
    function renderPreview(index) {
        if (allCards.length === 0) {
            generateAllCards();
        }
        
        if (index < 0 || index >= allCards.length) return;
        
        currentCardIndex = index;
        const card = allCards[index];
        const previewContainer = document.getElementById('card-preview');
        
        if (!previewContainer) return;
        
        let cardHtml = '';
        
        if (card.type === 'cover') {
            cardHtml = renderCoverCard();
        } else {
            cardHtml = renderContentCard(card);
        }
        
        previewContainer.innerHTML = cardHtml;
        
        // 渲染数学公式
        renderMath(previewContainer);
        
        // 更新导航状态
        updateNavigationState();
    }
    
    /**
     * 渲染封面卡片
     */
    function renderCoverCard() {
        const volNumber = document.getElementById('vol-number')?.value || '1';
        const topicTag = document.getElementById('topic-tag')?.value || '';
        const coverTitle = document.getElementById('cover-title')?.value || '与AI的深度对话';
        const coverSubtitle = document.getElementById('cover-subtitle')?.value || '';
        
        return `
            <div class="card cover" style="width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px;">
                <div class="card-header">
                    <span class="series-tag">#与AI对话 Vol.${volNumber}</span>
                    ${topicTag ? `<span class="topic-tag">#${topicTag}</span>` : ''}
                </div>
                <div class="cover-content">
                    <div class="series-badge">#与AI对话 Vol.${volNumber}</div>
                    <div class="quote-box">
                        <div class="quote-text">${escapeHtml(coverTitle)}</div>
                        ${coverSubtitle ? `<div class="subtitle">── ${escapeHtml(coverSubtitle)} ──</div>` : ''}
                    </div>
                    <div class="participants">
                        <span class="gemini-mark">✦ Gemini</span>
                        <span> × </span>
                        <span class="user-mark">User</span>
                    </div>
                    <div class="cover-signature">@Vanilla</div>
                </div>
            </div>
        `;
    }
    
    /**
     * 渲染内容卡片
     */
    function renderContentCard(card) {
        const volNumber = document.getElementById('vol-number')?.value || '1';
        const topicTag = document.getElementById('topic-tag')?.value || '';
        
        const roleName = card.role === 'user' ? 'User' : 'Gemini';
        const pageIndicator = card.totalPages > 1 ? `${card.page}/${card.totalPages}` : '';
        const continuationHint = card.page > 1 ? '<div class="continuation-hint">（接上页）</div>' : '';
        
        // 渲染 Markdown 内容
        const renderedContent = renderMarkdown(card.content);
        
        return `
            <div class="card ${card.role}" style="width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px;">
                <div class="card-header">
                    <span class="series-tag">#与AI对话 Vol.${volNumber}</span>
                    ${topicTag ? `<span class="topic-tag">#${topicTag}</span>` : ''}
                </div>
                <div class="card-body">
                    <div class="role-header">
                        <span class="role-name">${roleName}</span>
                        ${pageIndicator ? `<span class="page-indicator">${pageIndicator}</span>` : ''}
                    </div>
                    <div class="card-content">
                        ${continuationHint}
                        <div class="markdown-body">
                            ${renderedContent}
                        </div>
                        <div class="inline-signature">@Vanilla</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 渲染 Markdown 内容
     */
    function renderMarkdown(content) {
        if (typeof marked === 'undefined') {
            return escapeHtml(content);
        }
        
        // 预处理：保护数学公式
        let processed = content;
        const mathBlocks = [];
        let mathIndex = 0;
        
        // 保护块级公式 $$...$$
        processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            mathBlocks.push({ type: 'block', formula: formula.trim() });
            return `%%MATH_BLOCK_${mathIndex++}%%`;
        });
        
        // 保护行内公式 $...$
        processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
            mathBlocks.push({ type: 'inline', formula: formula.trim() });
            return `%%MATH_INLINE_${mathIndex++}%%`;
        });
        
        // 渲染 Markdown
        let html = marked.parse(processed);
        
        // 还原数学公式
        mathIndex = 0;
        html = html.replace(/%%MATH_BLOCK_(\d+)%%/g, (match, idx) => {
            const math = mathBlocks[parseInt(idx)];
            return `<div class="katex-display-wrapper">$$${math.formula}$$</div>`;
        });
        
        html = html.replace(/%%MATH_INLINE_(\d+)%%/g, (match, idx) => {
            const math = mathBlocks[parseInt(idx)];
            return `$${math.formula}$`;
        });
        
        return html;
    }
    
    /**
     * 渲染数学公式
     */
    function renderMath(container) {
        if (typeof renderMathInElement !== 'undefined' && window.katexOptions) {
            try {
                renderMathInElement(container, window.katexOptions);
            } catch (e) {
                console.warn('KaTeX 渲染失败:', e);
            }
        }
    }
    
    /**
     * 更新导航状态
     */
    function updateNavigationState() {
        const prevBtn = document.getElementById('prev-card');
        const nextBtn = document.getElementById('next-card');
        const indicator = document.getElementById('card-indicator');
        
        if (prevBtn) prevBtn.disabled = currentCardIndex <= 0;
        if (nextBtn) nextBtn.disabled = currentCardIndex >= allCards.length - 1;
        if (indicator) indicator.textContent = `${currentCardIndex + 1} / ${allCards.length}`;
    }
    
    /**
     * HTML 转义
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 获取所有卡片数据
     */
    function getAllCards() {
        if (allCards.length === 0) {
            generateAllCards();
        }
        return allCards;
    }
    
    /**
     * 为导出渲染卡片到指定容器
     */
    function renderCardForExport(card, container) {
        let cardHtml = '';
        
        if (card.type === 'cover') {
            cardHtml = renderCoverCard();
        } else {
            cardHtml = renderContentCard(card);
        }
        
        container.innerHTML = cardHtml;
        
        // 渲染数学公式
        renderMath(container);
        
        return container.firstElementChild;
    }
    
    // 公开 API
    return {
        init,
        setConversations,
        renderPreview,
        getAllCards,
        renderCardForExport,
        generateAllCards
    };
})();
