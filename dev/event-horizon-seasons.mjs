// Development-only local UI rehearsal. No real identity, server, score, or API writes.
// Vite's production entrypoints exclude this dev page and module.
const realFetch=window.fetch.bind(window);
window.fetch=async (input,options)=>{
  const url=String(input);
  if(url==='/api/event-horizon/config')return new Response(JSON.stringify({enabled:true,watchEnabled:false,seasons:{classic:'playable',halloween:'playable',thanksgiving:'playable',christmas:'playable'},clientId:'preview',version:'event-horizon-v11',dailyPrizes:{amounts:[250000,150000,100000,60000,40000],fullPilots:5}}),{headers:{'Content-Type':'application/json'}});
  if(url.startsWith('/api/event-horizon/'))return new Response(JSON.stringify({error:'Synthetic preview · no server connection'}),{status:503,headers:{'Content-Type':'application/json'}});
  return realFetch(input,options);
};
await import('../src/activities/event-horizon/game.mjs');
const {renderBoard,setRankedAvailable}=await import('../src/activities/event-horizon/leaderboard.mjs');
setRankedAvailable(false);
const scoreBoard={scope:'Synthetic preview server',verification:'Preview data · no scores written',entries:[{playerId:'preview-1',name:'Orbit pilot',score:82147,survival:138,rank:1}],self:null};
const failures={kind:'failures',scope:'Synthetic preview server',verification:'Preview data · no scores written',entries:[{playerId:'preview-1',name:'Orbit pilot',deaths:42,attempts:48,rank:1},{playerId:'preview-2',name:'Comet chaser',deaths:31,attempts:39,rank:2}],self:null};
renderBoard(scoreBoard);
document.getElementById('board-failures').addEventListener('click',()=>renderBoard(failures));
document.getElementById('board-scores').addEventListener('click',()=>renderBoard(scoreBoard));

const fly=document.createElement('button');fly.textContent='Preview casual flight';fly.addEventListener('click',()=>window.__eventHorizonDev.fly());document.querySelector('.actions').append(fly);

const averages={kind:'averages',scope:'Synthetic preview server',verification:'Preview data · no scores written',entries:[{playerId:'preview-2',name:'Comet chaser',averageScore:23567.8974358974,totalScore:919148,attempts:39,rank:1},{playerId:'preview-1',name:'Orbit pilot',averageScore:17342.5,totalScore:832440,attempts:48,rank:2}],self:null};
document.getElementById('board-averages').addEventListener('click',()=>renderBoard(averages));

const combos={kind:'combos',scope:'Synthetic preview server',verification:'Preview data · no scores written',entries:[{playerId:'preview-1',name:'Orbit pilot',bestCombo:37,attempts:48,rank:1},{playerId:'preview-2',name:'Comet chaser',bestCombo:21,attempts:39,rank:2}],self:null};
const daily={kind:'daily',challengeDate:'2026-11-06',pilots:2,scope:'Daily Challenge · 2026-11-06',verification:'Same seed for everyone in this server · resets 00:00 UTC',entries:[{playerId:'preview-2',name:'Comet chaser',score:41230,survival:121,maxCombo:18,rank:1},{playerId:'preview-1',name:'Orbit pilot',score:30987,survival:97,maxCombo:9,rank:2}],self:null};
document.getElementById('board-combos').addEventListener('click',()=>renderBoard(combos));
document.getElementById('board-daily').addEventListener('click',()=>renderBoard(daily));
