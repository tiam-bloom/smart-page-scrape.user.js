/*
// ==UserScript==
// @name         智能页面抓取器
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  提取网页内容，通过AI（模拟）解析为结构化表格，提供复制功能，并支持历史记录查看与管理。
// @author       Tiam
// @match        *://*.gov.cn/*
// @match        *://*.org/*
// @match        https://tools.textin.com/table
// @match        https://tools.textin.com/text_recognize
// @match        https://mineru.net/OpenSourceTools/Extractor
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @require      file:///Users/tiam/Documents/code/data-collector/src/tampermonkey/smart-page-scrape.user.js
// ==/UserScript==

    如何使用
    安装 Tampermonkey：确保你的浏览器（如 Chrome, Firefox, Edge）已经安装了 Tampermonkey 扩展。
    创建新脚本：点击 Tampermonkey 图标，选择 "创建新脚本"。
    替换代码：清空编辑器中的默认代码，完整粘贴下面的代码。
    保存：按 Ctrl + S (或 Cmd + S) 保存脚本。
    使用：
    打开你想要抓取内容的网页。
    页面右上角会出现一个"开始选择"的悬浮按钮。
    点击按钮，进入选择模式（鼠标会变成十字准星）。
    将鼠标移动到你想要作为链接容器的元素上（例如，一个包含所有文章链接的 <div>），该元素会高亮显示。
    点击该元素，脚本将自动开始抓取所有子链接的内容。
    抓取过程中，状态面板会显示进度。
    抓取完成后，所有内容会自动复制到剪贴板，并给出成功提示。
    V3.1
    新增快捷键启动,双击X进入选择模式
    V3.2
    优化AI解析交互与弹窗
    V3.3
    新增解析历史记录功能：
    1. 每次解析成功后自动持久化保存数据。
    2. 点击"查看解析历史记录"可查看所有历史数据。
    3. 提供"复制全部"和"清空历史记录"功能。
    V3.5
    全新UI设计升级：
    1. 现代化界面设计，添加渐变背景和毛玻璃效果
    2. 增加丰富的动画效果：滑入、缩放、脉冲等
    3. 优化加载体验，添加进度条和加载动画
    4. 增强交互反馈，按钮悬停和点击效果
    5. 选择模式添加居中提示框，操作更直观
    6. 响应式设计，支持移动端适配
    V3.6
    新增拖动与最小化，避免遮挡网页正常功能
    V3.7
    1：Auto模式切换元素时显示当前将使用的模式
    2：解析时在加载弹窗中显示可折叠的文本预览区域
    3. 添加历史记录按钮数量显示功能
    4. Link模式下，添加提取纯净文本功能
    V4.0
    新增一键快捷提取当前网页所有内容并自动解析功能：
    1. 新增"⚡ 一键提取全部"按钮，点击直接提取整个页面文本内容
    2. 添加Z键快捷键支持，按Z键即可触发一键提取
    3. 自动清理页面噪音（脚本、样式、隐藏元素等）
    4. 自动调用AI解析，无需手动选择元素
    V4.1
    1. 移除冗余的Cookie处理代码（getCookiesFromBrowser、parseDocumentCookie、getApiCookies、getCookiesForUrl）
    2. GM_xmlhttpRequest会自动携带目标URL的Cookie，无需手动获取和设置
    3. 移除 @grant GM_cookie 声明
    4. 新增功能介绍和使用说明弹窗（点击标题栏"?"按钮）
    5. 优化模式选择器为分段按钮样式
    V4.2
    新增支持OCR图片识别模式：
    1. 模式选择器新增"OCR"选项
    2. 选择包含图片的元素后，自动提取所有图片
    3. 调用OCR API识别图片中的文字
    4. 识别结果自动进行AI解析
    5. 支持识别 img 标签图片和背景图片
    V5.0
    1. 使用 Shadow DOM 完全隔离宿主页面样式，彻底解决跨网站样式污染问题
    2. 全面美化UI排版，优化视觉层次和间距
    3. 所有弹窗、模态框均纳入 Shadow DOM 隔离
    4. 改善按钮视觉层次，区分主操作和次操作
    V5.1
 1. 新增数据筛选功能：解析后自动筛选数据（默认开启）
    - 按（姓名+身份证号码）去重，身份证号码为空时只按姓名去重
    - 删除没有姓名和职务字段的行
    - 结果弹窗中显示筛选统计信息
 2. 配置页面新增"数据筛选"开关，可控制是否启用自动筛选

失效
    http://gaj.sxjz.gov.cn/site/public/zwgkshowz.aspx?u=jzjj.html

    异步加载的领导信息无法采集：
    http://www.yichang.gov.cn/zfxxgk/list.html?depid=848&catid=4
    https://www.yidu.gov.cn/zfxxgk/list.html?depid=1026&catid=4
*/

