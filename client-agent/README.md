# FDM-AI Client Agent

本地 Agent 运行在用户电脑上，通过 WebSocket 接收前端指令，负责执行浏览器和云端都不适合直接做的本机操作。

## 功能

| 功能 | 工具 |
|------|------|
| 通过切片软件原生流程导出 3MF | Bambu Studio CLI |
| 实时进度回传到前端 | WebSocket |

## 快速启动

```bash
cd client-agent
npm install
cp config.example.json config.json
npm start
```

默认监听：`ws://localhost:7890`

## 配置文件

```json
{
  "port": 7890,
  "backend_url": "http://localhost:8000",
  "bambu_studio_path": "C:/Program Files/Bambu Studio/bambu-studio.exe"
}
```

## 支持的命令

### 本地 slicer CLI 导出 3MF

```json
{
  "cmd": "export_3mf_cli",
  "job_id": "<server-job-id>",
  "output_name": "optimized.3mf"
}
```

兼容旧命令名：

```json
{
  "cmd": "repack_3mf",
  "job_id": "<server-job-id>"
}
```

## Agent -> 前端消息

```json
{
  "type": "progress" | "done" | "error" | "hello" | "status",
  "cmd": "export_3mf_cli",
  "job_id": "...",
  "message": "...",
  "download_url": "...",
  "data": {}
}
```

## 说明

- 当前 3MF 主路径已经改为"切片软件原生导出"
- Agent 会先探测本机 `Bambu Studio` 实际支持的 CLI 参数名，再按本机版本拼接命令
- 旧的 ZIP 重打包不再是默认生产方案
- 如果后续支持 OrcaSlicer，可在保持前端协议不变的前提下扩展 Agent 的执行器
