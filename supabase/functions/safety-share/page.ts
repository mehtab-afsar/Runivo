/** The public safety-share page (PRD R2). Pure so it can be unit-tested. */

export interface ShareView {
  username: string;
  sport: string;
  status: 'live' | 'no_signal' | 'finished';
  lat: number | null;
  lng: number | null;
  position_at: string | null;
  distance_m: number | null;
  elapsed_sec: number | null;
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const VERB: Record<string, string> = { run: 'running', trail_run: 'trail running', trail: 'trail running', walk: 'walking', hike: 'hiking', cycle: 'riding' };

export function statusLine(v: ShareView): string {
  if (v.status === 'finished') return `${v.username} has finished.`;
  if (v.status === 'no_signal') return `${v.username} is ${VERB[v.sport] ?? 'out'}. Waiting for their next position…`;
  return `${v.username} is ${VERB[v.sport] ?? 'out'} now.`;
}

/** The whole page. It polls `jsonUrl` every 15 s and moves the marker. */
export function renderPage(v: ShareView | null, jsonUrl: string): string {
  const title = v ? `${esc(v.username)} · live on Runivo` : 'Link expired · Runivo';
  const body = v
    ? `<div id="map"></div>
<div class="card"><div id="status">${esc(statusLine(v))}</div><div id="meta" class="meta"></div>
<div class="note">Shared from Runivo for safety. The location stops updating when the activity ends.</div></div>`
    : `<div class="card"><div id="status">This link has expired or was never valid.</div>
<div class="note">Safety links stop working 12 hours after they start.</div></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body{margin:0;height:100%;font-family:-apple-system,system-ui,sans-serif;background:#f6f5f2;color:#141414}
#map{position:absolute;inset:0 0 140px 0}
.card{position:absolute;left:0;right:0;bottom:0;min-height:140px;box-sizing:border-box;padding:16px 18px;background:#fff;border-radius:18px 18px 0 0;box-shadow:0 -4px 16px rgba(0,0,0,.08)}
#status{font-weight:600;font-size:17px}.meta{margin-top:6px;color:#555;font-size:14px}.note{margin-top:10px;color:#8a8a8a;font-size:12px}
</style></head><body>${body}
${v ? `<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var J=${JSON.stringify(jsonUrl)};var map=L.map('map',{zoomControl:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var mk=null,first=true;map.setView([20,0],2);
function fmt(s){s=Math.max(0,Math.round(s||0));var h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(r).padStart(2,'0')}
function ago(t){if(!t)return'';var s=Math.round((Date.now()-new Date(t).getTime())/1000);return s<60?s+' s ago':Math.round(s/60)+' min ago'}
function draw(v){if(!v){document.getElementById('status').textContent='This link has expired.';return}
document.getElementById('status').textContent=v.line;
document.getElementById('meta').textContent=[(v.distance_m!=null?(v.distance_m/1000).toFixed(2)+' km':''),(v.elapsed_sec!=null?fmt(v.elapsed_sec):''),(v.position_at?'updated '+ago(v.position_at):'')].filter(Boolean).join(' · ');
if(v.lat!=null&&v.lng!=null){var p=[v.lat,v.lng];if(!mk)mk=L.circleMarker(p,{radius:9,color:'#fff',weight:3,fillColor:'#FF4518',fillOpacity:1}).addTo(map);else mk.setLatLng(p);if(first){map.setView(p,16);first=false}else map.panTo(p)}}
function tick(){fetch(J,{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(draw).catch(function(){})}
draw(${JSON.stringify(v ? { ...v, line: statusLine(v) } : null).replace(/</g, '\\u003c')});setInterval(tick,15000);
</script>` : ''}</body></html>`;
}
