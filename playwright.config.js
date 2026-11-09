// Playwright 설정: 테스트 전에 tests/serve.js로 앱을 http://localhost:8000 에 띄움
const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "tests",
  timeout: 60000,
  webServer: { command: "node tests/serve.js", url: "http://localhost:8000/", reuseExistingServer: true },
});
