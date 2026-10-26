// ===== NYUSHI-CORE BEGIN v1.0 =====
// 高校入試対策ドリル共通の採点部品（数・根号・多項式・解の集合・因数分解の形）。
// 各アプリで同じ内容を使う。アプリの中で直接直さない。
// 値は BigInt の有理数で厳密に比べる（浮動小数・許容誤差は使わない）。eval / Function は使わない。
//
// 判定結果 { status, kind, reason, flags, message, ... }
//   status（GraderCore と同じ名前）:
//     correct ○ / notReduced ×（値は合うが途中・書き方の決まり違反）/ negDenominator △（0点。分母にだけマイナス）/
//     wrong ×（値が違う）/ unreadable（読めない・書きかけ。採点しない）/ empty（未入力。採点しない）
//   kind（画面の出し分け用）:
//     correct / unfinished（途中：約分・根号・有理化・同類項・展開・共通因数）/ notation（書き方の決まり）/
//     negDenominator / wrong / incomplete（empty と unreadable。採点せず書き直しを促す）
var NyushiCore = (function () {
  'use strict';

  var VERSION = 'v1.0';

  /* ============================================================
   * 0. 上限とエラー
   * ========================================================== */
  var LIMIT_INT = 10n ** 18n;
  var MAX_TERMS = 64;
  var MAX_RADICAND = 100000;
  var MAX_INPUT_CHARS = 200;
  var MAX_TOKENS = 200;
  var MAX_DEPTH = 12;
  var MAX_EXPONENT = 6;
  var MAX_PIECES = 6;

  function AnswerError(code, message) { this.code = code; this.message = message; }
  function tooLarge() { return new AnswerError('TOO_LARGE', '数が大きすぎます。式をもう一度確かめよう。'); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* ============================================================
   * 1. BigInt 有理数
   * ========================================================== */
  function babs(a) { return a < 0n ? -a : a; }
  function bgcd(a, b) { a = babs(a); b = babs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function rat(n, d) {
    n = BigInt(n); d = d === undefined ? 1n : BigInt(d);
    if (d === 0n) throw new AnswerError('DIV_ZERO', '0でわることはできません。');
    if (d < 0n) { n = -n; d = -d; }
    if (n === 0n) return { n: 0n, d: 1n };
    var g = bgcd(n, d) || 1n;
    n /= g; d /= g;
    if (babs(n) > LIMIT_INT || d > LIMIT_INT) throw tooLarge();
    return { n: n, d: d };
  }
  function ratAdd(a, b) { return rat(a.n * b.d + b.n * a.d, a.d * b.d); }
  function ratMul(a, b) { return rat(a.n * b.n, a.d * b.d); }
  function ratNeg(a) { return { n: -a.n, d: a.d }; }
  function ratIsZero(a) { return a.n === 0n; }
  var ZERO = { n: 0n, d: 1n };

  /* ============================================================
   * 2. 値のモデル（根号つき多項式）
   *   Value = { key: Rational }、key = "根号の中（平方因数を外した数。1は根号なし）|文字:指数,…"
   * ========================================================== */
  function extractSquare(n) {
    var rest = Math.trunc(n), square = 1;
    if (!Number.isFinite(rest) || rest < 1) throw new AnswerError('BAD_RADICAND', '根号の中は正の数にしてね。');
    for (var i = 2; i * i <= rest; i++) while (rest % (i * i) === 0) { rest /= i * i; square *= i; }
    return { square: square, rest: rest };
  }
  function parseVars(s) {
    var out = {};
    if (!s) return out;
    s.split(',').forEach(function (part) { var p = part.split(':'); out[p[0]] = Number(p[1]); });
    return out;
  }
  function varsKey(map) {
    return Object.keys(map).filter(function (k) { return map[k] !== 0; }).sort()
      .map(function (k) { return k + ':' + map[k]; }).join(',');
  }
  function addVars(a, b, sign) {
    var out = {}, k;
    for (k in a) if (has(a, k)) out[k] = a[k];
    for (k in b) if (has(b, k)) out[k] = (out[k] || 0) + (sign || 1) * b[k];
    return out;
  }
  function splitKey(key) {
    var i = key.indexOf('|');
    return { radicand: Number(key.slice(0, i)), vars: parseVars(key.slice(i + 1)) };
  }
  function makeKey(radicand, vars) { return radicand + '|' + varsKey(vars); }
  function guardTerms(v) { if (Object.keys(v).length > MAX_TERMS) throw tooLarge(); return v; }

  function vTerm(n, d, radicand, vars) {
    var coef0 = rat(n, d);
    if (ratIsZero(coef0)) return {};
    var r = Math.trunc(radicand || 1);
    if (r < 1 || r > MAX_RADICAND) throw tooLarge();
    var sq = extractSquare(r), out = {};
    out[makeKey(sq.rest, vars || {})] = ratMul(coef0, rat(BigInt(sq.square)));
    return out;
  }
  function vInt(n) { return vTerm(BigInt(n), 1n); }
  function vAdd(a, b) {
    var out = {}, k;
    for (k in a) if (has(a, k)) out[k] = a[k];
    for (k in b) if (has(b, k)) {
      var sum = ratAdd(out[k] || ZERO, b[k]);
      if (ratIsZero(sum)) delete out[k]; else out[k] = sum;
    }
    return guardTerms(out);
  }
  function vNeg(a) { var out = {}; for (var k in a) if (has(a, k)) out[k] = ratNeg(a[k]); return out; }
  function vSub(a, b) { return vAdd(a, vNeg(b)); }
  function vMul(a, b) {
    var out = {};
    for (var ka in a) if (has(a, ka)) {
      var ta = splitKey(ka);
      for (var kb in b) if (has(b, kb)) {
        var tb = splitKey(kb), product = ta.radicand * tb.radicand;
        if (product > MAX_RADICAND * MAX_RADICAND) throw tooLarge();
        var sq = extractSquare(product);
        if (sq.rest > MAX_RADICAND) throw tooLarge();
        var coef = ratMul(ratMul(a[ka], b[kb]), rat(BigInt(sq.square)));
        var key = makeKey(sq.rest, addVars(ta.vars, tb.vars, 1));
        var sum = ratAdd(out[key] || ZERO, coef);
        if (ratIsZero(sum)) delete out[key]; else out[key] = sum;
      }
    }
    return guardTerms(out);
  }
  function vInverse(a) {
    var keys = Object.keys(a);
    if (keys.length === 0) throw new AnswerError('DIV_ZERO', '0でわることはできません。');
    if (keys.length > 1) throw new AnswerError('UNSUPPORTED_DIVISION', '2つ以上の項でわる形は、この問題では使いません。');
    var t = splitKey(keys[0]);
    var denom = ratMul(a[keys[0]], rat(BigInt(t.radicand)));
    var out = {};
    out[makeKey(t.radicand, addVars({}, t.vars, -1))] = rat(denom.d, denom.n);
    return out;
  }
  function vDiv(a, b) { return vMul(a, vInverse(b)); }
  function vPow(a, e) {
    if (!Number.isInteger(e) || e < 0) throw new AnswerError('BAD_EXPONENT', '指数は0以上の整数にしてね。');
    if (e > MAX_EXPONENT) throw new AnswerError('BAD_EXPONENT', '指数が大きすぎます。');
    var out = vInt(1);
    for (var i = 0; i < e; i++) out = vMul(out, a);
    return out;
  }
  function vSqrt(a) {
    var keys = Object.keys(a);
    if (keys.length === 0) return {};
    if (keys.length > 1) throw new AnswerError('UNSUPPORTED_RADICAND', '根号の中は1つの数にしてね。');
    var t = splitKey(keys[0]);
    if (t.radicand !== 1 || varsKey(t.vars) !== '') throw new AnswerError('UNSUPPORTED_RADICAND', '二重根号や文字の入った根号は、この問題では使いません。');
    var c = a[keys[0]];
    if (c.n < 0n) throw new AnswerError('NEGATIVE_RADICAND', '根号の中は0以上にしてね。');
    var nd = c.n * c.d;
    if (nd > BigInt(MAX_RADICAND)) throw tooLarge();
    return vTerm(1n, c.d, Number(nd));
  }
  function valueKey(v) {
    return Object.keys(v).sort().map(function (k) { return k + '=' + v[k].n + '/' + v[k].d; }).join(';') || '0';
  }
  function valueEquals(a, b) { return valueKey(a) === valueKey(b); }
  function asRational(v) {
    var keys = Object.keys(v);
    if (keys.length === 0) return { n: 0n, d: 1n };
    if (keys.length > 1) return null;
    var t = splitKey(keys[0]);
    if (t.radicand !== 1 || varsKey(t.vars) !== '') return null;
    return v[keys[0]];
  }
  function hasVars(v) { return Object.keys(v).some(function (k) { return varsKey(splitKey(k).vars) !== ''; }); }

  /* ---------- 正答の LaTeX（表示用。判定には使わない） ---------- */
  function varsLatex(vars) {
    return Object.keys(vars).filter(function (k) { return vars[k] !== 0; }).sort()
      .map(function (k) { return vars[k] === 1 ? k : k + '^{' + vars[k] + '}'; }).join('');
  }
  function termBodyLatex(key, coef) {
    var t = splitKey(key), v = varsLatex(t.vars);
    var radical = t.radicand > 1 ? '\\sqrt{' + t.radicand + '}' : '';
    var absN = babs(coef.n);
    if (coef.d === 1n) return ((absN === 1n && (radical || v)) ? '' : String(absN)) + radical + v;
    return '\\frac{' + ((absN === 1n && radical) ? '' : String(absN)) + radical + '}{' + coef.d + '}' + v;
  }
  function termSortInfo(key) {
    var t = splitKey(key), degree = 0;
    for (var k in t.vars) if (has(t.vars, k)) degree += t.vars[k];
    return { degree: degree, radicand: t.radicand, varsText: varsKey(t.vars) };
  }
  function sortedKeys(v) {
    return Object.keys(v).sort(function (a, b) {
      var ia = termSortInfo(a), ib = termSortInfo(b);
      if (ia.degree !== ib.degree) return ib.degree - ia.degree;
      if (ia.varsText !== ib.varsText) return ia.varsText < ib.varsText ? -1 : 1;
      return ia.radicand - ib.radicand;
    });
  }
  function canonicalLatex(v) {
    var keys = sortedKeys(v);
    if (!keys.length) return '0';
    var anyVars = keys.some(function (k) { return termSortInfo(k).degree !== 0; });
    var anyRad = keys.some(function (k) { return termSortInfo(k).radicand > 1; });
    if (!anyVars && anyRad && keys.length > 1) {
      var ci = keys.findIndex(function (k) { return termSortInfo(k).radicand === 1; });
      if (ci > 0 && v[keys[ci]].n > 0n) keys.unshift(keys.splice(ci, 1)[0]);
    }
    return keys.map(function (k, i) {
      var c = v[k], body = termBodyLatex(k, c);
      return c.n < 0n ? '-' + body : (i === 0 ? body : '+' + body);
    }).join('');
  }

  /* ============================================================
   * 3. 前処理（全角・IME・MathLive のゆれをそろえる。値は書き換えない）
   * ========================================================== */
  var SUPERSCRIPT = { '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3', '\u2074': '4',
    '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9' };
  var RE_SUPERSCRIPT = /[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+/g;
  var RE_INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;
  var RE_PLACEHOLDER = /\\placeholder(?![A-Za-z])\s*(?:\[[^\]]*\])?\s*(?:\{[^{}]*\})?/g;
  var RE_SIZING = /\\(?:left|right|mleft|mright|middle|bigl|bigr|Bigl|Bigr|big|Big|displaystyle|textstyle)(?![A-Za-z])/g;
  var RE_SPACE_CMD = /\\(?:qquad|quad)(?![A-Za-z])|\\[,;:! ]|~/g;

  function toStr(raw) { return raw == null ? '' : String(raw); }

  // 何も書いていない（空欄・空の枠だけ・かっこと区切りだけ）なら true
  function isBlank(raw) {
    var s = toStr(raw).replace(RE_INVISIBLE, '').replace(RE_PLACEHOLDER, '')
      .replace(/\\(?:left|right|mleft|mright|frac|dfrac|tfrac|sqrt)(?![A-Za-z])/g, '')
      .replace(/\\[,;:! ]|\\q?quad(?![A-Za-z])/g, '')
      .replace(/[\s\u3000(){}\[\]\uFF08\uFF09,\uFF0C\u3001]/g, '');
    return s === '';
  }

  function stripUnits(s, units) {
    if (!units || !units.length) return s;
    for (var i = 0; i < units.length; i++) {
      var u = String(units[i]).normalize('NFKC').replace(/\s+/g, '');
      var cands = ['\\text{' + u + '}', '\\mathrm{' + u + '}', '\\operatorname{' + u + '}', '\\textrm{' + u + '}', u];
      for (var j = 0; j < cands.length; j++) {
        if (s.length > cands[j].length && s.slice(-cands[j].length) === cands[j]) return s.slice(0, -cands[j].length);
      }
    }
    return s;
  }

  // 1つの答案を、採点用の1本の文字列にする。読めなければ AnswerError
  function preprocess(raw, opts) {
    var s = toStr(raw).replace(RE_INVISIBLE, '');
    // IME の上付き数字（x の右上の小さい 2）は、NFKC で「x2」に潰れる前に指数へ読み替える
    s = s.replace(RE_SUPERSCRIPT, function (m) {
      return '^{' + m.split('').map(function (c) { return SUPERSCRIPT[c]; }).join('') + '}';
    });
    s = s.normalize('NFKC');
    if (/\\placeholder(?![A-Za-z])/.test(s)) throw new AnswerError('INCOMPLETE', 'まだ入力していないところがあるよ。');
    if (/\\sqrt\s*\[/.test(s)) throw new AnswerError('UNSUPPORTED', '3乗根は、この問題では使いません。');
    s = s.replace(/[\u2212\u2010-\u2015\u30FC\uFF70\uFE63]/g, '-')        // 負号のゆれ（長音・各種ダッシュ）
      .replace(/[\u00D7\u2715\u2716\u00B7\u22C5\u30FB\u2219]/g, '*')     // 掛け算の記号
      .replace(/[\u3001]/g, ',')                                           // 読点
      .replace(/\\pm(?![A-Za-z])/g, '\u00B1').replace(/\\surd(?![A-Za-z])/g, '\u221A');
    if (/\\mp(?![A-Za-z])|\u2213/.test(s)) throw new AnswerError('MP', '∓ は使わないよ。± を使って書こう。');
    s = s.replace(RE_SIZING, '').replace(RE_SPACE_CMD, ' ');
    // 波かっこの記号（\{ \}・\lbrace \rbrace）は、かっこの一種として読む
    s = s.replace(/\\\{|\\lbrace(?![A-Za-z])/g, '(').replace(/\\\}|\\rbrace(?![A-Za-z])/g, ')');
    // 空白を消す前に、コマンドの後ろの空白を片づける（\cdot x が \cdotx にならないように）
    s = s.replace(/\\(?:dfrac|tfrac|cfrac)(?![A-Za-z])/g, '\\frac')
      .replace(/\\(?:cdot|times|ast)(?![A-Za-z])/g, '*').replace(/\\div(?![A-Za-z])/g, '\u00F7')
      .replace(/\\(frac|sqrt)\s+([A-Za-z])/g, '\\$1{$2}');
    // 数字と数字が空白で区切られている（1 2）のは並び書き。12 と読まない
    if (/[0-9.]\s+[0-9.]/.test(s)) throw new AnswerError('SPACED_DIGITS', '数字の間に空白があります。1つの数として書き直そう。');
    s = s.replace(/\s+/g, '');
    s = stripUnits(s, opts && opts.units);
    s = s.replace(/\\(?:mathrm|mathit|text|textrm|operatorname)\{([A-Za-z])\}/g, '$1');
    s = s.replace(/\\lparen(?![A-Za-z])/g, '(').replace(/\\rparen(?![A-Za-z])/g, ')');
    // 大文字の文字は小文字として読む（\ コマンドの中は変えない）
    s = s.replace(/\\[A-Za-z]+|[A-Z]/g, function (m) { return m.length === 1 ? m.toLowerCase() : m; });
    if (/\{\}/.test(s)) throw new AnswerError('INCOMPLETE', 'まだ入力していないところがあるよ。');
    if (s.length > MAX_INPUT_CHARS) throw new AnswerError('TOO_LONG', '式が長すぎます。答えの形まで整理してから入力しよう。');
    return s;
  }

  /* ============================================================
   * 4. トークナイザと再帰下降パーサ
   *   expr  := term (('+'|'-') term)*
   *   term  := unary ( ('*'|'/'|'÷')? unary )*    暗黙の乗算を含む
   *   unary := ('+'|'-') unary | power            単項マイナスは累乗より弱い（-3^2 = -9）
   *   power := atom ('^' 指数)?
   *   atom  := 数 | 小数 | 文字 | '(' expr ')' | '{' expr '}' | \frac 群 群 | \sqrt 群 | √ 数
   *   \frac23・\sqrt7 の省略形は、LaTeX と同じく数字1桁ずつ読む。√23（記号）は √(23) と読む。
   * ========================================================== */
  var ATOM_START = { NUM: 1, DEC: 1, VAR: 1, '(': 1, '{': 1, FRAC: 1, SQRT: 1, ROOT: 1 };

  function tokenize(s, allowPm) {
    var tokens = [], i = 0, m;
    while (i < s.length) {
      var rest = s.slice(i), ch = rest.charAt(0);
      if (ch === '\\') {
        m = /^\\[a-zA-Z]+/.exec(rest);
        if (!m) throw new AnswerError('UNKNOWN_TOKEN', '使えない記号があります。');
        if (m[0] === '\\frac') tokens.push({ t: 'FRAC' });
        else if (m[0] === '\\sqrt') tokens.push({ t: 'SQRT' });
        else if (m[0] === '\\div') tokens.push({ t: '/', slash: false });
        else throw new AnswerError('UNKNOWN_COMMAND', 'この問題では使えない記号が入っています。');
        i += m[0].length; continue;
      }
      m = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(rest);
      if (m) {
        var text = m[0];
        if (rest.charAt(text.length) === '.') throw new AnswerError('SYNTAX', '小数点の位置を確かめよう。');
        if (text.indexOf('.') >= 0) {
          var p = text.split('.');
          tokens.push({ t: 'DEC', n: BigInt((p[0] || '0') + p[1]), d: 10n ** BigInt(p[1].length), raw: text });
        } else tokens.push({ t: 'NUM', n: BigInt(text), raw: text });
        i += text.length; continue;
      }
      if (/[a-z]/.test(ch)) { tokens.push({ t: 'VAR', name: ch }); i++; continue; }
      if (ch === '\u221A') { tokens.push({ t: 'ROOT' }); i++; continue; }
      if (ch === '/') { tokens.push({ t: '/', slash: true }); i++; continue; }
      if (ch === '\u00F7') { tokens.push({ t: '/', slash: false }); i++; continue; }
      if ('+-*^(){}'.indexOf(ch) >= 0) { tokens.push({ t: ch }); i++; continue; }
      if (ch === '\u00B1' || ch === '\u2213') {
        if (allowPm) { tokens.push({ t: 'PM', mp: ch === '\u2213' }); i++; continue; } // 表示用だけ
        throw new AnswerError('PM', '±はここでは使えません。');
      }
      if (ch === '[' || ch === ']') throw new AnswerError('UNSUPPORTED', '3乗根は、この問題では使いません。');
      if (ch === '=') throw new AnswerError('EQUALS', '答えだけを書こう（= は1つまで）。');
      if (ch === ',') throw new AnswerError('SEPARATOR', '答えの区切り方を確かめよう。');
      throw new AnswerError('UNKNOWN_TOKEN', '「' + ch + '」は使えない記号です。');
    }
    if (tokens.length > MAX_TOKENS) throw new AnswerError('TOO_LONG', '式が長すぎます。');
    if (!tokens.length) throw new AnswerError('EMPTY', '答えを入力してから決定しよう。');
    return tokens;
  }

  function parseTokens(tokens) {
    var p = 0, depth = 0;
    function peek() { return tokens[p] ? tokens[p].t : null; }
    function accept(t) { if (peek() === t) { p++; return true; } return false; }
    function expect(t, msg) { if (!accept(t)) throw new AnswerError('SYNTAX', msg); }
    function enter() { if (++depth > MAX_DEPTH) throw new AnswerError('TOO_DEEP', '括弧が深すぎます。'); }

    function group(what) {
      if (peek() === '{') {
        accept('{'); enter();
        var v = expr();
        expect('}', what + 'の書き方を確かめよう。');
        depth--;
        return { k: 'group', a: v };
      }
      if (peek() === 'NUM') { // \frac16・\sqrt72 は1桁ずつ（LaTeX と同じ）
        var tok = tokens[p];
        if (tok.raw.length > 1) {
          tokens[p] = { t: 'NUM', n: BigInt(tok.raw.slice(1)), raw: tok.raw.slice(1) };
          return { k: 'num', n: BigInt(tok.raw.charAt(0)), raw: tok.raw.charAt(0) };
        }
        p++;
        return { k: 'num', n: tok.n, raw: tok.raw };
      }
      if (peek() === 'DEC' || peek() === 'VAR') return atom();
      throw new AnswerError('SYNTAX', what + 'の中身が読み取れません。');
    }

    function atom() {
      var t = peek(), tok;
      if (t === 'NUM') { tok = tokens[p++]; return { k: 'num', n: tok.n, raw: tok.raw }; }
      if (t === 'DEC') { tok = tokens[p++]; return { k: 'dec', n: tok.n, d: tok.d, raw: tok.raw }; }
      if (t === 'VAR') { tok = tokens[p++]; return { k: 'var', name: tok.name }; }
      if (t === '(' || t === '{') {
        var close = t === '(' ? ')' : '}';
        p++; enter();
        var v = expr();
        expect(close, '括弧が閉じていません。');
        depth--;
        return { k: 'group', a: v, paren: t === '(' };
      }
      if (t === 'FRAC') { p++; var num = group('分数の分子'); var den = group('分数の分母'); return { k: 'frac', num: num, den: den }; }
      if (t === 'SQRT') { p++; return { k: 'sqrt', a: group('根号') }; }
      if (t === 'ROOT') { // √23 は √(23)
        p++;
        var nt = peek();
        if (nt === 'NUM' || nt === 'DEC' || nt === 'VAR' || nt === '(' || nt === '{') return { k: 'sqrt', a: atom() };
        throw new AnswerError('INCOMPLETE', '根号の中を書こう。');
      }
      if (t === null) throw new AnswerError('INCOMPLETE', '式の続きを書こう。');
      throw new AnswerError('SYNTAX', '式として読み取れません。');
    }

    function power() {
      var base = atom();
      if (accept('^')) {
        var e;
        if (peek() === 'NUM') {
          var tok = tokens[p];
          if (tok.raw.length > 1) { // x^23 は x^2・3（LaTeX と同じ）
            tokens[p] = { t: 'NUM', n: BigInt(tok.raw.slice(1)), raw: tok.raw.slice(1) };
            e = Number(tok.raw.charAt(0));
          } else { p++; e = Number(tok.n); }
        } else if (peek() === '{') {
          accept('{');
          if (peek() !== 'NUM') throw new AnswerError('BAD_EXPONENT', '指数は0以上の整数にしてね。');
          e = Number(tokens[p++].n);
          expect('}', '指数の中に、数のほかのもの（+ − や文字）が入っているよ。→ で指数の外に出てから続きを書こう。');
        } else throw new AnswerError('BAD_EXPONENT', '指数を書こう。');
        if (e > MAX_EXPONENT) throw new AnswerError('BAD_EXPONENT', '指数が大きすぎます。');
        return { k: 'pow', a: base, e: e };
      }
      return base;
    }

    function unary() {
      if (peek() === 'PM') { var pu = tokens[p++]; return { k: 'pm', a: null, b: unary(), mp: pu.mp }; }
      if (accept('+')) return unary();
      if (accept('-')) return { k: 'neg', a: unary() };
      return power();
    }

    function term() {
      var node = unary();
      for (;;) {
        if (accept('*')) { node = { k: 'mul', a: node, b: unary(), explicit: true }; continue; }
        if (peek() === '/') { var tk = tokens[p++]; node = { k: 'div', a: node, b: unary(), slash: !!tk.slash }; continue; }
        if (peek() === 'FRAC') { // 帯分数（2\frac{1}{2}）は 2+1/2 と読み、書き方の決まり違反（MIXED_NUMBER）にする
          var holder = null, base = node;
          while (base && base.k === 'neg') { holder = base; base = base.a; }
          if (base && (base.k === 'num' || base.k === 'dec')) {
            var fr = power();
            if (fr.k !== 'frac' || unwrapGroup(fr.num).k !== 'num' || unwrapGroup(fr.den).k !== 'num') {
              throw new AnswerError('AMBIGUOUS_MIXED_NUMBER', '数の右に分数が続いています。かけ算なら分数を先に書こう。');
            }
            var mixed = { k: 'mixed', whole: base, frac: fr };
            if (holder) holder.a = mixed; else node = mixed;
            continue;
          }
        }
        if (has(ATOM_START, peek())) { node = { k: 'mul', a: node, b: unary(), explicit: false }; continue; }
        return node;
      }
    }

    function expr() {
      var node = term();
      for (;;) {
        if (accept('+')) { node = { k: 'add', a: node, b: term() }; continue; }
        if (accept('-')) { node = { k: 'sub', a: node, b: term() }; continue; }
        if (peek() === 'PM') { var pt = tokens[p++]; node = { k: 'pm', a: node, b: term(), mp: pt.mp }; continue; }
        return node;
      }
    }

    var ast = expr();
    if (p !== tokens.length) throw new AnswerError('SYNTAX', '式の続きが読み取れません。');
    return ast;
  }

  function evalAst(ast, allowed) {
    function walk(node) {
      switch (node.k) {
        case 'num': return vTerm(node.n, 1n);
        case 'dec': return vTerm(node.n, node.d);
        case 'var': {
          if (allowed && allowed.indexOf(node.name) < 0) throw new AnswerError('BAD_VARIABLE', 'この問題では文字「' + node.name + '」は使いません。');
          var vars = {}; vars[node.name] = 1;
          return vTerm(1n, 1n, 1, vars);
        }
        case 'group': return walk(node.a);
        case 'neg': return vNeg(walk(node.a));
        case 'add': return vAdd(walk(node.a), walk(node.b));
        case 'sub': return vSub(walk(node.a), walk(node.b));
        case 'mul': return vMul(walk(node.a), walk(node.b));
        case 'div': return vDiv(walk(node.a), walk(node.b));
        case 'frac': return vDiv(walk(node.num), walk(node.den));
        case 'sqrt': return vSqrt(walk(node.a));
        case 'pow': return vPow(walk(node.a), node.e);
        case 'mixed': return vAdd(walk(node.whole), walk(node.frac));
        default: throw new AnswerError('SYNTAX', '式として読み取れません。');
      }
    }
    return walk(ast);
  }

  // 前処理済みの1つの式を読む → { ast, value }
  function parsePiece(s, allowed) {
    var ast = parseTokens(tokenize(s));
    return { ast: ast, value: evalAst(ast, allowed || null) };
  }

  /* ---------- 生徒の式を安全に描き直す（生の入力を MathJax へ渡さないため） ---------- */
  function bareLatex(node) { return (node.k === 'group' && !node.paren) ? toLatex(node.a) : toLatex(node); }
  function toLatex(node) {
    switch (node.k) {
      case 'num': return String(node.raw !== undefined ? node.raw : node.n);
      case 'dec': return String(node.raw);
      case 'var': return node.name;
      case 'group': {
        var inner = toLatex(node.a);
        return (node.paren || node.a.k === 'add' || node.a.k === 'sub') ? '\\left(' + inner + '\\right)' : inner;
      }
      case 'neg': return '-' + toLatex(node.a);
      case 'add': return toLatex(node.a) + '+' + toLatex(node.b);
      case 'sub': return toLatex(node.a) + '-' + toLatex(node.b);
      case 'pm': return (node.a ? toLatex(node.a) : '') + (node.mp ? '\\mp ' : '\\pm ') + toLatex(node.b);
      case 'div': return node.slash ? '\\frac{' + bareLatex(node.a) + '}{' + bareLatex(node.b) + '}' : toLatex(node.a) + '\\div ' + toLatex(node.b);
      case 'frac': return '\\frac{' + bareLatex(node.num) + '}{' + bareLatex(node.den) + '}';
      case 'mixed': return toLatex(node.whole) + toLatex(node.frac);
      case 'sqrt': return '\\sqrt{' + bareLatex(node.a) + '}';
      case 'pow': return toLatex(node.a) + '^{' + node.e + '}';
      case 'mul': {
        var l = toLatex(node.a), r = toLatex(node.b);
        return (node.explicit || (/[0-9.]$/.test(l) && /^[0-9.]/.test(r))) ? l + '\\times ' + r : l + r;
      }
      default: return '';
    }
  }

  /* ============================================================
   * 5. 形の点検（構文木だけを見る。値は失っている情報を持たないため）
   * ========================================================== */
  // 途中（あと一歩）
  var UNFINISHED = ['NOT_FACTORED', 'NOT_FACTORED_FULLY', 'COMMON_FACTOR_LEFT', 'NOT_EXPANDED', 'NOT_COLLECTED',
    'UNEVALUATED_CONSTANT', 'FRACTION_NOT_REDUCED', 'FRACTION_NESTED', 'RADICAL_NOT_SIMPLE', 'RADICAL_REPEATED',
    'RADICAL_IN_DENOMINATOR', 'VAR_REPEATED', 'VAR_IN_DENOMINATOR'];
  // 書き方の決まり
  var NOTATION = ['DOUBLE_SIGN', 'NOTATION_ONE', 'NOTATION_ORDER', 'NOTATION_TIMES', 'NOTATION_DIV',
    'REPEATED_FACTOR', 'DUPLICATE_SOLUTION', 'ZERO_COEFFICIENT_TERM', 'MIXED_NUMBER', 'NOTATION_NUMBER',
    'DECIMAL_NOT_ALLOWED', 'UNKNOWN_FORM'];

  var MESSAGES = {
    NOT_FACTORED: 'あと一歩：積の形に因数分解しよう',
    NOT_FACTORED_FULLY: 'あと一歩：まだ因数分解できるかっこがあるよ',
    COMMON_FACTOR_LEFT: 'あと一歩：かっこの中に残っている共通因数をくくり出そう',
    NOT_EXPANDED: 'あと一歩：かっこをはずして計算しよう',
    NOT_COLLECTED: 'あと一歩：同類項をまとめよう',
    UNEVALUATED_CONSTANT: 'あと一歩：数の計算を最後までしよう',
    FRACTION_NOT_REDUCED: 'あと一歩：約分しよう',
    FRACTION_NESTED: 'あと一歩：分数の中の分数をなくそう',
    RADICAL_NOT_SIMPLE: 'あと一歩：根号の中をできるだけ小さい自然数にしよう',
    RADICAL_REPEATED: 'あと一歩：根号どうしのかけ算をまとめよう',
    RADICAL_IN_DENOMINATOR: 'あと一歩：分母を有理化しよう',
    VAR_REPEATED: 'あと一歩：同じ文字のかけ算は累乗でまとめよう',
    VAR_IN_DENOMINATOR: 'あと一歩：式を整理しよう',
    DOUBLE_SIGN: '書き方：符号は1つにまとめよう（+-3 は -3）',
    NOTATION_ONE: '書き方：1 は省こう（1x は x、x の1乗も x と書く）',
    NOTATION_ORDER: '書き方：数は文字・根号・かっこの前に、文字はアルファベット順に書こう',
    NOTATION_TIMES: '書き方：文字式では × や・を省こう',
    NOTATION_DIV: '書き方：÷ は使わずに、分数の形で書こう',
    REPEATED_FACTOR: '書き方：同じ因数は2乗の形にまとめよう',
    DUPLICATE_SOLUTION: '書き方：同じ解は1回だけ書こう',
    ZERO_COEFFICIENT_TERM: '書き方：係数が0の項は書かないよ',
    DECIMAL_NOT_ALLOWED: '書き方：この問題は小数を使わずに答えよう',
    MIXED_NUMBER: '書き方：帯分数は使わずに、仮分数で書こう',
    NOTATION_NUMBER: '書き方：数の書き方を確かめよう（.5 は 0.5、05 は 5）',
    UNKNOWN_FORM: '書き方：答えの形をもう一度確かめよう',
    NEGATIVE_DENOMINATOR: '値は合っています。マイナスは分子か分数の前に書こう',
    missing: '答えの個数を確かめよう',
    extra: '答えの個数を確かめよう',
    count: '答えの個数を確かめよう',
    empty: '答えを入力してから決定しよう。'
  };

  function unwrapGroup(n) { while (n && n.k === 'group') n = n.a; return n; }
  function constantValue(node) { try { return asRational(evalAst(node, null)); } catch (e) { return null; } }
  function containsDec(node) {
    if (!node || typeof node !== 'object') return false;
    if (node.k === 'dec') return true;
    return containsDec(node.a) || containsDec(node.b) || containsDec(node.num) || containsDec(node.den);
  }
  // 項に分ける（深さ0）。ひき算の右側は符号を1つ持つ
  function splitTerms(node) {
    var out = [];
    (function walk(n, neg) {
      var u = unwrapGroup(n);
      if (u.k === 'add') { walk(u.a, neg); walk(u.b, 0); return; }
      if (u.k === 'sub') { walk(u.a, neg); walk(u.b, 1); return; }
      out.push({ node: u, neg: neg });
    })(node, 0);
    return out;
  }
  // 因数に分ける（順番を保つ）。単項マイナスの数を数える
  function flattenFactors(node, out) {
    var u = unwrapGroup(node);
    if (u.k === 'mul') { flattenFactors(u.a, out); flattenFactors(u.b, out); return out; }
    if (u.k === 'neg') { out.negs = (out.negs || 0) + 1; flattenFactors(u.a, out); return out; }
    out.push(u);
    return out;
  }
  // 明示的な掛け算記号（\cdot・×・*）を、文字・根号・かっこの式に使っているか
  function explicitTimes(node, flags) {
    var u = unwrapGroup(node);
    if (u.k === 'neg') return explicitTimes(u.a, flags);
    if (u.k !== 'mul') return;
    if (u.explicit && !(constantValue(u.a) !== null && constantValue(u.b) !== null)) flags.push('NOTATION_TIMES');
    explicitTimes(u.a, flags); explicitTimes(u.b, flags);
  }
  // 因数の並び順の区分: 0=数、1=文字・根号、2=かっこの式
  function factorClass(f) {
    switch (f.k) {
      case 'num': case 'dec': case 'mixed': return 0;
      case 'frac': case 'div': return constantValue(f) !== null ? 0 : 1;
      case 'var': case 'sqrt': return 1;
      case 'pow': {
        var b = unwrapGroup(f.a);
        while (b.k === 'neg') b = unwrapGroup(b.a);
        if (b.k === 'num' || b.k === 'dec') return 0;
        if (b.k === 'var' || b.k === 'sqrt') return 1;
        return 2;
      }
      default: return 2;
    }
  }
  function leadingNegs(node) {
    var n = 0, u = unwrapGroup(node);
    while (u.k === 'neg') { n++; u = unwrapGroup(u.a); }
    return n;
  }

  function analyzeFraction(node, policy, flags, depth, outerNegs) {
    var num = node.k === 'frac' ? node.num : node.a;
    var den = node.k === 'frac' ? node.den : node.b;
    if (node.k === 'div' && !node.slash) flags.push('NOTATION_DIV');
    if (node.k === 'div' && !node.slash && constantValue(num) && constantValue(den)) { flags.push('UNEVALUATED_CONSTANT'); return; }
    if (containsDec(num) || containsDec(den)) flags.push('UNEVALUATED_CONSTANT');

    var denFactors = flattenFactors(den, []);
    denFactors.forEach(function (f) {
      if (f.k === 'sqrt') { if (policy.rationalize !== false) flags.push('RADICAL_IN_DENOMINATOR'); }
      else if (f.k === 'var') flags.push('VAR_IN_DENOMINATOR');
      else if (f.k === 'pow' && unwrapGroup(f.a).k === 'var') flags.push('VAR_IN_DENOMINATOR');
      else if (f.k === 'frac' || f.k === 'div') flags.push('FRACTION_NESTED');
      else if (f.k === 'add' || f.k === 'sub') flags.push('NOT_EXPANDED');
    });
    var denValue = constantValue(den);
    if (outerNegs > 0 && leadingNegs(num) > 0) flags.push('DOUBLE_SIGN');
    if (denValue) {
      if (denValue.n < 0n) {
        // 分母だけにマイナス → △。ほかにも符号がある（\frac{-2}{-3}・-\frac{2}{-3}）→ 符号の書き方
        var numNeg = leadingNegs(num) > 0 || (constantValue(num) !== null && constantValue(num).n < 0n);
        flags.push(numNeg || outerNegs > 0 ? 'DOUBLE_SIGN' : 'NEGATIVE_DENOMINATOR');
      }
      if (denValue.d !== 1n) flags.push('FRACTION_NESTED');
      if (babs(denValue.n) === 1n && denValue.d === 1n) flags.push('FRACTION_NOT_REDUCED');
    }
    inspectNode(num, policy, flags, depth + 1);
    if (denValue && denValue.d === 1n && policy.reduce !== false) {
      var numValue = null;
      try { numValue = evalAst(num, null); } catch (e) { numValue = null; }
      if (numValue) {
        var coefs = Object.keys(numValue).map(function (k) { return numValue[k]; });
        if (coefs.length && coefs.every(function (c) { return c.d === 1n; })) {
          var g = babs(denValue.n);
          coefs.forEach(function (c) { g = bgcd(g, c.n); });
          if (g > 1n) flags.push('FRACTION_NOT_REDUCED');
        }
      }
    }
  }

  function analyzeTerm(node, termNeg, policy, flags, depth) {
    explicitTimes(node, flags);
    var factors = flattenFactors(node, []);
    var negs = (factors.negs || 0) + termNeg;
    var numeric = 0, radicals = 0, fractions = 0, maxClass = 0, seenVars = {}, varOrder = [];
    factors.forEach(function (f) {
      var cls = factorClass(f);
      if (cls < maxClass) flags.push('NOTATION_ORDER');
      if (cls > maxClass) maxClass = cls;
      switch (f.k) {
        case 'num':
          numeric++;
          if (f.n === 1n && factors.length > 1) flags.push('NOTATION_ONE');
          break;
        case 'dec':
          numeric++;
          if (policy.decimal === false) flags.push('DECIMAL_NOT_ALLOWED');
          break;
        case 'var':
          if (seenVars[f.name]) flags.push('VAR_REPEATED');
          seenVars[f.name] = 1; varOrder.push(f.name);
          break;
        case 'pow': {
          if (f.e === 1) flags.push('NOTATION_ONE');
          var base = unwrapGroup(f.a);
          while (base.k === 'neg') base = unwrapGroup(base.a);
          if (base.k === 'var') {
            if (seenVars[base.name]) flags.push('VAR_REPEATED');
            seenVars[base.name] = 1; varOrder.push(base.name);
            if (f.e === 0) flags.push('UNEVALUATED_CONSTANT');
          } else if (base.k === 'num' || base.k === 'dec') flags.push('UNEVALUATED_CONSTANT');
          else if (base.k === 'sqrt') flags.push('RADICAL_NOT_SIMPLE');
          else flags.push('NOT_EXPANDED');
          break;
        }
        case 'sqrt': {
          radicals++;
          if (radicals > 1) flags.push('RADICAL_REPEATED');
          var inner = unwrapGroup(f.a);
          if (inner.k !== 'num') {
            // 根号の中に計算・小数・分数・根号が残る（\sqrt{4\cdot2}・\sqrt{6+2}・\sqrt{8.0}・\sqrt{\frac{16}{2}}）。radical:false でも点検する
            flags.push('UNEVALUATED_CONSTANT');
            if (policy.radical !== false) flags.push('RADICAL_NOT_SIMPLE');
          } else {
            var n = Number(inner.n);
            if (n <= 1) flags.push('RADICAL_NOT_SIMPLE'); // \sqrt{1}・\sqrt{0}
            // 平方因数（\sqrt8 を 2\sqrt2 にしていない）の点検だけを radical:false で止める
            else if (policy.radical !== false && extractSquare(n).square > 1) flags.push('RADICAL_NOT_SIMPLE');
          }
          break;
        }
        case 'frac': case 'div':
          fractions++;
          if (fractions > 1 || depth > 0) flags.push('FRACTION_NESTED');
          analyzeFraction(f, policy, flags, depth, negs);
          break;
        case 'add': case 'sub':
          if (policy.expand !== false) flags.push('NOT_EXPANDED');
          break;
        case 'mixed':
          numeric++; flags.push('MIXED_NUMBER');
          break;
        default:
          flags.push('UNKNOWN_FORM');
      }
    });
    for (var i = 1; i < varOrder.length; i++) if (varOrder[i] < varOrder[i - 1]) flags.push('NOTATION_ORDER');
    if (numeric > 1) flags.push('UNEVALUATED_CONSTANT');
    if (numeric >= 1 && fractions >= 1) flags.push('UNEVALUATED_CONSTANT');
  }

  function inspectNode(node, policy, flags, depth) {
    var terms = splitTerms(node), seen = {};
    terms.forEach(function (t) {
      analyzeTerm(t.node, t.neg, policy, flags, depth || 0);
      var key = null;
      try {
        var v = evalAst(t.node, null), keys = Object.keys(v);
        if (terms.length > 1 && keys.length === 0) flags.push('ZERO_COEFFICIENT_TERM');
        if (keys.length === 1) key = keys[0];
      } catch (e) { key = null; }
      if (key) {
        if (seen[key]) flags.push(key === '1|' ? 'UNEVALUATED_CONSTANT' : 'NOT_COLLECTED');
        seen[key] = 1;
      }
    });
  }

  // .5（整数部のない小数）・05（先頭のゼロ）
  function numberFlags(node, flags) {
    if (!node || typeof node !== 'object') return;
    if ((node.k === 'num' || node.k === 'dec') && node.raw !== undefined && /^(?:0[0-9]|\.)/.test(String(node.raw))) flags.push('NOTATION_NUMBER');
    ['a', 'b', 'num', 'den', 'whole', 'frac'].forEach(function (k) { numberFlags(node[k], flags); });
  }
  // 符号が2つ続く（x^2+-3x・--3・+(-3)）
  function doubleSignFlags(s, flags) {
    if (/[+\-][+\-]/.test(s) || /[+\-]\([+\-]/.test(s)) flags.push('DOUBLE_SIGN');
  }

  function uniq(a) { var o = [], seen = {}; a.forEach(function (x) { if (!seen[x]) { seen[x] = 1; o.push(x); } }); return o; }

  /* ============================================================
   * 6. 因数分解の形
   * ========================================================== */
  // 多項式（値）を「原始的な形」にする: 係数の最大公約数・共通の文字・符号をはずす
  function primitiveOf(P) {
    var keys = Object.keys(P);
    var info = { content: false, key: '' };
    if (!keys.length) { info.key = '0'; return info; }
    // 係数を整数にそろえる（分数係数は共通因数の残り）
    var lcm = 1n;
    keys.forEach(function (k) { var d = P[k].d; lcm = lcm / bgcd(lcm, d) * d; });
    if (lcm !== 1n) info.content = true;
    var g = 0n;
    keys.forEach(function (k) { g = bgcd(g, P[k].n * (lcm / P[k].d)); });
    if (g > 1n && lcm === 1n) info.content = true;
    // 共通の文字
    var minExp = null;
    keys.forEach(function (k) {
      var v = splitKey(k).vars;
      if (minExp === null) { minExp = {}; for (var x in v) if (has(v, x)) minExp[x] = v[x]; }
      else for (var y in minExp) if (has(minExp, y)) minExp[y] = Math.min(minExp[y], v[y] || 0);
    });
    var common = false;
    for (var z in minExp) if (has(minExp, z) && minExp[z] > 0) common = true;
    if (common && keys.length > 1) info.content = true;
    // 正規化した値
    var Q = {};
    keys.forEach(function (k) {
      var t = splitKey(k), vars = {};
      for (var x in t.vars) if (has(t.vars, x)) vars[x] = t.vars[x] - (keys.length > 1 ? (minExp[x] || 0) : 0);
      Q[makeKey(t.radicand, vars)] = rat(P[k].n * (lcm / P[k].d), g || 1n);
    });
    var first = sortedKeys(Q)[0];
    if (Q[first].n < 0n) Q = vNeg(Q);
    info.key = valueKey(Q);
    return info;
  }

  // 積の形を読む → { flags, polys: {key: 回数}, entries: [key…], sum: bool }
  function analyzeFactored(ast, policy, s) {
    var flags = [];
    doubleSignFlags(s, flags);
    numberFlags(ast, flags);
    var top = unwrapGroup(ast);
    while (top.k === 'neg') top = unwrapGroup(top.a);
    if (top.k === 'add' || top.k === 'sub') return { flags: ['NOT_FACTORED'], polys: {}, entries: [], sum: true };
    if (top.k === 'div' || top.k === 'frac') { // (x+2)(x-3)/1・5x(x+3)\div1・\frac{10x(x+3)}{2}
      if (constantValue(top.k === 'frac' ? top.den : top.b) !== null) {
        if (top.k === 'div' && !top.slash) flags.push('NOTATION_DIV');
        flags.push('UNEVALUATED_CONSTANT');
        return { flags: flags, polys: {}, entries: [], sum: false, divided: true };
      }
    }
    explicitTimes(top, flags);
    var factors = flattenFactors(top, []);
    var maxClass = 0, numeric = 0, polys = {}, entries = [], seenVars = {}, varOrder = [], divided = false;
    function addPoly(node, times) {
      inspectNode(node, policy, flags, 0);
      var P;
      try { P = evalAst(node, null); } catch (e) { flags.push('UNKNOWN_FORM'); return; }
      if (Object.keys(P).length < 2) { flags.push('NOT_EXPANDED'); return; } // (x)・(2+3) のような1項のかっこ
      var pr = primitiveOf(P);
      if (pr.content) flags.push('COMMON_FACTOR_LEFT');
      if (entries.indexOf(pr.key) >= 0) flags.push('REPEATED_FACTOR');
      entries.push(pr.key);
      polys[pr.key] = (polys[pr.key] || 0) + times;
    }
    factors.forEach(function (f) {
      var cls = factorClass(f);
      if (cls < maxClass) flags.push('NOTATION_ORDER');
      if (cls > maxClass) maxClass = cls;
      switch (f.k) {
        case 'num':
          numeric++;
          if (f.n === 1n && factors.length > 1) flags.push('NOTATION_ONE');
          break;
        case 'dec':
          numeric++;
          if (policy.decimal === false) flags.push('DECIMAL_NOT_ALLOWED');
          break;
        case 'frac': case 'div':
          if (constantValue(f) === null) {
            // 10x\cdot\frac{x+3}{2} のように、かっこの式を数でわったまま
            if (constantValue(f.k === 'frac' ? f.den : f.b) !== null) { flags.push('UNEVALUATED_CONSTANT'); divided = true; }
            else flags.push('UNKNOWN_FORM');
            break;
          }
          numeric++;
          inspectNode(f, policy, flags, 0);
          break;
        case 'sqrt':
          inspectNode(f, policy, flags, 0);
          break;
        case 'var':
          if (seenVars[f.name]) flags.push('VAR_REPEATED');
          seenVars[f.name] = 1; varOrder.push(f.name);
          break;
        case 'pow': {
          if (f.e === 1) flags.push('NOTATION_ONE');
          var base = unwrapGroup(f.a);
          if (base.k === 'var') {
            if (seenVars[base.name]) flags.push('VAR_REPEATED');
            seenVars[base.name] = 1; varOrder.push(base.name);
          } else if (base.k === 'add' || base.k === 'sub') addPoly(base, f.e);
          else if (base.k === 'num' || base.k === 'dec') { numeric++; flags.push('UNEVALUATED_CONSTANT'); }
          else flags.push('NOT_EXPANDED'); // (2x)^2 など
          break;
        }
        case 'add': case 'sub':
          addPoly(f, 1);
          break;
        case 'mixed':
          numeric++; flags.push('MIXED_NUMBER');
          break;
        default:
          flags.push('UNKNOWN_FORM');
      }
    });
    for (var i = 1; i < varOrder.length; i++) if (varOrder[i] < varOrder[i - 1]) flags.push('NOTATION_ORDER');
    if (numeric > 1) flags.push('UNEVALUATED_CONSTANT');
    return { flags: flags, polys: polys, entries: entries, sum: false, divided: divided };
  }
  function samePolys(a, b) {
    var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join(';') !== kb.join(';')) return false;
    return ka.every(function (k) { return a[k] === b[k]; });
  }

  /* ============================================================
   * 7. 結果を作る
   * ========================================================== */
  function res(status, kind, reason, extra) {
    var r = { status: status, kind: kind, reason: reason || '', flags: [], message: '' };
    if (extra) for (var k in extra) if (has(extra, k)) r[k] = extra[k];
    if (!r.message) r.message = has(MESSAGES, r.reason) ? MESSAGES[r.reason] : '';
    return r;
  }
  function fromError(e) {
    if (!(e instanceof AnswerError)) throw e; // 作り手の誤りは隠さない
    if (e.code === 'EMPTY') return res('empty', 'incomplete', 'empty');
    if (e.code === 'BAD_VARIABLE') return res('wrong', 'wrong', 'badVariable', { message: e.message });
    return res('unreadable', 'incomplete', e.code, { message: e.message });
  }
  // 値が合っているときの、形による結果
  function fromFlags(flags, extra) {
    flags = uniq(flags);
    var e = extra || {};
    e.flags = flags;
    for (var i = 0; i < UNFINISHED.length; i++) if (flags.indexOf(UNFINISHED[i]) >= 0) return res('notReduced', 'unfinished', UNFINISHED[i], e);
    for (var j = 0; j < NOTATION.length; j++) if (flags.indexOf(NOTATION[j]) >= 0) return res('notReduced', 'notation', NOTATION[j], e);
    if (flags.indexOf('NEGATIVE_DENOMINATOR') >= 0) return res('negDenominator', 'negDenominator', 'NEGATIVE_DENOMINATOR', e);
    return res('correct', 'correct', '', e);
  }

  /* ---------- 模範解答（先生が書く）を読む。読めなければ作り手の誤りとして例外 ---------- */
  var answerCache = {};
  function answerValues(text) {
    var key = String(text);
    if (has(answerCache, key)) return answerCache[key];
    var out;
    try {
      var s = preprocess(text, null), vs = [];
      splitPieces(s).forEach(function (pc) { expandPm(pc).forEach(function (x) { vs.push(parsePiece(x, null).value); }); });
      out = vs;
    } catch (e) {
      throw new Error('NyushiCore: 模範解答が読めません: ' + text + '（' + (e && e.message) + '）');
    }
    answerCache[key] = out;
    return out;
  }
  function answerValue(text) {
    var vs = answerValues(text);
    if (vs.length !== 1) throw new Error('NyushiCore: 模範解答は1つの値にしてください: ' + text);
    return vs[0];
  }

  /* ---------- 区切り・x=・± ---------- */
  function splitPieces(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '(' || c === '{') depth++;
      if (c === ')' || c === '}') depth--;
      if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }
  // 「x=…」「…=x」をはずす。lhs: 外してよい文字の配列（null なら何でも）
  function stripLhs(pc, lhs, allowSwap) {
    var m = /^([a-z])=(?!.*=)(.+)$/.exec(pc);
    if (m && (lhs === null || lhs.indexOf(m[1]) >= 0)) return m[2];
    m = /^(.+)=([a-z])$/.exec(pc);
    if (m && allowSwap !== false && m[1].indexOf('=') < 0 && (lhs === null || lhs.indexOf(m[2]) >= 0)) return m[1];
    if (pc.indexOf('=') >= 0) {
      if (/^[a-z]?=$/.test(pc) || /^=/.test(pc)) throw new AnswerError('INCOMPLETE', '答えを書こう。');
      throw new AnswerError('EQUALS', '答えだけを書こう（= の使い方を確かめよう）。');
    }
    return pc;
  }
  var ONE_ANSWER = 'この問題の答えは1つだよ。「,」「、」は使わずに書き直そう。';
  var EMPTY_PIECE = '「,」「、」の前か後ろに答えがありません。答えだけを書き直そう。';
  // 生徒の答え（区切り・± を含む）を安全に描き直す。読めなければ undefined
  function displayLatex(s, lhs, allowSwap) {
    try {
      return splitPieces(s).map(function (pc) {
        return toLatex(parseTokens(tokenize(stripLhs(pc, lhs, allowSwap), true)));
      }).join(',\\ ');
    } catch (e) { return undefined; }
  }
  function expandPm(pc) {
    var n = (pc.match(/[\u00B1\u2213]/g) || []).length;
    if (n === 0) return [pc];
    if (n > 1) throw new AnswerError('PM', '±は1つの答えに1回だけ使おう。');
    var neg = pc.indexOf('\u2213') >= 0;
    return [pc.replace(/[\u00B1\u2213]/, neg ? '-' : '+'), pc.replace(/[\u00B1\u2213]/, neg ? '+' : '-')];
  }
  function policyOf(opts) {
    return { decimal: opts.decimal !== false, radical: opts.radical !== false, rationalize: opts.rationalize !== false,
      reduce: opts.reduce !== false, expand: opts.expand !== false };
  }
  function lhsOf(opts, answerHasVars) {
    if (Array.isArray(opts.lhs)) return opts.lhs;
    if (typeof opts.lhs === 'string') return [opts.lhs];
    return answerHasVars ? [] : null; // 答えが数なら「x=」「n=」などを何でも外す
  }
  // 生徒の入力を、値と形の点検つきの答えの並びにする
  function readStudent(raw, opts, answerHasVars, single, pastePm) {
    var s = preprocess(raw, opts);
    if (s === '') throw new AnswerError('EMPTY', '');
    var pieces = splitPieces(s);
    if (pieces.some(function (pc) { return pc === ''; })) throw new AnswerError('INCOMPLETE', EMPTY_PIECE);
    if (single && pieces.length > 1) throw new AnswerError('SEPARATOR', ONE_ANSWER);
    if (pieces.length > MAX_PIECES) throw new AnswerError('TOO_LONG', '答えが多すぎます。');
    var lhs = lhsOf(opts, answerHasVars), out = [];
    pieces.forEach(function (pc) {
      if (pc === '') throw new AnswerError('INCOMPLETE', EMPTY_PIECE);
      var body = stripLhs(pc, lhs, opts.allowSwap), pasted = false;
      if (pastePm && !single && !/[\u00B1]/.test(body) && (body.match(/\+-/g) || []).length === 1) { body = body.replace('+-', '\u00B1'); pasted = true; }
      var variants = expandPm(body);
      variants.forEach(function (x) {
        var p = parsePiece(x, opts.vars || null), flags = [];
        doubleSignFlags(x, flags);
        if (pasted) flags.push('DOUBLE_SIGN');
        numberFlags(p.ast, flags);
        inspectNode(p.ast, policyOf(opts), flags, 0);
        out.push({ value: p.value, flags: flags, ast: p.ast, pm: variants.length > 1 });
      });
    });
    out.latex = displayLatex(s, lhs, opts.allowSwap);
    return out;
  }

  /* ============================================================
   * 8. 採点
   * ========================================================== */
  // 1つの値（数・根号・式）。opts: vars, lhs, allowSwap, units, decimal, radical, rationalize, reduce, expand
  function gradeValue(raw, answer, opts) {
    opts = opts || {};
    var want = answerValue(answer);
    if (isBlank(raw)) return res('empty', 'incomplete', 'empty');
    var got;
    try { got = readStudent(raw, opts, hasVars(want), true); } catch (e) { return fromError(e); }
    if (got.length !== 1) return res('wrong', 'wrong', 'count', { studentLatex: got.latex });
    if (!valueEquals(got[0].value, want)) return res('wrong', 'wrong', 'value', { studentLatex: toLatex(got[0].ast) });
    return fromFlags(got[0].flags, { studentLatex: toLatex(got[0].ast) });
  }

  // 解の集合（2次方程式など）。answers: ['3','-\\frac{5}{2}'] や ['\\pm\\sqrt{7}']。順番は問わない
  function gradeSet(raw, answers, opts) {
    opts = opts || {};
    var list = Array.isArray(answers) ? answers : [answers], want = [];
    list.forEach(function (a) { answerValues(a).forEach(function (v) { want.push(v); }); });
    var wantKeys = uniq(want.map(valueKey));
    if (isBlank(raw)) return res('empty', 'incomplete', 'empty');
    var r = gradeSetOnce(raw, opts, want, wantKeys, false);
    // 「+-3」: そのまま（-3）読んで値が合わなければ、± のつもりとして読み直す（どちらも符号の書き方の決まり違反）
    if (r.status === 'wrong' && /\+-/.test(toStr(raw))) {
      var r2 = gradeSetOnce(raw, opts, want, wantKeys, true);
      if (r2.status !== 'wrong' && r2.status !== 'unreadable') return r2;
    }
    return r;
  }
  function gradeSetOnce(raw, opts, want, wantKeys, pastePm) {
    var got;
    try { got = readStudent(raw, opts, want.some(hasVars), false, pastePm); } catch (e) { return fromError(e); }
    var keys = got.map(function (g) { return valueKey(g.value); }), gotKeys = uniq(keys);
    var hit = gotKeys.filter(function (k) { return wantKeys.indexOf(k) >= 0; }).length;
    var extra = { matched: hit, expected: wantKeys.length, studentLatex: got.latex };
    if (hit < gotKeys.length) {
      if (hit === wantKeys.length) return res('wrong', 'wrong', 'extra', extra);
      return res('wrong', 'wrong', 'value', extra);
    }
    if (hit < wantKeys.length) return res('wrong', 'wrong', 'missing', extra);
    var flags = [];
    got.forEach(function (g) { flags = flags.concat(g.flags); });
    if (keys.length > gotKeys.length) flags.push('DUPLICATE_SOLUTION');
    return fromFlags(flags, extra);
  }

  // 因数分解。answer は完全に因数分解した形（例 '5x(x+3)'）。値が等しく、因数の組が同じなら○
  function gradeFactored(raw, answer, opts) {
    opts = opts || {};
    var pol = policyOf(opts);
    var wantAst;
    try { wantAst = parseTokens(tokenize(preprocess(answer, null))); }
    catch (e) { throw new Error('NyushiCore: 模範解答が読めません: ' + answer + '（' + (e && e.message) + '）'); }
    var wantValue = evalAst(wantAst, null), wantForm = analyzeFactored(wantAst, pol, '');
    if (isBlank(raw)) return res('empty', 'incomplete', 'empty');
    var s, ast, value;
    try {
      s = preprocess(raw, opts);
      if (s === '') return res('empty', 'incomplete', 'empty');
      var pieces = splitPieces(s);
      if (pieces.some(function (pc) { return pc === ''; })) throw new AnswerError('INCOMPLETE', EMPTY_PIECE);
      if (pieces.length > 1) throw new AnswerError('SEPARATOR', ONE_ANSWER);
      s = stripLhs(s, Array.isArray(opts.lhs) ? opts.lhs : [], opts.allowSwap);
      if (/[\u00B1\u2213]/.test(s)) return res('wrong', 'wrong', 'pm');
      ast = parseTokens(tokenize(s));
      value = evalAst(ast, opts.vars || null);
    } catch (e) { return fromError(e); }
    if (!valueEquals(value, wantValue)) return res('wrong', 'wrong', 'value', { studentLatex: toLatex(ast) });
    var form = analyzeFactored(ast, pol, s);
    if (!form.sum && !form.divided && form.flags.indexOf('COMMON_FACTOR_LEFT') < 0 && !samePolys(form.polys, wantForm.polys)) form.flags.push('NOT_FACTORED_FULLY');
    return fromFlags(form.flags, { studentLatex: toLatex(ast) });
  }

  // まとめ役。spec.mode: 'value'（既定）| 'set' | 'factored'。spec.answer / spec.answers と opts を1つにまとめて渡せる
  function judge(raw, spec) {
    spec = spec || {};
    if (spec.mode === 'set') return gradeSet(raw, spec.answers != null ? spec.answers : spec.answer, spec);
    if (spec.mode === 'factored') return gradeFactored(raw, spec.answer, spec);
    if (spec.mode && spec.mode !== 'value') throw new Error('NyushiCore: mode は value / set / factored のどれか: ' + spec.mode);
    return gradeValue(raw, spec.answer, spec);
  }

  /* ---------- 画面・得点 ---------- */
  function mark(r) { var st = r && r.status; return st === 'correct' ? '○' : st === 'negDenominator' ? '△' : '×'; }
  function points(r) { return (r && r.status) === 'correct' ? 1 : 0; }
  function isCorrect(r) { return (r && r.status) === 'correct'; }
  // 採点して問題を消費するか（空欄・書きかけは消費しない）
  function consumes(r) { var st = r && r.status; return st !== 'empty' && st !== 'unreadable'; }
  function message(r) { return (r && r.message) || ''; }
  // 誤答の見立て（diagnosticMatchers）用: LaTeX の値の比較キー
  function valueKeyOf(latex) { return valueKey(answerValue(latex)); }
  function parse(raw, opts) {
    var s = preprocess(raw, opts || null);
    return parsePiece(s, (opts && opts.vars) || null);
  }

  return {
    VERSION: VERSION, MESSAGES: MESSAGES, UNFINISHED: UNFINISHED.slice(), NOTATION: NOTATION.slice(),
    judge: judge, gradeValue: gradeValue, gradeSet: gradeSet, gradeFactored: gradeFactored,
    isBlank: isBlank, parse: parse, valueKey: valueKey, valueKeyOf: valueKeyOf, valueEquals: valueEquals,
    canonicalLatex: canonicalLatex, toLatex: toLatex,
    mark: mark, points: points, isCorrect: isCorrect, consumes: consumes, message: message
  };
})();
// ===== NYUSHI-CORE END v1.0 =====
if (typeof module !== 'undefined' && module.exports) module.exports = NyushiCore;
