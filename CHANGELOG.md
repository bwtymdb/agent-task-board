# 更新日志

本项目采用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的记录方式，版本号遵循语义化版本规范。

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

[0.1.0]: https://github.com/bwtymdb/agent-task-board/releases/tag/v0.1.0
