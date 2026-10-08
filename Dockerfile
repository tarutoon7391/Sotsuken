# Railway 用のイメージ（v4.4）。Office 資料を PDF に変換するため LibreOffice と日本語フォントを入れる
# 起動の流れは今までと同じ：npm start（prestart で migrate → サーバー起動）。healthcheck は railway.json の /api/health
FROM node:20-bookworm-slim

# LibreOffice（Writer / Calc / Impress）と日本語フォント。フォントが無いと日本語が豆腐（□）になる
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存だけ先に入れる（ソースだけ変えたときにキャッシュが効くように）
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY client/package.json client/
RUN npm ci

# ソースを入れて画面をビルドする（vite は devDependencies なので、npm ci は本番フラグなしで行う）
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV SOFFICE_PATH=soffice
EXPOSE 3000

CMD ["npm", "start"]
