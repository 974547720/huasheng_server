FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 设置默认命令（可以通过环境变量覆盖）
CMD ["npm", "start"]

