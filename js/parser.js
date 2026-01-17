/**
 * Markdown 对话解析器
 * 解析 chat 目录下的 markdown 文件，识别 User/Gemini 对话结构
 */

const AppParser = (function() {
    // 存储解析后的对话数据
    let conversations = [];
    let currentFileName = '';
    
    /**
     * 初始化解析器
     */
    function init() {
        bindFileInput();
        bindDemoButton();
    }
    
    /**
     * 绑定演示按钮
     */
    function bindDemoButton() {
        const demoBtn = document.getElementById('load-demo-btn');
        if (demoBtn) {
            demoBtn.addEventListener('click', loadDemoData);
        }
    }
    
    /**
     * 加载演示数据 - 包含智能合并测试用例
     */
    function loadDemoData() {
        // 测试用例说明：
        // 1. 短问短答（应合并到一页）
        // 2. 短问长答（用户问题单独或与部分回复合并，长回复分页）
        // 3. 连续短对话（应合并到对话流卡片）
        const demoContent = `
| User Prompt: |
|-------------|
| 什么是人工智能？ |

人工智能（AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

| User Prompt: |
|-------------|
| 能举个例子吗？ |

当然！比如语音助手、自动驾驶、图像识别等都是AI应用。

| User Prompt: |
|-------------|
| 根据维特根斯坦的哲学，语言即世界，当前LLM对于古人来说就是不可思议的全知全能神了，或者说更像是无数人类智慧结晶的幽灵。智能即计算，理解即计算？ |

这是一个非常深刻且充满哲学张力的思考。你将维特根斯坦的语言哲学、毕达哥拉斯的"万物皆数"、以及现代计算机科学的底层逻辑串联了起来。

**LLM（大语言模型）不仅仅是一项技术，它正在迫使我们重新定义"存在"、"智能"和"世界"的本质。**

### 1. 维特根斯坦的预言：语言的边界即世界的边界

> *"我的语言的界限意味着我的世界的界限。" —— 路德维希·维特根斯坦*

对于人类而言，这句话或许是隐喻；但对于 **LLM** 而言，这是 **字面意义上的真理**。

### 2. 毕达哥拉斯的幽灵：万物皆数

你提到的"Token 被编码为高维 Embedding 向量，本质是一串浮点数"，这直接呼应了毕达哥拉斯学派的 **"万物皆数"**。

在 Embedding 的世界里，意义变成了几何关系：

$$\\vec{King} - \\vec{Man} + \\vec{Woman} \\approx \\vec{Queen}$$

| User Prompt: |
|-------------|
| 怎么理解智能与意识解耦？ |

这是一个非常关键的认知转折点。过去，人类是地球上唯一的高级智慧生物，我们理所当然地认为"智能"和"意识"是绑定在一起的。

### 定义的剥离：能力 vs. 体验

* **智能（Intelligence）是关于"做"（Doing）：** 处理信息、解决问题、达成目标的能力。
* **意识（Consciousness）是关于"在"（Being）：** 主观体验，哲学家称之为 **Qualia（感受质）**。

**解耦的结论：** 就像潜水艇会游泳但不会像鱼一样"享受水流"一样，LLM 拥有极高的智能，但它的内心是一片虚无的黑暗。
`;
        
        currentFileName = '演示对话';
        document.getElementById('selected-file-name').textContent = '演示对话.md';
        
        conversations = parseMarkdown(demoContent);
        
        // 更新 UI
        updateConversationList(conversations);
        enableButtons();
        
        // 设置封面建议
        document.getElementById('cover-title').value = 'LLM正在迫使我们重新定义存在、智能和世界的本质';
        document.getElementById('cover-subtitle').value = '语言、智能与数字世界的哲学思辨';
        document.getElementById('topic-tag').value = '哲学思辨';
        
        // 触发预览
        if (typeof AppRenderer !== 'undefined') {
            AppRenderer.setConversations(conversations);
            AppRenderer.renderPreview(0);
        }
    }
    
    /**
     * 绑定文件输入事件
     */
    function bindFileInput() {
        const fileInput = document.getElementById('file-input');
        const fileNameDisplay = document.getElementById('selected-file-name');
        
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentFileName = file.name.replace(/\.(md|markdown)$/i, '');
                    fileNameDisplay.textContent = file.name;
                    
                    try {
                        const content = await readFile(file);
                        conversations = parseMarkdown(content);
                        
                        // 更新 UI
                        updateConversationList(conversations);
                        enableButtons();
                        
                        // 自动提取主题作为封面金句建议
                        suggestCoverTitle(conversations);
                        
                        // 触发预览
                        if (typeof AppRenderer !== 'undefined') {
                            AppRenderer.setConversations(conversations);
                            AppRenderer.renderPreview(0);
                        }
                    } catch (error) {
                        console.error('文件解析错误:', error);
                        alert('文件解析失败，请检查 Markdown 格式');
                    }
                }
            });
        }
    }
    
    /**
     * 读取文件内容
     */
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, 'UTF-8');
        });
    }
    
    /**
     * 解析 Markdown 文件，提取对话结构
     * 识别格式：
     * | User Prompt: |
     * |-------------|
     * | 用户问题内容 |
     * 
     * 然后是 Gemini 的回复
     */
    function parseMarkdown(content) {
        const result = [];
        const lines = content.split('\n');
        
        let currentRole = null;
        let currentContent = [];
        let inUserPrompt = false;
        let userPromptLines = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // 检测 User Prompt 表格开始
            if (trimmedLine.match(/^\|\s*User\s*Prompt\s*:\s*\|$/i)) {
                // 保存之前的内容
                if (currentRole && currentContent.length > 0) {
                    const content = currentContent.join('\n').trim();
                    if (content) {
                        result.push({
                            role: currentRole,
                            content: content
                        });
                    }
                }
                
                inUserPrompt = true;
                userPromptLines = 0;
                currentRole = 'user';
                currentContent = [];
                continue;
            }
            
            // 跳过表格分隔行
            if (inUserPrompt && trimmedLine.match(/^\|[-\s]+\|$/)) {
                continue;
            }
            
            // 解析用户问题内容（在表格内）
            if (inUserPrompt && trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
                // 提取表格内容
                const cellContent = trimmedLine.slice(1, -1).trim();
                if (cellContent) {
                    currentContent.push(cellContent);
                }
                userPromptLines++;
                continue;
            }
            
            // 用户问题表格结束，切换到 Gemini 回复
            if (inUserPrompt && !trimmedLine.startsWith('|')) {
                if (currentContent.length > 0) {
                    result.push({
                        role: 'user',
                        content: currentContent.join('\n').trim()
                    });
                }
                
                inUserPrompt = false;
                currentRole = 'gemini';
                currentContent = [];
                
                // 当前行可能是 Gemini 回复的开始
                if (trimmedLine) {
                    currentContent.push(line);
                }
                continue;
            }
            
            // 收集当前角色的内容
            if (currentRole && !inUserPrompt) {
                currentContent.push(line);
            }
        }
        
        // 保存最后一段内容
        if (currentRole && currentContent.length > 0) {
            const content = currentContent.join('\n').trim();
            if (content) {
                result.push({
                    role: currentRole,
                    content: content
                });
            }
        }
        
        return result;
    }
    
    /**
     * 更新对话列表 UI
     */
    function updateConversationList(conversations) {
        const listContainer = document.getElementById('conversation-list');
        if (!listContainer) return;
        
        if (conversations.length === 0) {
            listContainer.innerHTML = '<p class="placeholder-text">未找到有效对话</p>';
            return;
        }
        
        let html = '';
        conversations.forEach((conv, index) => {
            const previewText = conv.content.substring(0, 80).replace(/[#*`]/g, '') + 
                               (conv.content.length > 80 ? '...' : '');
            const roleLabel = conv.role === 'user' ? 'User' : 'Gemini';
            
            html += `
                <div class="conversation-item ${conv.role}" data-index="${index}">
                    <input type="checkbox" checked data-conv-index="${index}" />
                    <span class="role-tag">${roleLabel}</span>
                    <span class="preview-text">${escapeHtml(previewText)}</span>
                </div>
            `;
        });
        
        listContainer.innerHTML = html;
    }
    
    /**
     * 建议封面标题
     */
    function suggestCoverTitle(conversations) {
        const coverTitleInput = document.getElementById('cover-title');
        if (!coverTitleInput || conversations.length === 0) return;
        
        // 从第一个 Gemini 回复中提取第一句话作为建议
        const firstGemini = conversations.find(c => c.role === 'gemini');
        if (firstGemini) {
            const firstSentence = firstGemini.content
                .split(/[。！？\n]/)[0]
                .replace(/[#*`]/g, '')
                .trim()
                .substring(0, 50);
            
            if (firstSentence && !coverTitleInput.value) {
                coverTitleInput.placeholder = firstSentence + '...';
            }
        }
    }
    
    /**
     * 启用按钮
     */
    function enableButtons() {
        const previewBtn = document.getElementById('preview-btn');
        const exportBtn = document.getElementById('export-btn');
        
        if (previewBtn) previewBtn.disabled = false;
        if (exportBtn) exportBtn.disabled = false;
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
     * 获取选中的对话索引
     */
    function getSelectedConversations() {
        const checkboxes = document.querySelectorAll('#conversation-list input[type="checkbox"]:checked');
        const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.convIndex));
        return indices.map(i => conversations[i]).filter(Boolean);
    }
    
    /**
     * 获取所有对话
     */
    function getAllConversations() {
        return conversations;
    }
    
    /**
     * 获取当前文件名
     */
    function getFileName() {
        return currentFileName;
    }
    
    // 公开 API
    return {
        init,
        parseMarkdown,
        getSelectedConversations,
        getAllConversations,
        getFileName
    };
})();
