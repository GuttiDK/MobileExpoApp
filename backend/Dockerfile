FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache curl bash
RUN curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH

COPY package.json package-lock.json* ./
RUN bun install

COPY . .

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
