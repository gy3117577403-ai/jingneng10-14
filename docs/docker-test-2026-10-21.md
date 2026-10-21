# Docker 复测记录

日期：2026-10-21。工作目录：`C:\Users\31175\Desktop\10-21jineng`。

本文保留实施前的环境测试记录。后续本机报价工作台已使用独立 MariaDB 实例完成数据库验证，当前结果见 [工作台验收记录](./quote-workbench-verification.md)。

结论：Docker 引擎和基本容器运行能力可用；默认网络地址池耗尽阻止了新 Compose 项目自动创建网络。MySQL 8.4 镜像未完成下载，数据库就绪状态尚未验证。

## 实际测试结果

| 检查 | 结果 | 证据与范围 |
| --- | --- | --- |
| Docker 引擎 | 通过 | 客户端和服务端均返回 29.8.2；Docker Desktop 4.94.0；当前 context 为 desktop-linux，服务端为 Linux/WSL2 |
| Compose CLI | 通过 | `docker compose version` 返回 v5.5.1 |
| Docker Hub 基本拉取及运行 | 通过 | `docker run --rm --pull=always hello-world:latest` 完整下载并输出 `Hello from Docker!`，退出码 0 |
| 新建默认 Compose 网络 | 失败 | 守护进程返回 `all predefined address pools have been fully subnetted` |
| 网络清点 | 已核实 | 85 个 Docker 网络，其中 83 个 bridge 网络；包含默认地址池分配的网段和已有项目的自定义网段 |
| Compose 服务运行和本机访问 | 通过，有条件 | 临时测试改用现有 `bridge` 网络，以本机已有的 `node:20-alpine` 镜像提供 HTTP 服务；`127.0.0.1:13306/probe.txt` 返回预先写入数据卷的标记 |
| 数据卷持久化 | 通过 | 强制重建临时服务容器，确认容器 ID 改变后，原始标记仍可通过 HTTP 读取；服务启动命令不负责重新生成标记 |
| MySQL 8.4 镜像 | 未完成 | 初次拉取长时间未完成；重试一次后仍没有完整本地镜像，已停止本次拉取。未获得足以确认下载停滞根因的证据 |
| MySQL SQL 读写、事务回滚 | 未验证 | 未启动 MySQL 实例；已经准备的数据库测试脚本没有执行 |

本机端口访问和数据卷文件保留的测试，不能证明 MySQL 初始化、SQL 事务、报价保存或审批流程已经工作。

## 测试资源与清理

- 临时项目名为 `jn1014-docker-core-23e43e5ed3` 和 `jn1014-docker-smoke-23e43e5ed3`。结束后按各自 Compose 标签查询，剩余容器、网络和数据卷均为零。
- 本机端口 13306 已释放。
- 测试开始时的 10 个运行容器，在结束核对时全部仍在运行。另有两个其他项目容器在测试期间启动，未被本次测试操作。
- 没有清理历史 Docker 网络、历史容器或已有业务数据卷，也没有重启 Docker 引擎或修改全局网络、代理配置。
- 新下载的 hello-world 镜像和已下载的 MySQL 层缓存保留。
- 自动审批拒绝删除 Windows 临时测试目录；缩小到逐个删除已知文件后仍被拒绝，工具提示仅为 `blocked by policy`，未提供更具体原因。
- 以下目录中仍有 5 个本次创建的文件：`C:\Windows\TEMP\jn1014-docker-smoke-23e43e5ed3`。文件为 `compose.yaml`、`core-compose.yaml`、`probe.ps1`、`mysql-client.cnf`、`mysql-password.txt`。后两者包含随机生成、未用于现有服务的测试口令；本记录不包含口令内容。

## 对后端落地的影响

此前的“Docker 引擎连接失败”条件已消失，但 M0 数据库就绪验收仍未完成。实施前需要完成项目网络的地址冲突检查与配置、完整拉取 MySQL 8.4，并运行真实 SQL 读写、事务回滚和数据库重建后的持久化测试。

本次没有实施报价与审批后端，没有运行业务数据库迁移，没有提交或推送仓库变更。
