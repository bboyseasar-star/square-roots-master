/* D2-NUM: evidence-backed original variants with deterministic generation. */
(function () {
  'use strict';
  const COURSE_ID = 'square-roots';
  const RNG_VERSION = 'mulberry32-v1';
  const COVERAGE_REQUIRED_GROUPS = ['num.simplify_root','num.root_calc','num.rationalize','num.compare'];
  const FORMS = [
    ['num.root_calc','根号を含む和の計算','R02/R03/R04/R05 【1】'],
    ['num.rationalize','根号どうしの分数の有理化','H24'],
    ['num.compare','根号の値より小さい自然数の個数','H21'],
    ['num.compare','根号に最も近い自然数','H23/H31'],
    ['num.simplify_root','根号の中を整数の2乗とそれ以外に分ける計算','H25 【1】'],
    ['num.compare','根号を含む数の大小','H24'],
    ['num.signed_power','平方根について正しい記述','H28/R3'],
    ['num.transfer','根号が整数となる最小の自然数','H30'],
    ['num.compare','2つの根号の間の自然数','R5'],
    ['num.classify','無理数の判定','R4']
  ];
  function fnv(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
  function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function pick(r,a){return a[Math.floor(r()*a.length)];}
  const CHOICE_LABELS=['ア','イ','ウ','エ','オ'];
  // 記号問題の選択肢の順番だけを決める乱数（数値を決める乱数とは別。どの seed でも正解がイになるのを避ける）
  function orderRng(seed,slot){return rng(fnv(`${seed}|${COURSE_ID}|${slot}|choice-order|${RNG_VERSION}`));}
  // items: [[表示, 正しいか], …] → 並べ替えて [[記号, 表示, 正しいか], …]
  function labelChoices(items,ro){const idx=items.map((_,i)=>i);for(let i=idx.length-1;i>0;i--){const j=Math.floor(ro()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]];}return idx.map((k,i)=>[CHOICE_LABELS[i],items[k][0],items[k][1]]);}
  function integerSqrt(n){let x=0;while((x+1)*(x+1)<=n)x++;return x;}
  function isSquare(n){const x=integerSqrt(n);return x*x===n;}
  const tex = n => `\\sqrt{${n}}`;
  const rootOrOne = n => (n === 1 ? '1' : tex(n)); // √1 は 1 と書く（有理化の問題の分子）
  function working(id,p){
    if(id==='root-calc'){const c=integerSqrt(p.b/2);return `途中式：\\(\\sqrt{${p.b}}=\\sqrt{${c*c}\\times2}=${c}\\sqrt2\\)`;}
    if(id==='rationalize-surd'){return `途中式：\\(\\dfrac{${rootOrOne(p.a)}}{${tex(p.b)}}\\times\\dfrac{${tex(p.b)}}{${tex(p.b)}}\\) を計算します。`;}
    if(id==='natural-count'){return `途中式：候補を \\(m=1,2,3,\\ldots\\) と置き、\\(m^2\\times${p.b}\\) と \\(${p.k}^2\\) を比べます。`;}
    if(id==='nearest-natural'){const a=integerSqrt(p.n);return `途中式：中点との比較は、\\(4\\times${p.n}\\) と \\((2\\times${a}+1)^2\\) を比べて判断します。`;}
    if(id==='simplify-root'){return `途中式：\\(\\sqrt{${4*p.r}}=\\sqrt{4\\times${p.r}},\\quad \\sqrt{${9*p.r}}=\\sqrt{9\\times${p.r}}\\) と分けます。`;}
    if(id==='compare-three'){return '途中式：すべて正の数なので、2乗して大小を比べます。';}
    if(id==='sqrt-statement'){return `途中式：\\(\\sqrt{(-${p.m})^2}\\) は、先に中の \\((-${p.m})^2=${p.m*p.m}\\) を計算します。`;}
    if(id==='min-n-integer'){return `途中式：\\(${p.k}n\\) が整数の2乗（4, 9, 16, …）になるように、\\(${p.k}\\) を素因数分解して、同じ素数が2個ずつそろうように \\(n\\) を決めます。`;}
    if(id==='natural-between'){return `途中式：候補の自然数を \\(m\\) とし、\\(m^2\\) を \\(${p.a}\\) と \\(${p.b}\\) の間で1つずつ確かめます。`;}
    return '途中式：根号の中が整数の2乗（\\(1^2,2^2,3^2,\\ldots\\)）になっているかを確かめます。';
  }
  // grading: 採点の決め方（gradeAnswer が使う）。
  //   { mode:'value', answer:'LaTeX', opts } … 1つの値（NyushiCore.judge）
  //   { mode:'set', answers:['3','4'], opts } … 自然数の列挙（順不同。NyushiCore.judge の set）
  //   { mode:'choice', answer:['イ', …] } … 記号選択（GraderCore.gradeChoice）
  // answer は画面に出す正答（MathJax の \( \) つき、または記号の文字）。
  const q = (id, form, params, prompt, answer, hints, grading) => ({
    templateId:id, formId:form[0], evidence:[form[2]], courseId:COURSE_ID, subskillTag:form[0],
    generatedParams:params, fingerprint:JSON.stringify([id,params]), prompt, answer,
    hints:[hints[0],`${hints[1]}<br><strong>${working(id,params)}</strong>`,hints[2]], solution:hints[2], grading
  });
  const VALUE = (answer, opts) => ({ mode:'value', answer, opts:opts||{} });
  const CHOICE = (answer, n) => ({ mode:'choice', answer:[answer], labels:CHOICE_LABELS.slice(0, n) }); // ローマ字 a,i,u,e,o は gradeAnswer で読み替える
  function make(slot, seed){
    const r=rng(fnv(`${seed}|${COURSE_ID}|${slot}|${RNG_VERSION}`)), f=FORMS[slot%FORMS.length];
    if(slot%10===0){ const a=pick(r,[2,3,4]), b=pick(r,[8,18,32]); const c=integerSqrt(b/2); return q('root-calc',f,{a,b},`次の計算をしなさい。<div class="problem-expression" style="font-size:clamp(2rem,4vw,3.1rem);line-height:1.35;text-align:center;margin:26px 0 30px;font-weight:600">\\( ${a}${tex(2)}+${tex(b)} \\)</div>`,`\\(${a+c}\\sqrt{2}\\)`,['根号の中を、平方数を使って分けられないか見よう。','根号を、ある数の2乗と残りの積に分けて整理しよう。','\\(\\sqrt{'+b+'}= '+c+'\\sqrt{2}\\) なので、同じ \\(\\sqrt{2}\\) の係数を足して \\('+ (a+c)+'\\sqrt{2}\\) です。'],VALUE(`${a+c}\\sqrt{2}`,{lhs:[]})); }
    if(slot%10===1){const b=pick(r,[2,3,5,7]), a=pick(r,[1,2,3].filter(x=>x!==b)); const d=a*b; return q('rationalize-surd',f,{a,b},`\\(\\dfrac{${rootOrOne(a)}}{${tex(b)}}\\) を、分母に根号がない形で表しなさい。`,`\\(\\dfrac{${tex(d)}}{${b}}\\)`,['分母の根号をなくすため、分母と分子に同じ根号をかけよう。',`分母は \\(${tex(b)}\\times${tex(b)}=${b}\\) となり、根号がなくなります。分子にも同じ \\(${tex(b)}\\) をかけます。`,`\\(\\dfrac{${rootOrOne(a)}}{${tex(b)}}\\times\\dfrac{${tex(b)}}{${tex(b)}}=\\dfrac{${tex(d)}}{${b}}\\) です。`],VALUE(`\\frac{${tex(d)}}{${b}}`,{lhs:[]}));}
    if(slot%10===2){const k=pick(r,[4,5,6,7]), b=pick(r,[2,3,5]); let n=0;while((n+1)*(n+1)*b<k*k)n++;return q('natural-count',f,{k,b},`\\(\\dfrac{${k}}{${tex(b)}}\\) より小さい自然数は何個ありますか。自然数は \\(1\\) 以上です。`,String(n),['まず、その数がどの2つの連続する整数の間にあるか考えよう。','分母の根号を含む式は、両辺が正であることを確かめてから平方して比べよう。',`正の数なので平方して比べると、\\( ${n}\\lt \\dfrac{${k}}{${tex(b)}}\\lt ${n+1}\\) です。\\(1\\) から \\(${n}\\) までの \\(${n}\\) 個です。`],VALUE(String(n),{units:['個'],lhs:['n']}));}
    if(slot%10===3){const n=pick(r,[10,20,45,50,80]); const a=integerSqrt(n), ans=4*n<(2*a+1)*(2*a+1)?a:a+1;return q('nearest-natural',f,{n},`\\(${tex(n)}\\) に最も近い自然数を答えなさい。`,String(ans),['近くにある2つの平方数を探そう。','2つの平方数の間で、どちらに近いかを平方数を使って比べよう。',`\\(${a}^2\\lt ${n}\\lt ${a+1}^2\\) なので、\\(${a}\\lt ${tex(n)}\\lt ${a+1}\\) です。距離を比べると最も近い自然数は \\(${ans}\\) です。`],VALUE(String(ans),{lhs:[]}));}
    if(slot%10===4){const r0=pick(r,[2,3,5,7]);return q('simplify-root',f,{r:r0},`次の計算をしなさい。<div class="problem-expression" style="font-size:clamp(2rem,4vw,3.1rem);line-height:1.35;text-align:center;margin:26px 0 30px;font-weight:600">\\( ${tex(4*r0)}+${tex(9*r0)} \\)</div>`,`\\(5${tex(r0)}\\)`,['それぞれの根号の中から、できるだけ大きい「整数の2乗になる数（4, 9, 16, …）」を見つけよう。','平方数の部分と、それ以外の部分に分けて整理しよう。',`\\(${tex(4*r0)}=2${tex(r0)},\\ ${tex(9*r0)}=3${tex(r0)}\\) なので、同じ根号の係数を足して \\(5${tex(r0)}\\) です。`],VALUE(`5${tex(r0)}`,{lhs:[]}));}
    if(slot%10===5){const a=pick(r,[3,4,5]), b=pick(r,[2,3]), c=pick(r,[10,15,20]); const vals=[{t:String(a),square:a*a},{t:tex(c),square:c},{t:`${b}${tex(2)}`,square:2*b*b}]; vals.sort((x,y)=>x.square-y.square); return q('compare-three',f,{a,b,c},`\\( ${a},\\ ${tex(c)},\\ ${b}${tex(2)} \\) のうち、最も小さい数を答えなさい。`,`\\(${vals[0].t}\\)`,['小数に直さず、どの数も正であることを使おう。','正の数どうしは、2乗して大小を比べられるよ。','2乗を比べると最も小さいのは \\('+vals[0].t+'\\) です。'],VALUE(vals[0].t,{lhs:[],radical:!/^\d+\\sqrt/.test(vals[0].t)}));}
    if(slot%10===6){const m=pick(r,[2,3,4,5]), square=pick(r,[16,25,36,49]), nonSquare=pick(r,[2,3,5,6,7]);
      const items=[[`\\(${nonSquare}\\) の平方根は \\(${tex(nonSquare)}\\) だけである。`,false],[`\\(${tex(`(-${m})^2`)}=${m}\\) である。`,true],[`\\(${tex(square)}\\) は \\(\\pm${integerSqrt(square)}\\) に等しい。`,false],[`\\(${tex(nonSquare)}\\) は \\(${integerSqrt(nonSquare)+2}\\) より大きい。`,false]];
      const shown=labelChoices(items,orderRng(seed,slot)),good=shown.find(x=>x[2]);
      return q('sqrt-statement',f,{m,square,nonSquare},`次のア〜エで正しいものを1つ選び、その記号を入力しなさい。<br>${shown.map(x=>`${x[0]}　${x[1]}`).join('<br>')}`,good[0],['「平方根」と「正の平方根」を区別して考えよう。','\\(\\sqrt{a}\\) は、\\(a\\) の2つの平方根のうち正のほうを表します。',`正しいのは${good[0]}です。\\(\\sqrt{(-${m})^2}=\\sqrt{${m*m}}=${m}\\) です。なお、\\(${nonSquare}\\) の平方根は \\(\\pm${tex(nonSquare)}\\) の2つ、\\(${tex(square)}=${integerSqrt(square)}\\) です。また、\\(${integerSqrt(nonSquare)+2}=\\sqrt{${(integerSqrt(nonSquare)+2)**2}}\\) なので \\(${tex(nonSquare)}\\) は \\(${integerSqrt(nonSquare)+2}\\) より小さいです。`],CHOICE(good[0],shown.length));}
    if(slot%10===7){const k=pick(r,[12,18,20,24,45]);let n=1;while(!isSquare(k*n))n++;return q('min-n-integer',f,{k},`\\(${tex(`${k}n`)}\\) の値が整数となる自然数 \\(n\\) のうち、もっとも小さい値を答えなさい。`,String(n),['根号の中が整数の2乗（4, 9, 16, …）になるには、何をかければよいかを見よう。','\\('+k+'\\) を素因数分解して、同じ素数が2個ずつそろうようにしよう。',`\\(${k}\\times${n}=${k*n}=${integerSqrt(k*n)}^2\\) となり、整数の2乗になります。したがって、最小の \\(n\\) は \\(${n}\\) です。`],VALUE(String(n),{lhs:['n']}));}
    if(slot%10===8){const [a,b]=pick(r,[[5,11],[10,17],[13,20]]);const lo=integerSqrt(a)+1,hi=integerSqrt(b);const ans=[];for(let x=lo;x<=hi;x++)ans.push(x);return q('natural-between',f,{a,b},`\\(${tex(a)}\\lt n\\lt ${tex(b)}\\) となる自然数 \\(n\\) をすべて答えなさい。複数あるときは、半角コンマで区切りなさい。`,ans.join(','),['両端の根号がどの連続する整数の間にあるかを調べよう。','両端を平方数と比べ、入る自然数を1つずつ確かめよう。',`\\(${tex(a)}\\) と \\(${tex(b)}\\) の間に入る自然数は \\(${ans.join(', ')}\\) です。`],{mode:'set',answers:ans.map(String),opts:{lhs:['n']}});}
    const irrationalN=pick(r,[2,3,5,6,7]), square=pick(r,[4,9,16,25]), integer=pick(r,[2,4,5,7]);
    const items=[[`\\(${-integer}\\)`,false],[`\\(${tex(irrationalN)}\\)`,true],[`\\(${tex(square)}\\)`,false],['\\(0\\)',false],[`\\(\\dfrac{1}{${integer}}\\)`,false]];
    const shown=labelChoices(items,orderRng(seed,slot)),good=shown.find(x=>x[2]);
    return q('irrational',f,{irrationalN,square,integer},`次のア〜オのうち、無理数であるものを1つ選び、その記号を入力しなさい。<br>${shown.map(x=>`<span class="choice-opt">${x[0]}&nbsp;&nbsp;${x[1]}</span>`).join('')}`,good[0],['分数で表せる数が有理数です。','整数の2乗になる数（4, 9, 16, …）の平方根は整数になります。',`\\(${tex(irrationalN)}\\) は分数で表せない無理数です。したがって${good[0]}です。`],CHOICE(good[0],shown.length));
  }
  function makeSession(seed, ids, excludedFingerprints=[]){const forms=ids||[0,1,2,3,4,5,6,7,8,9],excluded=new Set(excludedFingerprints);return forms.map((slot,i)=>{let question;for(let retry=0;retry<50;retry++){question=make(slot,(seed+i*2654435761+retry*2246822519)>>>0);question.slot=slot%10;if(!excluded.has(question.fingerprint))return question;}throw new Error(`別数値問題を生成できません: ${slot}`);});}
  window.SquareRootsQuestions={COURSE_ID,RNG_VERSION,COVERAGE_REQUIRED_GROUPS,FORMS,makeSession,gradeAnswer};
})();

