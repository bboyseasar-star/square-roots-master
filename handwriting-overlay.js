(() => {
  'use strict';
  const protectedSelector='button,math-field,input,textarea,select,a,[role="button"],label';
  let canvas,ctx,bar,penButton,eraserButton,clearButton,available=false,tool=null,activePointer=null,last=null,hasMarks=false;
  function ensure(){
    if(canvas)return;
    canvas=document.createElement('canvas');canvas.id='handwriting-canvas';canvas.className='handwriting-canvas';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
    ctx=canvas.getContext('2d');resize();
    document.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);window.addEventListener('resize',resize);
  }
  function mount(target){
    ensure();if(bar&&bar.isConnected)return;
    bar=document.createElement('div');bar.className='handwriting-tools';bar.setAttribute('aria-label','手書き操作');
    bar.innerHTML='<button type="button" class="handwriting-button pen-button" aria-pressed="false">✏️ 書く</button><button type="button" class="handwriting-button eraser-button" aria-pressed="false" disabled>🧽 消す</button><button type="button" class="handwriting-button clear-button" disabled>全消し</button>';
    target.append(bar);penButton=bar.querySelector('.pen-button');eraserButton=bar.querySelector('.eraser-button');clearButton=bar.querySelector('.clear-button');
    penButton.onclick=()=>setTool(tool==='pen'?null:'pen');eraserButton.onclick=()=>hasMarks&&setTool(tool==='eraser'?null:'eraser');clearButton.onclick=clear;update();
  }
  function resize(){if(!canvas||!ctx)return;const dpr=window.devicePixelRatio||1,w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(canvas.width===w&&canvas.height===h)return;let old=null;if(hasMarks&&canvas.width){old=document.createElement('canvas');old.width=canvas.width;old.height=canvas.height;old.getContext('2d').drawImage(canvas,0,0)}canvas.width=w;canvas.height=h;ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';if(old)ctx.drawImage(old,0,0,old.width,old.height,0,0,w,h);ctx.setTransform(dpr,0,0,dpr,0,0);applyTool()}
  function applyTool(){if(!ctx)return;ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';ctx.lineWidth=tool==='eraser'?24:3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#312e81';ctx.fillStyle='#312e81'}
  function setTool(next){tool=available?next:null;activePointer=null;last=null;canvas.classList.toggle('is-active',!!tool);applyTool();update()}
  function update(){if(!bar)return;bar.hidden=!available;penButton.setAttribute('aria-pressed',String(tool==='pen'));eraserButton.setAttribute('aria-pressed',String(tool==='eraser'));penButton.classList.toggle('is-active',tool==='pen');eraserButton.classList.toggle('is-active',tool==='eraser');eraserButton.disabled=!hasMarks;clearButton.disabled=!hasMarks}
  function isProtected(t){return !!t?.closest?.(protectedSelector)}
  function down(e){if(!available||!tool||e.button!==0||isProtected(e.target))return;activePointer=e.pointerId;last={x:e.clientX,y:e.clientY};applyTool();ctx.beginPath();ctx.arc(last.x,last.y,(tool==='eraser'?24:3)/2,0,Math.PI*2);ctx.fill();hasMarks=true;update();e.preventDefault()}
  function move(e){if(e.pointerId!==activePointer||!last)return;if(isProtected(e.target)){end(e);return}const p={x:e.clientX,y:e.clientY};ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;hasMarks=true;e.preventDefault()}
  function end(e){if(activePointer===e.pointerId){activePointer=null;last=null}}
  function clear(){if(!ctx)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,canvas.width,canvas.height);ctx.restore();hasMarks=false;setTool(null)}
  window.SquareRootsHandwriting={mount,setAvailable(v){ensure();available=!!v;if(!available)setTool(null);update()},clear,reset(v=false){clear();available=!!v;update()},inkPixels(){if(!ctx)return 0;const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n}};
})();
