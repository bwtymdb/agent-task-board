# AI 任务看板

一个运行在 Windows 桌面上的本地任务监控台，用来集中查看 **WorkBuddy、Kimi Code、Kimi Work** 的会话状态。

当你同时让多个 AI 平台处理不同项目时，不必逐个打开平台检查。把正在处理的会话点成星标，就能在“重点监控”页和屏幕边缘的小面板里持续关注；需要时再去“全部对话”查找其他会话。

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-blue.svg)](https://github.com/bwtymdb/agent-task-board)
[![Electron](https://img.shields.io/badge/Electron-45-47848F.svg)](https://www.electronjs.org/)

## 功能

- **重点监控**：点星标即可加入，不需要分享链接、RPA 选取或手动命名。
- **全部对话与归档会话**：自动发现三个平台的本机会话，独立归档页可取消归档并继续工作。
- **单展开手风琴**：展开一个任务的操作区时自动收起其他任务，不需要额外点击。
- **真实状态**：红黄绿灯只来自平台，不提供人工改灯；状态筛选生效时可点“全部状态”一键恢复完整列表。
- **原对话直达**：Kimi Code 和 WorkBuddy 可打开对应会话继续工作，支持按钮和双击任务行。
- **Kimi Code 打开偏好**：设置中可选桌面端优先或 CMD 优先，默认桌面端。
- **仅监测 Work**：Kimi Work 只纳入 Work Agent 会话，不纳入 Chat 咨询对话。
- **同步操作**：Kimi Code、WorkBuddy 支持同步重命名和平台归档/恢复。
- **桌面悬浮**：置顶、30%–100% 透明度、鼠标穿透和位置记忆。
- **边缘缩略区**：拖到屏幕边缘后，仅保留重点任务的序号、平台和灯；鼠标靠近展开。
- **便签配色**：午夜、便签黄、薄荷绿、天空蓝、薰衣草、樱花粉。
- **本地运行**：不依赖云端账号同步，不上传对话正文，不包含遥测。

## 重点监控与归档的区别

| 操作 | 用途 | 是否影响原平台 |
| --- | --- | --- |
| 星标 | 把当前正在处理的会话加入重点监控 | 只改变看板，不改变平台 |
| 平台归档 | 暂时收起会话，以后到归档视图找回 | 在原平台同步归档 |
| 看板别名 | 给缺少公开标题接口的 Kimi Work 会话设置显示名称 | 只改变看板 |

重点监控不是第二套归档，也不会因为会话完成而自动移除。是否继续关注，由你通过星标决定。

## 状态约定

每行保留红、黄、绿三个灯，当前状态高亮，并附中文状态文字。

| 灯 | 含义 | 典型情况 |
| --- | --- | --- |
| 红灯 | 需要处理 | 等待权限确认、等待回答、执行失败、Hook 心跳中断、未知状态 |
| 黄灯 | 正在执行 | 规划、运行工具、后台任务进行中 |
| 绿灯 | 本轮完成 / 空闲 | 一轮回复结束或会话空闲 |

**绿灯只表示当前这一轮结束，不代表整个项目已经完成。** 状态统计和列表顺序随平台更新，不允许人工改灯。

## 平台能力矩阵

| 能力 | Kimi Code | WorkBuddy | Kimi Work |
| --- | --- | --- | --- |
| 自动发现会话 | 支持 | 支持 | 支持 |
| 实时状态 | 官方 API + Hooks + 本地事件回放 | 本地数据库状态 | 本地状态 JSON |
| 打开原对话 | 桌面端标题定位，或 CMD `kimi --session <id>` | `workbuddy://chat/<id>` | 当前仅打开平台 |
| 同步重命名 | 官方 Server API | 受限事务 + 回读校验 | 仅看板别名 |
| 平台归档/恢复 | 官方 Server API | 受限事务 + 回读校验 | 当前不支持 |
| 重点星标 | 支持 | 支持 | 支持 |

Kimi Code 官方目前没有公开的“按会话 ID 直达桌面端”参数。桌面端优先时，看板先唤起工作区，再通过会话搜索定位完整标题；定位失败会明确提示，不静默改开 CMD。CMD 优先则直接运行 `kimi --session <id>`。

Kimi Work 没有找到可稳定使用的公开会话深链和写接口，因此不以模拟点击冒充可靠支持。平台升级后，如出现公开稳定接口，可继续补齐。

## 安装

1. 前往 [Releases](https://github.com/bwtymdb/agent-task-board/releases/latest) 下载 `AgentTaskBoard-Setup-<version>.exe`。
2. 运行安装程序，从桌面或开始菜单启动“AI 任务看板”。
3. 在设置中点击“配置 / 修复 Kimi Code Hooks”，补充实时事件通知。

当前安装包未购买代码签名证书，Windows SmartScreen 可能提示“未知发布者”。请只运行从本仓库 Release 页面下载、且能核验来源的安装包。

### 系统要求

- Windows 10/11 x64
- 需要监控的 WorkBuddy、Kimi Code、Kimi Work 桌面端或 CLI
- Kimi Code Hook 上报器通过 `node` 命令运行，因此 Hook 辅助事件需要 Node.js 22+ 可在 `PATH` 中调用

没有 Node.js 时，看板主体、历史会话和官方 API/本地事件回放仍可使用，但 Hook 辅助事件不可用。

## 数据接入

| 平台 | 默认位置 |
| --- | --- |
| Kimi Code | `%USERPROFILE%\.kimi-code` |
| WorkBuddy | `%USERPROFILE%\.workbuddy\workbuddy.db` |
| Kimi Work | `%APPDATA%\kimi-desktop\kimi-agent\conversation-statuses.json` |

数据目录可在设置中修改，自定义路径重启后生效。

### Kimi Code 实时状态

状态获取按以下优先级合并：官方 Server API > Hooks > `wire.jsonl` 本地事件回放 > 静态会话元数据。老会话即使在 Hook 安装前已经运行，也能通过 API 或事件回放识别，不要求重启任务。

本地 Server API 凭据只在内存中用于 `127.0.0.1` 回环调用，不写入看板设置、不打印日志、不上传。

### Kimi Code Hooks

点击“配置 / 修复 Kimi Code Hooks”后，看板会备份现有 `config.toml`，在独立管理区块中添加状态上报 Hook，不覆盖其他 Hook。事件只发送到仅监听 `127.0.0.1` 的本地入口，并使用随机本地令牌校验。

## 隐私与写操作边界

- 监控过程只读源会话文件和数据库，不代替用户批准权限或回答问题。
- 不持久化对话正文，不上传本地会话内容。
- 不收集或上传平台账号密码、Cookie 或访问令牌。
- 只有用户主动重命名或归档时，才执行对应平台的受限写操作。
- WorkBuddy 写操作仅允许指定会话的 `title/custom_title/status/updated_at`，先备份、单行校验并回读，不提供通用 SQL。
- 看板自己的设置、星标、别名和 Hook 连接信息保存在 Electron `userData` 中。
- 本地 Hook 服务只绑定回环地址，不面向局域网或互联网开放。

**请不要提交真实会话导出、账号凭据、Hook 连接文件、数据库备份或本地设置到 Issue、Pull Request 或公开仓库。** 漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 当前限制

- 只监控当前 Windows 电脑上的本机会话，不做手机、其他电脑或云端账号的全量同步。
- Kimi Work 当前只打开平台，标题可设置看板别名，不支持平台重命名/归档。
- WorkBuddy 进行中的会话需要先完成再归档，避免把活动任务误收进归档。
- 私有平台数据结构可能随版本变化；连接器失效时显示错误并保留最后有效快照，不把未知状态误判为完成。
- 暂不支持远程审批、多人协作、自动更新、macOS 或 Linux。

## 从源码运行

推荐 Node.js 24；Node.js 22+ 为最低建议版本。

```bash
git clone https://github.com/bwtymdb/agent-task-board.git
cd agent-task-board
npm install
npm run dev
```

如果 Electron 官方二进制下载较慢，可在当前终端设置镜像后再安装：

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm install
```

PowerShell 可使用 `$env:ELECTRON_MIRROR` 和 `$env:ELECTRON_BUILDER_BINARIES_MIRROR` 设置同名变量。镜像只用于下载构建依赖，应用运行时不会连接这些镜像。

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
- **React 渲染进程**：重点监控、全部对话、设置和边缘缩略区。
- **受限 preload**：通过 `contextBridge` 暴露白名单 API；渲染进程不开放 Node.js。
- **统一状态模型**：三个平台分别映射为 `red | yellow | green`，不应用人工覆盖。
- **本地持久化**：设置通过临时文件加重命名方式原子写入。

```text
src/
  main/
    connectors/       # 三个平台适配器、官方 API 与事件回放
    event-server.ts   # 仅回环地址的 Hook 接收入口
    window.ts         # 置顶、透明度、穿透和重点缩略区
    store.ts          # 本地设置持久化
  preload/            # 受限 IPC 桥接
  renderer/           # React 界面
  shared/             # 共享类型、状态映射与排序
resources/
  hook-reporter.cjs   # 无第三方依赖的 Hook 上报器
```

安全相关设置包括 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。IPC 不暴露通用命令执行、通用文件读写或任意 SQL。

## 参与贡献

欢迎提交 Issue 和 Pull Request，尤其是：

- 平台新版本造成的数据结构或状态值变化
- Kimi Work 的公开、稳定会话标题、直达和回写接口
- 多显示器、DPI、窗口边缘交互问题
- 无障碍、性能和中英文界面改进

请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。发布流程见 [docs/RELEASING.md](docs/RELEASING.md)，版本变化见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证与名称说明

本项目使用 [MIT License](LICENSE)。

WorkBuddy、Kimi Code、Kimi Work 分别是其各自所有者的产品名称。本项目是独立的本地状态聚合工具，不隶属于、不代表，也不获得这些产品运营方的官方背书。使用时请遵守各平台的服务条款，不要通过本工具绕过权限、配额或安全控制。
