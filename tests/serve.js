// 테스트용 정적 서버: 저장소 폴더(index.html)를 http://localhost:8000 으로 띄움
// (file:// 주소는 초대 링크 origin이 null이라 쓰지 않음)
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const port = Number(process.env.PORT || 8000);
http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split("?")[0]);
  if (f === "/") f = "/index.html";
  const file = path.join(root, path.normalize(f));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {"Content-Type": file.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream", "Cache-Control": "no-store"});
    res.end(data);
  });
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