// ===== 採点（DOM に触らない。回帰テストからも呼ぶ） =====
// gradeAnswer(question, raws) → { status, kind, reason, message, studentLatex? }
//   status: correct / notReduced / negDenominator / wrong / unreadable / empty（empty・unreadable は採点しない）
//   kind  : correct / unfinished / notation / negDenominator / wrong / incomplete
// raws は欄の入力（文字列、または欄ごとの配列。このアプリは1欄）。
var SQUARE_ROOTS_MESSAGES = {
  empty: '答えを入力してから決定しよう。',
  choice: '答えの記号（ア、イ、…）をカタカナで1つだけ入力しよう。',
  surd: '√ がうまく入らなかったよ。消してから、√ はボタンで入れよう。',
  command: '使えない入力が入っているよ。数・√・分数のボタンで答えを入力しよう。',
  smallKana: '小さい文字になっているよ。大きいカタカナ1文字（ア、イ、…）で入力しよう。'
};
function squareRootsKindOf(status, kind) {
  if (kind) return kind;
  if (status === 'empty' || status === 'unreadable') return 'incomplete';
  return status; // correct / wrong / negDenominator
}
// 記号選択: 全角・半角カナ（ｱ）や \text{ア} を同じ文字にそろえてから GraderCore.gradeChoice で比べる
function squareRootsChoiceText(raw) {
  return String(raw == null ? '' : raw).normalize('NFKC')
    // 仮想キーボードの e・i は \exponentialE・\imaginaryI を入れるので、エ・イと読む
    .replace(/\\exponentialE(?![A-Za-z])/g, 'エ').replace(/\\imaginaryI(?![A-Za-z])/g, 'イ')
    .replace(/\\placeholder\{\}/g, '')
    .replace(/\\(?:text|textrm|mathrm|operatorname)\{([^{}]*)\}/g, '$1')
    .replace(/[\s\u3000]/g, '')
    // 画面の注意が「半角英数字で」なので、ローマ字1文字の a・i・u・e・o（大文字も）はア・イ・ウ・エ・オと読む
    .replace(/^[aiueo]$/i, c => SQUARE_ROOTS_ROMAJI[c.toLowerCase()]);
}
var SQUARE_ROOTS_ROMAJI = { a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ' };
function gradeAnswer(question, raws) {
  var raw = Array.isArray(raws) ? (raws[0] == null ? '' : String(raws[0])) : (raws == null ? '' : String(raws));
  var g = question && question.grading;
  if (!g) throw new Error('gradeAnswer: 問題に grading がありません');
  var r;
  if (g.mode === 'choice') {
    var text = squareRootsChoiceText(raw);
    if (/^[ァィゥェォッャュョヮヵヶ]$/.test(text)) {
      // 小さいカタカナ（ィ・ｨ）は、記号の打ちまちがいとして採点しない（消費しない）
      r = { status: 'unreadable', kind: 'incomplete', reason: 'smallKana', message: SQUARE_ROOTS_MESSAGES.smallKana };
    } else if (text !== '' && !/^[ァ-ヶA-Za-z]$/.test(text)) {
      // 数・式・ひらがな・2つ以上の記号は採点しない（消費しない）で、記号を1つ入れ直してもらう
      r = { status: 'unreadable', kind: 'incomplete', reason: 'choice', message: SQUARE_ROOTS_MESSAGES.choice };
    } else {
      r = GraderCore.gradeChoice(text, g.answer);
      r.studentText = text; // 画面に出す記号（\text{ｲ} → イ）
      if (r.status === 'empty') r.message = SQUARE_ROOTS_MESSAGES.empty;
    }
  } else {
    var spec = Object.assign({}, g.opts || {}, { mode: g.mode });
    if (g.mode === 'set') spec.answers = g.answers; else spec.answer = g.answer;
    r = NyushiCore.judge(raw, spec);
    // IME で「２√３」を一度に確定して欄が壊れた形（\surd が根号の中に入る）は、√ ボタンで入れ直してもらう
    if (r.status === 'unreadable' && /\\surd(?![A-Za-z])/.test(raw)) r = Object.assign({}, r, { message: SQUARE_ROOTS_MESSAGES.surd });
    // 部品の一言に「\text」などの LaTeX の命令名が入るときは、命令名を出さない一言にする
    else if (r.status === 'unreadable' && /\\/.test(r.message || '')) r = Object.assign({}, r, { message: SQUARE_ROOTS_MESSAGES.command });
  }
  return {
    status: r.status,
    kind: squareRootsKindOf(r.status, r.kind),
    reason: r.reason || '',
    message: r.message || '',
    studentLatex: r.studentLatex || '',
    studentText: r.studentText || ''
  };
}
