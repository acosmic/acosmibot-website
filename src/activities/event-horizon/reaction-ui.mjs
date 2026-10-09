// The spectator reaction controls: quick buttons, searchable picker, float layer.
// Shared by the Activity and the local preview so both exercise the same code.
import { emojiNode, floatEmoji, loadUsage, quickEmojis, reactionForView, recordUse, saveUsage, searchEmojis, wireEmoji } from './reactions.mjs';

export function createReactionUI({$, storage, fetchCatalog, send, now = () => performance.now()}) {
  let usage=loadUsage(storage), catalog={servers:[],at:-Infinity,renew:0}, loading=false, lastSent=0, available=false;
  let visible=(()=>{try{return storage.getItem('eh-reactions')!=='off';}catch{return true;}})();
  function sendReaction(emoji){
    const time=now();
    if(!available||time-lastSent<180||!send(wireEmoji(emoji)))return;
    lastSent=time;usage=recordUse(usage,emoji);saveUsage(storage,usage);
  }
  function emojiButton(emoji){
    const button=document.createElement('button');button.type='button';button.className='emoji-button';
    const label=emoji.id?`:${emoji.name}:`:emoji.name;button.title=label;button.setAttribute('aria-label',`Send ${label}`);
    const content=emojiNode(emoji);if(content.tagName==='IMG'){content.loading='lazy';content.alt='';}
    button.append(content);button.addEventListener('click',()=>sendReaction(emoji));return button;
  }
  // Quick buttons only reorder between bursts of use, never under a tapping finger.
  function renderQuick(){$('reaction-quick').replaceChildren(...quickEmojis(usage,catalog.servers).map(emojiButton));}
  function renderPicker(){
    const sections=searchEmojis(catalog.servers,$('emoji-search').value);let budget=400;
    const nodes=sections.flatMap(section=>{
      const title=document.createElement('h3');title.textContent=section.title;
      const group=document.createElement('div');group.className='emoji-group';
      group.append(...section.emojis.slice(0,Math.max(0,budget)).map(emojiButton));budget-=section.emojis.length;
      return group.childElementCount?[title,group]:[];
    });
    if(!nodes.length){const empty=document.createElement('p');empty.textContent='No emojis match that search.';nodes.push(empty);}
    $('emoji-grid').replaceChildren(...nodes);
  }
  async function refresh(){
    if(loading||now()-catalog.at<catalog.renew)return;
    loading=true;if(!catalog.servers.length)$('emoji-status').textContent='Loading server emojis…';
    try{
      const data=await fetchCatalog();
      catalog={servers:Array.isArray(data?.servers)?data.servers:[],at:now(),renew:(Number(data?.renewAfter)||1800)*1000};
      $('emoji-status').textContent=catalog.servers.length?'':'No server emojis found. Standard emojis are available.';
    }catch{
      catalog={...catalog,at:now(),renew:30000};
      if(!catalog.servers.length)$('emoji-status').textContent='Server emojis could not load. Standard emojis are available.';
    }finally{loading=false;renderQuick();if(!$('emoji-picker').hidden)renderPicker();}
  }
  function closePicker(){
    if($('emoji-picker').hidden)return;
    $('emoji-picker').hidden=true;$('emoji-open').setAttribute('aria-expanded','false');renderQuick();
  }
  function openPicker(){
    $('emoji-picker').hidden=false;$('emoji-open').setAttribute('aria-expanded','true');
    $('emoji-search').value='';renderPicker();void refresh();$('emoji-search').focus({preventScroll:true});
  }
  function updateToggle(){
    $('reactions').textContent=`Spectator emojis ${visible?'on':'off'}`;$('reactions').setAttribute('aria-pressed',String(visible));
    if(!visible)$('reaction-layer').replaceChildren();
  }
  $('emoji-open').addEventListener('click',()=>$('emoji-picker').hidden?openPicker():closePicker());
  $('emoji-search').addEventListener('input',renderPicker);
  $('emoji-picker').addEventListener('keydown',e=>{if(e.code==='Escape'){e.stopPropagation();closePicker();$('emoji-open').focus({preventScroll:true});}});
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#emoji-picker, #emoji-open'))closePicker();});
  $('reactions').addEventListener('click',()=>{visible=!visible;try{storage.setItem('eh-reactions',visible?'on':'off');}catch{/* per-session only */}updateToggle();});
  updateToggle();
  return {
    refresh,
    // The bar is offered only to a spectator whose relay supports reactions.
    setAvailable(next){
      if(available!==next){available=next;$('reaction-bar').hidden=!next;if(next)renderQuick();}
      if(!next)closePicker();
    },
    show(message){const emoji=reactionForView(message);if(emoji&&visible)floatEmoji($('reaction-layer'),emoji);},
    clear(){$('reaction-layer').replaceChildren();},
  };
}
