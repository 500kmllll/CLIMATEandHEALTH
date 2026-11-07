export const sceneTimes=Object.freeze(['07:00','10:30','12:00','13:00','14:00','18:30','20:30','22:00','02:00','07:00']);
export const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function newDay(){return {index:0,choices:[],B:0,Bwork:null,H:0,shifted:false,P:0,J:0,E:0,L:0,D:0,water:0,coolPlace:false,walk:true,ac:false,nightCost:0,sleepFirst:0,sleepSecond:0,morningRest:false};}
export function question(s){
  const qs=[
    {text:'A heat alert is in effect today. Midday is also the busiest time for orders.',up:'Keep the usual midday delivery schedule',down:'Move an hour of deliveries to the morning',scene:'residential'},
    {text:'The shortcut has no shade. The shaded route takes longer.',up:'Take the shortcut',down:'Take the shaded route',scene:'bridge'},
    {text:s.shifted?'You planned to avoid midday deliveries, but orders keep coming in.':'Orders keep coming in. There is no rider rest stop nearby.',up:s.shifted?'Take orders for half an hour after all':'Keep taking orders',down:s.shifted?'Rest as planned':'Stop taking orders and rest',scene:'flyover'},
    {text:'You have picked up your lunch. A cooler place to eat is a little farther away.',up:'Eat nearby',down:'Find somewhere cooler to eat',scene:'street'},
    {text:'You have run out of water. The free refill point is off your delivery route.',up:'Buy water in a shop',down:'Take a detour for free water',scene:'shop'},
    {text:'You have not met today’s target yet, and another order has come in.',up:'Work for one more hour',down:'Finish work as planned',scene:'tunnel'},
    {text:'You had planned to go for a walk. It is still hot outside, and you feel tired.',up:'Go for a walk as planned',down:'Skip the walk and rest at home',scene:'home'},
    {text:'The room is still hot and stuffy. Air conditioning means a higher electricity bill.',up:'Leave the air conditioning off for now',down:'Sleep with the air conditioning on',scene:'bed'},
    {text:s.ac?'The room is fairly cool. You wake briefly and check the time.':'The heat wakes you. You have had some water, but the room is still hot and stuffy.',up:s.ac?'Raise the temperature setting one step and go back to sleep':'Have some water and leave the air conditioning off',down:s.ac?'Keep the current setting and go back to sleep':'Have some water and turn the air conditioning on',scene:s.ac?'bed':'nightDrink'},
    {text:'Another night has passed. A new day of orders is about to begin.',up:'Keep the usual morning delivery schedule',down:'Rest for three hours first',scene:'morning'}
  ];
  return qs[s.index];
}
export function choose(s,choice){
  if(s.index>9)throw new Error('The day is complete');
  const i=s.index,up=choice===0;
  const dh=[[1,-1],[2,-1],[2,-1],[1,-1],[-1,1],[2,0],[1,-1],[2,-2],[1,-2],[1,0]][i][choice];
  s.H=clamp(s.H+dh,0,10);
  switch(i){
    case 0:s.shifted=!up;s.B+=up?12:4;break;
    case 1:s.B+=up?18:6;if(!up)s.D+=15;break;
    case 2:s.B+=up?24:4;if(s.shifted){if(up)s.J=30;}else if(!up)s.P=30;s.coolPlace=!up;break;
    case 3:s.B+=up?10:-6;if(!up&&!s.coolPlace)s.L=15;if(!up)s.coolPlace=true;break;
    case 4:s.B+=up?6:3;if(up)s.water=4;else s.D+=15;break;
    case 5:if(up){s.B+=18;s.E=60;}s.B=clamp(s.B,0,100);s.Bwork=s.B;break;
    case 6:s.walk=up;s.B+=up?8:-4;break;
    case 7:s.ac=!up;s.sleepFirst=up?210:230;s.nightCost+=up?0:2;break;
    case 8:if(s.ac){s.sleepSecond=up?210:225;s.nightCost+=up?2:3;}else{s.sleepSecond=up?180:225;if(!up){s.ac=true;s.nightCost+=3;}}break;
    case 9:s.morningRest=!up;break;
  }
  s.B=clamp(s.B,0,100);s.choices.push(choice);s.index++;
  return s;
}
export function account(s){
  const B=s.Bwork??s.B,f=B<=40?.90:B<=70?.86:.82;
  const W=480-s.P+s.J+s.E-s.L;
  const orders=Math.floor((W-s.D)*f/15);
  const sleep=s.sleepFirst+s.sleepSecond;
  return {W,orders,f,missing:32-orders,change:W-480,freeLost:s.E,cost:s.water+s.nightCost,sleep,sleepLost:480-sleep,morningOrders:s.morningRest?0:sleep>=420?10:9};
}
export function resultScene(index,choice,s){
  const up=choice===0;
  return [
    {scene:'residential',motion:'ride'},
    {scene:up?'bridge':'tunnel',motion:'ride'},
    {scene:up?'flyover':'roadRest',motion:up?'ride':'rest'},
    {scene:up?'lunchNearby':'lunchShade',motion:'lunch'},
    {scene:'drink',motion:'drink',detour:!up},
    {scene:up?'street':'home',motion:up?'ride':'rest',overtime:up},
    {scene:up?'walk':'home',motion:up?'walk':'rest'},
    {scene:up?'bedHot':'bed',motion:up?'sleep':'cool'},
    {scene:s.ac?'bed':'bedHot',motion:s.ac?'cool':'sleep'},
    {scene:up?'residential':'morning',motion:up?'ride':'rest'}
  ][index];
}
export const isNight=key=>['home','bed','bedHot','walk','nightDrink'].includes(key);
export function schedule(s){
  // Minute zero is 07:00. Each minute has exactly one category.
  const planned=new Uint8Array(1440),actual=new Uint8Array(1440),awake=new Uint8Array(1440),lost=new Uint8Array(1440);
  // 0 free time, 1 work and daily tasks, 2 sleep.
  const fill=(a,start,end,v)=>a.fill(v,start,end);
  for(const [a,b]of [[0,60],[120,360],[360,390],[390,510],[570,690],[1380,1440]])fill(planned,a,b,1);
  fill(planned,900,1380,2);actual.set(planned);
  if(s.shifted){fill(actual,300,360,0);fill(actual,60,120,1);}
  if(s.shifted&&s.J)fill(actual,300,330,1);
  if(!s.shifted&&s.P)fill(actual,300,330,0);
  if(s.L)fill(actual,390,405,1); // Daily tasks replace deliveries: same ring colour, different account.
  if(s.E)fill(actual,690,750,1);
  if(!s.walk)fill(lost,810,840,1);
  const a1=240-s.sleepFirst,a2=240-s.sleepSecond;
  fill(actual,900,900+a1,0);fill(awake,900,900+a1,1);
  fill(actual,1140,1140+a2,0);fill(awake,1140,1140+a2,1);
  for(let i=0;i<1440;i++)if(planned[i]!==actual[i]&&planned[i]!==0)lost[i]=1;
  return {planned,actual,awake,lost};
}
export function observations(s){
  const a=[];
  if(s.shifted)a.push('Work moved into what was free time in the morning.');
  if(!s.walk)a.push('The planned walk was cancelled.');
  return a.slice(0,2);
}
