# 发布流程

本文档供维护者发布 Windows 安装包时使用。发布物必须来自干净源码，不得混入本机设置、真实会话、账号信息或调试产物。

## 1. 发布前检查

- 确认 `CHANGELOG.md` 已记录新版本和已知限制。
- 确认 `package.json` 与锁文件中的版本一致。
- 确认没有 `.env`、本地设置、Hook 连接文件、真实截图或会话导出进入版本控制。
- 检查 README 中的安装命令、数据路径、平台能力和限制仍与代码一致。
- 不发布 `node_modules/`、`out/`、`release/`、`.tmp-store/` 或 Electron `userData`。

更新版本号但不自动创建 Git 提交或标签：

```bash
npm version <major.minor.patch> --no-git-tag-version
```

## 2. 完整验证

```bash
npm run lint
npm run build
npm run dist
```

必须实际安装生成的 `release/AgentTaskBoard-Setup-<version>.exe`，并验证：

- 三个平台的真实会话和中文标题可显示。
- Kimi Code 黄→红→绿事件、Hook 身份校验和安装后脚本路径正确。
- WorkBuddy 数据库和 Kimi Work 状态文件没有被看板写入。
- 搜索、筛选、归档、别名和手动任务正常。
- 置顶、透明度、鼠标穿透、全局热键恢复和边缘吸附正常。
- 完全退出后无残留 Hook 服务，安装版可在桌面或开始菜单启动。

无法验证的项目必须写进 Release Notes，不能省略。

## 3. 构建安装包

如果官方二进制下载缓慢，可使用以下镜像：

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm run dist
```

PowerShell 可使用 `$env:ELECTRON_MIRROR` 和 `$env:ELECTRON_BUILDER_BINARIES_MIRROR` 设置同名变量。

默认产物：

```text
release/AgentTaskBoard-Setup-<version>.exe
release/AgentTaskBoard-Setup-<version>.exe.blockmap
```

当前未配置自动更新，`.blockmap` 可保留供后续版本使用，不是用户安装的必需文件。

## 4. 发布到 GitHub

提交源码和文档后，为版本创建带 `v` 前缀的标签，例如 `v0.1.0`。在 GitHub 新建对应 Release，上传 `.exe` 安装包。

Release Notes 至少包括：

- 新增、修复和已知限制
- 支持的 Windows 架构（当前仅 x64）
- 未签名安装包可能触发 SmartScreen 的说明
- 平台升级导致的数据兼容注意事项
- 完整验证结果和未验证范围

也可以使用 GitHub CLI：

```bash
gh release create v<major.minor.patch> \
  "release/AgentTaskBoard-Setup-<major.minor.patch>.exe" \
  --title "AI 任务看板 v<major.minor.patch>" \
  --notes-file RELEASE_NOTES.md
```

`RELEASE_NOTES.md` 是发布时临时编写的说明，不应包含真实会话或账号信息。执行发布前确认 `gh auth status` 正常，并确认目标仓库确为 `bwtymdb/agent-task-board`。

## 5. 发布后

- 从 Release 页面重新下载安装包并做一次安装检查。
- 核对 Release 中的仓库、版本、文件大小和发布说明。
- 不将维护者令牌、GitHub 凭据或签名材料写入仓库、Issue 或 Release Notes。
- 发现严重隐私或安全问题时，优先撤下受影响发布物，再发布修复版本并说明影响。
