(() => {
  'use strict';
  const handwriting=window.SquareRootsHandwriting;
  function enhanceHints(root){
    new MutationObserver(()=>{[...root.children].forEach((el,i)=>{el.classList.add('hint-step');if(!el.querySelector('.hint-step-badge')){const badge=document.createElement('span');badge.className='hint-step-badge';badge.textContent=String(i+1);el.prepend(badge)}});window.MathJax?.typesetPromise?.([root]).catch(()=>{});}).observe(root,{childList:true});
  }
  function arrange(){
    const problem=document.querySelector('.problem');
    if(!problem){handwriting?.reset(false);return}
    if(problem.dataset.referenceUi){
      const supportCard=problem.querySelector(':scope > .support-card');
      [...problem.children].filter(node=>node.matches?.('.feedback, #next')).forEach(node=>supportCard?.append(node));
      return;
    }
    const prompt=problem.querySelector('.prompt'),input=problem.querySelector('.input-wrap'),hintBox=problem.querySelector('#hintbox'),hintButton=problem.querySelector('#hint');
    if(!prompt||!input||!hintBox||!hintButton)return;
    problem.dataset.referenceUi='true';problem.classList.add('work-layout');
    const questionCard=document.createElement('article');questionCard.className='question-card';
    const support=document.createElement('aside');support.className='support-card';
    const supportTitle=document.createElement('h3');supportTitle.textContent='ヒント・解説';
    [...problem.children].forEach(node=>questionCard.append(node));
    hintButton.classList.add('secondary','hint-button');support.append(supportTitle,hintButton,hintBox);
    problem.append(questionCard,support);enhanceHints(hintBox);
    let mount=document.querySelector('#handwriting-fixed-mount');if(!mount){mount=document.createElement('div');mount.id='handwriting-fixed-mount';document.body.append(mount);handwriting?.mount(mount)}
    handwriting?.reset(true);
  }
  new MutationObserver(arrange).observe(document.querySelector('#app'),{childList:true,subtree:true});arrange();
})();