console.log('[Userscript 已注入]', location.href);
console.log('top.location.href =', top.location.href);
console.log('isTop =', window.top === window.self);
(function () {
    'use strict';
    // AI单次最大输入大小（默认50KB，可通过配置页调整）
    function getMaxInputSize() {
        return GM_getValue('scraper_max_input_size', 1024 * 50);
    }

    // 大模型默认参数
    const DEFAULT_MODEL = 'GLM-4.6';
    const DEFAULT_TEMPERATURE = 1;
    const DEFAULT_TOP_K = 40;
    const DEFAULT_TOP_P = 0.9;

    // 抓取与行为默认参数
    const DEFAULT_CONCURRENCY = 5;
    const DEFAULT_AUTO_COPY = true;

    const MODEL_LIST = [
        "DeepSeek-V4-Pro",
        "MiniMax-M2.7",
        "Kimi-K2.6",
        "GLM-5.1",
        "gpt-5.4",
        "LlaDA2.1",
        "Ring-2.5-1T",
        "Ling-2.5-1T",
        "GLM-5",
        "MiniMax-M2.5",
        "claude-sonnet-4-6",
        "Kimi-K2.5",
        "GLM-4.7",
        "DeepSeek-V3.2",
        "gpt-5.1",
        "Ring-1T",
        "Ling-1T",
        "qwen3-max",
        "gpt-5-chat-2025-08-07",
        "DeepSeek-V3.1",
        "Gemini-2.5-pro",
        "DeepSeek-R1-0528",
        "gpt-4.1-2025-04-14"
    ];

    function getModelConfig() {
        return {
            model: GM_getValue('scraper_model', DEFAULT_MODEL),
            temperature: GM_getValue('scraper_temperature', DEFAULT_TEMPERATURE),
            topK: GM_getValue('scraper_top_k', DEFAULT_TOP_K),
            topP: GM_getValue('scraper_top_p', DEFAULT_TOP_P),
        };
    }

    function getConcurrency() {
        return GM_getValue('scraper_concurrency', DEFAULT_CONCURRENCY);
    }

    function getAutoCopy() {
        return GM_getValue('scraper_auto_copy', DEFAULT_AUTO_COPY);
    }

    // 获取当前日期并格式化为 "YYYYMMDD"
    const currentTimeFormatted = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 默认 System Prompt 模板
    const DEFAULT_SYSTEM_PROMPT = `从下面内容中提取人员相关信息整理为表格，缺失信息留空即可，表格字段为:
"公示时间	单位名称	姓名	身份证号码	性别	学历	毕业院校	职务（岗位）	手机号码	省份	市级	区级	采集时间	级别"
公示时间从发布时间/日期中获取，仅保留年份即可，如"2025"，没有相关信息默认使用"2025"
若存在出生年份相关信息，如"1977年12月"，则身份证号码字段可填入"******197712******"脱敏形式的身份证号码。如"1983年生"，可填入"******1983********"，注意使用星号补齐身份证号长度；
省份、市级、区级等信息若未明确提及可由单位等信息推出, 应该完整表达，比如"内蒙古自治区"而不是"内蒙古"；
采集时间统一为当前时间: {{currentDate}}
级别按照单位名称推断，可选值有"省级 市级 县级 直辖市区 直辖市 镇级"；
相邻且姓名相同的认定为同一人，整合信息为一个即可；
表格以markdown标准表格格式输出；`;

    // 获取 System Prompt，支持用户自定义 + 模板变量替换
    function getSystemPrompt() {
        const customPrompt = GM_getValue('scraper_system_prompt', '');
        const template = customPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
        return template.replace(/\{\{currentDate\}\}/g, currentTimeFormatted());
    }
    // 历史记录存储Key
    const HISTORY_KEY = 'scraper_history_v4';

    // =====================================================================
    // 宿主页面样式 — 仅用于选中元素高亮和光标（作用于宿主页面DOM）
    // =====================================================================
    GM_addStyle(`
        .scraper-highlight {
            outline: 3px solid #ff4757 !important;
            outline-offset: 2px !important;
            background-color: rgba(255, 71, 87, 0.15) !important;
            cursor: crosshair !important;
            border-radius: 4px !important;
            animation: scraperPulse 1.5s ease-in-out infinite !important;
        }
        @keyframes scraperPulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
        }
        .scraper-selecting { cursor: crosshair !important; }
        /* 确保 Shadow Host 不受宿主页面样式影响 — 逐属性重置，避免 all:initial !important 覆盖 inline style */
        #scraper-shadow-host {
            position: fixed !important;
            z-index: 2147483647 !important;
            display: block !important;
            width: 260px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            pointer-events: auto !important;
            box-sizing: border-box !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            line-height: 1.5 !important;
            font-size: 14px !important;
            color: #1a1a2e !important;
            text-align: left !important;
            vertical-align: baseline !important;
            float: none !important;
            clear: none !important;
            overflow: visible !important;
            visibility: visible !important;
            opacity: 1 !important;
            transform: none !important;
            animation: none !important;
            transition: none !important;
        }
    `);

    // =====================================================================
    // Shadow DOM 样式 — 所有面板/弹窗样式均在此，完全隔离
    // =====================================================================
    const SHADOW_CSS = `
        /* ============ 主面板 ============ */
        *, *::before, *::after {
            box-sizing: border-box;
        }

        :host {
            /* Shadow host 的定位由宿主页面的 GM_addStyle 控制 */
            /* 这里只设置继承给子元素的默认值 */
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #1a1a2e;
        }

        .scraper-panel.collapsed-mode { overflow: hidden; }
        .scraper-panel.collapsed-mode .scraper-body { display: none; }
        .scraper-panel.collapsed-mode .scraper-header {
            margin: 0;
            padding: 6px 10px;
            border-bottom: none;
        }
        .scraper-panel.collapsed-mode .scraper-title-text { display: none; }

        .scraper-panel.dragging-mode {
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.22), 0 4px 16px rgba(0, 0, 0, 0.18) !important;
            transform: scale(1.02);
        }

        .scraper-panel {
            background: #ffffff;
            border: 1px solid rgba(0, 0, 0, 0.06);
            border-radius: 14px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);
            padding: 0;
            overflow: hidden;
            transition: box-shadow 0.25s ease, transform 0.15s ease;
            animation: slideInRight 0.4s ease-out;
            cursor: move;
            user-select: none;
        }

        .scraper-panel:hover {
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        /* ============ 头部 ============ */
        .scraper-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            border-bottom: 1px solid #f0f0f5;
            background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
        }

        .scraper-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: 700;
            color: #2d3436;
            margin: 0;
            flex: 1;
            letter-spacing: 0.3px;
        }

        .scraper-title-icon {
            font-size: 16px;
            line-height: 1;
        }

        .scraper-controls {
            display: flex;
            gap: 2px;
            align-items: center;
        }

        .scraper-ctrl-btn {
            width: 26px;
            height: 26px;
            padding: 0;
            margin: 0;
            border: none;
            background: transparent;
            color: #8395a7;
            cursor: pointer;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.15s ease;
            box-shadow: none;
            line-height: 1;
        }

        .scraper-ctrl-btn:hover {
            background: #f1f2f6;
            color: #3742fa;
        }

        .scraper-ctrl-btn:active {
            transform: scale(0.88);
        }

        /* ============ 面板内容区 ============ */
        .scraper-body {
            padding: 12px 14px 14px;
        }

        /* ============ 模式选择器 ============ */
        .scraper-mode-bar {
            display: flex;
            background: #f1f3f8;
            border-radius: 8px;
            padding: 3px;
            gap: 2px;
            margin-bottom: 12px;
        }

        .scraper-mode-bar label {
            flex: 1;
            margin: 0;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            color: #8395a7;
            padding: 5px 0;
            text-align: center;
            border-radius: 6px;
            transition: all 0.2s ease;
            user-select: none;
            letter-spacing: 0.3px;
        }

        .scraper-mode-bar label:hover {
            color: #576574;
            background: rgba(0, 0, 0, 0.04);
        }

        .scraper-mode-bar input[type="radio"] {
            display: none;
        }

        .scraper-mode-bar input[type="radio"]:checked + label {
            background: linear-gradient(135deg, #3742fa 0%, #2d3bea 100%);
            color: #fff;
            box-shadow: 0 2px 6px rgba(55, 66, 250, 0.35);
        }

        /* ============ 按钮组 ============ */
        .scraper-btn {
            cursor: pointer;
            padding: 9px 14px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 12.5px;
            width: 100%;
            margin-bottom: 6px;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            color: white;
            letter-spacing: 0.2px;
            text-align: center;
            line-height: 1.4;
            box-sizing: border-box;
        }

        .scraper-btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: width 0.4s, height 0.4s;
        }

        .scraper-btn:hover::before {
            width: 300px;
            height: 300px;
        }

        .scraper-btn:hover {
            transform: translateY(-1px);
        }

        .scraper-btn:active {
            transform: translateY(0);
        }

        .scraper-btn:disabled {
            cursor: not-allowed;
            transform: none !important;
            filter: grayscale(0.4) brightness(0.85);
        }

        .scraper-btn:disabled::before { display: none; }

        /* 主操作按钮 */
        .scraper-btn--primary {
            background: linear-gradient(135deg, #3742fa 0%, #2d3bea 100%);
            box-shadow: 0 2px 8px rgba(55, 66, 250, 0.3);
        }
        .scraper-btn--primary:hover {
            box-shadow: 0 4px 14px rgba(55, 66, 250, 0.4);
        }

        /* 绿色/成功按钮 */
        .scraper-btn--success {
            background: linear-gradient(135deg, #00b894 0%, #00a381 100%);
            box-shadow: 0 2px 8px rgba(0, 184, 148, 0.3);
        }
        .scraper-btn--success:hover {
            box-shadow: 0 4px 14px rgba(0, 184, 148, 0.4);
        }

        /* 次要操作按钮 */
        .scraper-btn--secondary {
            background: linear-gradient(135deg, #636e72 0%, #576574 100%);
            box-shadow: 0 2px 6px rgba(99, 110, 114, 0.2);
        }
        .scraper-btn--secondary:hover {
            box-shadow: 0 4px 12px rgba(99, 110, 114, 0.3);
        }

        /* 紫色按钮 */
        .scraper-btn--purple {
            background: linear-gradient(135deg, #6c5ce7 0%, #5a4bd1 100%);
            box-shadow: 0 2px 6px rgba(108, 92, 231, 0.3);
        }
        .scraper-btn--purple:hover {
            box-shadow: 0 4px 12px rgba(108, 92, 231, 0.4);
        }

        /* 红色按钮 */
        .scraper-btn--danger {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            box-shadow: 0 2px 6px rgba(231, 76, 60, 0.3);
        }
        .scraper-btn--danger:hover {
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
        }

        /* 警告按钮 */
        .scraper-btn--warning {
            background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
            color: #1a1a2e;
            box-shadow: 0 2px 6px rgba(243, 156, 18, 0.3);
        }
        .scraper-btn--warning:hover {
            box-shadow: 0 4px 12px rgba(243, 156, 18, 0.4);
        }

        /* 小按钮 */
        .scraper-btn--sm {
            width: auto;
            padding: 6px 14px;
            font-size: 12px;
            margin: 0;
        }

        /* ============ 状态栏 ============ */
        .scraper-status {
            font-size: 11.5px;
            color: #636e72;
            white-space: pre-wrap;
            word-break: break-all;
            max-height: 100px;
            overflow-y: auto;
            background: #f8f9fc;
            border-radius: 8px;
            padding: 8px 10px;
            margin-top: 8px;
            border-left: 3px solid #3742fa;
            font-family: 'SF Mono', 'Monaco', 'Consolas', 'Menlo', monospace;
            line-height: 1.5;
        }

        .scraper-status::-webkit-scrollbar { width: 3px; }
        .scraper-status::-webkit-scrollbar-track { background: transparent; }
        .scraper-status::-webkit-scrollbar-thumb { background: #d1d8e0; border-radius: 2px; }

        /* ============ 模态框 ============ */
        .scraper-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(4px);
            z-index: 100000;
            display: flex;
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.25s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .scraper-modal {
            background: #ffffff;
            padding: 24px;
            border-radius: 16px;
            min-width: 400px;
            max-width: 85vw;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04);
            position: relative;
            display: flex;
            flex-direction: column;
            animation: scaleIn 0.25s ease-out;
        }

        @keyframes scaleIn {
            from { transform: scale(0.92); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }

        .scraper-modal h3 {
            margin: 0 0 16px 0;
            color: #1a1a2e;
            font-weight: 700;
            font-size: 17px;
            letter-spacing: 0.2px;
        }

        /* ============ 表格 ============ */
        .scraper-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 12px 0;
            font-size: 12.5px;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
        }

        .scraper-table th,
        .scraper-table td {
            padding: 10px 14px;
            text-align: left;
            white-space: pre-wrap;
            word-break: break-word;
            border-bottom: 1px solid #f0f0f5;
        }

        .scraper-table th {
            background: #f8f9fc;
            font-weight: 600;
            position: sticky;
            top: 0;
            color: #576574;
            font-size: 11.5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .scraper-table tr:hover td {
            background-color: #f8f9ff;
        }

        .scraper-table tr:last-child td {
            border-bottom: none;
        }

        .scraper-table td:empty::before {
            content: '-';
            color: #c8d6e5;
            font-style: italic;
        }

        /* 历史记录表格容器 */
        .history-scroll {
            max-height: 60vh;
            overflow-y: auto;
            border: 1px solid #f0f0f5;
            margin: 12px 0;
            border-radius: 8px;
            background: #fafbff;
        }

        .history-scroll::-webkit-scrollbar { width: 5px; }
        .history-scroll::-webkit-scrollbar-track { background: transparent; }
        .history-scroll::-webkit-scrollbar-thumb { background: #c8d6e5; border-radius: 3px; }

        /* ============ 模态框底部按钮组 ============ */
        .scraper-modal-actions {
            text-align: right;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 16px;
            padding-top: 14px;
            border-top: 1px solid #f0f0f5;
        }

        .scraper-modal-actions .scraper-btn {
            width: auto;
            margin: 0;
        }

        /* ============ 模态框状态文字 ============ */
        .scraper-modal-status {
            font-size: 12.5px;
            color: #636e72;
            margin: 8px 0;
            padding: 8px 12px;
            background: #f8f9fc;
            border-radius: 8px;
            border-left: 3px solid #3742fa;
            line-height: 1.5;
        }

        /* ============ 加载动画 ============ */
        .spinner {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2.5px solid #e9ecef;
            border-top: 2.5px solid #3742fa;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* ============ 输入框 ============ */
        .scraper-textarea {
            width: 100%;
            min-height: 260px;
            margin: 10px 0;
            padding: 12px 14px;
            border: 1.5px solid #e0e3eb;
            border-radius: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13.5px;
            resize: vertical;
            box-sizing: border-box;
            line-height: 1.7;
            color: #2d3436;
            transition: border-color 0.2s, box-shadow 0.2s;
            background: #fafbff;
        }

        .scraper-textarea:focus {
            outline: none;
            border-color: #3742fa;
            box-shadow: 0 0 0 3px rgba(55, 66, 250, 0.1);
            background: #fff;
        }

        /* ============ 选择模式提示 ============ */
        @keyframes fadeInScale {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        @keyframes fadeOutScale {
            from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }

        .scraper-hint {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(1);
            background: rgba(0, 0, 0, 0.82);
            color: white;
            padding: 14px 22px;
            border-radius: 12px;
            font-size: 13.5px;
            z-index: 100001;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            max-width: 280px;
            line-height: 1.6;
            animation: fadeInScale 0.3s ease-out;
        }

        .scraper-hint.fading-out {
            animation: fadeOutScale 0.4s ease-out forwards;
        }

        /* ============ 文本预览区 ============ */
        .preview-wrapper {
            margin-top: 10px;
            border: 1px solid #f0f0f5;
            border-radius: 8px;
            overflow: hidden;
            background: #fafbff;
        }

        .preview-toggle {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 7px 12px;
            background: #f1f3f8;
            cursor: pointer;
            font-size: 11.5px;
            font-weight: 500;
            color: #576574;
            user-select: none;
            transition: background 0.2s;
        }

        .preview-toggle:hover { background: #e8eaf0; }

        .toggle-arrow {
            transition: transform 0.3s ease;
            font-size: 10px;
        }

        .toggle-arrow.expanded { transform: rotate(180deg); }

        .preview-body {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }

        .preview-body.expanded {
            max-height: 200px;
            overflow-y: auto;
        }

        .preview-body pre {
            margin: 0;
            padding: 10px 12px;
            font-size: 11px;
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
            color: #576574;
            white-space: pre-wrap;
            word-break: break-all;
            line-height: 1.5;
        }

        .preview-body::-webkit-scrollbar { width: 3px; }
        .preview-body::-webkit-scrollbar-track { background: transparent; }
        .preview-body::-webkit-scrollbar-thumb { background: #d1d8e0; border-radius: 2px; }

        /* ============ 帮助弹窗内容 ============ */
        .help-scroll {
            max-height: 58vh;
            overflow-y: auto;
            padding-right: 6px;
        }

        .help-scroll::-webkit-scrollbar { width: 3px; }
        .help-scroll::-webkit-scrollbar-track { background: transparent; }
        .help-scroll::-webkit-scrollbar-thumb { background: #d1d8e0; border-radius: 2px; }

        .help-section {
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid #f0f0f5;
        }

        .help-section:last-child { border-bottom: none; margin-bottom: 0; }

        .help-section h4 {
            margin: 0 0 6px 0;
            font-size: 13.5px;
            color: #3742fa;
            font-weight: 600;
        }

        .help-section p {
            margin: 0;
            font-size: 12.5px;
            color: #576574;
            line-height: 1.6;
        }

        .help-section ul, .help-section ol {
            margin: 4px 0 0 0;
            padding-left: 20px;
            font-size: 12.5px;
            color: #576574;
            line-height: 1.8;
        }

        .help-section kbd {
            display: inline-block;
            padding: 1px 6px;
            font-size: 11px;
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
            color: #e74c3c;
            background: #fff;
            border: 1px solid #e0e3eb;
            border-radius: 4px;
            box-shadow: 0 1px 0 #e0e3eb;
        }

        .help-highlight-box {
            background: linear-gradient(135deg, #eef0ff 0%, #f8f9ff 100%);
            padding: 12px;
            border-radius: 8px;
            border-left: 3px solid #3742fa;
        }

        .help-warning-box {
            background: #fff9e6;
            padding: 12px;
            border-radius: 8px;
            border-left: 3px solid #f39c12;
        }

        /* ============ 进度条 ============ */
        .progress-track {
            width: 100%;
            height: 5px;
            background: #e9ecef;
            border-radius: 3px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3742fa, #2d3bea);
            transition: width 0.3s ease;
            border-radius: 3px;
        }

        /* ============ 配置页面 ============ */
        .config-group {
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid #f0f0f5;
        }

        .config-group:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        .config-group-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: 600;
            color: #2d3436;
            margin: 0 0 8px 0;
        }

        .config-group-title .config-group-icon {
            font-size: 15px;
            line-height: 1;
        }

        .config-group-desc {
            font-size: 12px;
            color: #8395a7;
            margin: 0 0 10px 0;
            line-height: 1.5;
        }

        .config-field {
            margin-bottom: 10px;
        }

        .config-field:last-child {
            margin-bottom: 0;
        }

        .config-label {
            display: block;
            font-size: 12.5px;
            font-weight: 500;
            color: #576574;
            margin-bottom: 5px;
        }

        .config-input {
            width: 100%;
            padding: 9px 12px;
            border: 1.5px solid #e0e3eb;
            border-radius: 8px;
            font-family: 'SF Mono', 'Monaco', 'Consolas', 'Menlo', monospace;
            font-size: 13px;
            color: #2d3436;
            background: #fafbff;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
            line-height: 1.5;
        }

        .config-input:focus {
            outline: none;
            border-color: #3742fa;
            box-shadow: 0 0 0 3px rgba(55, 66, 250, 0.1);
            background: #fff;
        }

        .config-input::placeholder {
            color: #b2bec3;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        select.config-input {
            cursor: pointer;
            padding-right: 28px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23576574' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            appearance: none;
            -webkit-appearance: none;
        }

        .config-status {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11.5px;
            font-weight: 500;
            padding: 3px 8px;
            border-radius: 4px;
            margin-top: 6px;
        }

        .config-status--ok {
            color: #00b894;
            background: rgba(0, 184, 148, 0.1);
        }

        .config-status--empty {
            color: #e17055;
            background: rgba(225, 112, 85, 0.1);
        }

        .config-save-hint {
            font-size: 12px;
            color: #636e72;
            margin-top: 12px;
            padding: 8px 12px;
            background: #f8f9fc;
            border-radius: 6px;
            line-height: 1.5;
        }

        .config-slider-row {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .config-slider-bound {
            font-size: 11px;
            color: #8395a7;
            font-weight: 500;
            white-space: nowrap;
            min-width: 32px;
        }

        .config-range {
            -webkit-appearance: none;
            appearance: none;
            flex: 1;
            height: 6px;
            border-radius: 3px;
            background: #e0e3eb;
            outline: none;
            margin: 0;
            padding: 0;
            cursor: pointer;
        }

        .config-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, #3742fa 0%, #2d3bea 100%);
            box-shadow: 0 2px 6px rgba(55, 66, 250, 0.35);
            cursor: pointer;
            border: 2px solid #fff;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .config-range::-webkit-slider-thumb:hover {
            transform: scale(1.15);
            box-shadow: 0 3px 10px rgba(55, 66, 250, 0.45);
        }

        .config-range::-webkit-slider-thumb:active {
            transform: scale(1.05);
        }

        .config-range::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, #3742fa 0%, #2d3bea 100%);
            box-shadow: 0 2px 6px rgba(55, 66, 250, 0.35);
            cursor: pointer;
            border: 2px solid #fff;
        }

        .config-range::-moz-range-track {
            height: 6px;
            border-radius: 3px;
            background: #e0e3eb;
        }

        .config-range:focus {
            outline: none;
        }

        .config-range:focus-visible {
            outline: 2px solid rgba(55, 66, 250, 0.4);
            outline-offset: 3px;
            border-radius: 3px;
        }

        /* ============ 筛选信息提示 ============ */
        .scraper-filter-info {
            font-size: 12px;
            color: #00b894;
            margin: 0 0 4px 0;
            padding: 8px 12px;
            background: rgba(0, 184, 148, 0.08);
            border-radius: 6px;
            border-left: 3px solid #00b894;
            line-height: 1.5;
        }

        .scraper-filter-info--disabled {
            color: #8395a7;
            background: rgba(131, 149, 167, 0.08);
            border-left-color: #b2bec3;
        }

        /* ============ 响应式 ============ */
        @media (max-width: 768px) {
            .scraper-modal {
                max-width: 95vw;
                max-height: 90vh;
                margin: 10px;
                padding: 16px;
            }
        }
    `;

    // =====================================================================
    // 辅助函数
    // =====================================================================

    async function getCrossOriginPageContent(items, extractor, onProgress) {
        const itemList = Array.isArray(items) ? items : [items];
        const results = new Array(itemList.length);
        const CONCURRENCY = getConcurrency();

        const gmFetch = async (url) => {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    responseType: "arraybuffer",
                    timeout: 15000,
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`HTTP错误：状态码 ${response.status}`));
                        }
                    },
                    onerror: (err) => {
                        reject(new Error(`网络错误: ${err}`));
                    },
                    ontimeout: () => {
                        reject(new Error("请求超时"));
                    }
                });
            });
        };

        /**
         * 检测HTML中的JS重定向和meta refresh重定向并提取目标URL
         * 常见模式: 
         * 1. <script>document.location.href="...";</script>
         * 2. <script>window.location="...";</script>
         * 3. <meta http-equiv="refresh" content="0;URL=..." />
         */
        const detectRedirect = (html) => {
            // 1. 使用 DOM 解析检测 meta refresh 重定向（更健壮，支持任意属性顺序）
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const metaRefresh = doc.querySelector('meta[http-equiv="refresh" i]');
                if (metaRefresh) {
                    const content = metaRefresh.getAttribute('content');
                    if (content) {
                        // content 格式: "0;URL=..." 或 "0; url=..." 或 "5;url=..."
                        const urlMatch = content.match(/url\s*=\s*(.+)/i);
                        if (urlMatch && urlMatch[1]) {
                            return urlMatch[1].trim().replace(/^['"]|['"]$/g, '');
                        }
                    }
                }
            } catch (e) {
                console.warn('DOM 解析 meta refresh 失败，回退到正则匹配', e);
            }

            // 2. 检测 JS 重定向
            const patterns = [
                /document\.location\.href\s*=\s*['"]([^'"]+)['"]/i,
                /document\.location\s*=\s*['"]([^'"]+)['"]/i,
                /window\.location\.href\s*=\s*['"]([^'"]+)['"]/i,
                /window\.location\s*=\s*['"]([^'"]+)['"]/i,
                /location\.replace\s*\(\s*['"]([^'"]+)['"]\s*\)/i,
                /location\.assign\s*\(\s*['"]([^'"]+)['"]\s*\)/i,
            ];
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            return null;
        };

        const fetchOne = async (item, index) => {
            const maxRedirects = 3;
            let currentUrl = item.url;
            try {
                let html;
                let redirectCount = 0;
                while (redirectCount < maxRedirects) {
                    // console.log('url', currentUrl);
                    const response = await gmFetch(currentUrl);
                    const buffer = response.response;
                    html = await decodeHtmlBuffer(buffer);
                    // console.log('html', html);

                    // 检测重定向（meta refresh 和 JS 重定向）
                    const redirectUrl = detectRedirect(html);
                    if (redirectUrl) {
                        // 解析相对URL为绝对URL
                        const absoluteUrl = new URL(redirectUrl, currentUrl).href;
                        console.log(`检测到重定向: ${currentUrl} -> ${absoluteUrl}`);
                        currentUrl = absoluteUrl;
                        redirectCount++;
                    } else {
                        break;
                    }
                }
                if (redirectCount >= maxRedirects) {
                    console.warn(`重定向次数超过上限(${maxRedirects})，停止跟随`);
                }
                const parser = new DOMParser();
                const dom = parser.parseFromString(html, 'text/html');
                const content = extractor ? extractor(dom, item) : { url: currentUrl, title: dom.title };
                results[index] = { url: currentUrl, success: true, data: content };
            } catch (error) {
                results[index] = { url: currentUrl, success: false, error: error.message };
            }
            if (onProgress) {
                const doneCount = results.filter(r => r !== undefined).length;
                onProgress(doneCount, itemList.length, results[index], index);
            }
        };

        // 并发池：最多同时 CONCURRENCY 个请求
        const executing = new Set();
        for (let i = 0; i < itemList.length; i++) {
            const p = fetchOne(itemList[i], i).then(() => { executing.delete(p); });
            executing.add(p);
            if (executing.size >= CONCURRENCY) {
                await Promise.race(executing);
            }
        }
        await Promise.all(executing);

        return Array.isArray(items) ? results : results[0];
    }

    /**
     * 从DOM中提取纯净的可见文本
     */
    function extractCleanText(dom) {
        const bodyClone = dom.body.cloneNode(true);
        const removeTags = ['script', 'style', 'noscript', 'svg', 'path', 'meta', 'link', 'header', 'footer'];
        removeTags.forEach(tag => {
            const elements = bodyClone.querySelectorAll(tag);
            elements.forEach(el => el.remove());
        });
        const walker = document.createTreeWalker(bodyClone, NodeFilter.SHOW_COMMENT, null, false);
        const comments = [];
        while (walker.nextNode()) { comments.push(walker.currentNode); }
        comments.forEach(comment => comment.remove());
        let text = bodyClone.textContent || bodyClone.innerText || '';
        text = text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
        return text;
    }

    /**
     * 从原始字节中检测编码并解码为HTML文本
     */
    async function decodeHtmlBuffer(buffer) {
        const tempDecoder = new TextDecoder('utf-8', { fatal: false });
        const tempHtml = tempDecoder.decode(buffer, { stream: true });
        const parser = new DOMParser();
        const dom = parser.parseFromString(tempHtml, 'text/html');
        let detectedCharset = 'utf-8';
        const charsetMeta = dom.querySelector('meta[charset]');
        if (charsetMeta) {
            detectedCharset = charsetMeta.getAttribute('charset').toLowerCase();
        } else {
            const httpEquivMeta = dom.querySelector('meta[http-equiv="Content-Type"]');
            if (httpEquivMeta) {
                const content = httpEquivMeta.getAttribute('content');
                const match = content.match(/charset=([^;\s]+)/i);
                if (match && match[1]) { detectedCharset = match[1].toLowerCase(); }
            }
        }
        if (detectedCharset && detectedCharset !== 'utf-8') {
            const finalDecoder = new TextDecoder(detectedCharset === 'gb2312' ? 'gbk' : detectedCharset, { fatal: false });
            return finalDecoder.decode(buffer);
        }
        return tempHtml;
    }

    // =====================================================================
    // 通用弹窗辅助：ESC 键关闭
    // =====================================================================
    function enableEscToClose(overlayEl, onClose) {
        const handler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                document.removeEventListener('keydown', handler, true);
                onClose();
            }
        };
        document.addEventListener('keydown', handler, true);
        // overlay 被移除时自动清理
        const observer = new MutationObserver(() => {
            if (!shadow.contains(overlayEl)) {
                document.removeEventListener('keydown', handler, true);
                observer.disconnect();
            }
        });
        observer.observe(shadow, { childList: true });
    }

    // =====================================================================
    // Shadow DOM 创建
    // =====================================================================
    const scraperHost = document.createElement('div');
    scraperHost.id = 'scraper-shadow-host';
    const shadow = scraperHost.attachShadow({ mode: 'open' });

    // 注入样式到 shadow root
    const shadowStyle = document.createElement('style');
    shadowStyle.textContent = SHADOW_CSS;
    shadow.appendChild(shadowStyle);

    // 创建主面板
    const panel = document.createElement('div');
    panel.className = 'scraper-panel';
    panel.innerHTML = `
        <div class="scraper-header">
            <div class="scraper-title">
                <span class="scraper-title-icon">📊</span>
                <span class="scraper-title-text">SScrape</span>
            </div>
            <div class="scraper-controls">
                <button class="scraper-ctrl-btn" id="config-btn" title="配置">⚙</button>
                <button class="scraper-ctrl-btn" id="help-btn" title="使用说明">?</button>
                <button class="scraper-ctrl-btn" id="collapse-btn" title="折叠/展开">−</button>
                <button class="scraper-ctrl-btn" id="close-btn" title="关闭">×</button>
            </div>
        </div>
        <div class="scraper-body">
            <div class="scraper-mode-bar">
                <input type="radio" name="scraper-mode" value="auto" id="mode-auto" checked>
                <label for="mode-auto">Auto</label>
                <input type="radio" name="scraper-mode" value="text" id="mode-text">
                <label for="mode-text">Text</label>
                <input type="radio" name="scraper-mode" value="link" id="mode-link">
                <label for="mode-link">Link</label>
                <input type="radio" name="scraper-mode" value="ocr" id="mode-ocr">
                <label for="mode-ocr">OCR</label>
            </div>
            <button class="scraper-btn scraper-btn--success" id="quick-extract-btn">⚡ 一键解析</button>
            <button class="scraper-btn scraper-btn--primary" id="start-btn">开始选择元素</button>
            <button class="scraper-btn scraper-btn--secondary" id="custom-input-btn">自定义输入</button>
            <button class="scraper-btn scraper-btn--purple" id="history-btn">查看解析历史记录</button>
            <div class="scraper-status" id="status-div">准备就绪。</div>
        </div>
    `;
    shadow.appendChild(panel);
    document.body.appendChild(scraperHost);

    // =====================================================================
    // DOM 引用（全部通过 shadow root）
    // =====================================================================
    const startBtn = shadow.getElementById('start-btn');
    const quickExtractBtn = shadow.getElementById('quick-extract-btn');
    const customInputBtn = shadow.getElementById('custom-input-btn');
    const historyBtn = shadow.getElementById('history-btn');
    const statusDiv = shadow.getElementById('status-div');
    const collapseBtn = shadow.getElementById('collapse-btn');
    const closeBtn = shadow.getElementById('close-btn');
    const helpBtn = shadow.getElementById('help-btn');

    let highlightedElement = null;

    // =====================================================================
    // 拖拽功能
    // =====================================================================
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let animationFrame = null;

    // 加载保存的位置（默认右上角）
    const savedPosition = GM_getValue('scraper_position', null);
    if (savedPosition) {
        scraperHost.style.left = savedPosition.x + 'px';
        scraperHost.style.top = savedPosition.y + 'px';
        scraperHost.style.right = 'auto';
    } else {
        // 首次使用，定位到右上角
        scraperHost.style.right = '20px';
        scraperHost.style.top = '20px';
        scraperHost.style.left = 'auto';
    }

    // 加载折叠状态
    const isCollapsed = GM_getValue('scraper_collapsed', false);
    if (isCollapsed) {
        panel.classList.add('collapsed-mode');
        scraperHost.style.width = 'auto';
        collapseBtn.textContent = '+';
    }

    function constrainPosition(x, y, w, h) {
        const maxX = window.innerWidth - w;
        const maxY = window.innerHeight - h;
        return {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY))
        };
    }

    // 从 header 区域发起拖拽
    const headerEl = shadow.querySelector('.scraper-header');
    headerEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return; // 不拦截按钮点击
        dragStart(e);
    });
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        e.preventDefault();
        const rect = scraperHost.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        isDragging = true;
        panel.classList.add('dragging-mode');
        scraperHost.style.cursor = 'grabbing';
        scraperHost.style.transition = 'none';
    }

    function dragMove(e) {
        if (!isDragging) return;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(() => {
            const newX = e.clientX - dragOffsetX;
            const newY = e.clientY - dragOffsetY;
            const rect = scraperHost.getBoundingClientRect();
            const constrained = constrainPosition(newX, newY, rect.width, rect.height);
            scraperHost.style.left = constrained.x + 'px';
            scraperHost.style.top = constrained.y + 'px';
            scraperHost.style.right = 'auto';
        });
    }

    function dragEnd() {
        if (!isDragging) return;
        isDragging = false;
        panel.classList.remove('dragging-mode');
        scraperHost.style.cursor = '';
        scraperHost.style.transition = '';
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        const rect = scraperHost.getBoundingClientRect();
        scraperHost.style.right = 'auto';
        GM_setValue('scraper_position', { x: rect.left, y: rect.top });
    }

    // 防止拖拽时选中文本
    panel.addEventListener('selectstart', (e) => {
        if (isDragging) e.preventDefault();
    });

    // =====================================================================
    // 折叠 / 关闭 / 帮助
    // =====================================================================
    collapseBtn.addEventListener('click', () => {
        const isCurrentlyCollapsed = panel.classList.contains('collapsed-mode');
        if (isCurrentlyCollapsed) {
            panel.classList.remove('collapsed-mode');
            scraperHost.style.width = '260px';
            collapseBtn.textContent = '−';
            GM_setValue('scraper_collapsed', false);
        } else {
            panel.classList.add('collapsed-mode');
            scraperHost.style.width = 'auto';
            collapseBtn.textContent = '+';
            GM_setValue('scraper_collapsed', true);
        }
    });

    closeBtn.addEventListener('click', () => {
        if (confirm('确定要关闭数据抓取器吗？刷新页面可重新打开。')) {
            scraperHost.style.display = 'none';
        }
    });

    helpBtn.addEventListener('click', () => {
        showHelpDialog();
    });

    const configBtn = shadow.getElementById('config-btn');
    configBtn.addEventListener('click', () => {
        showConfigDialog();
    });

    function showConfigDialog() {
        const currentOcrToken = GM_getValue('paddleocr_token', '') || '';
        const hasToken = currentOcrToken.trim().length > 0;
        const currentMaxInputSize = GM_getValue('scraper_max_input_size', 1024 * 50);
        const currentSystemPrompt = GM_getValue('scraper_system_prompt', '');
        const currentModelConfig = getModelConfig();
        const currentConcurrency = getConcurrency();
        const currentAutoCopy = getAutoCopy();
        const currentDataFilter = getDataFilter();

        const overlay = document.createElement('div');
        overlay.className = 'scraper-overlay';
        overlay.innerHTML = `
            <div class="scraper-modal" style="max-width: 600px; width: 90vw;">
                <h3>配置</h3>
                <div class="help-scroll">
                    <div class="config-group">
                        <div class="config-group-title">
                            <span class="config-group-icon">🔑</span>
                            OCR Token
                        </div>
                        <p class="config-group-desc">使用OCR图片识别功能需要配置Token，请前往 <a href="https://aistudio.baidu.com/account/accessToken" target="_blank" style="color: #3742fa; text-decoration: underline;">PaddleOCR开放平台</a> 获取API Token后填入。</p>
                        <div class="config-field">
                            <label class="config-label" for="config-ocr-token">PaddleOCR Token</label>
                            <input type="password" class="config-input" id="config-ocr-token"
                                   value="${currentOcrToken.replace(/"/g, '&quot;')}"
                                   placeholder="请输入OCR API Token..." />
                            <div class="config-status ${hasToken ? 'config-status--ok' : 'config-status--empty'}" id="config-ocr-status">
                                ${hasToken ? '✓ 已配置' : '✗ 未配置'}
                            </div>
                        </div>
                    </div>
                    <div class="config-group">
                        <div class="config-group-title">
                            <span class="config-group-icon">📏</span>
                            AI 单次最大输入大小
                        </div>
                        <p class="config-group-desc">控制每次调用AI解析时单个文本块的最大字节数。值过小会增加API调用次数，值过大可能超出模型输入限制。拖动滑块调整，范围 1~100 KB。</p>
                        <div class="config-field">
                            <label class="config-label">最大输入大小：<strong id="config-max-input-label">${(currentMaxInputSize / 1024).toFixed(0)} KB</strong></label>
                            <div class="config-slider-row">
                                <span class="config-slider-bound">1 KB</span>
                                <input type="range" class="config-range" id="config-max-input-size"
                                       value="${currentMaxInputSize / 1024}"
                                       min="1" max="100" step="1" />
                                <span class="config-slider-bound">100 KB</span>
                            </div>
                        </div>
                    </div>
                    <div class="config-group">
                        <div class="config-group-title">
                            <span class="config-group-icon">🧠</span>
                            大模型参数
                        </div>
                        <p class="config-group-desc">配置AI解析时使用的大模型及推理参数。模型不同，输出质量和速度有差异；Temperature 越高输出越随机，Top-K/Top-P 控制采样范围。</p>
                        <div class="config-field">
                            <label class="config-label" for="config-model">模型 (Model)</label>
                            <select class="config-input" id="config-model">
                                ${MODEL_LIST.map(m => `<option value="${m}" ${m === currentModelConfig.model ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                        </div>
                        <div class="config-field">
                            <label class="config-label">Temperature：<strong id="config-temperature-label">${currentModelConfig.temperature.toFixed(1)}</strong></label>
                            <div class="config-slider-row">
                                <span class="config-slider-bound">0</span>
                                <input type="range" class="config-range" id="config-temperature"
                                       value="${currentModelConfig.temperature}" min="0" max="2" step="0.1" />
                                <span class="config-slider-bound">2</span>
                            </div>
                        </div>
                        <div class="config-field">
                            <label class="config-label">Top-K：<strong id="config-top-k-label">${currentModelConfig.topK}</strong></label>
                            <div class="config-slider-row">
                                <span class="config-slider-bound">1</span>
                                <input type="range" class="config-range" id="config-top-k"
                                       value="${currentModelConfig.topK}" min="1" max="100" step="1" />
                                <span class="config-slider-bound">100</span>
                            </div>
                        </div>
                        <div class="config-field">
                            <label class="config-label">Top-P：<strong id="config-top-p-label">${currentModelConfig.topP.toFixed(2)}</strong></label>
                            <div class="config-slider-row">
                                <span class="config-slider-bound">0</span>
                                <input type="range" class="config-range" id="config-top-p"
                                       value="${currentModelConfig.topP}" min="0" max="1" step="0.01" />
                                <span class="config-slider-bound">1</span>
                            </div>
                        </div>
                    </div>
                    <div class="config-group">
                        <div class="config-group-title">
                            <span class="config-group-icon">⚡</span>
                            抓取与行为
                        </div>
                        <p class="config-group-desc">控制链接抓取的并发数量、解析完成后的自动复制行为以及数据筛选功能。</p>
                        <div class="config-field">
                            <label class="config-label">链接抓取并发数：<strong id="config-concurrency-label">${currentConcurrency}</strong></label>
                            <div class="config-slider-row">
                                <span class="config-slider-bound">1</span>
                                <input type="range" class="config-range" id="config-concurrency"
                                       value="${currentConcurrency}" min="1" max="10" step="1" />
                                <span class="config-slider-bound">10</span>
                            </div>
                        </div>
                        <div class="config-field">
                            <label class="config-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="config-auto-copy" ${currentAutoCopy ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #3742fa;" />
                                解析完成后自动复制结果到剪贴板
                            </label>
                        </div>
                        <div class="config-field">
                            <label class="config-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="config-data-filter" ${currentDataFilter ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #3742fa;" />
                                自动筛选解析数据（去重+删除空姓名空职务行）
                            </label>
                        </div>
                    </div>
                    <div class="config-group">
                        <div class="config-group-title">
                            <span class="config-group-icon">🤖</span>
                            System Prompt
                        </div>
                        <p class="config-group-desc">自定义AI解析时使用的系统提示词。修改后保存即生效，点击「恢复默认模板」可还原。模板变量：<code style="background: #f1f3f8; padding: 1px 5px; border-radius: 3px; font-size: 11.5px; color: #e74c3c;">{{currentDate}}</code> = 当前日期（YYYYMMDD格式）。</p>
                        <div class="config-field">
                            <label class="config-label" for="config-system-prompt">System Prompt 内容</label>
                            <textarea class="scraper-textarea" id="config-system-prompt"
                                      style="min-height: 180px; font-size: 12.5px; line-height: 1.6;"
                                      placeholder="">${(currentSystemPrompt.trim() || DEFAULT_SYSTEM_PROMPT).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                            <div class="config-status config-status--empty" id="config-prompt-status">
                                使用默认模板
                            </div>
                        </div>
                        <div style="margin-top: 6px;">
                            <button class="scraper-btn scraper-btn--secondary scraper-btn--sm" id="config-reset-prompt-btn" style="margin: 0; width: auto;">恢复默认模板</button>
                        </div>
                    </div>
                    <div class="config-save-hint">
                        💡 修改后点击「保存」按钮生效，配置信息仅保存在本地浏览器中。
                    </div>
                </div>
                <div class="scraper-modal-actions">
                    <button class="scraper-btn scraper-btn--success scraper-btn--sm" id="config-save-btn">保存</button>
                    <button class="scraper-btn scraper-btn--secondary scraper-btn--sm" id="config-cancel-btn">取消</button>
                </div>
            </div>
        `;
        shadow.appendChild(overlay);
        enableEscToClose(overlay, () => { if (shadow.contains(overlay)) shadow.removeChild(overlay); });

        const tokenInput = overlay.querySelector('#config-ocr-token');
        const statusEl = overlay.querySelector('#config-ocr-status');
        const maxInputSizeInput = overlay.querySelector('#config-max-input-size');
        const maxInputLabel = overlay.querySelector('#config-max-input-label');
        const modelSelect = overlay.querySelector('#config-model');
        const temperatureInput = overlay.querySelector('#config-temperature');
        const temperatureLabel = overlay.querySelector('#config-temperature-label');
        const topKInput = overlay.querySelector('#config-top-k');
        const topKLabel = overlay.querySelector('#config-top-k-label');
        const topPInput = overlay.querySelector('#config-top-p');
        const topPLabel = overlay.querySelector('#config-top-p-label');
        const concurrencyInput = overlay.querySelector('#config-concurrency');
        const concurrencyLabel = overlay.querySelector('#config-concurrency-label');
        const autoCopyCheckbox = overlay.querySelector('#config-auto-copy');
        const dataFilterCheckbox = overlay.querySelector('#config-data-filter');
        const promptTextarea = overlay.querySelector('#config-system-prompt');
        const promptStatusEl = overlay.querySelector('#config-prompt-status');
        const resetPromptBtn = overlay.querySelector('#config-reset-prompt-btn');
        const saveBtn = overlay.querySelector('#config-save-btn');
        const cancelBtn = overlay.querySelector('#config-cancel-btn');

        // Token 实时状态指示
        tokenInput.addEventListener('input', () => {
            const val = tokenInput.value.trim();
            const filled = val.length > 0;
            statusEl.className = `config-status ${filled ? 'config-status--ok' : 'config-status--empty'}`;
            statusEl.textContent = filled ? '✓ 已配置' : '✗ 未配置';
        });

        // Token 显示/隐藏切换
        tokenInput.addEventListener('dblclick', () => {
            tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
        });

        // maxInputSize 滑块实时更新
        maxInputSizeInput.addEventListener('input', () => {
            const kbVal = parseInt(maxInputSizeInput.value, 10);
            maxInputLabel.textContent = `${kbVal} KB`;
        });

        // Temperature 滑块实时更新
        temperatureInput.addEventListener('input', () => {
            temperatureLabel.textContent = parseFloat(temperatureInput.value).toFixed(1);
        });

        // Top-K 滑块实时更新
        topKInput.addEventListener('input', () => {
            topKLabel.textContent = parseInt(topKInput.value, 10);
        });

        // Top-P 滑块实时更新
        topPInput.addEventListener('input', () => {
            topPLabel.textContent = parseFloat(topPInput.value).toFixed(2);
        });

        // 并发数 滑块实时更新
        concurrencyInput.addEventListener('input', () => {
            concurrencyLabel.textContent = parseInt(concurrencyInput.value, 10);
        });

        // System Prompt 实时状态
        promptTextarea.addEventListener('input', () => {
            const val = promptTextarea.value.trim();
            const isDefault = val === DEFAULT_SYSTEM_PROMPT.trim();
            if (val.length === 0 || isDefault) {
                promptStatusEl.className = 'config-status config-status--empty';
                promptStatusEl.textContent = '使用默认模板';
            } else {
                promptStatusEl.className = 'config-status config-status--ok';
                promptStatusEl.textContent = '✓ 已自定义';
            }
        });

        // 恢复默认模板
        resetPromptBtn.addEventListener('click', () => {
            promptTextarea.value = DEFAULT_SYSTEM_PROMPT;
            promptStatusEl.className = 'config-status config-status--empty';
            promptStatusEl.textContent = '使用默认模板';
        });

        saveBtn.addEventListener('click', () => {
            // 保存 Token
            const newToken = tokenInput.value.trim();
            GM_setValue('paddleocr_token', newToken);

            // 保存 maxInputSize（滑块值单位为 KB，存储时转为 bytes）
            const kbVal = parseInt(maxInputSizeInput.value, 10);
            if (!isNaN(kbVal) && kbVal >= 1 && kbVal <= 100) {
                GM_setValue('scraper_max_input_size', kbVal * 1024);
            }

            // 保存大模型参数
            GM_setValue('scraper_model', modelSelect.value);
            const tempVal = parseFloat(temperatureInput.value);
            if (!isNaN(tempVal) && tempVal >= 0 && tempVal <= 2) {
                GM_setValue('scraper_temperature', tempVal);
            }
            const topKVal = parseInt(topKInput.value, 10);
            if (!isNaN(topKVal) && topKVal >= 1 && topKVal <= 100) {
                GM_setValue('scraper_top_k', topKVal);
            }
            const topPVal = parseFloat(topPInput.value);
            if (!isNaN(topPVal) && topPVal >= 0 && topPVal <= 1) {
                GM_setValue('scraper_top_p', topPVal);
            }

            // 保存并发数
            const concurrencyVal = parseInt(concurrencyInput.value, 10);
            if (!isNaN(concurrencyVal) && concurrencyVal >= 1 && concurrencyVal <= 10) {
                GM_setValue('scraper_concurrency', concurrencyVal);
            }

            // 保存自动复制
            GM_setValue('scraper_auto_copy', autoCopyCheckbox.checked);

            // 保存数据筛选
            GM_setValue('scraper_data_filter', dataFilterCheckbox.checked);

            // 保存 System Prompt（与默认模板相同时存空值，保持空=默认语义）
            const promptValue = promptTextarea.value.trim();
            GM_setValue('scraper_system_prompt', promptValue === DEFAULT_SYSTEM_PROMPT.trim() ? '' : promptTextarea.value);

            saveBtn.textContent = '已保存 ✓';
            saveBtn.disabled = true;
            setTimeout(() => {
                if (shadow.contains(overlay)) shadow.removeChild(overlay);
            }, 800);
        });

        cancelBtn.addEventListener('click', () => { shadow.removeChild(overlay); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) shadow.removeChild(overlay); });
    }

    function showHelpDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'scraper-overlay';
        overlay.innerHTML = `
            <div class="scraper-modal" style="max-width: 500px; width: 90vw;">
                <h3>功能介绍与使用说明</h3>
                <div class="help-scroll">
                    <div class="help-section help-highlight-box">
                        <h4>脚本简介</h4>
                        <p style="margin-bottom: 6px;"><strong>智能页面抓取器</strong> 是一个Tampermonkey脚本，专门用于<strong>抓取政府网站信息公开的人员公示数据</strong>。</p>
                        <p style="margin-bottom: 4px;">主要功能：</p>
                        <ul style="margin-bottom: 0;">
                            <li>从网页或链接中<strong>自动提取人员公示信息</strong>（姓名、身份证号、职务、单位等）</li>
                            <li>利用AI智能解析，将<strong>非结构化文本</strong>转换为<strong>结构化表格</strong>数据</li>
                            <li>支持<strong>一键批量抓取</strong>多个链接页面的内容</li>
                            <li>自动保存解析<strong>历史记录</strong>，方便后续查看和导出</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h4>功能模式</h4>
                        <ul>
                            <li><strong>Auto</strong> - 自动识别，选择元素后自动判断使用文本或链接模式</li>
                            <li><strong>Text</strong> - 文本模式，直接提取选中元素的文本内容</li>
                            <li><strong>Link</strong> - 链接模式，提取选中元素内所有链接页面的内容</li>
                            <li><strong>OCR</strong> - 图片识别模式，提取选中元素中的图片并调用OCR API识别文字</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h4>一键解析</h4>
                        <p>点击按钮或按 <kbd>Z</kbd> 键，直接提取当前页面全部文本内容并自动解析。无需选择元素。</p>
                    </div>
                    <div class="help-section">
                        <h4>选择元素</h4>
                        <ul>
                            <li>点击"开始选择元素"按钮或双击 <kbd>X</kbd> 进入选择模式</li>
                            <li>鼠标悬停在元素上会高亮显示</li>
                            <li><kbd>滚轮</kbd> 向上切换到父元素，向下切换到子元素</li>
                            <li>点击选中目标元素，<kbd>ESC</kbd> 取消选择</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h4>历史记录</h4>
                        <p>解析成功的数据会自动保存到历史记录，点击"查看解析历史记录"可以查看、复制或清空历史数据。</p>
                    </div>
                    <div class="help-section">
                        <h4>快捷键</h4>
                        <ul>
                            <li><kbd>Z</kbd> - 一键提取当前页面全部内容</li>
                            <li><kbd>X</kbd> 双击 - 进入元素选择模式</li>
                            <li><kbd>ESC</kbd> - 取消选择模式</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h4>使用技巧</h4>
                        <ul>
                            <li>选择包含所有链接的容器元素，避免逐个点击</li>
                            <li>页面内容过长时自动截断（最大5万字符）</li>
                            <li>可拖拽悬浮窗到任意位置</li>
                            <li>点击"−"可最小化面板</li>
                        </ul>
                    </div>
                    <div class="help-section">
                        <h4>OCR 图片识别</h4>
                        <p>选择OCR模式，选中包含图片的元素后，脚本会自动提取图片并调用OCR API识别文字。使用前请点击面板标题栏 <strong>⚙</strong> 按钮配置Token。</p>
                    </div>
                </div>
                <div class="scraper-modal-actions">
                    <button class="scraper-btn scraper-btn--primary scraper-btn--sm" id="help-close-btn">知道了</button>
                </div>
            </div>
        `;
        shadow.appendChild(overlay);
        enableEscToClose(overlay, () => { if (shadow.contains(overlay)) shadow.removeChild(overlay); });

        overlay.querySelector('#help-close-btn').addEventListener('click', () => {
            shadow.removeChild(overlay);
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) shadow.removeChild(overlay);
        });
    }

    // =====================================================================
    // 选中文本检测 & 状态更新
    // =====================================================================
    function debounce(fn, delay = 100) {
        let timer = null;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(() => { fn.apply(this, arguments); }, delay);
        };
    }

    function checkSelectedText() {
        const selectedText = window.getSelection().toString().trim();
        if (selectedText) {
            startBtn.textContent = "解析选中文本";
        } else {
            startBtn.textContent = "开始选择元素";
        }
        return selectedText;
    }

    const debouncedCheckSelectedText = debounce(checkSelectedText);
    ['mouseup', 'keyup', 'selectionchange'].forEach(event => {
        document.addEventListener(event, debouncedCheckSelectedText);
    });

    function updateStatus(message) {
        statusDiv.textContent = message;
        console.log(`[Scraper Status] ${message}`);
    }

    function getElementPath(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return 'N/A';
        let path = element.tagName.toLowerCase();
        if (element.id) path += `#${element.id}`;
        if (element.className) path += `.${element.className.split(' ').join('.')}`;
        return path;
    }

    function getSelectedMode() {
        return shadow.querySelector('input[name="scraper-mode"]:checked').value;
    }

    /**
     * 判断 a 元素的 href 是否为无效链接（javascript:void(0) 等）
     */
    function isVoidLink(a) {
        const href = a.getAttribute('href') || '';
        return /^\s*javascript\s*:/i.test(href.trim()) || href.trim() === '' || href.trim() === '#';
    }

    function getAutoModeHint(element) {
        if (!element) return '';
        const mode = getSelectedMode();
        if (mode !== 'auto') return '';
        const allLinks = element.querySelectorAll('a[href]');
        // 统计有效链接（排除 javascript:void(0) 等，但尝试从 onclick/data-* 提取的也算）
        const validCount = Array.from(allLinks).filter(a => {
            if (!isVoidLink(a)) return true;
            // void 链接但有 onclick 或 data-* 中可能有 URL
            const onclick = a.getAttribute('onclick') || '';
            if (onclick && /(?:location|open|href|navigate)/i.test(onclick)) return true;
            const dataAttrs = ['data-href', 'data-url', 'data-link', 'data-src'];
            for (const attr of dataAttrs) {
                if (a.getAttribute(attr)) return true;
            }
            return false;
        }).length;
        if (validCount > 0) return `\n→ Link模式 (${validCount}个链接)`;
        return '\n→ Text模式';
    }

    // =====================================================================
    // 元素选择模式
    // =====================================================================
    function startSelectElement() {
        document.body.classList.add('scraper-selecting');
        startBtn.disabled = true;
        const mode = getSelectedMode();
        let modeHint = '';
        if (mode === 'text') modeHint = '文本模式：';
        if (mode === 'link') modeHint = '链接模式：';

        // 创建选择提示框（加入 shadow root）
        const selectionHint = document.createElement('div');
        selectionHint.className = 'scraper-hint';
        selectionHint.id = 'selection-hint';
        selectionHint.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 6px; color: #ffd700;">
                ${modeHint}选择模式已激活
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
                移动鼠标选择元素<br>
                <span style="color: #87ceeb;">滚轮</span> 切换层级 | <span style="color: #87ceeb;">ESC</span> 取消
            </div>
        `;
        shadow.appendChild(selectionHint);

        const displayDuration = 1500;
        setTimeout(() => {
            selectionHint.classList.add('fading-out');
            selectionHint.addEventListener('animationend', () => {
                if (selectionHint.parentNode) selectionHint.parentNode.removeChild(selectionHint);
            }, { once: true });
        }, displayDuration);

        updateStatus(`${modeHint}请移动鼠标并点击要处理的元素...\n(滚轮可切换父/子元素，ESC取消选择)`);
        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseout', handleMouseOut);
        document.addEventListener('click', handleClick);
        document.addEventListener('wheel', handleWheel, { passive: false });
        document.addEventListener('keydown', handleKeyDown);
    }

    function handleClickStartBtn() {
        const selectedText = window.getSelection().toString().trim();
        if (selectedText) {
            updateStatus('检测到选中文本，直接使用选中文本进行解析...');
            parse_content(selectedText, () => startBtn.click());
            return;
        }
        startSelectElement();
    }

    startBtn.addEventListener('click', handleClickStartBtn);

    // 快捷键
    let xKeyClickCount = 0;
    let xKeyDoubleClickTimer = null;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'z' || e.key === 'Z' || e.keyCode === 90) {
            e.preventDefault();
            quickExtractBtn.click();
            return;
        }
        if (e.key === 'x' || e.key === 'X' || e.keyCode === 88) {
            e.preventDefault();
            xKeyClickCount++;
            clearTimeout(xKeyDoubleClickTimer);
            xKeyDoubleClickTimer = setTimeout(() => {
                if (xKeyClickCount === 2) {
                    handleClickStartBtn();
                }
                xKeyClickCount = 0;
                xKeyDoubleClickTimer = null;
            }, 300);
        }
    });

    // =====================================================================
    // 一键提取
    // =====================================================================
    quickExtractBtn.addEventListener('click', async () => {
        const originalText = quickExtractBtn.textContent;
        quickExtractBtn.disabled = true;
        quickExtractBtn.textContent = '正在提取...';

        try {
            updateStatus('正在提取页面全部内容...');
            const fullContent = extractFullPageContent();

            if (!fullContent || fullContent.trim().length === 0) {
                alert('未能提取到页面内容，请确保页面已完全加载。');
                updateStatus('页面内容提取失败。');
                return;
            }

            const contentLength = fullContent.length;
            updateStatus(`页面内容提取完成 (${contentLength} 字符)，正在调用AI解析，请稍候...`);
            await parse_content(fullContent, () => quickExtractBtn.click());

        } catch (error) {
            console.error('一键提取失败:', error);
            alert(`提取失败: ${error.message}`);
            updateStatus(`提取失败: ${error.message}`);
        } finally {
            quickExtractBtn.textContent = originalText;
            quickExtractBtn.disabled = false;
        }
    });

    function extractFullPageContent() {
        const bodyClone = document.body.cloneNode(true);
        const removeTags = ['script', 'style', 'noscript','svg', 'meta', 'link', 'header', 'footer', 'nav'];
        removeTags.forEach(tag => {
            const elements = bodyClone.querySelectorAll(tag);
            elements.forEach(el => el.remove());
        });
        // 移除自身面板
        const selfPanel = bodyClone.querySelector('#scraper-shadow-host');
        if (selfPanel) selfPanel.remove();

        // const hiddenElements = bodyClone.querySelectorAll('[style*="display: none"], [style*="display:none"], [hidden], [aria-hidden="true"]');
        // hiddenElements.forEach(el => el.remove());

        let text = bodyClone.textContent || bodyClone.innerText || '';
        text = text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

        const maxContentLength = 50000;
        if (text.length > maxContentLength) {
            text = text.substring(0, maxContentLength) + '\n...(内容过长，已截断)';
        }
        return text;
    }

    // =====================================================================
    // 自定义输入
    // =====================================================================
    customInputBtn.addEventListener('click', () => {
        showCustomInputDialog();
    });

    function showCustomInputDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'scraper-overlay';
        overlay.innerHTML = `
            <div class="scraper-modal" style="max-width: 680px; width: 90vw;">
                <h3>自定义输入内容</h3>
                <textarea class="scraper-textarea"
                          id="custom-text"
                          style="min-height: 320px; font-size: 13.5px; line-height: 1.7;"
                          placeholder="请在此粘贴或输入需要解析的文本内容..."></textarea>
                <div class="scraper-modal-actions">
                    <button class="scraper-btn scraper-btn--primary scraper-btn--sm" id="custom-confirm-btn">确认解析</button>
                    <button class="scraper-btn scraper-btn--secondary scraper-btn--sm" id="custom-cancel-btn">取消</button>
                </div>
            </div>
        `;
        shadow.appendChild(overlay);
        enableEscToClose(overlay, () => { if (shadow.contains(overlay)) shadow.removeChild(overlay); });

        const customTextarea = overlay.querySelector('#custom-text');
        const confirmBtn = overlay.querySelector('#custom-confirm-btn');
        const cancelBtn = overlay.querySelector('#custom-cancel-btn');
        customTextarea.focus();

        confirmBtn.addEventListener('click', () => {
            const customText = customTextarea.value.trim();
            if (customText) {
                shadow.removeChild(overlay);
                updateStatus('正在解析自定义输入内容...');
                parse_content(customText, () => showCustomInputDialog());
            } else {
                alert('请输入需要解析的内容！');
            }
        });

        cancelBtn.addEventListener('click', () => { shadow.removeChild(overlay); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) shadow.removeChild(overlay); });
    }

    // =====================================================================
    // 鼠标交互事件处理（元素选择）
    // =====================================================================
    function handleMouseOver(e) {
        // 事件从 shadow DOM 内冒泡时 e.target 会被重定向为 scraperHost
        if (scraperHost.contains(e.target)) return;
        if (highlightedElement) { highlightedElement.classList.remove('scraper-highlight'); }
        highlightedElement = e.target;
        highlightedElement.classList.add('scraper-highlight');
        const autoHint = getAutoModeHint(highlightedElement);
        updateStatus(`当前选中: ${getElementPath(highlightedElement)}\n(滚轮可切换父/子元素)${autoHint}`);
    }

    function handleMouseOut(e) {
        if (highlightedElement) { highlightedElement.classList.remove('scraper-highlight'); }
    }

    function handleWheel(e) {
        e.preventDefault();
        let nextElement = null;
        if (e.deltaY < 0) {
            if (highlightedElement && highlightedElement.parentElement && highlightedElement.parentElement !== document.body) {
                nextElement = highlightedElement.parentElement;
            }
        } else if (e.deltaY > 0) {
            if (highlightedElement && highlightedElement.children.length > 0) {
                nextElement = highlightedElement.children[0];
            }
        }
        if (nextElement) {
            if (highlightedElement) highlightedElement.classList.remove('scraper-highlight');
            highlightedElement = nextElement;
            highlightedElement.classList.add('scraper-highlight');
            const autoHint = getAutoModeHint(highlightedElement);
            updateStatus(`当前选中: ${getElementPath(highlightedElement)}\n(滚轮可切换父/子元素)${autoHint}`);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            e.preventDefault();
            updateStatus('已取消选择模式');
            cleanupSelectionListeners();
            startBtn.disabled = false;
        }
    }

    function cleanupSelectionListeners() {
        document.body.classList.remove('scraper-selecting');
        document.removeEventListener('mouseover', handleMouseOver);
        document.removeEventListener('mouseout', handleMouseOut);
        document.removeEventListener('click', handleClick);
        document.removeEventListener('wheel', handleWheel);
        document.removeEventListener('keydown', handleKeyDown);
        if (highlightedElement) {
            highlightedElement.classList.remove('scraper-highlight');
            highlightedElement = null;
        }
        const selectionHint = shadow.getElementById('selection-hint');
        if (selectionHint) {
            selectionHint.classList.add('fading-out');
            selectionHint.addEventListener('animationend', () => {
                if (selectionHint.parentNode) selectionHint.parentNode.removeChild(selectionHint);
            }, { once: true });
        }
    }

    function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        // 事件源自 shadow DOM 内部时 e.target 被重定向为 scraperHost
        if (scraperHost.contains(e.target)) return;
        const targetElement = highlightedElement;
        if (!targetElement) {
            updateStatus("选择错误，请重试。");
            startBtn.disabled = false;
            cleanupSelectionListeners();
            return;
        }
        cleanupSelectionListeners();
        startScraping(targetElement);
    }

    /**
     * 从 a 元素的属性中尝试提取真实 URL（onclick / data-* 等）
     * 返回绝对 URL 字符串，提取失败返回 null
     */
    function extractUrlFromAttrs(a) {
        // 尝试从 onclick 中提取 URL
        const onclick = a.getAttribute('onclick') || '';
        if (onclick) {
            const onclickPatterns = [
                /(?:location\.href|window\.location|window\.open|open)\s*\(\s*['"]([^'"]+)['"]/i,
                /(?:location\.href|window\.location)\s*=\s*['"]([^'"]+)['"]/i,
                /['"]([^'"]*(?:https?:\/\/|\/)[^'"]*)['"]/,
            ];
            for (const pattern of onclickPatterns) {
                const match = onclick.match(pattern);
                if (match && match[1]) {
                    try {
                        return new URL(match[1], location.href).href;
                    } catch (e) {
                        // URL 解析失败，继续尝试
                    }
                }
            }
        }
        // 尝试从 data-* 属性中提取 URL
        const dataAttrs = ['data-href', 'data-url', 'data-link', 'data-src'];
        for (const attr of dataAttrs) {
            const value = a.getAttribute(attr);
            if (value) {
                try {
                    return new URL(value, location.href).href;
                } catch (e) {
                    // URL 解析失败，继续尝试
                }
            }
        }
        return null;
    }

    /**
     * 通过模拟点击来捕获 javascript:void(0) 链接的真实目标 URL
     * 原理：临时拦截 window.open 和 beforeunload 事件，模拟点击元素，
     * 捕获其尝试跳转/打开的 URL，然后恢复原始行为
     *
     * @param {HTMLAnchorElement} a - 需要模拟点击的 a 元素
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<string|null>} 捕获到的 URL，失败返回 null
     */
    async function resolveVoidLinkUrl(a, timeout = 3000) {
        // 保存原始方法（在 Promise 外部保存，确保 cleanup 总能恢复）
        const originalWindowOpen = window.open;
        let origAssign, origReplace;
        try {
            origAssign = Location.prototype.assign;
            origReplace = Location.prototype.replace;
        } catch (e) {
            // 某些浏览器可能不允许访问
        }

        return new Promise((resolve) => {
            let resolved = false;
            let capturedUrl = null;

            const doResolve = (url) => {
                if (resolved) return;
                resolved = true;
                capturedUrl = url;
                cleanup();
                resolve(url);
            };

            const timer = setTimeout(() => {
                doResolve(null);
            }, timeout);

            const cleanup = () => {
                clearTimeout(timer);
                window.open = originalWindowOpen;
                // 恢复 Location 原型方法
                try {
                    if (origAssign) Location.prototype.assign = origAssign;
                    if (origReplace) Location.prototype.replace = origReplace;
                } catch (e) { /* ignore */ }
            };

            // 拦截 window.open，捕获 URL 但阻止实际打开新窗口
            window.open = function(url, ...args) {
                if (url && typeof url === 'string') {
                    try {
                        const absoluteUrl = new URL(url, location.href).href;
                        if (/^https?:\/\//i.test(absoluteUrl)) {
                            doResolve(absoluteUrl);
                            return null;
                        }
                    } catch (e) { /* ignore */ }
                }
                // 非有效 URL，继续传递
                return originalWindowOpen.call(window, url, ...args);
            };

            // 拦截 Location.prototype.assign / replace
            try {
                Location.prototype.assign = function(url) {
                    try {
                        const absoluteUrl = new URL(url, location.href).href;
                        if (/^https?:\/\//i.test(absoluteUrl)) {
                            doResolve(absoluteUrl);
                            return; // 阻止实际导航
                        }
                    } catch (e) { /* ignore */ }
                    return origAssign.call(this, url);
                };
                Location.prototype.replace = function(url) {
                    try {
                        const absoluteUrl = new URL(url, location.href).href;
                        if (/^https?:\/\//i.test(absoluteUrl)) {
                            doResolve(absoluteUrl);
                            return; // 阻止实际导航
                        }
                    } catch (e) { /* ignore */ }
                    return origReplace.call(this, url);
                };
            } catch (e) {
                // 某些浏览器可能不允许修改 Location.prototype
            }

            // 拦截 location.href 赋值（通过定义当前 window 的 location setter — 注意浏览器限制较多）
            // 这是最难拦截的方式，多数浏览器不允许重定义 window.location
            // 作为兜底，监听 beforeunload 防止页面真的跳走
            const beforeUnloadHandler = (e) => {
                e.preventDefault();
                e.returnValue = '';
            };
            window.addEventListener('beforeunload', beforeUnloadHandler, { once: true });

            // 模拟点击
            try {
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                a.dispatchEvent(clickEvent);
            } catch (e) {
                console.warn('[SmartScraper] 模拟点击失败:', e);
                doResolve(null);
            }
        });
    }

    // =====================================================================
    // 主抓取流程
    // =====================================================================
    async function startScraping(targetElement) {
        const mode = getSelectedMode();

        if (mode === 'ocr') {
            await handleOcrMode(targetElement);
            return;
        }

        updateStatus(`已选择元素: <${targetElement.tagName.toLowerCase()}>\n正在查找链接...`);

        // 分离普通链接和 void 链接（javascript:void(0) 等）
        const allLinks = targetElement.querySelectorAll('a[href]');
        const normalItems = [];   // { name, url }
        const voidLinks = [];     // { element, name }

        allLinks.forEach(a => {
            const name = a.text.trim() || '无标题';
            if (isVoidLink(a)) {
                // 先尝试从属性中提取 URL
                const attrUrl = extractUrlFromAttrs(a);
                if (attrUrl) {
                    normalItems.push({ name, url: attrUrl });
                } else {
                    voidLinks.push({ element: a, name });
                }
            } else {
                normalItems.push({ name, url: a.href });
            }
        });

        // 对 void 链接进行模拟点击以捕获真实 URL（串行执行，避免冲突）
        if (voidLinks.length > 0) {
            updateStatus(`发现 ${voidLinks.length} 个 javascript:void 链接，正在模拟点击解析真实地址...`);
            for (let i = 0; i < voidLinks.length; i++) {
                const { element, name } = voidLinks[i];
                updateStatus(`模拟点击 ${i + 1}/${voidLinks.length}: ${name}`);
                try {
                    const resolvedUrl = await resolveVoidLinkUrl(element);
                    if (resolvedUrl) {
                        console.log(`[SmartScraper] void链接解析成功: ${name} -> ${resolvedUrl}`);
                        normalItems.push({ name, url: resolvedUrl });
                    } else {
                        console.warn(`[SmartScraper] void链接模拟点击未能捕获URL: ${name}`);
                    }
                } catch (e) {
                    console.warn(`[SmartScraper] void链接模拟点击出错: ${name}`, e);
                }
            }
        }

        // 去重
        const items = Array.from(
            new Map(normalItems.map(item => [item.url, item])).values()
        );

        try {
            let full_text = null;
            if (mode == 'auto' && items.length > 0 || mode == 'link') {
                updateStatus(`找到 ${items.length} 个链接。\n开始抓取内容（并发${getConcurrency()}个）...`);
                const extractor = (dom, item) => {
                    return { name: item.name, title: dom.title, desc: extractCleanText(dom) };
                };
                const results = await getCrossOriginPageContent(items, extractor, (done, total, result) => {
                    if (result.success) {
                        updateStatus(`抓取进度: ${done}/${total}\n✅ ${result.url}`);
                    } else {
                        updateStatus(`抓取进度: ${done}/${total}\n❌ ${result.url} - ${result.error}`);
                    }
                });
                full_text = [];
                for (const result of results) {
                    if (result.success) {
                        full_text.push(`${result.data.name}\n${result.data.desc}`);
                    }
                }
                const successCount = results.filter(r => r.success).length;
                updateStatus(`抓取完成！成功 ${successCount}/${results.length} 页，共 ${full_text.reduce((s, t) => s + t.length, 0)} 字。正在调用AI分析内容，请稍候...`);
            } else {
                updateStatus('将使用文本模式解析');
                full_text = targetElement.textContent || '';
            }
            if (full_text) {
                await parse_content(full_text, () => startScraping(targetElement));
            } else {
                updateStatus(`抓取完成，但未能从所选元素中提取到任何有效文本内容。`);
                startBtn.disabled = false;
            }
        } catch (error) {
            updateStatus(`发生未知错误: ${error.message}`);
            console.error(error);
            startBtn.disabled = false;
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = "重新选择";
            updateStatus('准备就绪。');
        }
    }

    // =====================================================================
    // OCR 模式
    // =====================================================================
    async function handleOcrMode(targetElement) {
        updateStatus('正在提取元素中的图片...');
        const images = targetElement.querySelectorAll('img');
        const imageUrls = [];

        const allElements = targetElement.querySelectorAll('*');
        allElements.forEach(el => {
            const style = el.getAttribute('style') || '';
            const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
            if (bgMatch && bgMatch[1]) {
                imageUrls.push({ url: bgMatch[1], isBackground: true });
            }
        });

        images.forEach(img => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
            if (src && !src.startsWith('data:')) {
                imageUrls.push({ url: src, isBackground: false });
            }
        });

        if (imageUrls.length === 0) {
            updateStatus('未在选中元素中找到图片，请选择包含图片的元素。');
            startBtn.disabled = false;
            startBtn.textContent = "重新选择";
            return;
        }

        updateStatus(`找到 ${imageUrls.length} 张图片，正在OCR识别...`);

        try {
            const ocrResults = [];
            const maxImages = 10;
            for (let i = 0; i < Math.min(imageUrls.length, maxImages); i++) {
                const imgInfo = imageUrls[i];
                updateStatus(`正在识别第 ${i + 1}/${Math.min(imageUrls.length, maxImages)} 张图片...`);
                try {
                    const ocrText = await recognizeImageWithOcr(imgInfo.url);
                    if (ocrText) {
                        ocrResults.push(`【图片 ${i + 1}】\n${ocrText}`);
                        updateStatus(`✅ 图片 ${i + 1} 识别完成`);
                    }
                } catch (imgError) {
                    console.error(`图片 ${i + 1} 识别失败:`, imgError);
                    updateStatus(`❌ 图片 ${i + 1} 识别失败: ${imgError.message}`);
                }
            }

            if (ocrResults.length === 0) {
                updateStatus('未能识别出任何文字，请检查图片是否清晰。');
                startBtn.disabled = false;
                return;
            }

            const fullText = ocrResults.join('\n\n');
            updateStatus(`OCR识别完成！共识别 ${ocrResults.length} 张图片，${fullText.length} 字。正在调用AI分析...`);
            await parse_content(fullText, () => startScraping(targetElement));

        } catch (error) {
            updateStatus(`OCR识别出错: ${error.message}`);
            console.error('OCR识别出错:', error);
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = "重新选择";
        }
    }

    async function recognizeImageWithOcr(imageUrl) {
        return new Promise(async (resolve, reject) => {
            try {
                const base64Data = await imageToBase64(imageUrl);
                if (!base64Data) { reject(new Error('图片转换为base64失败')); return; }

                const jsonData = {
                    file: base64Data,
                    fileType: 1,
                    useDocOrientationClassify: false,
                    useDocUnwarping: false,
                    useChartRecognition: false
                };

                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://x5n5d3edv96dlfn7.aistudio-app.com/layout-parsing",
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `token ${GM_getValue('paddleocr_token', '')}`
                    },
                    data: JSON.stringify(jsonData),
                    timeout: 60000,
                    onload: function(response) {
                        try {
                            if (response.status !== 200) { reject(new Error(`HTTP错误：状态码 ${response.status}`)); return; }
                            const result = JSON.parse(response.responseText);
                            if (result.error) { reject(new Error(result.error)); return; }
                            let ocrText = '';
                            const layoutResults = result.result?.layoutParsingResults || [];
                            for (const pageResult of layoutResults) {
                                if (pageResult.markdown?.text) ocrText += pageResult.markdown.text + '\n';
                            }
                            resolve(ocrText.trim());
                        } catch (parseError) { reject(new Error(`解析结果失败: ${parseError.message}`)); }
                    },
                    onerror: function(error) { reject(new Error(`网络请求失败: ${error.error || '未知错误'}`)); },
                    ontimeout: function() { reject(new Error('请求超时')); }
                });
            } catch (error) { reject(error); }
        });
    }

    async function imageToBase64(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                responseType: "arraybuffer",
                onload: function(response) {
                    if (response.status !== 200) { resolve(null); return; }
                    try {
                        const bytes = new Uint8Array(response.response);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                        resolve(btoa(binary));
                    } catch (e) { resolve(null); }
                },
                onerror: function() { resolve(null); }
            });
        });
    }

    // =====================================================================
    // AI 解析
    // =====================================================================
    async function extract_with_ai(content) {
        return new Promise(async (resolve, reject) => {
            const modelConfig = getModelConfig();
            const jsonData = {
                'windowId': 'windowId_cb7b6fe8-8945-440b-abad-fe920c4ee1de',
                'sessionId': 'sessionId_2c13ee8ff4b54772acdeeb6d7b9fd6c0',
                'serviceSource': 'servicesMarket',
                'modelType': 'CHAT',
                'model': modelConfig.model,
                'config': {
                    'temperature': modelConfig.temperature,
                    'topK': modelConfig.topK,
                    'topP': modelConfig.topP,
                    'enableSecCheck': false,
                    'chat_template_kwargs': { 'enable_thinking': false },
                },
                'messages': [
                    { "role": "system", "content": [{ "type": "text", "text": getSystemPrompt() }] },
                    { 'role': 'user', 'content': [{ 'type': 'text', 'text': content }] },
                ],
                'stream': true,
                'parentKey': 'root',
                'questionKey': 'questionKey_9f126057-8d02-4cf1-8f1f-a40ef16741f9',
                'answerKey': 'answerKey_8bec47ad-6f28-4338-9971-70981dadd30d',
            };

            GM_xmlhttpRequest({
                method: "POST",
                url: "https://xxxxxx-ai/api/chat",
                headers: {
                  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                },
                data: JSON.stringify(jsonData),
                timeout: 30000,
                onload: function (response) {
                    try {
                        if (response.status < 200 || response.status >= 300) {
                            throw new Error(`HTTP错误！状态码: ${response.status} ${response.statusText}`);
                        }
                        const full_answer = [];
                        const lines = response.responseText.split('\n');
                        for (const line of lines) {
                            if (line) {
                                let text = line.trim();
                                if (text.startsWith('data:')) text = text.substring(5).trim();
                                if (!text || text === '[DONE]') continue;
                                const data = JSON.parse(text);
                                const content = data['content'];
                                if (content && Array.isArray(content)) {
                                    for (const item of content) {
                                        if (item['type'] === 'text') full_answer.push(item['text']);
                                    }
                                }
                            }
                        }
                        resolve(full_answer.join(''));
                    } catch (e) {
                        console.error("解析流式响应时出错:", e);
                        reject(e);
                    }
                },
                onerror: function (error) {
                    reject(new Error(`网络请求失败: ${error.error || '未知错误'}`));
                }
            });
        });
    }

    function extract_md_table(md_answer) {
        try {
            const lines = md_answer.split('\n').filter(line => line.trim().startsWith('|'));
            if (lines.length < 3) return [];
            const headerLine = lines[0];
            const headers = headerLine.substring(1, headerLine.length - 1).split('|').map(h => h.trim()).filter(h => h);
            const dataLines = lines.slice(2);
            return dataLines.map(line => {
                const cells = line.substring(1, line.length - 1).split('|');
                const values = cells.map(v => v.trim());
                const rowObj = {};
                headers.forEach((header, index) => { rowObj[header] = values[index] || ''; });
                return rowObj;
            });
        } catch (e) {
            console.error("Failed to parse markdown table:", e);
            return [];
        }
    }

    // 数据筛选默认参数
    const DEFAULT_DATA_FILTER = true;

    function getDataFilter() {
        return GM_getValue('scraper_data_filter', DEFAULT_DATA_FILTER);
    }

    /**
     * 对解析后的表格数据进行筛选：
     * 1. 删除没有姓名和职务字段的行
     * 2. 根据（姓名+身份证号码）字段去重，身份证号码为空时只按姓名去重
     * @param {Array<Object>} tableData - 解析出的表格数据数组
     * @returns {{ filtered: Array<Object>, removedEmpty: number, removedDuplicate: number }}
     */
    function filterTableData(tableData) {
        if (!Array.isArray(tableData) || tableData.length === 0) {
            return { filtered: tableData, removedEmpty: 0, removedDuplicate: 0 };
        }

        // 识别表头中"姓名"和"职务"相关的字段名（支持多种写法）
        const nameKeys = ['姓名', '名字', '名称'];
        const positionKeys = ['职务', '职务（岗位）', '岗位', '职位', '职务(岗位)'];
        const idKeys = ['身份证号码', '身份证号', '身份证', '证件号码', '证件号'];

        const findKey = (row, candidates) => {
            for (const candidate of candidates) {
                if (row.hasOwnProperty(candidate)) return candidate;
            }
            return null;
        };

        // 用第一行数据确定字段名
        const sampleRow = tableData[0];
        const nameKey = findKey(sampleRow, nameKeys);
        const positionKey = findKey(sampleRow, positionKeys);
        const idKey = findKey(sampleRow, idKeys);

        // 第一步：删除没有姓名和职务字段的行
        let afterEmptyFilter = [];
        let removedEmpty = 0;
        for (const row of tableData) {
            const nameValue = nameKey ? (row[nameKey] || '').toString().trim() : '';
            const positionValue = positionKey ? (row[positionKey] || '').toString().trim() : '';
            // 如果姓名和职务都为空，则删除该行
            if (!nameValue && !positionValue) {
                removedEmpty++;
            } else {
                afterEmptyFilter.push(row);
            }
        }

        // 第二步：根据（姓名+身份证号码）去重
        const seen = new Set();
        const filtered = [];
        let removedDuplicate = 0;
        for (const row of afterEmptyFilter) {
            const nameValue = nameKey ? (row[nameKey] || '').toString().trim() : '';
            const idValue = idKey ? (row[idKey] || '').toString().trim() : '';
            // 身份证号码为空时只按姓名去重，否则按姓名+身份证号码去重
            const dedupeKey = idValue ? `${nameValue}||${idValue}` : nameValue;
            if (!dedupeKey || seen.has(dedupeKey)) {
                removedDuplicate++;
            } else {
                seen.add(dedupeKey);
                filtered.push(row);
            }
        }

        return { filtered, removedEmpty, removedDuplicate };
    }

    function getUTF8ByteSize(str) {
        if (typeof str !== 'string') return 0;
        return new TextEncoder().encode(str).length;
    }

    function splitContent(text, maxLength = 4000) {
        if (!text || typeof text !== 'string') return [];
        if (text.length <= maxLength) return [text];
        const chunks = [];
        let startIndex = 0;
        while (startIndex < text.length) {
            let endIndex = startIndex + maxLength;
            if (endIndex >= text.length) { chunks.push(text.substring(startIndex)); break; }
            const splitIndex = Math.max(
                text.lastIndexOf('.', endIndex),
                text.lastIndexOf('\n', endIndex),
                text.lastIndexOf('。', endIndex)
            );
            const finalIndex = splitIndex > startIndex ? splitIndex + 1 : endIndex;
            chunks.push(text.substring(startIndex, finalIndex));
            startIndex = finalIndex;
        }
        return chunks;
    }

    function regroup(chunks, maxLength = 1024 * 6) {
        if (!Array.isArray(chunks) || maxLength <= 0) return [];
        const result = [];
        let currentGroup = '';
        for (const chunk of chunks) {
            let str = String(chunk)
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/\$\(function\(\)\{[\s\S]*?\}\);/gi, '')
                .replace(/ajax\([\s\S]*?\);/gi, '')
                .replace(/<!--[\s\S]*?-->/gi, '')
                .replace(/\/\/.*?\n/gi, '')
                .replace(/\/\*[\s\S]*?\*\//gi, '')
                .replace(/<[^>]+>/gi, '')
                .replace(/\s+/g, ' ')
                .replace(/^\s+/, '')
                .replace(/\s+$/, '');
            if (currentGroup === '') {
                currentGroup = str;
            } else {
                const combinedLength = getUTF8ByteSize(currentGroup + str);
                if (combinedLength <= maxLength) {
                    currentGroup += '\n' + str;
                } else {
                    result.push(currentGroup);
                    currentGroup = str;
                }
            }
        }
        if (currentGroup !== '') result.push(currentGroup);
        return result;
    }

    // =====================================================================
    // 核心解析流程
    // =====================================================================
    // 全局解析计数器：跟踪正在进行的解析任务数
    let _parsingCount = 0;

    async function parse_content(content, retryCallback) {
        return new Promise(async (resolve) => {
            _parsingCount++;
            const doneResolve = (value) => {
                _parsingCount--;
                resolve(value);
            };
            let contents = [];
            if (Array.isArray(content)) {
                contents = regroup(content, getMaxInputSize());
            } else if (typeof content === 'string') {
                contents = [content];
            }
            if (contents.length === 0) {
                updateStatus('错误：没有可用的内容进行解析。');
                doneResolve('no-content');
                return;
            }

            // 加载弹窗
            let loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'scraper-overlay';
            loadingOverlay.innerHTML = `
                <div class="scraper-modal" style="max-width: 520px; width: 90vw;">
                    <h3>AI解析中 <span class="spinner"></span></h3>
                    <div style="margin: 16px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span id="loading-status" class="scraper-modal-status" style="margin: 0; border: none; background: none; padding: 0;">
                                准备处理 ${contents.length} 个文本块...
                            </span>
                            <span id="progress-text" style="font-size: 12px; color: #8395a7; font-weight: 600;">0%</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" id="progress-bar" style="width: 0%;"></div>
                        </div>
                        <div class="preview-wrapper">
                            <div class="preview-toggle" id="preview-toggle">
                                <span>文本预览</span>
                                <span class="toggle-arrow expanded" id="toggle-arrow">▼</span>
                            </div>
                            <div class="preview-body expanded" id="preview-body">
                                <pre id="preview-text">等待处理...</pre>
                            </div>
                        </div>
                    </div>
                    <div class="scraper-modal-actions">
                        <button class="scraper-btn scraper-btn--secondary scraper-btn--sm" id="loading-cancel-btn">取消</button>
                    </div>
                </div>
            `;
            shadow.appendChild(loadingOverlay);

            const loadingStatusDiv = loadingOverlay.querySelector('#loading-status');
            const cancelBtn = loadingOverlay.querySelector('#loading-cancel-btn');
            let isCancelled = false;

            cancelBtn.addEventListener('click', () => {
                isCancelled = true;
                if (shadow.contains(loadingOverlay)) shadow.removeChild(loadingOverlay);
                doneResolve('cancelled');
            });

            // 文本预览折叠/展开
            const previewToggle = loadingOverlay.querySelector('#preview-toggle');
            const previewBody = loadingOverlay.querySelector('#preview-body');
            const toggleArrow = loadingOverlay.querySelector('#toggle-arrow');
            const previewText = loadingOverlay.querySelector('#preview-text');

            previewToggle.addEventListener('click', () => {
                const isExpanded = previewBody.classList.contains('expanded');
                if (isExpanded) {
                    previewBody.classList.remove('expanded');
                    toggleArrow.classList.remove('expanded');
                } else {
                    previewBody.classList.add('expanded');
                    toggleArrow.classList.add('expanded');
                }
            });

            try {
                const startTime = Date.now();
                let allTableData = [];
                let firstHeaders = null;
                let successCount = 0;
                const totalChunks = contents.length;
                const errorMessages = [];
                const progressBar = loadingOverlay.querySelector('#progress-bar');
                const progressText = loadingOverlay.querySelector('#progress-text');

                for (let i = 0; i < totalChunks; i++) {
                    if (isCancelled) return;
                    const progress = Math.round(((i + 1) / totalChunks) * 100);
                    loadingStatusDiv.textContent = `正在处理第 ${i + 1} / ${totalChunks} 块 (${contents[i].length}字，约 ${(getUTF8ByteSize(contents[i]) / 1024).toFixed(1)} KB)...`;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `${progress}%`;

                    const previewMaxLen = 10000;
                    const chunkText = contents[i];
                    const truncated = chunkText.length > previewMaxLen ? chunkText.substring(0, previewMaxLen) + '\n...(共' + chunkText.length + '字)' : chunkText;
                    previewText.textContent = `【第 ${i + 1} 块】\n${truncated}`;
                    previewBody.scrollTop = 0;

                    try {
                        const md_answer_chunk = await extract_with_ai(contents[i]);
                        const currentTable = extract_md_table(md_answer_chunk);
                        if (currentTable.length > 0) {
                            if (!firstHeaders) firstHeaders = Object.keys(currentTable[0]);
                            allTableData.push(...currentTable);
                            successCount++;
                        } else {
                            const errorMsg = `第 ${i + 1} 块未能解析出表格数据。`;
                            console.warn(errorMsg, md_answer_chunk.substring(0, 200));
                            errorMessages.push(errorMsg);
                        }
                    } catch (chunkError) {
                        const errorMsg = `第 ${i + 1} 块处理失败: ${chunkError.message}`;
                        console.error(errorMsg);
                        errorMessages.push(errorMsg);
                    }
                }

                if (isCancelled) return;
                if (shadow.contains(loadingOverlay)) shadow.removeChild(loadingOverlay);

                // 数据筛选
                let filterInfo = null;
                const isDataFilterEnabled = getDataFilter();
                const originalDataCount = allTableData.length;
                if (isDataFilterEnabled && allTableData.length > 0) {
                    filterInfo = filterTableData(allTableData);
                    allTableData = filterInfo.filtered;
                }

                // 结果弹窗
                let resultOverlay = document.createElement('div');
                resultOverlay.className = 'scraper-overlay';
                resultOverlay.innerHTML = `
                    <div class="scraper-modal">
                        <h3>AI解析结果</h3>
                        <div id="result-status" class="scraper-modal-status"></div>
                        ${filterInfo && (filterInfo.removedEmpty > 0 || filterInfo.removedDuplicate > 0) ? `
                        <div class="scraper-filter-info" id="filter-info">
                            数据筛选已${isDataFilterEnabled ? '开启' : '关闭'}：
                            删除空姓名/职务行 ${filterInfo.removedEmpty} 条，
                            去重 ${filterInfo.removedDuplicate} 条，
                            筛选后剩余 ${filterInfo.filtered.length} 条
                        </div>
                        ` : (isDataFilterEnabled ? `
                        <div class="scraper-filter-info" id="filter-info">
                            数据筛选已开启：无需筛选
                        </div>
                        ` : `
                        <div class="scraper-filter-info scraper-filter-info--disabled" id="filter-info">
                            数据筛选已关闭（可在配置中开启）
                        </div>
                        `)}
                        <div style="max-height: 60vh; overflow-y: auto; border: 1px solid #f0f0f5; border-radius: 8px; margin: 12px 0;">
                            <table class="scraper-table" id="result-table"></table>
                        </div>
                        <div class="scraper-modal-actions">
                            <button class="scraper-btn scraper-btn--success scraper-btn--sm" id="copy-btn">
                                复制 (TSV)
                            </button>
                            <button class="scraper-btn scraper-btn--warning scraper-btn--sm" id="retry-btn">
                                重试
                            </button>
                            <button class="scraper-btn scraper-btn--secondary scraper-btn--sm" id="result-close-btn">
                                关闭
                            </button>
                        </div>
                    </div>
                `;
                shadow.appendChild(resultOverlay);

                const resultStatusDiv = resultOverlay.querySelector('#result-status');
                const tableEl = resultOverlay.querySelector('#result-table');
                const useTime = ((Date.now() - startTime) / 1000).toFixed(2);

                if (allTableData.length > 0) {
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    firstHeaders.forEach(headerText => {
                        const th = document.createElement('th');
                        th.textContent = headerText;
                        headerRow.appendChild(th);
                    });
                    thead.appendChild(headerRow);
                    tableEl.appendChild(thead);

                    const tbody = document.createElement('tbody');
                    allTableData.forEach(rowData => {
                        const tr = document.createElement('tr');
                        firstHeaders.forEach(header => {
                            const td = document.createElement('td');
                            td.textContent = rowData[header] ?? '';
                            tr.appendChild(td);
                        });
                        tbody.appendChild(tr);
                    });
                    tableEl.appendChild(tbody);

                    const totalLength = contents.reduce((total, str) => total + String(str).length, 0);
                    let statusText = `耗时 ${useTime}秒，处理完成！成功 ${successCount}/${totalChunks} 块，从 ${totalLength} 字中共解析 ${allTableData.length} 条数据。`;
                    if (filterInfo && (filterInfo.removedEmpty > 0 || filterInfo.removedDuplicate > 0)) {
                        statusText += `\n筛选：删除空行 ${filterInfo.removedEmpty} 条，去重 ${filterInfo.removedDuplicate} 条。`;
                    }
                    if (errorMessages.length > 0) {
                        statusText += `\n⚠️ ${errorMessages.length} 个块处理失败，详情请查看控制台。`;
                    }
                    resultStatusDiv.textContent = statusText;
                    resultStatusDiv.style.color = '#00b894';
                    statusDiv.textContent = `成功解析 ${allTableData.length} 条数据。`;

                    const tsvContent = allTableData.map(row => firstHeaders.map(header => row[header]).join('\t')).join('\n');
                    if (getAutoCopy()) {
                        GM_setClipboard(tsvContent);
                    }

                    // 保存历史记录
                    try {
                        const historyEntry = {
                            time: new Date().toLocaleString(),
                            headers: firstHeaders,
                            data: allTableData,
                            count: allTableData.length
                        };
                        const uniqueKey = HISTORY_KEY + new Date().toISOString() + '_' + Math.random().toString(36).slice(2, 9);
                        await GM.setValue(uniqueKey, historyEntry);
                        window._currentHistoryKey = uniqueKey;
                        updateHistoryButtonCount();
                    } catch (e) {
                        console.error('保存历史记录失败:', e);
                    }
                } else {
                    let statusText;
                    if (filterInfo && originalDataCount > 0 && allTableData.length === 0) {
                        statusText = `筛选后所有数据被移除（原始 ${originalDataCount} 条中，删除空行 ${filterInfo.removedEmpty} 条，去重 ${filterInfo.removedDuplicate} 条）。可在配置中关闭数据筛选后重试。`;
                    } else {
                        statusText = `所有文本块均解析失败，未获取到任何有效数据。`;
                    }
                    if (errorMessages.length > 0) {
                        statusText += `\n错误信息汇总：\n${errorMessages.join('\n')}`;
                    }
                    resultStatusDiv.textContent = statusText;
                    resultStatusDiv.style.color = '#e74c3c';
                    statusDiv.textContent = originalDataCount > 0 ? '筛选后无有效数据。' : '未能解析出任何有效表格。';
                }

                const copyBtn = resultOverlay.querySelector('#copy-btn');
                const resultCloseBtn = resultOverlay.querySelector('#result-close-btn');
                const retryBtn = resultOverlay.querySelector('#retry-btn');

                const cleanupAndResolve = () => {
                    if (shadow.contains(resultOverlay)) shadow.removeChild(resultOverlay);
                    doneResolve('closed');
                };

                enableEscToClose(resultOverlay, cleanupAndResolve);
                resultCloseBtn.addEventListener('click', cleanupAndResolve);
                resultOverlay.addEventListener('click', (e) => { if (e.target === resultOverlay) cleanupAndResolve(); });

                retryBtn.addEventListener('click', async () => {
                    if (window._currentHistoryKey) {
                        try { await GM.deleteValue(window._currentHistoryKey); } catch (e) { console.error('删除历史记录失败:', e); }
                    }
                    if (shadow.contains(resultOverlay)) shadow.removeChild(resultOverlay);
                    doneResolve('retrying');
                    retryCallback();
                });

                copyBtn.addEventListener('click', () => {
                    if (allTableData.length === 0) { alert('没有可复制的数据。'); return; }
                    const tsvContent = allTableData.map(row => firstHeaders.map(header => row[header]).join('\t')).join('\n');
                    GM_setClipboard(tsvContent);
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '已复制!';
                    copyBtn.disabled = true;
                    setTimeout(() => { copyBtn.textContent = originalText; copyBtn.disabled = false; }, 2000);
                });

            } catch (error) {
                console.error("An unexpected error occurred in parse_content:", error);
                if (!isCancelled && shadow.contains(loadingOverlay)) {
                    loadingStatusDiv.textContent = `发生未知错误: ${error.message}`;
                    loadingStatusDiv.style.color = '#e74c3c';
                }
            }
        });
    }

    // =====================================================================
    // 历史记录
    // =====================================================================
    async function updateHistoryButtonCount() {
        const allKeys = await GM.listValues();
        const historyKeys = allKeys.filter(key => key.startsWith(HISTORY_KEY));
        historyKeys.sort();
        const historyPromises = historyKeys.map(key => GM.getValue(key));
        const history = await Promise.all(historyPromises);

        const totalCount = history.reduce((total, entry) => total + (entry.count || 0), 0);
        historyBtn.textContent = totalCount > 0 ? `查看解析历史记录 (${totalCount})` : '查看解析历史记录';
    }

    updateHistoryButtonCount();

    historyBtn.addEventListener('click', () => { showHistoryModal(); });

    async function showHistoryModal() {
        const allKeys = await GM.listValues();
        const historyKeys = allKeys.filter(key => key.startsWith(HISTORY_KEY));
        historyKeys.sort();
        const historyPromises = historyKeys.map(key => GM.getValue(key));
        const history = await Promise.all(historyPromises);

        const overlay = document.createElement('div');
        overlay.className = 'scraper-overlay';

        // 合并所有表头（去重）
        const allHeadersSet = new Set();
        history.forEach(item => item.headers.forEach(h => allHeadersSet.add(h)));
        const displayHeaders = Array.from(allHeadersSet);

        let tableHTML = '';
        if (history.length === 0) {
            tableHTML = '<div style="text-align:center; padding: 40px; color: #8395a7;">暂无历史解析记录</div>';
        } else {
            tableHTML = `<table class="scraper-table"><thead><tr>`;
            displayHeaders.forEach(h => tableHTML += `<th>${h}</th>`);
            tableHTML += `</tr></thead><tbody>`;
            history.forEach(entry => {
                entry.data.forEach(row => {
                    tableHTML += `<tr title="${entry.time}">`;
                    displayHeaders.forEach(h => { tableHTML += `<td>${row[h] !== undefined ? row[h] : ''}</td>`; });
                    tableHTML += `</tr>`;
                });
            });
            tableHTML += `</tbody></table>`;
        }

        const totalNumber = history.reduce((total, entry) => total + entry.count, 0);

        const parsingCount = _parsingCount;
        const parsingHint = parsingCount > 0
            ? `<span style="color: #e17055; font-weight: 600;">还有 ${parsingCount} 个解析任务进行中</span>`
            : '';

        overlay.innerHTML = `
            <div class="scraper-modal" style="max-width:95vw; max-height:90vh;">
                <h3>解析历史记录</h3>
                <div style="font-size: 13px; color: #636e72; margin-bottom: 8px;">统计：共 ${history.length} 次解析记录，合计 ${totalNumber} 条数据${parsingHint ? '　' + parsingHint : ''}</div>
                <div class="history-scroll">
                    ${tableHTML}
                </div>
                <div class="scraper-modal-actions">
                    <button class="scraper-btn scraper-btn--primary scraper-btn--sm" id="history-refresh-btn">刷新</button>
                    <button class="scraper-btn scraper-btn--success scraper-btn--sm" id="history-copy-all-btn" ${history.length === 0 ? 'disabled' : ''}>复制全部 (TSV)</button>
                    <button class="scraper-btn scraper-btn--danger scraper-btn--sm" id="history-clear-btn" ${history.length === 0 ? 'disabled' : ''}>清空并关闭</button>
                    <button class="scraper-btn scraper-btn--secondary scraper-btn--sm" id="history-close-btn">关闭</button>
                </div>
            </div>
        `;
        shadow.appendChild(overlay);
        enableEscToClose(overlay, () => { if (shadow.contains(overlay)) shadow.removeChild(overlay); });

        overlay.querySelector('#history-close-btn').addEventListener('click', () => { shadow.removeChild(overlay); });

        overlay.querySelector('#history-clear-btn').addEventListener('click', async () => {
            if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
                const allKeys = await GM.listValues();
                const historyKeys = allKeys.filter(key => key.startsWith(HISTORY_KEY));
                if (historyKeys.length === 0) return;
                const deletePromises = historyKeys.map(key => GM.deleteValue(key));
                await Promise.all(deletePromises);
                updateHistoryButtonCount();
                shadow.removeChild(overlay);
            }
        });

        overlay.querySelector('#history-copy-all-btn').addEventListener('click', () => {
            let fullTSV = "";
            history.forEach(entry => {
                entry.data.forEach(row => {
                    fullTSV += entry.headers.map(h => row[h]).join('\t') + '\n';
                });
            });
            GM_setClipboard(fullTSV);
            const btn = overlay.querySelector('#history-copy-all-btn');
            const oldText = btn.textContent;
            btn.textContent = '已复制!';
            setTimeout(() => btn.textContent = oldText, 2000);
        });

        overlay.querySelector('#history-refresh-btn').addEventListener('click', () => {
            if (shadow.contains(overlay)) shadow.removeChild(overlay);
            showHistoryModal();
        });
    }
})();
