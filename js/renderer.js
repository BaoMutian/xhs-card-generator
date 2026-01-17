/**
 * 卡片渲染器
 * 使用 marked.js 渲染 Markdown，KaTeX 渲染数学公式，highlight.js 代码高亮
 */

const AppRenderer = (function () {
    // 卡片尺寸常量
    const CARD_WIDTH = 1080;
    const CARD_HEIGHT = 1800;
    // 内容区域最大高度 = 卡片高度 - 顶部padding(36) - 角色header区(约70) - 底部区域(约70) - 安全边距(24)
    const CONTENT_MAX_HEIGHT = 1600;

    // 存储对话数据
    let conversations = [];
    let allCards = []; // 包含封面和所有内容卡片
    let currentCardIndex = 0;

    // 测量容器（用于计算实际渲染高度）
    let measureContainer = null;

    /**
     * 初始化渲染器
     */
    function init() {
        configureMarked();
        bindNavigationButtons();
        bindPreviewButton();
        createMeasureContainer();
    }

    /**
     * 创建隐藏的测量容器
     */
    function createMeasureContainer() {
        // 检查是否已存在
        measureContainer = document.getElementById('measure-container');
        if (measureContainer) return;

        measureContainer = document.createElement('div');
        measureContainer.id = 'measure-container';
        measureContainer.className = 'markdown-body';
        document.body.appendChild(measureContainer);
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
     * 生成所有卡片（包含封面和分页）- 基于实际渲染高度分页
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

        // 使用基于实际渲染高度的智能分页
        generateCardsWithHeightMeasurement(selectedConvs);

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
     * 测量 Markdown 内容渲染后的实际高度
     */
    function measureContentHeight(content, isDialogue = false) {
        if (!measureContainer) {
            createMeasureContainer();
        }

        const html = renderMarkdown(content);
        measureContainer.innerHTML = html;

        // 渲染数学公式
        renderMath(measureContainer);

        // 如果是对话流，需要额外计算角色头部的高度
        const extraHeight = isDialogue ? 60 : 0; // 对话项的角色头部约 60px

        return measureContainer.scrollHeight + extraHeight;
    }

    /**
     * 测量对话流卡片的总高度
     */
    function measureDialogueHeight(messages) {
        let totalHeight = 0;
        const GAP = 24; // 对话项之间的间距
        const ITEM_PADDING = 56; // 每个对话项的内边距 (28*2)
        const ROLE_HEADER = 52; // 角色头部高度

        messages.forEach((msg, idx) => {
            const contentHeight = measureContentHeight(msg.content);
            totalHeight += contentHeight + ITEM_PADDING + ROLE_HEADER;
            if (idx > 0) totalHeight += GAP;
        });

        return totalHeight;
    }

    /**
     * 基于实际渲染高度生成分页卡片 - 智能合并短消息
     */
    function generateCardsWithHeightMeasurement(conversations) {
        // 对话流卡片的最大高度（需要减去底部区域）
        const DIALOGUE_MAX_HEIGHT = CONTENT_MAX_HEIGHT - 60;

        // 当前页面累积的消息
        let currentPageMessages = [];
        let currentPageHeight = 0;

        conversations.forEach((conv, convIndex) => {
            const content = conv.content;
            const contentHeight = measureContentHeight(content, currentPageMessages.length > 0);

            // 计算如果添加这条消息后的总高度
            const additionalHeight = currentPageMessages.length > 0
                ? contentHeight + 24 + 56 + 52  // 间距 + padding + 角色头
                : contentHeight + 56 + 52;

            // 检查能否添加到当前页（作为对话流）
            if (currentPageHeight + additionalHeight <= DIALOGUE_MAX_HEIGHT) {
                currentPageMessages.push({
                    role: conv.role,
                    content: content,
                    convIndex: convIndex
                });
                currentPageHeight += additionalHeight;
            } else {
                // 放不下，先输出当前页
                if (currentPageMessages.length > 0) {
                    flushCurrentPage(currentPageMessages);
                    currentPageMessages = [];
                    currentPageHeight = 0;
                }

                // 处理当前消息
                // 检查单条消息能否放入一页
                const singleMsgHeight = measureContentHeight(content) + 56 + 52;

                if (singleMsgHeight <= CONTENT_MAX_HEIGHT) {
                    // 可以放入一页，开始新的累积
                    currentPageMessages.push({
                        role: conv.role,
                        content: content,
                        convIndex: convIndex
                    });
                    currentPageHeight = singleMsgHeight;
                } else {
                    // 单条消息超长，需要分页
                    const pages = splitContentByHeight(content, CONTENT_MAX_HEIGHT);
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
                // 单条消息，检查是否需要分页
                const content = messages[0].content;
                const height = measureContentHeight(content);

                if (height <= CONTENT_MAX_HEIGHT - 100) {
                    // 不需要分页
                    allCards.push({
                        type: 'content',
                        role: messages[0].role,
                        content: content,
                        page: 1,
                        totalPages: 1,
                        isFirst: true
                    });
                } else {
                    // 需要分页
                    const pages = splitContentByHeight(content, CONTENT_MAX_HEIGHT - 100);
                    pages.forEach((pageContent, pageIndex) => {
                        allCards.push({
                            type: 'content',
                            role: messages[0].role,
                            content: pageContent,
                            page: pageIndex + 1,
                            totalPages: pages.length,
                            isFirst: pageIndex === 0
                        });
                    });
                }
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
     * 基于渲染高度分割内容，在段落边界分割
     */
    function splitContentByHeight(content, maxHeight) {
        const pages = [];

        // 将内容按块级元素分割（段落、标题、代码块、列表等）
        const blocks = splitIntoBlocks(content);

        let currentPage = '';
        let currentHeight = 0;

        blocks.forEach(block => {
            const blockWithSeparator = currentPage ? '\n\n' + block : block;
            const testContent = currentPage + blockWithSeparator;
            const testHeight = measureContentHeight(testContent);

            if (testHeight <= maxHeight) {
                currentPage = testContent;
                currentHeight = testHeight;
            } else {
                // 当前块放不下
                if (currentPage) {
                    pages.push(currentPage);
                }

                // 检查单个块是否超高
                const blockHeight = measureContentHeight(block);
                if (blockHeight > maxHeight) {
                    // 块太大，需要进一步拆分
                    const subPages = splitLongBlock(block, maxHeight);
                    subPages.forEach((subPage, idx) => {
                        if (idx === subPages.length - 1) {
                            currentPage = subPage;
                            currentHeight = measureContentHeight(subPage);
                        } else {
                            pages.push(subPage);
                        }
                    });
                } else {
                    currentPage = block;
                    currentHeight = blockHeight;
                }
            }
        });

        if (currentPage) {
            pages.push(currentPage);
        }

        return pages.length > 0 ? pages : [content];
    }

    /**
     * 将 Markdown 内容分割成块级元素
     */
    function splitIntoBlocks(content) {
        const blocks = [];
        const lines = content.split('\n');
        let currentBlock = [];
        let inCodeBlock = false;
        let inList = false;

        lines.forEach((line, idx) => {
            // 检测代码块
            if (line.trim().startsWith('```')) {
                if (inCodeBlock) {
                    // 代码块结束
                    currentBlock.push(line);
                    blocks.push(currentBlock.join('\n'));
                    currentBlock = [];
                    inCodeBlock = false;
                } else {
                    // 代码块开始
                    if (currentBlock.length > 0) {
                        blocks.push(currentBlock.join('\n'));
                        currentBlock = [];
                    }
                    currentBlock.push(line);
                    inCodeBlock = true;
                }
                return;
            }

            if (inCodeBlock) {
                currentBlock.push(line);
                return;
            }

            // 检测列表项
            const isListItem = /^[\s]*[-*+]|\d+\./.test(line);

            // 检测标题
            const isHeading = /^#{1,6}\s/.test(line);

            // 检测引用
            const isBlockquote = /^>\s/.test(line);

            // 检测空行（段落分隔）
            const isEmpty = line.trim() === '';

            if (isEmpty) {
                if (currentBlock.length > 0) {
                    blocks.push(currentBlock.join('\n'));
                    currentBlock = [];
                }
                inList = false;
            } else if (isHeading) {
                // 标题作为新块的开始
                if (currentBlock.length > 0) {
                    blocks.push(currentBlock.join('\n'));
                    currentBlock = [];
                }
                currentBlock.push(line);
                inList = false;
            } else if (isListItem) {
                if (!inList && currentBlock.length > 0) {
                    blocks.push(currentBlock.join('\n'));
                    currentBlock = [];
                }
                currentBlock.push(line);
                inList = true;
            } else {
                currentBlock.push(line);
            }
        });

        if (currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
        }

        return blocks.filter(b => b.trim());
    }

    /**
     * 拆分超长的单个块（如超长段落）
     */
    function splitLongBlock(block, maxHeight) {
        const pages = [];

        // 先尝试按句子拆分
        const sentences = block.split(/(?<=[。！？.!?\n])/);
        let current = '';
        let currentHeight = 0;

        sentences.forEach(sentence => {
            const testContent = current + sentence;
            const testHeight = measureContentHeight(testContent);

            if (testHeight <= maxHeight) {
                current = testContent;
                currentHeight = testHeight;
            } else {
                if (current) {
                    pages.push(current);
                }

                // 检查单句是否超长
                const sentenceHeight = measureContentHeight(sentence);
                if (sentenceHeight > maxHeight) {
                    // 单句超长，按词/字符强制拆分
                    const chunks = splitLongSentence(sentence, maxHeight);
                    chunks.forEach((chunk, idx) => {
                        if (idx === chunks.length - 1) {
                            current = chunk;
                            currentHeight = measureContentHeight(chunk);
                        } else {
                            pages.push(chunk);
                        }
                    });
                } else {
                    current = sentence;
                    currentHeight = sentenceHeight;
                }
            }
        });

        if (current) {
            pages.push(current);
        }

        return pages.length > 0 ? pages : [block];
    }

    /**
     * 拆分超长句子（最后手段：按字符拆分）
     */
    function splitLongSentence(sentence, maxHeight) {
        const pages = [];
        let start = 0;
        const step = 100; // 每次尝试增加的字符数

        while (start < sentence.length) {
            let end = start + step;

            // 二分查找最佳分割点
            let low = start + 1;
            let high = sentence.length;
            let bestEnd = start + 1;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const testChunk = sentence.slice(start, mid);
                const testHeight = measureContentHeight(testChunk);

                if (testHeight <= maxHeight) {
                    bestEnd = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            pages.push(sentence.slice(start, bestEnd));
            start = bestEnd;
        }

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
     * 获取作者签名
     */
    function getAuthorSignature() {
        return document.getElementById('author-signature')?.value || '@Vanilla';
    }

    /**
     * 渲染封面卡片
     */
    function renderCoverCard() {
        const volNumber = document.getElementById('vol-number')?.value || '1';
        const topicTag = document.getElementById('topic-tag')?.value || '';
        const coverTitle = document.getElementById('cover-title')?.value || '与AI的深度对话';
        const coverSubtitle = document.getElementById('cover-subtitle')?.value || '';
        const signature = getAuthorSignature();

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
                    <div class="cover-signature">${escapeHtml(signature)}</div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染内容卡片
     */
    function renderContentCard(card) {
        const volNumber = document.getElementById('vol-number')?.value || '1';
        const signature = getAuthorSignature();

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
                        <span class="inline-signature">${escapeHtml(signature)}</span>
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
        const signature = getAuthorSignature();

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
                        <span class="inline-signature">${escapeHtml(signature)}</span>
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

        // 处理跨行的粗体：将内部换行替换为空格
        // 只匹配真正的粗体（开头 ** 后紧跟非空白，结尾 ** 前紧跟非空白）
        processed = processed.replace(/\*\*(\S[\s\S]*?\S)\*\*/g, (match, text) => {
            // 只有包含换行时才处理
            if (text.includes('\n')) {
                const fixed = text.replace(/\n/g, ' ');
                return `**${fixed}**`;
            }
            return match;
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
        } else if (card.type === 'dialogue') {
            cardHtml = renderDialogueCard(card);
        } else {
            cardHtml = renderContentCard(card);
        }

        container.innerHTML = cardHtml;

        // 渲染数学公式
        renderMath(container);

        return container.firstElementChild;
    }

    /**
     * 获取当前卡片索引
     */
    function getCurrentCardIndex() {
        return currentCardIndex;
    }

    // 公开 API
    return {
        init,
        setConversations,
        renderPreview,
        getAllCards,
        renderCardForExport,
        generateAllCards,
        getCurrentCardIndex
    };
})();
