# Experimental NAQLA staging image: the Mindustry TeaVM runtime is compiled
# from pinned GPL-3.0 sources and bundled into the SAME web application.
# Production distribution must satisfy all corresponding-source obligations.
FROM eclipse-temurin:21-jdk-jammy AS mindustry-web
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
RUN git clone --recurse-submodules https://github.com/khoichon/mindustry-web.git mindustry-web \
    && git -C mindustry-web checkout 33652d79b21498d2cbd0d7f38cab46aa3a8fe183 \
    && git -C mindustry-web submodule update --init --recursive
WORKDIR /opt/mindustry-web
RUN curl --fail --location --retry 3 \
    -o mindustry.jar \
    https://github.com/Anuken/Mindustry/releases/download/v159.7/Mindustry.jar \
    && echo '67b2e5c7575e564b184ed11e139c01ddc140afd28b238715e7d42e81612fdfbe  mindustry.jar' | sha256sum -c -
WORKDIR /opt/mindustry-web/offlinemode
RUN chmod +x ./gradlew \
    && ./gradlew --no-daemon :backend-teavm:buildWeb "-Dorg.gradle.java.home=$JAVA_HOME"

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# The copied game is a real upstream-derived TeaVM output, not a launcher stub.
COPY --from=mindustry-web /opt/mindustry-web/offlinemode/backend-teavm/build/web /tmp/mindustry-web
COPY --from=mindustry-web /opt/mindustry-web/LICENSE /tmp/mindustry-web/LICENSE
RUN node scripts/package-mindustry-web.mjs /tmp/mindustry-web \
    && cp /tmp/mindustry-web/LICENSE apps/mobile/public/third-party/mindustry/LICENSE \
    && test -s apps/mobile/public/third-party/mindustry/naqla-runtime.json
# The complete test suite is run in GitHub CI; Docker builds only the tested app.
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATABASE_PATH=/app/data/board-arena.db
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/index.mjs"]
