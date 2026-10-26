(() => {
  'use strict';
  const Q = window.SquareRootsQuestions;
  const KEY = `nyushi-daimon2:v2:course:${Q.COURSE_ID}`;
  const HKEY = `nyushi-daimon2:v2:history:${Q.COURSE_ID}`;
  const CLEAR_SCORE = 8;
  const NEXT_GUARD_MS = 500;
  const app = document.querySelector('#app');
  let memory = {};
  let state = {};

  // 入力補助ボタン（プレースホルダ型。押したあとカーソルが枠の中に入る）
  const INSERT_BUTTONS = [
    { latex: '\\sqrt{#0}', label: '√', aria: '根号を入れる' },
    { latex: '\\frac{#0}{#?}', label: '分数', aria: '分数を入れる' }
  ];

  const store = {
    get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return memory[k] ?? f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { memory[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 使えない環境 */ } delete memory[k]; }
  };

  function typeset() {
    return window.MathJax?.typesetPromise?.([app]).catch(() => {}) || Promise.resolve();
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // 生徒の答えの表示。生の入力は MathJax に渡さず、部品が描き直した studentLatex だけを数式にする
  function answerView(a) {
    if (a.input === 'GIVE_UP') return '（ヒント3を使用）';
    if (a.studentLatex) return `\\(${esc(a.studentLatex.replace(/\\frac(?![A-Za-z])/g, '\\dfrac'))}\\)`;
    if (a.studentText) return esc(a.studentText);
    return `<span class="tex2jax_ignore">${esc(a.input)}</span>`;
  }

  function histories() { return store.get(HKEY, []); }
  function saveHistory(score) {
    const h = histories();
    h.unshift({ date: new Date().toLocaleString('ja-JP'), score, total: 10, clear: score >= CLEAR_SCORE });
    store.set(HKEY, h.slice(0, 20));
  }

  function home() {
    const h = histories();
    app.innerHTML = `<section class="home"><div class="start"><div class="start-in"><h1 class="title"><span class="emoji-icon">👹</span> 高校入試対策シリーズ<br>～大問2・数と平方根～</h1><button class="primary" id="start">▶ スタート！</button><a class="about" href="legal.html">このアプリについて</a></div></div><aside class="history-card"><h2>学習の履歴</h2><div class="history-list">${h.length ? h.map(x => `<div class="history-item"><strong>${x.score} / ${x.total}</strong>　${x.clear ? 'クリア' : '挑戦中'}<br><small>${esc(x.date)}</small></div>`).join('') : '<p class="notice">まだ記録はありません。</p>'}</div><hr><button class="ghost danger" id="reset">この端末の記録を消す</button></aside></section>`;
    document.querySelector('#start').onclick = () => begin('normal');
    document.querySelector('#reset').onclick = () => {
      if (confirm('このアプリの記録だけを消します。よろしいですか？')) { store.del(KEY); store.del(HKEY); home(); }
    };
  }

  function begin(mode, slots, excludedFingerprints = []) {
    const seed = Date.now() >>> 0;
    state = { mode, seed, qs: Q.makeSession(seed, slots, excludedFingerprints), i: 0, answers: [], hints: 0, locked: false };
    renderQuestion();
  }

  function insert(latex) {
    const mf = document.querySelector('#answer');
    if (!mf || state.locked) return;
    const opts = { selectionMode: 'placeholder', focus: true };
    try {
      if (typeof mf.insert === 'function') mf.insert(latex, opts);
      else mf.executeCommand(['insert', latex, opts]);
    } catch {
      try { mf.executeCommand(['insert', latex, opts]); } catch { /* 入れられなかった */ }
    }
    mf.focus?.();
  }

  /* IME で全角のまま「２√３」を一度に確定すると、MathLive が欄を \sqrt{２\surd３} に壊す。
   * 確定文字列に √ があり2文字以上のときだけ、既定の挿入を止めて半角の LaTeX（2\sqrt{3}）を入れ直す。
   * √ を含まない確定（２個・ｎ＝２など）には一切手を出さない。（exam-calculation と同じ処理） */
  const IME_SUPERSCRIPT = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  // 「２√３」→「2\sqrt{3}」。√ の直後の数（小数可）・文字1つ・(...) だけを根号の中にする。読めない文字があれば null
  function imeSqrtToLatex(text) {
    let s = String(text).replace(/[⁰¹²³⁴-⁹]+/g, mm => `^{${[...mm].map(c => IME_SUPERSCRIPT[c]).join('')}}`);
    // 空白を消してから × を置きかえる（\times の後ろの空白まで消すと、最後の照合に通らない）
    s = s.normalize('NFKC').replace(/[−‐‑‒–—―ー]/g, '-').replace(/\s+/g, '')
      .replace(/[×✕]/g, '\\times ').replace(/[・･·⋅]/g, '\\cdot '); // 中点（・ ･ · ⋅）はかけ算の記号
    s = s.replace(/√(\(([^()]*)\)|\d+(?:\.\d+)?|[A-Za-z])?/g, (_, all, inner) =>
      `\\sqrt{${all === undefined ? '#?' : (inner !== undefined ? inner : all)}}`);
    return /^(?:[0-9A-Za-z.+\-*/()=^{}#?]|\\sqrt|\\times |\\cdot )*$/.test(s) ? s : null;
  }
  // 欄ごとに1回だけ呼ぶ
  function installSqrtImeFix(field) {
    let replaying = false;
    field.addEventListener('compositionend', event => {
      if (replaying) return;
      const text = event.data;
      if (typeof text !== 'string' || text.length < 2 || !text.includes('√')) return;
      const latex = imeSqrtToLatex(text);
      if (latex === null) return;
      event.stopImmediatePropagation(); // MathLive の既定の挿入（\sqrt{２\surd３} になる）を止める
      event.preventDefault();
      // MathLive の「変換中」の状態は終わらせる（止めたままだと、その後のキー入力を受け付けなくなる）。
      // 中身の無い compositionend を同じ要素（keyboard-sink）へ送り直す。
      const sink = event.composedPath()[0];
      replaying = true;
      try {
        if (sink && sink.dispatchEvent) {
          if ('textContent' in sink) sink.textContent = '';
          sink.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '' }));
        }
      } catch { /* 続行 */ } finally { replaying = false; }
      // 「２√」のように根号の中が空のときは、カーソルを根号の枠の中に置く（続けて打った 3 が根号の中に入る）
      const options = { selectionMode: latex.includes('#?') ? 'placeholder' : 'after', focus: true };
      try { field.insert(latex, options); }
      catch { try { field.executeCommand(['insert', latex, options]); } catch { /* 続行 */ } }
    }, true);
  }

  // 入力欄の「決定」を、実キーの Enter（GraderCore.setupMathField の onEnter）と、仮想キーボードの ↵（MathLive の change）の
  // 両方で受ける。↵ は keydown を出さないため change で拾う。change は欄からフォーカスが外れたときにも出るので、
  // 欄にフォーカスがあるときだけ受ける。同じ操作で両方が来ても、400ms 以内の2回目は無視して二重採点を防ぐ。（linear と同じ）
  function bindMathFieldSubmit(mf, onSubmit) {
    if (!mf || mf.dataset.submitBound) return;
    mf.dataset.submitBound = '1';
    let last = 0;
    const fire = () => { const now = Date.now(); if (now - last < 400) return; last = now; onSubmit(); };
    GraderCore.setupMathField(mf, { onEnter: event => { if (!event.repeat) fire(); } });
    mf.addEventListener('change', () => {
      const focused = typeof mf.hasFocus === 'function' ? mf.hasFocus() : document.activeElement === mf;
      if (focused) fire();
    });
  }
  // 仮想キーボードが出ている間は、<html> に vk-open を付けて高さ固定をゆるめ（CSS 側）、
  // getTargets() が返す要素（入力欄・判定・決定ボタン）がキーボードの上に見えるようにスクロールする。閉じたら先頭へ戻す。（linear と同じ）
  function followVirtualKeyboard(getTargets) {
    const vk = window.mathVirtualKeyboard;
    if (!vk || followVirtualKeyboard.bound) return;
    followVirtualKeyboard.bound = true;
    followVirtualKeyboard.getTargets = getTargets;
    const update = () => {
      const h = Math.round(vk.boundingRect?.height || 0), open = vk.visible !== false && h > 0, root = document.documentElement;
      const was = root.classList.contains('vk-open');
      root.classList.toggle('vk-open', open);
      root.style.setProperty('--vk-height', `${open ? h : 0}px`);
      if (!open) { if (was) window.scrollTo(0, 0); return; }
      measure(h);
      // 開いた直後は配置が落ち着く前のことがあるので、少し待って測り直す
      if (!was) setTimeout(() => { if (document.documentElement.classList.contains('vk-open')) measure(Math.round(vk.boundingRect?.height || 0)); }, 300);
    };
    const measure = h => {
      requestAnimationFrame(() => {
        // 隠れている要素（大きさが 0 で位置が 0,0 のもの）は位置合わせの対象から外す
        const rects = (followVirtualKeyboard.getTargets() || []).filter(Boolean).map(e => e.getBoundingClientRect())
          .filter(r => r.width > 0 || r.height > 0 || r.top !== 0 || r.left !== 0);
        if (!rects.length) return;
        const top = Math.min(...rects.map(r => r.top)), bottom = Math.max(...rects.map(r => r.bottom));
        const visibleBottom = window.innerHeight - h - 8;
        let dy = 0;
        if (bottom > visibleBottom) dy = bottom - visibleBottom;
        if (top - dy < 8) dy = top - 8;
        if (dy) window.scrollBy(0, dy);
      });
    };
    vk.addEventListener('geometrychange', update);
    vk.addEventListener('virtual-keyboard-toggle', update); // 開いたときに geometrychange が来ないことがある
    window.addEventListener('resize', update);
    followVirtualKeyboard.update = update;
  }

  function renderQuestion() {
    const q = state.qs[state.i], total = state.qs.length;
    const isChoice = q.grading && q.grading.mode === 'choice';
    // 記号問題は √・分数の代わりに、選択肢の数だけ「ア」「イ」…のボタンを出す（タッチだけの端末でもカタカナを入れられるように）
    const buttons = isChoice
      ? (q.grading.labels || []).map(l => `<button class="ghost choice-key" type="button" data-choice="${l}" aria-label="${l} を入れる">${l}</button>`).join('')
      : INSERT_BUTTONS.map((b, i) => `<button class="ghost" type="button" data-insert="${i}" aria-label="${b.aria}">${b.label}</button>`).join('');
    const help = isChoice ? '※ 下のア〜' + ((q.grading.labels || []).slice(-1)[0] || 'オ') + 'のボタンか、カタカナで答えよう。' : '※ 半角英数字で入力してね。分数・根号は入力補助を使えます。';
    app.innerHTML = `<section class="screen"><header class="top"><button class="ghost" id="quit">ホームへ</button><b>Q ${state.i + 1} / ${total}</b><span></span></header><div class="progress"><i style="width:${state.i / total * 100}%"></i></div><article class="problem"><div class="prompt">${q.prompt}</div><div class="input-wrap"><math-field id="answer" inputmode="latin" aria-label="解答を入力"></math-field></div><div class="input-msg" id="inputmsg" role="status" aria-live="polite"></div><div class="help">${help}</div><div class="actions">${buttons}</div><div id="hintbox"></div><div class="actions"><button class="ghost" id="hint">ヒント</button><button class="primary" id="submit">決定</button></div></article></section>`;
    document.querySelectorAll('[data-insert]').forEach(b => {
      // ボタンを押しても欄のカーソル位置を失わないように、mousedown で欄からフォーカスを奪わない
      b.addEventListener('mousedown', e => e.preventDefault());
      b.onclick = () => insert(INSERT_BUTTONS[Number(b.dataset.insert)].latex);
    });
    document.querySelectorAll('[data-choice]').forEach(b => {
      // 押すと欄をその記号にする（決定前なら何度でも変えられる）。フォーカスは移さない（タッチで仮想キーボードを開かない）
      b.onclick = () => {
        if (state.locked) return;
        const field = document.querySelector('#answer');
        if (field) field.value = b.dataset.choice;
        showInputMessage('');
        document.querySelectorAll('[data-choice]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      };
    });
    const mf = document.querySelector('#answer');
    // 欄ごとに1回だけ。Enter（IME の確定・押しっぱなしは除く）で決定する
    // 欄ごとに1回だけ。採点のあとの Enter・↵ は「次へ」
    bindMathFieldSubmit(mf, () => { if (state.locked) document.querySelector('#next')?.click(); else submit(); });
    followVirtualKeyboard(() => [document.querySelector('.input-wrap'), document.querySelector('#inputmsg'), document.querySelector('#submit'), document.querySelector('.feedback'), document.querySelector('#next')]);
    // 空白キーで「\\:」を入れる。「1 2」が 12 に化けず、部品が「数字の間に空白」として採点しない
    try { mf.mathModeSpace = '\\:'; } catch { /* 古い版では設定できない */ }
    installSqrtImeFix(mf);
    // 仮想キーボードの ↵ は、決定（change）のあとに input（insertLineBreak）を出す。そのときは一言を消さない
    mf.addEventListener('input', e => { if (e && e.inputType === 'insertLineBreak') return; showInputMessage(''); });
    document.querySelector('#quit').onclick = () => home();
    document.querySelector('#hint').onclick = showHint;
    document.querySelector('#submit').onclick = submit;
    typeset();
    // キーボードを開いたまま「次へ」で進んでも問題文が上に隠れないように、先頭へ戻してから位置を合わせる
    window.scrollTo(0, 0);
    followVirtualKeyboard.update?.();
  }

  function showInputMessage(text) {
    const box = document.querySelector('#inputmsg');
    if (box) box.textContent = text;
  }

  function showHint() {
    const q = state.qs[state.i];
    if (state.locked) return;
    if (state.hints < 2) {
      state.hints++;
      document.querySelector('#hintbox').insertAdjacentHTML('beforeend', `<div class="hint">${q.hints[state.hints - 1]}</div>`);
      typeset();
      return;
    }
    if (confirm('⚠️ 次のヒントは答えだよ！')) {
      state.hints = 3;
      lock({ status: 'wrong', kind: 'wrong', reason: 'giveUp', message: '' }, 'GIVE_UP');
      document.querySelector('#hintbox').insertAdjacentHTML('beforeend', `<div class="hint">${q.hints[2]}</div>`);
      typeset();
    }
  }

  function submit() {
    if (state.locked) return;
    const q = state.qs[state.i];
    const mf = document.querySelector('#answer');
    const raw = mf ? String(mf.value || '') : '';
    let r;
    try { r = Q.gradeAnswer(q, [raw]); }
    catch { r = { status: 'unreadable', kind: 'incomplete', reason: 'error', message: '読み取れませんでした。式を確かめて、もう一度決定しよう。' }; }
    // 空欄・書きかけは採点しない・消費しない・記録しない
    if (!NyushiCore.consumes(r)) {
      showInputMessage(r.message || '答えを入力してから決定しよう。');
      followVirtualKeyboard.update?.();
      mf?.focus?.();
      return;
    }
    lock(r, raw);
  }

  // 結果ごとの見出しと色（class）
  function verdictOf(r) {
    // 見出しは8本共通の形（途中・書き方も「不正解」。色で区別する）
    if (r.status === 'correct') return { cls: 'good', title: '○ 正解' };
    if (r.status === 'negDenominator') return { cls: 'neg', title: '△ 書き直そう', note: '値は合っているけど、分母にマイナスがあるので正解には数えないよ。マイナスは分子か分数の前に書こう。' };
    if (r.status === 'notReduced' && r.kind === 'notation') return { cls: 'notation', title: '× 不正解（書き方）' };
    if (r.status === 'notReduced') return { cls: 'unfinished', title: '× 不正解（あと一歩）' };
    return { cls: 'bad', title: '× 不正解' };
  }

  function lock(r, input) {
    if (state.locked) return;
    state.locked = true;
    state.lockedAt = Date.now();
    const q = state.qs[state.i];
    const ok = NyushiCore.isCorrect(r);
    const entry = { q, ok, status: r.status, kind: r.kind, input, studentLatex: r.studentLatex || '', studentText: r.studentText || '' };
    state.answers.push(entry);
    showInputMessage('');
    document.querySelector('#answer').setAttribute('readonly', '');
    document.querySelector('#hint').disabled = true;
    document.querySelector('#submit').disabled = true;
    document.querySelectorAll('[data-insert], [data-choice]').forEach(b => { b.disabled = true; });
    const v = verdictOf(r);
    // 部品の一言（「あと一歩：〇〇」「書き方：〇〇」）はそのまま添える。△は正解に数えない旨の一言を出す
    const note = v.note || String(r.message || '');
    const msg = note ? `<br><span class="feedback-msg">${esc(note)}</span>` : '';
    const detail = ok ? '' : `${msg}<br>あなたの答え：${answerView(entry)}<br>正しい答え：${q.answer}<br>${q.solution}`;
    document.querySelector('.problem').insertAdjacentHTML('beforeend', `<div class="feedback ${v.cls === 'good' || v.cls === 'bad' ? v.cls : 'bad ' + v.cls}"><b>${v.title}</b>${detail}</div><button class="primary" id="next">${state.i + 1 === state.qs.length ? '結果を見る' : '次へ'}</button>`);
    document.querySelector('#next').onclick = () => {
      // 採点から約500msの間は「次へ」を受け付けない（採点の Enter・↵・タップが続けて「次へ」になるのを防ぐ）
      if (Date.now() - (state.lockedAt || 0) < NEXT_GUARD_MS) return;
      state.i++;
      state.locked = false;
      state.hints = 0;
      state.i === state.qs.length ? result() : renderQuestion();
    };
    typeset();
    followVirtualKeyboard.update?.();
    revealFeedbackOnNarrow();
  }

  // 狭い画面（1列のレイアウト）では判定と「次へ」が下に隠れるので、見える位置までスクロールする。
  // ↵ で仮想キーボードが閉じると先頭へ戻る処理が走るので、それが終わってから合わせる。
  function revealFeedbackOnNarrow() {
    if (!window.matchMedia?.('(max-width:900px)').matches) return; // CSS の1列の境目（reference-theme.css）とそろえる
    setTimeout(() => {
      const fb = document.querySelector('.feedback'), next = document.querySelector('#next');
      if (!fb || !next || document.documentElement.classList.contains('vk-open')) return;
      const bottom = next.getBoundingClientRect().bottom, top = fb.getBoundingClientRect().top;
      // 画面下の手書きツールバーの高さ分をあける
      const bar = document.querySelector('#handwriting-fixed-mount')?.getBoundingClientRect();
      const limit = window.innerHeight - (bar && bar.height ? bar.height + 16 : 8);
      if (bottom > limit) window.scrollBy(0, Math.min(bottom - limit, top - 8));
    }, 350);
  }

  function markOf(a) {
    if (a.status === 'correct') return '○';
    if (a.status === 'negDenominator') return '△（書き直そう）';
    if (a.status === 'notReduced') return a.kind === 'notation' ? '×（書き方）' : '×（あと一歩）';
    return '×';
  }

  function result() {
    const score = state.answers.filter(a => a.ok).length;
    if (state.mode === 'normal') saveHistory(score);
    app.innerHTML = `<section class="screen"><div class="top"><button class="ghost" id="home">ホームへ</button><b>${state.mode === 'review' ? '復習結果' : '結果'}</b><span></span></div><div class="score">${score} / ${state.qs.length}</div><div class="result-list">${state.answers.map((a, i) => `<div class="review"><b>Q${i + 1} ${markOf(a)}</b><br>あなたの答え：${answerView(a)}<br>正答：${a.q.answer}</div>`).join('')}</div><div class="actions">${state.answers.some(a => !a.ok) ? '<button class="primary" id="review">まちがいだけ復習</button>' : ''}<button class="ghost" id="again">もう一度</button><button class="ghost" id="home2">ホームへ</button></div></section>`;
    document.querySelector('#home').onclick = home;
    document.querySelector('#home2').onclick = home;
    document.querySelector('#again').onclick = () => begin('normal');
    const r = document.querySelector('#review');
    if (r) {
      r.onclick = () => begin(
        'review',
        state.answers.filter(a => !a.ok).map(a => a.q.slot), // 同じ formId の型が複数あるので、出題した型の番号で戻す
        state.answers.filter(a => !a.ok).map(a => a.q.fingerprint)
      );
    }
    typeset();
  }

  home();
})();
