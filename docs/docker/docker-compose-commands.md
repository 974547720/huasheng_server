# Docker Compose 常用命令手册

本文档记录了本项目中使用 Docker Compose 进行多容器开发的常用命令，包含详细说明和实际示例。

## 目录

- [基本操作](#基本操作)
- [容器管理](#容器管理)
- [日志查看](#日志查看)
- [数据库操作](#数据库操作)
- [调试与故障排查](#调试与故障排查)
- [数据管理](#数据管理)
- [网络与卷管理](#网络与卷管理)
- [常用工作流](#常用工作流)

---

## 基本操作

### 启动服务

#### 后台启动所有服务
```bash
docker-compose up -d
```
**说明：**
- `-d` 参数表示在后台（detached）运行
- 首次运行会自动构建镜像（如果使用 `build` 配置）
- 会创建网络、卷等资源（如果不存在）

**示例输出：**
```
✔ Network huasheng_server_app-network Created
✔ Volume huasheng_server_mysql_data Created
✔ Container mysql-local       Created
✔ Container redis-local        Created
✔ Container huasheng-app       Created
```

#### 前台启动（查看实时日志）
```bash
docker-compose up
```
**说明：**
- 在前台运行，可以看到所有服务的实时日志
- 按 `Ctrl+C` 会停止所有服务
- 适合调试和查看启动过程

#### 启动特定服务
```bash
docker-compose up -d mysql redis
```
**说明：**
- 只启动指定的服务（mysql 和 redis）
- 其他服务不会启动

#### 强制重新创建容器
```bash
docker-compose up -d --force-recreate
```
**说明：**
- 即使容器配置没有变化，也会重新创建容器
- 适用于需要重置容器状态的场景

#### 重新构建镜像并启动
```bash
docker-compose up -d --build
```
**说明：**
- 在启动前重新构建镜像
- 适用于 Dockerfile 或代码有更新时

---

### 停止服务

#### 停止所有服务（保留容器）
```bash
docker-compose stop
```
**说明：**
- 停止运行中的容器，但不删除
- 数据卷和网络保持不变
- 可以快速重新启动：`docker-compose start`

#### 停止并删除容器
```bash
docker-compose down
```
**说明：**
- 停止并删除所有容器
- 删除网络（如果由 docker-compose 创建）
- **保留数据卷**（数据不会丢失）

#### 停止并删除容器及数据卷
```bash
docker-compose down -v
```
**说明：**
- ⚠️ **危险操作**：会删除所有数据卷
- 包括 MySQL 和 Redis 的所有数据
- 适用于需要完全重置环境的场景

**示例：重新初始化数据库**
```bash
# 1. 停止并删除所有数据
docker-compose down -v

# 2. 重新启动（会执行 init.sql）
docker-compose up -d
```

---

## 容器管理

### 查看容器状态
```bash
docker-compose ps
```
**说明：**
- 显示所有服务的容器状态
- 包括容器名称、状态、端口映射等信息

**示例输出：**
```
NAME            IMAGE                COMMAND                  SERVICE   CREATED         STATUS          PORTS
huasheng-app    huasheng_server-app   "docker-entrypoint.s…"   app       2 minutes ago   Up 2 minutes    0.0.0.0:3000->3000/tcp
mysql-local     mysql:8.0             "docker-entrypoint.s…"   mysql     2 minutes ago   Up 2 minutes    0.0.0.0:3307->3306/tcp
redis-local     redis:7-alpine        "docker-entrypoint.s…"   redis     2 minutes ago   Up 2 minutes    0.0.0.0:6378->6379/tcp
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart app
docker-compose restart mysql redis
```

### 启动已停止的容器
```bash
docker-compose start
```

### 暂停和恢复服务
```bash
# 暂停所有服务
docker-compose pause

# 恢复所有服务
docker-compose unpause
```

---

## 日志查看

### 查看所有服务日志
```bash
docker-compose logs
```

### 实时跟踪日志（类似 tail -f）
```bash
docker-compose logs -f
```
**说明：**
- `-f` 参数表示跟随（follow）日志输出
- 按 `Ctrl+C` 退出

### 查看特定服务的日志
```bash
# 查看应用日志
docker-compose logs -f app

# 查看 MySQL 日志
docker-compose logs -f mysql

# 查看 Redis 日志
docker-compose logs -f redis
```

### 查看最近 N 行日志
```bash
docker-compose logs --tail=100 app
```
**说明：**
- 只显示最后 100 行日志
- 适合查看最近的错误信息

### 查看带时间戳的日志
```bash
docker-compose logs -t app
```
**说明：**
- `-t` 参数显示时间戳
- 便于定位问题发生的时间

---

## 数据库操作

### 连接到 MySQL 容器

#### 方式一：使用 docker-compose exec
```bash
docker-compose exec mysql mysql -uroot -proot3306
```
**说明：**
- 直接进入 MySQL 命令行
- 使用 root 用户，密码为 `root3306`（根据 docker-compose.yml 配置）

#### 方式二：使用普通用户
```bash
docker-compose exec mysql mysql -udeveloper -pabcd1234 mydatabase
```
**说明：**
- 使用普通用户 `developer`
- 直接连接到 `mydatabase` 数据库

#### 方式三：进入容器后连接
```bash
# 进入容器
docker-compose exec mysql bash

# 在容器内连接 MySQL
mysql -uroot -proot3306
```

### 执行 SQL 命令
```bash
# 查看所有数据库
docker-compose exec mysql mysql -uroot -proot3306 -e "SHOW DATABASES;"

# 查看表
docker-compose exec mysql mysql -uroot -proot3306 -e "USE peanut_parser; SHOW TABLES;"

# 查看表结构
docker-compose exec mysql mysql -uroot -proot3306 -e "USE peanut_parser; DESCRIBE users;"
```

### 执行 SQL 文件
```bash
# 从宿主机执行 SQL 文件
docker-compose exec -T mysql mysql -uroot -proot3306 < /path/to/your/script.sql

# 从容器内执行 SQL 文件
docker-compose exec mysql mysql -uroot -proot3306 mydatabase < /path/to/script.sql
```

### 导出数据库
```bash
# 导出整个数据库
docker-compose exec mysql mysqldump -uroot -proot3306 peanut_parser > backup.sql

# 导出特定表
docker-compose exec mysql mysqldump -uroot -proot3306 peanut_parser users parse_tasks > tables_backup.sql

# 导出并压缩
docker-compose exec mysql mysqldump -uroot -proot3306 peanut_parser | gzip > backup.sql.gz
```

### 导入数据库
```bash
# 导入 SQL 文件
docker-compose exec -T mysql mysql -uroot -proot3306 peanut_parser < backup.sql
```

### 重新初始化数据库
```bash
# 1. 停止并删除数据卷
docker-compose down -v

# 2. 重新启动（会自动执行 mysql/init/init.sql）
docker-compose up -d

# 3. 验证数据库
docker-compose exec mysql mysql -uroot -proot3306 -e "USE peanut_parser; SHOW TABLES;"
```

---

## 调试与故障排查

### 进入容器内部

#### 进入应用容器
```bash
docker-compose exec app sh
```
**说明：**
- 进入应用容器的 shell
- 可以查看文件、运行命令等
- 使用 `exit` 退出

**常用操作：**
```bash
# 查看环境变量
env

# 查看文件列表
ls -la

# 查看进程
ps aux

# 测试数据库连接
node -e "require('./src/config/db.js').query('SELECT 1').then(console.log)"
```

#### 进入 MySQL 容器
```bash
docker-compose exec mysql bash
```

#### 进入 Redis 容器
```bash
docker-compose exec redis sh
```

### 查看容器资源使用情况
```bash
docker-compose top
```
**说明：**
- 显示每个容器中运行的进程
- 类似 Linux 的 `top` 命令

### 查看容器详细信息
```bash
# 查看应用容器信息
docker inspect huasheng-app

# 查看 MySQL 容器信息
docker inspect mysql-local
```

### 检查服务健康状态
```bash
# 查看健康检查状态
docker-compose ps

# 查看详细健康检查日志
docker inspect mysql-local | grep -A 10 Health
```

### 查看网络连接
```bash
# 查看容器网络
docker network inspect huasheng_server_app-network

# 测试容器间连接
docker-compose exec app ping mysql
docker-compose exec app ping redis
```

---

## 数据管理

### 查看数据卷
```bash
# 列出所有数据卷
docker volume ls

# 查看特定数据卷详情
docker volume inspect huasheng_server_mysql_data
docker volume inspect huasheng_server_redis_data
```

### 备份数据卷
```bash
# 备份 MySQL 数据卷
docker run --rm -v huasheng_server_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup.tar.gz /data

# 备份 Redis 数据卷
docker run --rm -v huasheng_server_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis_backup.tar.gz /data
```

### 恢复数据卷
```bash
# 恢复 MySQL 数据卷
docker run --rm -v huasheng_server_mysql_data:/data -v $(pwd):/backup alpine tar xzf /backup/mysql_backup.tar.gz -C /
```

### 清理未使用的数据卷
```bash
# ⚠️ 谨慎使用：删除所有未使用的数据卷
docker volume prune
```

---

## 网络与卷管理

### 查看网络
```bash
# 列出所有网络
docker network ls

# 查看网络详情
docker network inspect huasheng_server_app-network
```

### 查看端口映射
```bash
docker-compose ps
```
**说明：**
- 在 PORTS 列可以看到端口映射
- 格式：`宿主机端口:容器端口`

**本项目端口映射：**
- 应用：`3000:3000`
- MySQL：`3307:3306`
- Redis：`6378:6379`

---

## 常用工作流

### 完整开发环境启动流程
```bash
# 1. 确保 .env 文件存在并配置正确
cp .env.example .env
# 编辑 .env 文件

# 2. 首次启动（构建镜像）
docker-compose up -d --build

# 3. 查看日志确认服务正常
docker-compose logs -f

# 4. 验证数据库初始化
docker-compose exec mysql mysql -uroot -proot3306 -e "USE peanut_parser; SHOW TABLES;"
```

### 代码更新后的操作
```bash
# 如果修改了 Dockerfile 或依赖
docker-compose up -d --build

# 如果只修改了代码（已挂载卷，会自动热重载）
# 无需重启，nodemon 会自动检测变化
```

### 重新初始化数据库
```bash
# 1. 停止并删除所有数据
docker-compose down -v

# 2. 确保 mysql/init/init.sql 是最新的

# 3. 重新启动
docker-compose up -d

# 4. 等待 MySQL 初始化完成（查看日志）
docker-compose logs -f mysql

# 5. 验证
docker-compose exec mysql mysql -uroot -proot3306 -e "USE peanut_parser; SHOW TABLES;"
```

### 调试应用问题
```bash
# 1. 查看应用日志
docker-compose logs -f app

# 2. 进入容器检查
docker-compose exec app sh

# 3. 检查环境变量
docker-compose exec app env | grep -E "DB_|REDIS_"

# 4. 测试数据库连接
docker-compose exec app node -e "require('./src/config/db.js').query('SELECT 1').then(r => console.log('DB OK:', r)).catch(e => console.error('DB Error:', e))"
```

### 常见问题
```bash

### 当容器增加了新的package包的时候

# 强行清理所有相关资源
# 停止容器并删除关联的匿名卷（-v 参数）
docker-compose down -v

# 重新构建并启动
docker-compose up -d --build

# 如果不想折腾卷，可以尝试让运行中的容器自己装一下：
docker-compose exec app npm install axios
# 然后验证一下是否成功
docker-compose exec app ls node_modules/axios
```


### 生产环境部署准备
```bash
# 1. 修改 docker-compose.yml 中的命令为生产模式
# command: npm start  # 而不是 npm run dev

# 2. 构建生产镜像
docker-compose build

# 3. 启动服务
docker-compose up -d

# 4. 查看状态
docker-compose ps
```

---

## 快速参考

### 最常用的命令组合

```bash
# 启动环境
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 重启服务
docker-compose restart app

# 停止环境
docker-compose down

# 完全重置（删除所有数据）
docker-compose down -v && docker-compose up -d
```

### 服务名称速查

- **应用服务**：`app`
- **MySQL 服务**：`mysql`
- **Redis 服务**：`redis`

### 容器名称速查

- **应用容器**：`huasheng-app`
- **MySQL 容器**：`mysql-local`
- **Redis 容器**：`redis-local`

---

## 注意事项

1. **数据持久化**：MySQL 和 Redis 的数据都保存在 Docker 卷中，使用 `docker-compose down -v` 会删除所有数据

2. **端口冲突**：如果端口被占用，可以修改 `docker-compose.yml` 中的端口映射

3. **环境变量**：容器内应用通过服务名（`mysql`、`redis`）访问其他容器，而不是 `localhost`

4. **热重载**：开发模式下，代码修改会自动重启应用（nodemon），无需手动重启容器

5. **健康检查**：应用容器会等待 MySQL 和 Redis 健康检查通过后才启动

---

## 故障排查清单

如果遇到问题，按以下顺序检查：

1. ✅ 检查容器状态：`docker-compose ps`
2. ✅ 查看服务日志：`docker-compose logs -f [service]`
3. ✅ 检查网络连接：`docker-compose exec app ping mysql`
4. ✅ 验证环境变量：`docker-compose exec app env`
5. ✅ 检查数据卷：`docker volume ls`
6. ✅ 查看容器详细信息：`docker inspect [container_name]`

---

## 相关文档

- [Docker Compose 官方文档](https://docs.docker.com/compose/)
- [Docker 官方文档](https://docs.docker.com/)
- 项目 README.md

---

**最后更新**：2026-01-20

