FROM oven-sh/bun:latest

WORKDIR /usr/src/app

COPY package.json .
RUN bun install

COPY . .

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
