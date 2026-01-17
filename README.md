# 与AI对话 - 小红书卡片生成器

将 AI 对话记录转换为精美的小红书风格卡片，一键导出分享。

![预览](https://img.shields.io/badge/平台-小红书-FF2442?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## 功能特性

- **Markdown 解析** - 支持从 Markdown 文件导入 AI 对话记录
- **智能分页** - 自动将长对话拆分为多张卡片，保持阅读连贯性
- **对话流合并** - 短问短答自动合并到同一张卡片，节省空间
- **封面图生成** - 自动生成带有主题金句的精美封面
- **数学公式** - 支持 KaTeX 渲染 LaTeX 数学公式
- **代码高亮** - 支持多种编程语言的语法高亮
- **一键导出** - 批量导出为 PNG 图片，打包成 ZIP 下载

## 快速开始

### 在线使用

直接用浏览器打开 `index.html` 文件即可使用，无需安装任何依赖。

### 本地服务器（推荐）

```bash
# 使用 npx 快速启动（需要 Node.js）
npx serve -l 3000

# 或使用 Python
python -m http.server 3000
```

然后访问 `http://localhost:3000`

## 使用说明

### 1. 准备对话文件

创建 Markdown 文件，使用以下格式标记用户提问：

```markdown
| User Prompt: |
|-------------|
| 你的问题内容 |

AI 的回复内容...

| User Prompt: |
|-------------|
| 下一个问题 |

AI 的下一个回复...
```

### 2. 导入并预览

1. 点击"选择 Markdown 文件"导入对话
2. 设置 Vol 编号和话题标签
3. 编辑封面图的主题金句和副标题
4. 勾选要导出的卡片
5. 点击"预览卡片"查看效果

### 3. 导出分享

点击"导出 ZIP"按钮，所有卡片将打包为 ZIP 文件下载。

## 项目结构

```
xhs-chat-with-ai/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── parser.js       # Markdown 解析器
│   ├── renderer.js     # 卡片渲染器
│   └── exporter.js     # PNG 导出器
├── assets/
│   └── icons/          # 角色图标
└── chat/               # 示例对话文件
```

## 技术栈

- **marked.js** - Markdown 解析
- **KaTeX** - 数学公式渲染
- **highlight.js** - 代码语法高亮
- **html2canvas** - HTML 转 PNG
- **JSZip** - ZIP 文件生成

## 卡片规格

- 尺寸：1080 × 1800 像素（小红书推荐比例 3:5）
- 导出分辨率：2x 高清
- 格式：PNG

## 自定义

### 修改角色名称

在 `js/renderer.js` 中搜索 `roleName` 修改角色显示名称。

### 修改卡片样式

编辑 `css/style.css` 中的样式变量：

```css
:root {
    --card-bg: #FAF8F5;           /* 卡片背景色 */
    --text-primary: #1a1a1a;       /* 主文字颜色 */
    --accent-blue: #4A90D9;        /* Gemini 强调色 */
    --accent-warm: #D4A574;        /* User 强调色 */
}
```

## License

MIT License - 自由使用，欢迎贡献！

## 致谢

灵感来源于与 AI 的深度对话，感谢 Gemini 的哲学思辨。
