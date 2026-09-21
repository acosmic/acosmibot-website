import { avatarSource } from './avatar.mjs';

export function renderViewers(container, message, labelText='Watching your flight') {
  const label=document.createElement('span');label.className='viewer-label';
  label.textContent=`${message.count} watching`;
  const roster=document.createElement('ul');roster.className='viewer-roster';
  roster.setAttribute('aria-label',labelText);roster.tabIndex=0;
  for(const viewer of (message.viewers||[]).slice(0,20)){
    const item=document.createElement('li'),name=document.createElement('span');
    const fallback=document.createElement('span');fallback.className='viewer-avatar';
    fallback.textContent=Array.from(viewer.name||'?')[0];fallback.setAttribute('aria-hidden','true');
    const source=avatarSource(viewer);
    if(source){
      const avatar=document.createElement('img');avatar.src=source;avatar.alt='';avatar.width=22;avatar.height=22;
      avatar.addEventListener('error',()=>avatar.replaceWith(fallback),{once:true});item.append(avatar);
    }else item.append(fallback);
    name.className='viewer-name';name.textContent=viewer.name||'Viewer';name.title=name.textContent;
    item.append(name);roster.append(item);
  }
  container.replaceChildren(label,roster);
}
