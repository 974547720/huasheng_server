# 阿里云 + Docker 部署（小白手把手）

本文档面向前端/新手，目标是在阿里云 Ubuntu 服务器上用 Docker 部署 `huasheng_server`。

## 一、准备工作

1. 购买阿里云 ECS（推荐 Ubuntu 22.04 LTS）
2. 在安全组开放端口
   - `22`（SSH）
   - `80`（HTTP）
   - `443`（HTTPS，可选）
   - `3000`（Node 服务端口，如果不走 Nginx）
3. 在本地准备好项目代码，并推送到 GitHub

## 二、登录服务器

```bash
ssh root@你的服务器公网IP
```

## 三、安装 Docker 和 docker-compose

```bash
apt update -y
apt install -y ca-certificates curl gnupg lsb-release

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update -y
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

验证：

```bash
docker -v
docker compose version
```

## 四、准备项目目录

建议放到 `/opt`：

```bash
mkdir -p /opt/huasheng_server
cd /opt/huasheng_server
```

拉取代码：

```bash
git clone 你的GitHub仓库地址 .
```

## 五、准备生产环境配置文件

### 1）创建生产用 docker-compose 文件

在项目根目录新建 `docker-compose.prod.yml`：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - REDIS_DB=${REDIS_DB}
      - JWT_SECRET=${JWT_SECRET}
      - MAIL_HOST=${MAIL_HOST}
      - MAIL_PORT=${MAIL_PORT}
      - MAIL_SECURE=${MAIL_SECURE}
      - MAIL_USER=${MAIL_USER}
      - MAIL_PASS=${MAIL_PASS}
      - MAIL_FROM=${MAIL_FROM}
      - MEOW_API_KEY=${MEOW_API_KEY}
      - MEOW_POST_API=${MEOW_POST_API}
    depends_on:
      - mysql
      - redis

volumes:
  mysql_data:
  redis_data:
```

### 2）创建 `.env`（服务器环境变量）

在项目根目录创建 `.env`（注意：不要提交到 Git）：

```env
NODE_ENV=production
PORT=3000

DB_USER=developer
DB_PASSWORD=你自己的数据库密码
DB_NAME=mydatabase
MYSQL_ROOT_PASSWORD=你自己的root密码

REDIS_PASSWORD=
REDIS_DB=0

JWT_SECRET=换成强随机字符串

MAIL_HOST=smtp.163.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=你的邮箱
MAIL_PASS=你的邮箱SMTP授权码
MAIL_FROM="花生平台 <你的邮箱>"

MEOW_API_KEY=你的key
MEOW_POST_API=https://api.meowload.net/openapi/extract/post
```

> 注意：如果你在云服务器上用 163 邮箱 SMTP 仍然超时，说明运营商/平台出站网络限制，建议换邮件服务（如 SendGrid/Mailgun）。

## 六、启动服务

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

查看状态：

```bash
docker compose -f docker-compose.prod.yml ps
```

查看日志：

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

## 七、验证服务

浏览器访问：

```
http://你的服务器IP:3000/
```

如果你想使用 80/443 域名访问，需要加 Nginx 反代（可选）。

## 八、常见问题

1. **访问不了端口**
   - 检查阿里云安全组是否放行 `3000`
2. **Redis 报错 NOAUTH**
   - 检查 `.env` 中 `REDIS_PASSWORD` 是否正确
3. **Redis 报 NaN**
   - 确认 `REDIS_DB=0`
4. **MySQL 连接失败**
   - 确认 `DB_*` 和 `MYSQL_ROOT_PASSWORD` 正确
5. **邮件发送超时**
   - 云服务器可能限制 SMTP 端口，建议换邮件服务

## 九、更新部署（以后发布新版本）

```bash
cd /opt/huasheng_server
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

