const ART='https://acosmibot.com/activities/event-horizon/assets/key-art.png';
export function activityFor(mode, startedAt) {
  const state={playing:'Flying a ranked run',ready:'Preparing a ranked flight',paused:'Flight paused',
    'casual-playing':'Flying for fun','casual-ready':'Preparing a flight','casual-dead':'Finished a casual flight',
    watching:'Watching a flight',dead:'Finished a ranked flight',intro:'In the lobby'}[mode]||'In the lobby';
  return {type:0,details:'Event Horizon',state,
    assets:{large_image:ART,large_text:'Acosmibot: Event Horizon'},
    ...(['playing','casual-playing'].includes(mode)&&startedAt?{timestamps:{start:startedAt}}:{})};
}

// Serialize and coalesce changes. Presence failures never affect the game.
export class Presence {
  constructor(sdk){this.sdk=sdk;this.pending=null;this.busy=false;this.last='';this.lastSent=0;}
  update(mode,startedAt){
    const activity=activityFor(mode,startedAt),key=JSON.stringify(activity);
    if(key===this.last)return;
    this.pending={activity,key};void this.flush();
  }
  async flush(){
    if(this.busy||!this.pending)return;
    this.busy=true;
    const wait=Math.max(0,15000-(Date.now()-this.lastSent));
    if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    const next=this.pending;this.pending=null;
    try{await this.sdk.commands.setActivity({activity:next.activity});this.last=next.key;}catch{}
    this.lastSent=Date.now();this.busy=false;if(this.pending)void this.flush();
  }
}
