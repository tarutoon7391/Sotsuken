// 通しシナリオ（docs/10 P6 の a〜g）を REST + Socket.IO で自動実行する。
// 使い方：サーバーを起動してから  node scripts/e2e-scenario.js [http://localhost:3000]
// テストデータは e2e_ 接頭辞。終了時に作ったユーザー・クラスを削除する（FK の CASCADE で授業以下も消える）。
const { io } = require('socket.io-client');
const mysql = require('mysql2/promise');
const config = require('../server/src/config');

const BASE = process.argv[2] || `http://localhost:${config.port}`;
const stamp = Date.now().toString(36);
const results = [];

function ok(label, cond, detail = '') {
  results.push({ label, pass: !!cond, detail });
  console.log(`${cond ? 'OK ' : 'NG '} ${label}${detail ? '  (' + detail + ')' : ''}`);
}

/** クッキー付き fetch */
function client() {
  let cookie = '';
  const call = async (method, path, body, form) => {
    const headers = { cookie };
    const init = { method, headers };
    if (form) init.body = form;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + '/api' + path, init);
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
  call.cookie = () => cookie;
  return call;
}

function connect(cookie, lessonId) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { lesson_id: lessonId }, extraHeaders: { cookie }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
  });
}

function waitFor(socket, event, ms = 15000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), ms);
    socket.once(event, (p) => { clearTimeout(t); resolve(p); });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 前回の残骸を掃除
  {
    const c = await mysql.createConnection({ uri: config.databaseUrl });
    await c.query("DELETE FROM classes WHERE teacher_id IN (SELECT id FROM users WHERE login_id LIKE 'e2e\_%')");
    await c.query("DELETE FROM users WHERE login_id LIKE 'e2e\_%'");
    await c.end();
  }
  const T = client();
  const S = client();

  // a. 先生登録→クラス作成→生徒登録→参加コードで加入
  let r = await T('POST', '/register', { name: 'e2e先生', login_id: `e2e_t_${stamp}`, password: 'password123', role: 'teacher' });
  ok('a. 先生登録 201', r.status === 201, `status=${r.status}`);
  const teacher = r.data;
  r = await T('POST', '/classes', { name: `e2e クラス ${stamp}` });
  ok('a. クラス作成 201 join_code 8桁', r.status === 201 && /^[A-Z0-9]{8}$/.test(r.data.join_code), JSON.stringify(r.data));
  const cls = r.data;
  r = await S('POST', '/register', { name: 'e2e生徒', login_id: `e2e_s_${stamp}`, password: 'password123', role: 'student' });
  ok('a. 生徒登録 201', r.status === 201, `status=${r.status}`);
  const student = r.data;
  r = await S('POST', '/classes/join', { join_code: cls.join_code });
  ok('a. 参加コードで加入', r.status === 200 || r.status === 201, `status=${r.status}`);
  r = await S('GET', `/classes/${cls.id}`);
  ok('a. 生徒のクラス詳細に join_code が無い', r.status === 200 && r.data.join_code === undefined, JSON.stringify(r.data));

  // b. 先生が授業作成（タグ付き）→開始、生徒が入室（待機→live）
  r = await T('POST', `/classes/${cls.id}/lessons`, { title: 'e2e 授業', tags: ['数学', 'テスト'] });
  ok('b. 授業作成 201', r.status === 201 && r.data.room_name, JSON.stringify(r.data));
  const lesson = r.data;
  r = await S('GET', `/classes/${cls.id}/lessons?tag=数学`);
  ok('b. ?tag=数学 で絞り込める', r.status === 200 && r.data.length === 1 && r.data[0].tags.includes('数学'), JSON.stringify(r.data));

  const sSock = await connect(S.cookie(), lesson.id).catch((e) => e);
  ok('b. 生徒 Socket 接続（preparing）', sSock && sSock.connected, sSock && sSock.message);
  const tSock = await connect(T.cookie(), lesson.id).catch((e) => e);
  ok('b. 先生 Socket 接続', tSock && tSock.connected, tSock && tSock.message);

  r = await T('GET', `/lessons/${lesson.id}/attendance`);
  ok('b. 開始前は未入室 absent / joined_at null', r.status === 200 && r.data[0] && r.data[0].status === 'absent' && r.data[0].joined_at === null, JSON.stringify(r.data));

  const startedP = waitFor(sSock, 'lesson:started');
  r = await T('POST', `/lessons/${lesson.id}/start`);
  ok('b. 授業開始 → LessonDetail status=live', r.status === 200 && r.data.status === 'live', JSON.stringify(r.data).slice(0, 120));
  ok('b. 生徒に lesson:started が届く', (await startedP) !== undefined);
  r = await T('POST', `/lessons/${lesson.id}/start`);
  ok('b. 二重開始は 409', r.status === 409, `status=${r.status} code=${r.data && r.data.error && r.data.error.code}`);
  await sleep(300);
  r = await S('GET', `/lessons/${lesson.id}/attendance/me`);
  ok('b. 開始で接続中の生徒が present', r.status === 200 && r.data.status === 'present', JSON.stringify(r.data));

  // c. 理解ボタン → 先生の集計
  const undP = waitFor(tSock, 'understanding:update');
  sSock.emit('understanding:send', { type: 'understood' });
  const und = await undP;
  ok('c. understanding:update が先生に届く（understood=1）', und && und.understood === 1 && und.total === 1, JSON.stringify(und));
  r = await T('GET', `/lessons/${lesson.id}/understanding`);
  ok('c. GET understanding current/totals', r.status === 200 && r.data.current.understood === 1 && r.data.totals.understood === 1, JSON.stringify(r.data));

  // d. 挙手・匿名質問 → 先生に表示、回答済み
  const raisedP = waitFor(tSock, 'question:raised');
  const raiseNewS = waitFor(sSock, 'question:new'); // 挙手でも question:new（body null）が全員に届く
  sSock.emit('question:raise', {});
  const raised = await raisedP;
  await raiseNewS;
  ok('d. 挙手 → question:raised が先生に', raised && raised.user && raised.user.id === student.id, JSON.stringify(raised));
  const qNewT = waitFor(tSock, 'question:new');
  const qNewS = waitFor(sSock, 'question:new');
  r = await S('POST', `/lessons/${lesson.id}/questions`, { body: '匿名の質問です', is_anonymous: true });
  ok('d. 匿名質問 POST 201', r.status === 201 && r.data.id, JSON.stringify(r.data));
  const q = r.data;
  const [nt, ns] = [await qNewT, await qNewS];
  ok('d. question:new 先生には user あり・生徒には無し', nt && nt.user && ns && ns.user === undefined, `teacher=${JSON.stringify(nt)} student=${JSON.stringify(ns)}`);
  r = await S('GET', `/lessons/${lesson.id}/questions`);
  const anon = r.data.find((x) => x.id === q.id);
  ok('d. 生徒の一覧で匿名投稿者が非表示', anon && anon.user === undefined, JSON.stringify(anon));
  const ansP = waitFor(sSock, 'question:answered');
  r = await T('PATCH', `/questions/${q.id}`, { status: 'answered' });
  ok('d. 回答済み PATCH', r.status === 200, `status=${r.status}`);
  ok('d. question:answered が届く', (await ansP) !== undefined);

  // e. 確認ボタン → 生徒ポップ → 応答 → 先生の応答状況
  const checkP = waitFor(sSock, 'attention:check');
  r = await T('POST', `/lessons/${lesson.id}/attention`, { timeout_sec: 60 });
  ok('e. 確認ボタン発動 201 {check_id, deadline_at}', r.status === 201 && r.data.check_id && r.data.deadline_at, JSON.stringify(r.data));
  const check = await checkP;
  ok('e. attention:check が生徒に', check && check.check_id === r.data.check_id, JSON.stringify(check));
  const attUpdP = waitFor(tSock, 'attention:update');
  r = await S('POST', `/attention/${check.check_id}/respond`);
  ok('e. 応答 204', r.status === 204, `status=${r.status}`);
  const attUpd = await attUpdP;
  ok('e. attention:update responded に生徒', attUpd && attUpd.responded.some((u) => u.id === student.id) && attUpd.pending.length === 0, JSON.stringify(attUpd));

  // f. 一時退出 → 残り時間 → 戻る → 累積加算
  const awayUpdP = waitFor(tSock, 'attendance:update');
  r = await S('POST', `/lessons/${lesson.id}/attendance/away`);
  ok('f. 一時退出', r.status === 200 && r.data.status === 'away', JSON.stringify(r.data));
  const awayUpd = await awayUpdP;
  ok('f. attendance:update(away) が先生に', awayUpd && awayUpd.status === 'away', JSON.stringify(awayUpd));
  r = await S('GET', `/lessons/${lesson.id}/attendance/me`);
  ok('f. remaining_sec が 閾値15分 付近', r.status === 200 && r.data.remaining_sec > 850 && r.data.remaining_sec <= 900, JSON.stringify(r.data));
  await sleep(1500);
  r = await S('POST', `/lessons/${lesson.id}/attendance/return`);
  ok('f. 戻る → present、away_total_sec が加算', r.status === 200 && r.data.status === 'present' && r.data.away_total_sec >= 1, JSON.stringify(r.data));

  // チャット（履歴 API）
  const chatP = waitFor(tSock, 'chat:message');
  sSock.emit('chat:message', { body: 'こんにちは' });
  const chat = await chatP;
  ok('chat:message が配信される', chat && chat.body === 'こんにちは' && chat.user.id === student.id, JSON.stringify(chat));
  r = await T('GET', `/lessons/${lesson.id}/chat?limit=10`);
  ok('GET chat 履歴', r.status === 200 && r.data.length === 1, JSON.stringify(r.data));

  // スポットライト
  const spotP = waitFor(sSock, 'spotlight:update');
  r = await T('PUT', `/lessons/${lesson.id}/spotlight`, { user_id: student.id });
  ok('spotlight PUT → {user_id}', r.status === 200 && r.data.user_id === student.id, JSON.stringify(r.data));
  const spot = await spotP;
  ok('spotlight:update が生徒に', spot && spot.user_id === student.id, JSON.stringify(spot));
  r = await S('POST', `/lessons/${lesson.id}/token`);
  ok('token（LiveKit 未設定なら url 空で 200）', r.status === 200, JSON.stringify(r.data).slice(0, 100));

  // g. 授業終了 → lesson:ended → 出席確定
  const endedP = waitFor(sSock, 'lesson:ended');
  r = await T('POST', `/lessons/${lesson.id}/end`);
  ok('g. 授業終了 status=ended', r.status === 200 && r.data.status === 'ended', JSON.stringify(r.data).slice(0, 100));
  ok('g. lesson:ended が届く', (await endedP) !== undefined);
  r = await T('GET', `/lessons/${lesson.id}/attendance`);
  const row = r.data.find((x) => x.user.id === student.id);
  ok('g. 終了後は present/absent の2値（生徒は present）', row && row.status === 'present', JSON.stringify(row));
  r = await T('POST', `/lessons/${lesson.id}/end`);
  ok('g. 終了済みを再終了は 409', r.status === 409, `status=${r.status}`);

  sSock.disconnect();
  tSock.disconnect();

  // 片付け
  const conn = await mysql.createConnection({ uri: config.databaseUrl });
  await conn.query('DELETE FROM classes WHERE id = ?', [cls.id]);
  await conn.query('DELETE FROM users WHERE id IN (?, ?)', [teacher.id, student.id]);
  await conn.end();

  const fails = results.filter((x) => !x.pass);
  console.log(`\n合計 ${results.length} 件、NG ${fails.length} 件`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error('シナリオ中断:', e);
  process.exit(2);
});
