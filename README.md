# AI 任务看板

一个运行在 Windows 桌面上的本地任务调度面板，用来集中查看 **WorkBuddy、Kimi Code、Kimi Work** 的会话状态。

当你同时让多个 AI 平台处理不同项目时，不必再逐个打开平台检查：哪些仍在运行、哪些等你确认、哪些已经空闲，一屏看清。

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-blue.svg)](https://github.com/bwtymdb/agent-task-board)
[![Electron](https://img.shields.io/badge/Electron-45-47848F.svg)](https://www.electronjs.org/)

## 功能

- **自动汇总**：读取本机会话，不要求逐个粘贴对话链接。
- **三灯状态**：红灯表示需要处理，黄灯表示正在执行，绿灯表示本轮完成或空闲。
- **任务管理**：支持搜索、平台筛选、状态排序、归档、别名和手动任务。
- **桌面悬浮**：支持窗口置顶、30%–100% 透明度和位置记忆。
- **鼠标穿透**：点击可穿透到下层应用，按 `Ctrl+Alt+Space` 随时恢复。
- **边缘吸附**：拖到屏幕边缘自动收起，鼠标靠近展开，移出后收起。
- **本地运行**：不依赖云端账号同步，不上传对话正文，不包含遥测。

## 界面与状态约定

每一行都保留红、黄、绿三个灯，当前状态高亮，其余弱化，同时显示中文状态文字，避免只依赖颜色传递信息。

| 灯 | 含义 | 典型情况 |
| --- | --- | --- |
| 红灯 | 需要处理 | 等待权限确认、等待回答、执行失败、Hook 心跳中断、未知状态 |
| 黄灯 | 正在执行 | 规划、运行工具、后台任务进行中 |
| 绿灯 | 本轮完成 / 空闲 | 一轮回复结束或会话空闲 |

**绿灯只表示当前这一轮结束，不代表整个项目已经完成。** 默认顺序为红灯、黄灯、绿灯，同组按最近更新时间倒序。

## 安装

### 使用安装包

1. 前往 [Releases](https://github.com/bwtymdb/agent-task-board/releases/latest) 下载 `AgentTaskBoard-Setup-<version>.exe`。
2. 运行安装程序，从桌面或开始菜单启动“AI 任务看板”。
3. 在设置中点击“配置 / 修复 Kimi Code Hooks”，启用实时状态上报。

当前安装包未购买代码签名证书，Windows SmartScreen 可能提示“未知发布者”。请只运行从本仓库 Release 页面下载、且你能核验来源的安装包，不要通过关闭 Windows 安全功能规避提示。

### 系统要求

- Windows 10/11 x64
- 需要监控的 WorkBuddy、Kimi Code、Kimi Work 桌面端或 CLI
- Kimi Code Hook 上报器通过 `node` 命令运行，因此实时 Hook 功能需要 Node.js 22+ 可在系统 `PATH` 中调用

没有 Node.js 时，看板主体和历史会话发现仍可使用，但 Kimi Code 实时 Hook 上报不可用。

## 平台接入方式

| 平台 | 接入方式 | 数据位置（默认） |
| --- | --- | --- |
| Kimi Code | 官方会话索引、会话状态文件、官方 Hooks | `%USERPROFILE%\.kimi-code` |
| WorkBuddy | 只读查询本地 SQLite，轮询并监听变化 | `%USERPROFILE%\.workbuddy\workbuddy.db` |
| Kimi Work | 只读监听本地会话状态 JSON | `%APPDATA%\kimi-desktop\kimi-agent\conversation-statuses.json` |

数据目录可在看板设置中修改，自定义路径重启后生效。

### Kimi Code Hooks

点击“配置 / 修复 Kimi Code Hooks”后，看板会：

1. 备份现有 `config.toml`。
2. 在独立管理区块中添加状态上报 Hook，不覆盖其他 Hook。
3. 将会话事件发送到仅监听 `127.0.0.1` 的本地入口，使用随机本地令牌校验。

Hook 对新会话自动生效；已经运行的会话可能需要重启。重复配置会更新看板自己的管理区块，不会重复追加。

## 隐私与安全边界

- 不读取 WorkBuddy、Kimi Code、Kimi Work 的账号密码或访问令牌。
- 不持久化对话正文，不上传本地会话内容。
- 监控过程只读源会话文件和数据库，不代替用户批准权限或回答问题。
- 唯一的配置写入是用户主动触发的 Kimi Code Hook 安装；写入前会备份。
- 看板自己的设置、别名、手动任务和 Hook 连接信息保存在 Electron `userData` 中。
- 本地 Hook 服务只绑定回环地址，不面向局域网或互联网开放。

**请不要提交真实会话导出、账号凭据、Hook 连接文件或本地设置到 Issue、Pull Request 或公开仓库。** 漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 当前限制

- 只监控当前 Windows 电脑上的本机会话，不做手机、其他电脑或云端账号的全量同步。
- WorkBuddy、Kimi Work 当前提供“打开平台”，不保证直达具体会话。
- Kimi Work 没有可用于本项目的公开完整会话标题接口；缺标题时显示短 ID，可设置别名。
- Kimi Code 可通过 `kimi --session <id>` 在新终端恢复会话。
- 暂不支持远程审批、多人协作、自动更新、macOS 或 Linux。
- 私有平台数据结构可能随版本变化；连接器失效时会显示错误并保留最后有效快照，不会把未知状态误判为完成。

## 从源码运行

推荐使用 Node.js 24；Node.js 22+ 为最低建议版本。

```bash
git clone https://github.com/bwtymdb/agent-task-board.git
cd agent-task-board
npm install
npm run dev
```

如果 Electron 官方二进制下载较慢，可在当前终端设置镜像后再安装：

```bash
# Git Bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm install
```

```powershell
# PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm install
```

镜像只用于下载构建依赖；应用运行时不会连接这些镜像。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发模式 |
| `npm run lint` | 执行 TypeScript 严格检查 |
| `npm run build` | 构建主进程、preload 和渲染进程 |
| `npm run dist` | 重建原生依赖并生成 Windows NSIS 安装包 |

安装包输出到 `release/AgentTaskBoard-Setup-<version>.exe`。

## 技术结构

- **Electron 主进程**：窗口、托盘、全局热键、本地 Hook 服务和平台适配器。
- **React 渲染进程**：看板、筛选、设置和任务操作。
- **受限 preload**：通过 `contextBridge` 暴露白名单 API；渲染进程不开放 Node.js。
- **统一状态模型**：三个平台分别映射为 `red | yellow | green`，再应用别名和手动覆盖。
- **本地持久化**：设置通过临时文件加重命名方式原子写入。

```text
src/
  main/
    connectors/       # Kimi Code、WorkBuddy、Kimi Work 适配器
    event-server.ts   # 仅回环地址的 Hook 接收入口
    window.ts         # 置顶、透明度、穿透和边缘吸附
    store.ts          # 本地设置持久化
  preload/            # 受限 IPC 桥接
  renderer/           # React 界面
  shared/             # 共享类型、状态映射与排序
resources/
  hook-reporter.cjs   # 无第三方依赖的 Hook 上报器
```

安全相关设置包括 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。外部手动链接只允许 `http/https`，IPC 不暴露通用命令执行能力。

## 参与贡献

欢迎提交 Issue 和 Pull Request，尤其是：

- 平台新版本造成的数据结构或状态值变化
- WorkBuddy、Kimi Work 的公开、稳定会话标题与直达接口
- 多显示器、DPI、窗口边缘交互问题
- 无障碍、性能和中英文界面改进

请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。发布流程见 [docs/RELEASING.md](docs/RELEASING.md)，版本变化见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证与名称说明

本项目使用 [MIT License](LICENSE)。

WorkBuddy、Kimi Code、Kimi Work 分别是其各自所有者的产品名称。本项目是独立的本地状态聚合工具，不隶属于、不代表，也不获得这些产品运营方的官方背书。使用时请遵守各平台的服务条款，不要通过本工具绕过权限、配额或安全控制。
