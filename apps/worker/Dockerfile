FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY patches ./patches
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/worker ./apps/worker
# Root postinstall restores 3D assets the worker does not ship. Rebuild native extractors after.
RUN pnpm install --frozen-lockfile --filter @compa/worker... --ignore-scripts \
 && pnpm rebuild sharp @napi-rs/canvas \
 && chown -R node:node /app
USER node
CMD ["pnpm","--filter","@compa/worker","start"]
