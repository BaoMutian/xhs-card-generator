/**
 * PNG 导出器
 * 使用 html2canvas 将卡片导出为 PNG 图像
 */

const AppExporter = (function() {
    // 导出配置
    const EXPORT_SCALE = 2; // 2x 缩放以获得高清图像
    const CARD_WIDTH = 1080;
    const CARD_HEIGHT = 1800;
    
    // 导出状态
    let isExporting = false;
    
    /**
     * 初始化导出器
     */
    function init() {
        bindExportButton();
    }
    
    /**
     * 绑定导出按钮
     */
    function bindExportButton() {
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportAllCards);
        }
    }
    
    /**
     * 导出所有卡片
     */
    async function exportAllCards() {
        if (isExporting) {
            alert('正在导出中，请稍候...');
            return;
        }
        
        if (typeof html2canvas === 'undefined') {
            alert('html2canvas 库未加载，无法导出');
            return;
        }
        
        const cards = AppRenderer.getAllCards();
        if (cards.length === 0) {
            alert('没有可导出的卡片，请先选择 Markdown 文件');
            return;
        }
        
        isExporting = true;
        const exportBtn = document.getElementById('export-btn');
        const originalText = exportBtn.textContent;
        
        try {
            const volNumber = document.getElementById('vol-number')?.value || '1';
            const exportContainer = document.getElementById('export-container');
            
            // 清空导出容器
            exportContainer.innerHTML = '';
            
            // 逐个导出卡片
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                exportBtn.textContent = `导出中 ${i + 1}/${cards.length}...`;
                
                // 生成文件名
                const fileName = generateFileName(volNumber, i, card);
                
                // 渲染卡片到导出容器
                const cardElement = AppRenderer.renderCardForExport(card, exportContainer);
                
                // 等待字体和图片加载
                await waitForResources(cardElement);
                
                // 导出为 PNG
                await exportToPng(cardElement, fileName);
                
                // 短暂延迟，避免浏览器卡顿
                await delay(100);
            }
            
            alert(`成功导出 ${cards.length} 张卡片！`);
            
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败: ' + error.message);
        } finally {
            isExporting = false;
            exportBtn.textContent = originalText;
        }
    }
    
    /**
     * 生成文件名
     * 格式: Vol1_00_cover.png, Vol1_01_user.png, Vol1_02_gemini.png
     */
    function generateFileName(volNumber, index, card) {
        const paddedIndex = String(index).padStart(2, '0');
        
        if (card.type === 'cover') {
            return `Vol${volNumber}_${paddedIndex}_cover.png`;
        }
        
        let suffix = card.role;
        if (card.totalPages > 1) {
            const pageLetter = String.fromCharCode(96 + card.page); // 1->a, 2->b, etc.
            suffix += pageLetter;
        }
        
        return `Vol${volNumber}_${paddedIndex}_${suffix}.png`;
    }
    
    /**
     * 等待资源加载
     */
    function waitForResources(element) {
        return new Promise((resolve) => {
            // 等待字体加载
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => {
                    // 额外延迟以确保渲染完成
                    setTimeout(resolve, 200);
                });
            } else {
                setTimeout(resolve, 500);
            }
        });
    }
    
    /**
     * 导出单张卡片为 PNG
     */
    async function exportToPng(element, fileName) {
        const canvas = await html2canvas(element, {
            scale: EXPORT_SCALE,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#FAF8F5',
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            logging: false,
            onclone: (clonedDoc) => {
                // 确保克隆的元素可见
                const clonedElement = clonedDoc.querySelector('.card');
                if (clonedElement) {
                    clonedElement.style.position = 'static';
                    clonedElement.style.left = '0';
                    clonedElement.style.top = '0';
                }
            }
        });
        
        // 转换为 Blob 并下载
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    downloadBlob(blob, fileName);
                    resolve();
                } else {
                    reject(new Error('Canvas 转换失败'));
                }
            }, 'image/png', 1.0);
        });
    }
    
    /**
     * 下载 Blob 文件
     */
    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    /**
     * 延迟函数
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 导出单张卡片（用于预览导出）
     */
    async function exportCurrentCard() {
        if (isExporting) return;
        
        const cards = AppRenderer.getAllCards();
        const currentIndex = getCurrentCardIndex();
        
        if (currentIndex < 0 || currentIndex >= cards.length) {
            alert('没有可导出的卡片');
            return;
        }
        
        isExporting = true;
        
        try {
            const volNumber = document.getElementById('vol-number')?.value || '1';
            const card = cards[currentIndex];
            const exportContainer = document.getElementById('export-container');
            
            const fileName = generateFileName(volNumber, currentIndex, card);
            const cardElement = AppRenderer.renderCardForExport(card, exportContainer);
            
            await waitForResources(cardElement);
            await exportToPng(cardElement, fileName);
            
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败: ' + error.message);
        } finally {
            isExporting = false;
        }
    }
    
    /**
     * 获取当前卡片索引
     */
    function getCurrentCardIndex() {
        const indicator = document.getElementById('card-indicator');
        if (indicator) {
            const match = indicator.textContent.match(/(\d+)\s*\/\s*\d+/);
            if (match) {
                return parseInt(match[1]) - 1;
            }
        }
        return 0;
    }
    
    // 公开 API
    return {
        init,
        exportAllCards,
        exportCurrentCard
    };
})();
