# 更新日志

本项目采用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的记录方式，版本号遵循语义化版本规范。

## [Unreleased]

### 新增

- 接入 DeepSeek Harness 本机会话，支持普通及多帧 Zstandard JSONL 日志、红黄绿状态、星标、别名、筛选、提醒和每日 AI 总结。
- 设置中可配置 `DSH_HOME`，日志只读，不提供未经验证的会话直达、同步重命名或平台归档。

## [0.3.0] - 2026-11-02

### 变更

- AI 进展从逐轮摘要改为每天一份工作总结，合并当天相同目标，展示完成程度、完成事项、遗留问题和后续建议。
- 分析期间不再显示旧的逐轮流水账，AI 缓存增加每日总结版本标识。
- AI 输入仅保留用户指令和每轮最终回复，排除当天内容；按任务和日期缓存，未变化的往日不重复调用。
- 每天上午 8 点自动检查往日总结，错过开机时段时在看板启动后补做。

## [0.2.2] - 2026-11-02

### 新增

- 已保存的 AI 配置支持随时进入“编辑配置”，可修改厂商、接口地址、API Key 和模型；完成后可收起并再次编辑。

## [0.2.1] - 2026-11-02

### 变更

- Kimi、智谱、火山方舟的 Coding Plan 与开放平台/按量接口拆分，避免会员套餐误用开放平台地址。
- 设置页持续显示当前厂商、接口地址、模型和脱敏 Key；切换模型后立即显示新模型并确认保存。

## [0.2.0] - 2026-11-02

### 新增

- 支持 Kimi、DeepSeek、通义千问、智谱、火山方舟、混元、千帆、OpenAI、Claude、Gemini、OpenRouter 等厂商及自定义 OpenAI 兼容接口。
- API Key 使用 Windows 加密保存，模型列表自动读取，厂商目录每日检查更新。
- 进展窗口可手动生成并缓存 AI 按天摘要；Kimi Code、WorkBuddy 分析真实对话，Kimi Work 分析实际写入文件的内容。

## [0.1.2] - 2026-11-02

### 新增

- 每条任务可打开独立进展窗口，按天查看实际完成结果和修改文件，支持缩放、最大化和 Esc 关闭；Kimi Work 缺少时间信息时明确标记。

## [0.1.1] - 2026-10-30

### 新增

- “重点监控 / 全部对话”双页面和本地星标，不再要求手动分享链接。
- 边缘缩略区仅展示重点任务的序号、平台和真实灯状态。
- 午夜、便签黄、薄荷绿、天空蓝、薰衣草、樱花粉六套主题。
- WorkBuddy 深链直达原对话。
- Kimi Code、WorkBuddy 同步重命名和平台归档/恢复，带备份及回读验证。
- Kimi Code 官方 Server API 和 `wire.jsonl` 事件回放，老会话无需重启也能识别真实状态。
- Kimi Code 桌面端/CMD 打开偏好，默认桌面端，支持完整标题搜索定位。
- 双击任务行打开会话，与打开按钮行为一致。
- Kimi Work 仅纳入 Work Agent 会话，过滤 Chat 咨询对话。
- 独立“归档会话”页，归档按钮随真实状态切换为“取消归档”并使用不同颜色。
- 任务操作区单展开，展开另一行时自动收起上一行。
- 移除已被星标流程替代的手动任务入口和逻辑。
- 状态筛选生效时显示“全部状态”按钮，一键恢复完整列表。
- Kimi Code 后台任务可显示数量并通过官方取消接口终止，状态区分“后台任务进行中”。
- 任务从黄灯变为绿灯或红灯时分别播放柔和完成音和警示音，首次加载不发声。

### 变更

- WorkBuddy 同步重命名同时更新 `title` 和 `custom_title`，修复桌面端仍显示旧标题的问题。
- WorkBuddy `active` 不再误标为“需处理”，未知状态仍保持红灯。
- 状态只来自平台，移除人工改灯。
- 星标与平台归档彻底分离：星标服务当前工作，归档服务以后找回。
- Kimi Work 的标题修改明确标记为“看板别名”；未验证的平台直达和回写不再暗示支持。
- 监控仍保持只读，只有用户主动重命名或归档时才执行受限回写。
- 后台任务列表和状态统计排除看板自身；取消前重新读取任务，禁止终止看板进程或已结束的任务。
- 单击系统托盘图标即可显示并聚焦主界面，保留原有右键菜单。

## [0.1.0] - 2026-10-25

首个可安装、可开源使用的 Windows 版本。

### 新增

- 汇总 WorkBuddy、Kimi Code、Kimi Work 的本机会话。
- 红黄绿三灯状态、状态排序、搜索、平台筛选和归档视图。
- 会话别名、手动状态覆盖、恢复自动状态和手动链接任务。
- Kimi Code 官方 Hooks 接入、本地随机令牌校验和重复配置保护。
- WorkBuddy 本地 SQLite 只读监控和中文标题显示。
- Kimi Work 本地状态文件监控、未知状态保护和短 ID 标题兜底。
- 窗口置顶、透明度、鼠标穿透、全局热键和系统托盘。
- 屏幕四边吸附、悬停展开、移出收起和拖离恢复。
- Windows x64 NSIS 安装包、三灯应用图标和原生 SQLite 重建。
- MIT 开源许可证、贡献指南、安全政策和发布流程。

### 已知限制

- 仅支持当前 Windows 电脑上的本机会话。
- WorkBuddy、Kimi Work 打开对应平台，不保证直达具体会话。
- Kimi Work 缺少公开完整标题接口时以短 ID 显示，可设置别名。
- 安装包未购买代码签名证书。

[0.4.0]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.4.0
[0.3.0]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.3.0
[0.2.2]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.2.2
[0.2.1]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.2.1
[0.2.0]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.2.0
[0.1.2]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.1.2
[0.1.1]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.1.1
[0.1.0]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.1.0
