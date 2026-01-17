/**
 * 卡片渲染器
 * 使用 marked.js 渲染 Markdown，KaTeX 渲染数学公式，highlight.js 代码高亮
 */

const AppRenderer = (function () {
    // 卡片尺寸常量
    const CARD_WIDTH = 1080;
    const CARD_HEIGHT = 1800;
    const CONTENT_MAX_HEIGHT = 1580; // 内容区域最大高度（卡片高度减去padding）

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
        renderer.code = function (code, language) {
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
     * 生成所有卡片（包含封面和分页）- 基于字符数估算分页
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

        if (selectedConvs.length === 0) {
            updateNavigationState();
            return;
        }

        // 使用字符数估算的简单分页
        generateCardsWithCharEstimate(selectedConvs);

        // 标记最后一张内容卡片
        for (let i = allCards.length - 1; i >= 0; i--) {
            if (allCards[i].type !== 'cover') {
                allCards[i].isLast = true;
                break;
            }
        }

        updateNavigationState();
    }

    /**
     * 基于字符数估算生成分页卡片 - 智能合并短消息
     */
    function generateCardsWithCharEstimate(conversations) {
        // 每页最大字符数（降低以避免溢出）
        const MAX_CHARS_PER_PAGE = 660;

        // 当前页面累积的消息
        let currentPageMessages = [];
        let currentPageChars = 0;

        conversations.forEach((conv, convIndex) => {
            const content = conv.content;
            const contentLen = content.length;

            // 检查能否添加到当前页
            if (currentPageChars + contentLen <= MAX_CHARS_PER_PAGE) {
                // 可以合并到当前页
                currentPageMessages.push({
                    role: conv.role,
                    content: content,
                    convIndex: convIndex
                });
                currentPageChars += contentLen;
            } else {
                // 放不下，先输出当前页
                if (currentPageMessages.length > 0) {
                    flushCurrentPage(currentPageMessages);
                    currentPageMessages = [];
                    currentPageChars = 0;
                }

                // 处理当前消息
                if (contentLen <= MAX_CHARS_PER_PAGE) {
                    // 短消息，开始新页
                    currentPageMessages.push({
                        role: conv.role,
                        content: content,
                        convIndex: convIndex
                    });
                    currentPageChars = contentLen;
                } else {
                    // 长消息，需要分页
                    const pages = splitContentByChars(content, MAX_CHARS_PER_PAGE);
                    pages.forEach((pageContent, pageIndex) => {
                        allCards.push({
                            type: 'content',
                            role: conv.role,
                            content: pageContent,
                            page: pageIndex + 1,
                            totalPages: pages.length,
                            isFirst: pageIndex === 0
                        });
                    });
                }
            }
        });

        // 输出最后一页
        if (currentPageMessages.length > 0) {
            flushCurrentPage(currentPageMessages);
        }

        /**
         * 输出当前页面的消息
         */
        function flushCurrentPage(messages) {
            if (messages.length === 0) return;

            if (messages.length === 1) {
                // 单条消息
                allCards.push({
                    type: 'content',
                    role: messages[0].role,
                    content: messages[0].content,
                    page: 1,
                    totalPages: 1,
                    isFirst: true
                });
            } else {
                // 多条消息合并为对话流卡片
                allCards.push({
                    type: 'dialogue',
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                });
            }
        }
    }

    /**
     * 按字符数分割内容，尽量在段落边界分割
     */
    function splitContentByChars(content, maxChars) {
        const pages = [];
        const paragraphs = content.split(/\n\n+/);
        let currentPage = '';

        paragraphs.forEach(para => {
            para = para.trim();
            if (!para) return;

            const addition = currentPage ? '\n\n' + para : para;

            if (currentPage.length + addition.length <= maxChars) {
                currentPage += addition;
            } else {
                // 当前段落放不下
                if (currentPage) {
                    pages.push(currentPage);
                }

                // 如果单个段落超长，按句子拆分
                if (para.length > maxChars) {
                    const subPages = splitLongParagraph(para, maxChars);
                    subPages.forEach((subPage, idx) => {
                        if (idx === subPages.length - 1) {
                            currentPage = subPage;
                        } else {
                            pages.push(subPage);
                        }
                    });
                } else {
                    currentPage = para;
                }
            }
        });

        if (currentPage) {
            pages.push(currentPage);
        }

        return pages.length > 0 ? pages : [content];
    }

    /**
     * 拆分超长段落
     */
    function splitLongParagraph(para, maxChars) {
        const pages = [];
        const sentences = para.split(/(?<=[。！？.!?\n])/);
        let current = '';

        sentences.forEach(sentence => {
            if (current.length + sentence.length <= maxChars) {
                current += sentence;
            } else {
                if (current) pages.push(current);

                // 如果单句超长，强制按字符拆分
                if (sentence.length > maxChars) {
                    for (let i = 0; i < sentence.length; i += maxChars) {
                        const chunk = sentence.slice(i, Math.min(i + maxChars, sentence.length));
                        if (i + maxChars >= sentence.length) {
                            current = chunk;
                        } else {
                            pages.push(chunk);
                        }
                    }
                } else {
                    current = sentence;
                }
            }
        });

        if (current) pages.push(current);
        return pages;
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
        } else if (card.type === 'dialogue') {
            cardHtml = renderDialogueCard(card);
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
                <div class="cover-content">
                    <div class="series-badge">#与AI对话 Vol.${volNumber}</div>
                    <div class="quote-box">
                        <div class="quote-text">${escapeHtml(coverTitle)}</div>
                        ${coverSubtitle ? `<div class="subtitle">── ${escapeHtml(coverSubtitle)} ──</div>` : ''}
                    </div>
                    <div class="participants">
                        <span class="gemini-mark">✦ Gemini 3 Pro</span>
                        <span> × </span>
                        <span class="user-mark">我</span>
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

        const roleName = card.role === 'user' ? '我' : 'Gemini 3 Pro';
        const roleIcon = card.role === 'user'
            ? 'assets/icons/user.png'
            : 'assets/icons/gemini.svg';
        const pageIndicator = card.totalPages > 1 ? `${card.page}/${card.totalPages}` : '';
        // 使用 isFirst 字段判断是否是续页
        const showContinuation = card.isFirst === false || (card.page && card.page > 1);
        const continuationHint = showContinuation ? '<div class="continuation-hint">（接上页）</div>' : '';

        // 渲染 Markdown 内容
        const renderedContent = renderMarkdown(card.content);

        // 最后一页显示"（完）"
        const endMark = card.isLast ? '<div class="end-mark">（完）</div>' : '';

        return `
            <div class="card ${card.role}" style="width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px;">
                <div class="card-body">
                    <div class="role-header">
                        <img class="role-icon" src="${roleIcon}" alt="${roleName}">
                        <span class="role-name">${roleName}</span>
                        ${pageIndicator ? `<span class="page-indicator">${pageIndicator}</span>` : ''}
                    </div>
                    <div class="card-content">
                        ${continuationHint}
                        <div class="markdown-body">
                            ${renderedContent}
                        </div>
                        ${endMark}
                    </div>
                    <div class="card-bottom">
                        <span class="series-tag">#与AI对话 Vol.${volNumber}</span>
                        <span class="inline-signature">@Vanilla</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染对话流卡片（多条消息合并）
     */
    function renderDialogueCard(card) {
        const volNumber = document.getElementById('vol-number')?.value || '1';

        // 渲染所有消息
        const messagesHtml = card.messages.map(msg => {
            const roleName = msg.role === 'user' ? '我' : 'Gemini 3 Pro';
            const roleIcon = msg.role === 'user'
                ? 'assets/icons/user.png'
                : 'assets/icons/gemini.svg';
            const renderedContent = renderMarkdown(msg.content);

            return `
                <div class="dialogue-item ${msg.role}">
                    <div class="dialogue-role">
                        <img class="dialogue-icon" src="${roleIcon}" alt="${roleName}">
                        <span class="dialogue-name">${roleName}</span>
                    </div>
                    <div class="dialogue-content">
                        <div class="markdown-body">
                            ${renderedContent}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // 最后一页显示"（完）"
        const endMark = card.isLast ? '<div class="end-mark">（完）</div>' : '';

        return `
            <div class="card dialogue" style="width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px;">
                <div class="card-body">
                    <div class="dialogue-flow">
                        ${messagesHtml}
                        ${endMark}
                    </div>
                    <div class="card-bottom">
                        <span class="series-tag">#与AI对话 Vol.${volNumber}</span>
                        <span class="inline-signature">@Vanilla</span>
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

        // 处理跨行的粗体和斜体：将内部换行替换为空格
        // 粗体 **...**
        processed = processed.replace(/\*\*([\s\S]*?)\*\*/g, (match, text) => {
            // 将内部的换行符替换为空格
            const fixed = text.replace(/\n/g, ' ');
            return `**${fixed}**`;
        });

        // 斜体 *...* (但不匹配 **)
        processed = processed.replace(/(?<!\*)\*(?!\*)([^*\n][^*]*?)\*(?!\*)/g, (match, text) => {
            const fixed = text.replace(/\n/g, ' ');
            return `*${fixed}*`;
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
