import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Thay %BUILD_ID% trong index.html bằng thời điểm dựng.
 *
 * Màn hình chờ in con số này ra. Nghe thì vụn vặt, nhưng nó trả lời đúng câu
 * hỏi hay gặp nhất khi deploy xong mà giao diện không đổi: người dùng đang
 * chạy bản nào — bản vừa dựng, hay một bản cũ còn nằm trong cache.
 */
function buildId(): Plugin {
  const id = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return {
    name: 'build-id',
    transformIndexHtml: (html) => html.replaceAll('%BUILD_ID%', id),
  };
}

export default defineConfig({
  plugins: [react(), buildId()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    allowedHosts: true,
    /*
      Mã nguồn nằm trên ổ Windows, bind-mount vào container Linux. Thay đổi
      file trên host KHÔNG sinh ra sự kiện inotify bên trong container, nên
      Vite không hề biết file đã đổi: nó cứ trả module đã transform từ lần
      đầu, sửa xong refresh mấy cũng vẫn thấy bản cũ cho tới khi restart.
      Hỏi vòng vòng thì tưởng lỗi code, thật ra là watcher điếc — bật polling.
    */
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': 'http://backend:8000',
      '/uploads': 'http://backend:8000',
    },
  },
});
