// 우리 집 앱 자동 테스트 (Playwright, 아이폰 13 크기)
// 실행: npm install && npx playwright install chromium && npm test
// 기본 테스트는 Supabase 요청을 모두 막고 돌림 (운영 서버에 테스트 데이터가 쌓이지 않게).
// 두 기기 동기화 테스트는 운영 서버에 테스트 집을 만들기 때문에 SERVER_TESTS=1 일 때만 돎.
const { test, expect, devices } = require("@playwright/test");

const URL_A = "http://localhost:8000/";
const URL_B = "http://127.0.0.1:8000/"; // 다른 origin = 다른 기기(따로 저장)
test.use({ ...devices["iPhone 13"] });

async function offline(page){
  const calls = [];
  await page.route("**/*.supabase.co/**", r => { calls.push(r.request().url()); r.abort(); });
  return calls;
}
function watchErrors(page){ const errs = []; page.on("pageerror", e => errs.push(String(e))); return errs; }

test("혼자 쓰기: 물건 추가, 서버 요청 없음, 네 탭 열기", async ({ page }) => {
  const errs = watchErrors(page); const calls = await offline(page);
  await page.goto(URL_A);
  await page.evaluate(() => setLang("ko"));
  await page.click('[onclick="pickSolo()"]');
  await page.click(".fab");
  await page.fill("#iname", "충전기");
  await page.click('#sheet [onclick="addItem()"]');
  await expect(page.locator("#itemList")).toContainText("충전기");
  for (const t of ["chores", "fridge", "alerts", "items"]) { await page.evaluate(t => go(t), t); await expect(page.locator(".hdr-title")).not.toBeEmpty(); }
  expect(calls).toEqual([]);
  expect(errs).toEqual([]);
});

test("받은 데이터 검사: 위험한 사진 주소와 번호는 버리고 실행되지 않음", async ({ page }) => {
  const errs = watchErrors(page); await offline(page);
  await page.goto(URL_A);
  await page.evaluate(() => { S.started = true; S.mode = "house"; S.me = "A"; save(); render(); });
  await page.evaluate(() => {
    window.__pwned = 0;
    applyShared({
      items: [
        { id: 1, name: "ok", location: "방", photo: 'x" onerror="window.__pwned=1' },
        { id: "1);window.__pwned=2;//", name: "bad id", location: "방" },
        { id: 3, name: "<img src=x onerror=window.__pwned=3>", location: "방", qty: "<b>9</b>", price: "<i>1</i>", expiry: '2026-01-01" onfocus="x' },
      ],
      spaces: [{ id: "s1');window.__pwned=4;('", name: "x" }, { id: "s2", name: "칸", photo: "javascript:alert(1)" }],
      supplies: [{ id: 1, name: "세제", level: '<img src=x onerror="window.__pwned=5">' }],
    });
    go("items");
  });
  await page.evaluate(() => go("fridge"));
  await page.evaluate(() => { sub.fridge = "supplies"; render(); });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({ pwned: window.__pwned, items: S.items.map(i => i.id), photo: S.items[0].photo, spaces: S.spaces.map(s => s.id), s2photo: S.spaces[0].photo, qty: S.items[1].qty, price: S.items[1].price, expiry: S.items[1].expiry }));
  expect(r.pwned).toBe(0);
  expect(r.items).toEqual([1, 3]);
  expect(r.photo).toBeUndefined();
  expect(r.spaces).toEqual(["s2"]);
  expect(r.s2photo).toBeUndefined();
  expect(r).toMatchObject({ qty: 1, price: null, expiry: "" });
  expect(errs).toEqual([]);
});

test("초대 코드: 새 코드는 10자리, 6자리 예전 코드도 허용", async ({ page }) => {
  await offline(page);
  await page.goto(URL_A);
  const r = await page.evaluate(() => ({ len: newCode().length, ok6: CODE_RE.test("AB12CD"), ok10: CODE_RE.test("AB12CD34EF"), bad: CODE_RE.test("AB1"), bad2: CODE_RE.test("AB12CD<x>") }));
  expect(r).toEqual({ len: 10, ok6: true, ok10: true, bad: false, bad2: false });
});

test("개인정보 안내가 설정과 시작 화면에서 열림", async ({ page }) => {
  await offline(page);
  await page.goto(URL_A);
  await page.evaluate(() => setLang("ko"));
  await page.click('[onclick="openPrivacy()"]');
  await expect(page.locator("#sheet")).toContainText("누가 볼 수 있나요");
  await expect(page.locator('#sheet a[href^="mailto:"]')).toBeVisible();
});

test("두 기기 동기화 (운영 서버 사용)", async ({ browser }) => {
  test.skip(!process.env.SERVER_TESTS, "SERVER_TESTS=1 일 때만 실행");
  const ctx = () => browser.newContext({ ...devices["iPhone 13"] });
  const a = await (await ctx()).newPage(), b = await (await ctx()).newPage();
  const errs = [...watchErrors(a), ...watchErrors(b)];
  await a.goto(URL_A); await a.evaluate(() => setLang("ko"));
  await a.click('[onclick="showCreate()"]'); await a.fill("#hn", "test house"); await a.fill("#mine", "A");
  await a.click('[onclick="createHouse()"]'); await a.waitForSelector(".hero");
  const code = await a.evaluate(() => S.serverCode);
  expect(code).toHaveLength(10);
  await b.goto(URL_B + "?join=" + code); await b.fill("#jname", "B"); await b.click('[onclick^="joinHouse"]');
  await b.evaluate(() => go("items")); await b.click(".fab"); await b.fill("#iname", "from B"); await b.click('#sheet [onclick="addItem()"]');
  await expect.poll(() => a.evaluate(() => S.items.some(i => i.name === "from B")), { timeout: 30000 }).toBe(true);
  expect(errs).toEqual([]);
});
