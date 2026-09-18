// Live viewing is optional presentation. It never mutates the ranked replay.
export class LiveClient {
  constructor({api, onMessage, onStatus, socketFactory = url => new WebSocket(url), origin = location.origin}) {
    Object.assign(this, {api,onMessage,onStatus,socketFactory,origin});
    this.enabled=false;this.runId=null;this.socket=null;this.generation=0;this.seq=0;this.target=null;this.retry=0;
    this.objectIds=new WeakMap();this.nextObjectId=0;
  }
  start() {this.enabled=true;void this.connect();}
  stop() {
    this.enabled=false;++this.generation;clearTimeout(this.retryTimer);clearTimeout(this.renewTimer);
    clearTimeout(this.handshakeTimer);
    this.socket?.close();this.socket=null;
  }
  send(message) {
    if (!this.authenticated || this.socket?.readyState !== 1 || this.socket.bufferedAmount > 65536) return false;
    this.socket.send(JSON.stringify(message));return true;
  }
  async credential(generation) {
    const result = await this.api('/live-ticket',{runId:this.runId});
    if (generation !== this.generation || !this.enabled) return null;
    if (result.protocol !== 1 || result.path !== '/event-horizon-live') throw Error('Live watching needs an updated Activity.');
    return result;
  }
  async connect() {
    if (!this.enabled) return;
    const generation=++this.generation;this.authenticated=false;this.onStatus('connecting');
    clearTimeout(this.renewTimer);clearTimeout(this.retryTimer);this.socket?.close();
    clearTimeout(this.handshakeTimer);
    try {
      const credentials=await this.credential(generation);if(!credentials)return;
      const url=new URL(credentials.path,this.origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';
      const socket=this.socket=this.socketFactory(url.href);
      this.handshakeTimer=setTimeout(()=>{if(generation===this.generation)socket.close();},10000);
      socket.addEventListener('open',()=>{if(generation===this.generation)socket.send(JSON.stringify({type:'authenticate',ticket:credentials.ticket}));});
      socket.addEventListener('message',event=>{
        if(generation!==this.generation)return;
        try {
          const message=JSON.parse(event.data);
          if(message.type==='authenticated'){
            clearTimeout(this.handshakeTimer);
            const firstAuthentication=!this.authenticated;
            this.authenticated=true;this.retry=0;this.onStatus('connected');
            if(firstAuthentication&&this.target)this.send({type:'watch',runId:this.target});
            clearTimeout(this.renewTimer);this.renewTimer=setTimeout(()=>void this.renew(generation),40000);
          }else {
            if(message.type==='error'&&['unavailable','full'].includes(message.code))this.target=null;
            this.onMessage(message);
          }
        } catch {socket.close();}
      });
      socket.addEventListener('close',event=>{
        if(generation!==this.generation)return;
        this.authenticated=false;clearTimeout(this.renewTimer);
        clearTimeout(this.handshakeTimer);
        if(event.code===4001){this.stop();this.onStatus('replaced');return;}
        this.scheduleReconnect(generation);
      });
      socket.addEventListener('error',()=>socket.close());
    }catch(error){if(generation===this.generation)this.scheduleReconnect(generation,error);}
  }
  scheduleReconnect(generation,error) {
    if(!this.enabled||generation!==this.generation)return;
    this.onStatus('reconnecting');
    if(error?.status===401||error?.status===403||error?.code==='watch_disabled'){
      this.stop();this.onStatus('unavailable');return;
    }
    clearTimeout(this.retryTimer);
    this.retryTimer=setTimeout(()=>void this.connect(),Math.min(15000,2000*2**this.retry++));
  }
  async renew(generation) {
    try {
      const credentials=await this.credential(generation);
      if(credentials&&this.socket?.readyState===1)this.socket.send(JSON.stringify({type:'authenticate',ticket:credentials.ticket}));
    }catch{if(generation===this.generation)this.socket?.close();}
  }
  setRun(runId) {
    if(this.runId===runId)return;
    this.runId=runId;this.seq=0;this.objectIds=new WeakMap();this.nextObjectId=0;if(this.enabled)void this.connect();
  }
  watch(runId) {this.target=runId;return this.send({type:'watch',runId});}
  unwatch() {this.target=null;this.send({type:'unwatch'});}
  snapshot(state,status,input) {
    if(!this.authenticated||this.socket?.readyState!==1)return;
    const identify=object=>{
      if(object.id)return object;
      if(!this.objectIds.has(object))this.objectIds.set(object,`live-${this.nextObjectId++}`);
      return {...object,id:this.objectIds.get(object)};
    };
    // Simulation events are local sounds/effects, not persistent state.
    this.send({type:'snapshot',seq:this.seq++,state:{...state,objects:state.objects.map(identify),crossers:state.crossers.map(identify),events:[]},status,input});
  }
}

export function snapshotForView(message) {
  const s=message?.state;
  if(message?.type!=='snapshot'||!s||!Number.isFinite(s.tick)||!Array.isArray(s.objects)||!Array.isArray(s.crossers)||!Array.isArray(s.specials))return null;
  return structuredClone(s);
}
