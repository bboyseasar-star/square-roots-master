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
    ['num.simplify_root','平方因数を整理する根号計算','H25 【1】'],
    ['num.compare','根号を含む数の大小','H24'],
    ['num.signed_power','平方根について正しい記述','H28/R3'],
    ['num.transfer','根号が整数となる最小の自然数','H30'],
    ['num.compare','2つの根号の間の自然数','R5'],
    ['num.classify','無理数の判定','R4']
  ];
  function fnv(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
  function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function pick(r,a){return a[Math.floor(r()*a.length)];}
  function integerSqrt(n){let x=0;while((x+1)*(x+1)<=n)x++;return x;}
  function isSquare(n){const x=integerSqrt(n);return x*x===n;}
  const tex = n => `\\sqrt{${n}}`;
  function working(id,p){
    if(id==='root-calc'){const c=integerSqrt(p.b/2);return `途中式：\\(\\sqrt{${p.b}}=\\sqrt{${c*c}\\times2}=${c}\\sqrt2\\)`;}
    if(id==='rationalize-surd'){return `途中式：\\(\\dfrac{${tex(p.a)}}{${tex(p.b)}}\\times\\dfrac{${tex(p.b)}}{${tex(p.b)}}\\) と置きます。`;}
    if(id==='natural-count'){return `途中式：候補を \\(m=1,2,3,\\ldots\\) と置き、\\(m^2\\times${p.b}\\) と \\(${p.k}^2\\) を比べます。`;}
    if(id==='nearest-natural'){const a=integerSqrt(p.n);return `途中式：中点との比較は、\\(4\\times${p.n}\\) と \\((2\\times${a}+1)^2\\) を比べて判断します。`;}
    if(id==='simplify-root'){return `途中式：\\(\\sqrt{${4*p.r}}=\\sqrt{4\\times${p.r}},\\quad \\sqrt{${9*p.r}}=\\sqrt{9\\times${p.r}}\\) と分けます。`;}
    if(id==='compare-three'){return '途中式：すべて正の数なので、2乗して大小を比べます。';}
    if(id==='sqrt-statement'){return '途中式：\\(\\sqrt{x^2}=|x|\\) を使い、各文を確かめます。';}
    if(id==='min-n-integer'){return `途中式：\\(${p.k}n\\) が完全平方数になるように、素因数の個数をそろえます。`;}
    if(id==='natural-between'){return `途中式：候補の自然数を \\(m\\) とし、\\(m^2\\) を \\(${p.a}\\) と \\(${p.b}\\) の間で1つずつ確かめます。`;}
    return '途中式：根号内が完全平方数かどうかを、\\(1^2,2^2,3^2,\\ldots\\) と照合します。';
  }
  const q = (id, form, params, prompt, answer, hints, aliases=[]) => ({
    templateId:id, formId:form[0], evidence:[form[2]], courseId:COURSE_ID, subskillTag:form[0],
    generatedParams:params, fingerprint:JSON.stringify([id,params]), prompt, answer,
    formPolicy:id==='root-calc'?'equivalent-value':id==='rationalize-surd'?'rationalized-simplest':'exact-value',
    hints:[hints[0],`${hints[1]}<br><strong>${working(id,params)}</strong>`,hints[2]], solution:hints[2], aliases
  });
  function make(slot, seed){
    const r=rng(fnv(`${seed}|${COURSE_ID}|${slot}|${RNG_VERSION}`)), f=FORMS[slot%FORMS.length];
    if(slot%10===0){ const a=pick(r,[2,3,4]), b=pick(r,[8,18,32]); const c=integerSqrt(b/2); return q('root-calc',f,{a,b},`次の計算をしなさい。<div class="problem-expression" style="font-size:clamp(2rem,4vw,3.1rem);line-height:1.35;text-align:center;margin:26px 0 30px;font-weight:600">\\( ${a}${tex(2)}+${tex(b)} \\)</div>`,`\\(${a+c}\\sqrt{2}\\)`,['根号の中を、平方数を使って分けられないか見よう。','根号を、ある数の2乗と残りの積に分けて整理しよう。','\\(\\sqrt{'+b+'}= '+c+'\\sqrt{2}\\) なので、同じ \\(\\sqrt{2}\\) の係数を足して \\('+ (a+c)+'\\sqrt{2}\\) です。'],[`${a+c}\\sqrt{2}`]); }
    if(slot%10===1){const b=pick(r,[2,3,5,7]), a=pick(r,[1,2,3].filter(x=>x!==b)); const d=a*b; return q('rationalize-surd',f,{a,b},`\\(\\dfrac{${tex(a)}}{${tex(b)}}\\) を、分母に根号がない形で表しなさい。`,`\\(\\dfrac{${tex(d)}}{${b}}\\)`,['分母の根号をなくすため、分母と分子に同じ根号をかけよう。','分子と分母に、分母にある根号をかけてから計算しよう。',`\\(\\dfrac{${tex(a)}}{${tex(b)}}\\times\\dfrac{${tex(b)}}{${tex(b)}}=\\dfrac{${tex(d)}}{${b}}\\) です。`],[`\\frac{\\sqrt{${d}}}{${b}}`,`\\frac{${tex(d)}}{${b}}`]);}
    if(slot%10===2){const k=pick(r,[4,5,6,7]), b=pick(r,[2,3,5]); let n=0;while((n+1)*(n+1)*b<k*k)n++;return q('natural-count',f,{k,b},`\\(\\dfrac{${k}}{${tex(b)}}\\) より小さい自然数は何個ありますか。自然数は \\(1\\) 以上です。`,String(n),['まず、その数がどの2つの連続する整数の間にあるか考えよう。','分母の根号を含む式は、両辺が正であることを確かめてから平方して比べよう。',`正の数なので平方して比べると、\\( ${n}<\\dfrac{${k}}{${tex(b)}}<${n+1}\\) です。\\(1\\) から \\(${n}\\) までの \\(${n}\\) 個です。`]);}
    if(slot%10===3){const n=pick(r,[10,20,45,50,80]); const a=integerSqrt(n), ans=4*n<(2*a+1)*(2*a+1)?a:a+1;return q('nearest-natural',f,{n},`\\(${tex(n)}\\) に最も近い自然数を答えなさい。`,String(ans),['近くにある2つの平方数を探そう。','2つの平方数の間で、どちらに近いかを平方数を使って比べよう。',`\\(${a}^2<${n}<${a+1}^2\\) なので、\\(${a}<${tex(n)}<${a+1}\\) です。距離を比べると最も近い自然数は \\(${ans}\\) です。`]);}
    if(slot%10===4){const r0=pick(r,[2,3,5,7]);return q('simplify-root',f,{r:r0},`次の計算をしなさい。<div class="problem-expression" style="font-size:clamp(2rem,4vw,3.1rem);line-height:1.35;text-align:center;margin:26px 0 30px;font-weight:600">\\( ${tex(4*r0)}+${tex(9*r0)} \\)</div>`,`\\(5${tex(r0)}\\)`,['それぞれの根号の中から、最大の平方因数を見つけよう。','平方数の部分と、それ以外の部分に分けて整理しよう。',`\\(${tex(4*r0)}=2${tex(r0)},\\ ${tex(9*r0)}=3${tex(r0)}\\) なので、同じ根号の係数を足して \\(5${tex(r0)}\\) です。`],[`5${tex(r0)}`]);}
    if(slot%10===5){const a=pick(r,[3,4,5]), b=pick(r,[2,3]), c=pick(r,[10,15,20]); const vals=[{t:String(a),square:a*a},{t:tex(c),square:c},{t:`${b}${tex(2)}`,square:2*b*b}]; vals.sort((x,y)=>x.square-y.square); return q('compare-three',f,{a,b,c},`\\( ${a},\\ ${tex(c)},\\ ${b}${tex(2)} \\) のうち、最も小さい数を答えなさい。`,vals[0].t,['小数に直さず、どの数も正であることを使おう。','正の数どうしは、2乗して大小を比べられるよ。','2乗を比べると最も小さいのは \\('+vals[0].t+'\\) です。'],[vals[0].t]);}
    if(slot%10===6){const m=pick(r,[2,3,4,5]), square=pick(r,[16,25,36,49]), nonSquare=pick(r,[2,3,5,6,7]);const opts=[['ア',`\\(${tex(nonSquare)}\\) の平方根は \\(${tex(nonSquare)}\\) だけである。`,false],['イ',`\\(${tex(`(-${m})^2`)}=${m}\\) である。`,true],['ウ',`\\(${tex(square)}\\) は \\(\\pm${integerSqrt(square)}\\) に等しい。`,false],['エ',`\\(${tex(nonSquare)}\\) は \\(${integerSqrt(nonSquare)+2}\\) より大きい。`,false]];const good=opts[1];return q('sqrt-statement',f,{m,square,nonSquare},`次のア〜エで正しいものを1つ選び、その記号を入力しなさい。<br>ア　${opts[0][1]}<br>イ　${opts[1][1]}<br>ウ　${opts[2][1]}<br>エ　${opts[3][1]}`,good[0],['「平方根」と「正の平方根」を区別して考えよう。','根号 \\(\\sqrt{\\phantom{x}}\\) は、0以上の主平方根を表します。',`正しいのはイです。\\(\\sqrt{(-${m})^2}=\\sqrt{${m*m}}=${m}\\) です。`],['イ','i']);}
    if(slot%10===7){const k=pick(r,[12,18,20,24,45]);let n=1;while(!isSquare(k*n))n++;return q('min-n-integer',f,{k},`\\(${tex(`${k}n`)}\\) の値が整数となる自然数 \\(n\\) のうち、もっとも小さい値を答えなさい。`,String(n),['根号の中を完全平方数にするには何が足りないかを見よう。','\\('+k+'\\) を素因数に分け、指数が偶数個になるようにしよう。',`\\(${k}\\times${n}\\) は完全平方数になります。したがって、最小の \\(n\\) は \\(${n}\\) です。`]);}
    if(slot%10===8){const [a,b]=pick(r,[[5,11],[10,17],[13,20]]);const lo=integerSqrt(a)+1,hi=integerSqrt(b);const ans=[];for(let x=lo;x<=hi;x++)ans.push(x);return q('natural-between',f,{a,b},`\\(${tex(a)}<n<${tex(b)}\\) となる自然数 \\(n\\) をすべて答えなさい。複数あるときは、半角コンマで区切りなさい。`,ans.join(','),['両端の根号がどの連続する整数の間にあるかを調べよう。','両端を平方数と比べ、入る自然数を1つずつ確かめよう。',`\\(${tex(a)}\\) と \\(${tex(b)}\\) の間に入る自然数は \\(${ans.join(', ')}\\) です。`],[ans.join('，'),ans.join('、')]);}
    const irrationalN=pick(r,[2,3,5,6,7]), square=pick(r,[4,9,16,25]), integer=pick(r,[2,4,5,7]);const opts=[['ア',String(-integer),false],['イ',tex(irrationalN),true],['ウ',tex(square),false],['エ','0',false],['オ',`\\dfrac{1}{${integer}}`,false]];return q('irrational',f,{irrationalN,square,integer},`次のア〜オのうち、無理数であるものを1つ選び、その記号を入力しなさい。<br>ア　\\(${-integer}\\)　イ　\\(${tex(irrationalN)}\\)　ウ　\\(${tex(square)}\\)　エ　\\(0\\)　オ　\\(\\dfrac{1}{${integer}}\\)`,`イ`,['分数で表せる数が有理数です。','完全平方数の平方根は整数になります。',`\\(${tex(irrationalN)}\\) は分数で表せない無理数です。したがってイです。`],['i']);
  }
  function makeSession(seed, ids, excludedFingerprints=[]){const forms=ids||[0,1,2,3,4,5,6,7,8,9],excluded=new Set(excludedFingerprints);return forms.map((slot,i)=>{let question;for(let retry=0;retry<50;retry++){question=make(slot,(seed+i*2654435761+retry*2246822519)>>>0);if(!excluded.has(question.fingerprint))return question;}throw new Error(`別数値問題を生成できません: ${slot}`);});}
  function clean(s){return String(s||'').replace(/\\left|\\right|\\,/g,'').replace(/\\[()]/g,'').replace(/\$/g,'').replace(/\\sqrt\{([^}]+)\}/g,'√$1').replace(/\\sqrt([0-9]+)/g,'√$1').replace(/\\dfrac|\\frac/g,'frac').replace(/[{}\\s]/g,'').replace(/，|、/g,',').toLowerCase();}
  function rawLatex(s){return String(s||'').replace(/√(\d+)/g,'\\sqrt{$1}').replace(/\\left|\\right/g,'').replace(/\\[()]/g,'').replace(/\$/g,'').replace(/\\dfrac/g,'\\frac').replace(/\\,|\\!|\\;|\\:/g,'').replace(/\\cdot|\\times/g,'').replace(/\s+/g,'');}
  function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1;}
  function parseSurdTerm(source){const s=rawLatex(source),m=s.match(/^([+-]?\d*)\\sqrt\{(\d+)\}$/);if(!m)return null;const coefficient=m[1]===''||m[1]==='+'?1:m[1]==='-'?-1:Number(m[1]),radicand=Number(m[2]);if(!Number.isInteger(coefficient)||radicand<=0)return null;return{coefficient,radicand};}
  function canonicalSurd(coefficient,radicand,denominator=1){if(!denominator)return null;let factor=1,remainder=radicand;for(let i=2;i*i<=remainder;i++){while(remainder%(i*i)===0){factor*=i;remainder/=i*i;}}let numerator=coefficient*factor,den=denominator;if(den<0){numerator=-numerator;den=-den;}const divisor=gcd(numerator,den);return{numerator:numerator/divisor,denominator:den/divisor,radicand:remainder};}
  function parseRationalSurd(source){const s=rawLatex(source);let coefficient,radicand,denominator=1,rawCoefficient,rawRadicand,rawDenominator;
    let m=s.match(/^\\frac\{([+-]?\d*\\sqrt\{\d+\})\}\{([+-]?\d+)\}$/);
    if(m){const term=parseSurdTerm(m[1]);if(!term)return null;coefficient=term.coefficient;radicand=term.radicand;denominator=Number(m[2]);}
    else if((m=s.match(/^\\frac\{([+-]?\d+)\}\{([+-]?\d+)\}(\\sqrt\{\d+\})$/))){const term=parseSurdTerm(m[3]);coefficient=Number(m[1])*term.coefficient;radicand=term.radicand;denominator=Number(m[2]);}
    else if((m=s.match(/^([+-]?\d*\\sqrt\{\d+\})\/([+-]?\d+)$/))){const term=parseSurdTerm(m[1]);if(!term)return null;coefficient=term.coefficient;radicand=term.radicand;denominator=Number(m[2]);}
    else if((m=s.match(/^([+-]?\d+)\/([+-]?\d+)(\\sqrt\{\d+\})$/))){const term=parseSurdTerm(m[3]);coefficient=Number(m[1])*term.coefficient;radicand=term.radicand;denominator=Number(m[2]);}
    else{const term=parseSurdTerm(s);if(!term)return null;coefficient=term.coefficient;radicand=term.radicand;}
    rawCoefficient=coefficient;rawRadicand=radicand;rawDenominator=denominator;const canonical=canonicalSurd(coefficient,radicand,denominator);if(!canonical)return null;let squarefree=true;for(let i=2;i*i<=rawRadicand;i++)if(rawRadicand%(i*i)===0){squarefree=false;break;}return{...canonical,simplest:squarefree&&rawDenominator>0&&gcd(rawCoefficient,rawDenominator)===1};}
  function sameSurd(a,b){return !!a&&!!b&&a.numerator===b.numerator&&a.denominator===b.denominator&&a.radicand===b.radicand;}
  function grade(question, input){const a=clean(input), expected=clean(question.answer), aliases=question.aliases.map(clean);if(a===expected||aliases.includes(a))return true;if(question.formPolicy==='equivalent-value')return sameSurd(parseRationalSurd(input),parseRationalSurd(question.answer));if(question.formPolicy==='rationalized-simplest'){const parsed=parseRationalSurd(input);return !!parsed&&parsed.simplest&&sameSurd(parsed,parseRationalSurd(question.answer));}return false;}
  window.SquareRootsQuestions={COURSE_ID,RNG_VERSION,COVERAGE_REQUIRED_GROUPS,FORMS,makeSession,grade,clean};
})();
