/* ==========================================================================
   08_result.js — 授業結果（デモ用ロジック）
   実装時は GET /api/lessons/:id ／ /attendance ／ /understanding（totals）／ /questions ／ /files の結果から各値を入れる。
   ========================================================================== */
(function () {
  'use strict';
  const esc = Demo.esc, personHtml = Demo.personHtml;

  // ---- モックデータ ----
  const REACTIONS = [
    { key: 'got',   label: 'わかった',   count: 58 },
    { key: 'lost',  label: 'わからない', count: 14 },
    { key: 'again', label: 'もう一度',   count: 21 }
  ];

  const QUESTIONS = [
    { name: '山田 そら',   anon: true,  time: '11:12', body: '頂点の座標を出すとき、平方完成のやり方がまだよく分かりません。もう一度説明してほしいです。', answered: false },
    { name: '高橋 れん',   anon: false, time: '11:20', body: 'y = a(x − p)² + q の p と q が、なぜ符号が逆になるのですか？', answered: false },
    { name: '伊藤 ゆい',   anon: true,  time: '11:28', body: '宿題のプリントは 3 番までですか？', answered: false },
    { name: '佐藤 みお',   anon: false, time: '10:58', body: 'グラフを右に 3 動かすと x − 3 になるのはなぜですか？', answered: true, answer: '「x = 3 のとき元の x = 0 と同じ値になる」と考えると分かりやすいです。' },
    { name: '田中 ひなた', anon: false, time: '11:03', body: 'a が負の数のときは上下どちらに開きますか？', answered: true, answer: '下に開きます（上に凸）。' },
    { name: '加藤 めい',   anon: true,  time: '11:05', body: '教科書 p.64 の例題 2 も同じ考え方でいいですか？', answered: true, answer: 'はい、同じ平行移動で解けます。' },
    { name: '森 いちか',   anon: false, time: '11:15', body: 'ノートに書いた図が板書と少し違うのですが大丈夫ですか？', answered: true, answer: '頂点と軸が合っていれば大丈夫です。' },
    { name: '中村 あおい', anon: false, time: '11:24', body: '最大・最小は次回やりますか？', answered: true, answer: '次回「二次関数の最大・最小」で扱います。' }
  ];

  const MATERIALS = [
    { kind: 'PDF', name: '二次関数のグラフ_プリント.pdf', pages: 4 },
    { kind: '画像', name: '板書_平行移動.png', pages: 1 },
    { kind: 'PDF', name: '演習問題_平行移動.pdf', pages: 2 }
  ];

  // ---- 描画 ----
  function renderReactions(list) {
    const wrap = document.getElementById('reactions');
    const empty = document.getElementById('reactionsEmpty');
    const total = list.reduce(function (a, r) { return a + r.count; }, 0);
    if (total === 0) { wrap.innerHTML = ''; wrap.hidden = true; empty.hidden = false; return; }
    wrap.hidden = false; empty.hidden = true;
    const max = Math.max.apply(null, list.map(function (r) { return r.count; }));
    wrap.innerHTML = list.map(function (r) {
      const w = Math.round(r.count / max * 100);
      return '<div class="bar-row bar-' + r.key + '">' +
        '<span>' + esc(r.label) + '</span>' +
        '<div class="bar-track" role="img" aria-label="' + esc(r.label) + ' ' + r.count + '回"><div class="bar-fill" style="width:' + w + '%"></div></div>' +
        '<span class="bar-num">' + r.count + '</span>' +
      '</div>';
    }).join('');
  }

  function renderQuestions(list) {
    const ol = document.getElementById('questions');
    const empty = document.getElementById('questionsEmpty');
    const count = document.getElementById('qCount');
    if (list.length === 0) { ol.innerHTML = ''; ol.hidden = true; empty.hidden = false; count.hidden = true; return; }
    ol.hidden = false; empty.hidden = true; count.hidden = false;

    // 未回答を先に、それぞれ時刻順
    const sorted = list.slice().sort(function (a, b) {
      if (a.answered !== b.answered) return a.answered ? 1 : -1;
      return a.time.localeCompare(b.time);
    });

    ol.innerHTML = sorted.map(function (q) {
      // 匿名投稿：生徒側には「？」だが、先生には投稿者名が見える
      const who = q.anon
        ? personHtml({ name: '匿名', role: 'anon' }, { noBadge: true }) + '<span class="q-anon">（' + esc(q.name) + '）</span>'
        : personHtml({ name: q.name, role: 'student' });
      const state = q.answered
        ? '<span class="tag tag-accent">回答済み</span>'
        : '<span class="q-unread"><span class="dot dot-accent-2"></span>未回答</span>';
      const tail = q.answered
        ? '<div class="q-answer">' + esc(q.answer) + '</div>'
        : '<div class="q-actions"><button type="button" class="btn btn-secondary js-answer">回答する</button></div>';
      return '<li class="q-item' + (q.answered ? '' : ' is-unanswered') + '">' +
        '<div class="q-meta">' + who + state + '<span class="q-time">' + esc(q.time) + '</span></div>' +
        '<div class="q-body">' + esc(q.body) + '</div>' + tail +
      '</li>';
    }).join('');
  }

  function renderMaterials(list) {
    document.getElementById('materials').innerHTML = list.map(function (m) {
      const kindClass = m.kind === 'PDF' ? 'mat-kind-pdf' : 'mat-kind-img';
      return '<li><a class="mat-item" href="#" onclick="return false">' +
        '<span class="mat-kind ' + kindClass + '">' + esc(m.kind) + '</span>' +
        '<span class="mat-name">' + esc(m.name) + '</span>' +
        '<span class="mat-pages">' + m.pages + 'p</span>' +
      '</a></li>';
    }).join('');
  }

  function renderSummary(d) {
    document.getElementById('stAttend').textContent = Math.round(d.present / d.total * 100);
    document.getElementById('stAttendSub').textContent = d.present + ' / ' + d.total + ' 人';
    document.getElementById('stAck').textContent = d.present ? Math.round(d.acked / d.present * 100) : 0;
    document.getElementById('stAckSub').textContent = d.acked + ' / ' + d.present + ' 人';
    document.getElementById('stQ').textContent = d.questions;
    const qs = document.getElementById('stQSub');
    qs.textContent = d.unanswered > 0 ? '未回答 ' + d.unanswered : '未回答なし';
    qs.classList.toggle('unanswered', d.unanswered > 0);
    document.getElementById('stLost').textContent = d.lost;
    document.getElementById('attPresent').textContent = d.present;
    document.getElementById('attLeft').textContent = d.left;   // away_total_sec > 0 の出席者
    document.getElementById('attAbsent').textContent = d.absent;
  }

  // 「回答する」（デモ：トーストのみ）
  document.getElementById('questions').addEventListener('click', function (e) {
    if (e.target.closest('.js-answer')) Demo.toast('回答フォームは今後追加します');
  });

  // ---- 状態切替 ----
  function applyMode(key) {
    if (key === 'empty') {
      renderSummary({ total: 30, present: 27, left: 5, absent: 3, acked: 24, questions: 0, unanswered: 0, lost: 0 });
      renderReactions(REACTIONS.map(function (r) { return { key: r.key, label: r.label, count: 0 }; }));
      renderQuestions([]);
    } else {
      const unanswered = QUESTIONS.filter(function (q) { return !q.answered; }).length;
      renderSummary({ total: 30, present: 27, left: 5, absent: 3, acked: 24, questions: QUESTIONS.length, unanswered: unanswered, lost: 14 });
      renderReactions(REACTIONS);
      renderQuestions(QUESTIONS);
    }
    renderMaterials(MATERIALS);
  }

  Demo.stateBar({
    states: [
      { key: 'normal', label: '通常' },
      { key: 'empty', label: 'データなし' }
    ],
    initial: 'normal',
    onChange: applyMode
  });
})();
