/* CONAP | Informes individuales de monitoreo. No modifica el CSV. */
(function (global) {
  'use strict';
  const base = new URL('../boletas/incendios_forestales/', document.currentScript.src);
  const asset = new URL('jszip.min.js', document.currentScript.src);
  const template = new URL('plantilla_informe_individual_incendios.docx', base);
  const services = ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer','https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'];
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const val = (r,k) => String(r[k] ?? '').trim();
  const show = s => s || 'Sin dato (campo vacío)';
  const name = r => val(r,'__guarda') || val(r,'Nombre del guardarrecursos');
  const safe = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,100) || 'Sin_dato';
  const xml = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function dateKey(s) {
    let m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/), y,mo,d;
    if(m){[,mo,d,y]=m;} else {m=String(s||'').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return '';[,y,mo,d]=m;}
    const dt=new Date(Date.UTC(+y,+mo-1,+d));
    return dt.getUTCFullYear()===+y && dt.getUTCMonth()===+mo-1 && dt.getUTCDate()===+d ? dt.toISOString().slice(0,10):'';
  }
  function coords(r){const a=val(r,'Y'),b=val(r,'X'),lat=Number(a.replace(',','.')),lon=Number(b.replace(',','.'));return a&&b&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=13.5&&lat<=18.2&&lon>=-92.5&&lon<=-88 ? {lat,lon}:null;}
  function fields(r,map){
    const get=k=>show(val(r,k)), date=s=>{const d=dateKey(s);return d?d.split('-').reverse().join('/'):show(s);}, num=k=>{const s=val(r,k),n=Number(s.replace(',','.'));return s&&Number.isFinite(n)&&n>=0?n:null;}, fmt=n=>n.toLocaleString('es-GT',{maximumFractionDigits:8}), ha=k=>num(k)!==null?fmt(num(k))+' ha':get(k), stamp=k=>date(val(r,'Fecha '+k))+' · '+get('Hora '+k), time=k=>{const d=dateKey(val(r,'Fecha '+k)),h=val(r,'Hora '+k);return d&&/^([01]\d|2[0-3]):[0-5]\d$/.test(h)?Date.parse(d+'T'+h+':00Z'):null;};
    const a=time('aviso'),t=time('llegada medios terrestres'),c=time('control'),l=time('liquidacion'),air=time('llegada medios aereos');
    function interval(x,y,label){if(x===null||y===null)return label+': datos incompletos';if(y<x)return label+': inconsistencia cronológica (hito final anterior al inicial)';const m=(y-x)/60000;return label+': '+Math.floor(m/60)+' h '+m%60+' min';}
    const chronology=[interval(a,t,'Aviso–llegada terrestre'),interval(t,c,'Llegada terrestre–control'),interval(c,l,'Control–liquidación'),interval(a,l,'Aviso–liquidación')];if(air!==null)chronology.push(interval(a,air,'Aviso–llegada aérea'));
    const total=num('Superficie total ha'),plant=num('Area plantacion ha'),natural=num('Area bosque natural ha');let surface='';if(total!==null){if(plant!==null&&natural!==null&&Math.abs(plant+natural-total)>1e-7)surface='La suma de superficies desglosadas difiere del total declarado; verificar la boleta.';else if((plant!==null&&plant>total)||(natural!==null&&natural>total))surface='Una superficie desglosada supera el total declarado; verificar la boleta.';else if(plant===null||natural===null)surface='El desglose contiene campos vacíos; no se interpretan como cero.';}
    const obs=val(r,'Observaciones'),causa=val(r,'Causas incendio'),otro=val(r,'Causas otro'),inst=val(r,'Instituciones participantes'),instOtro=val(r,'Instituciones otro');
    return {SUBTITULO:'AC283 · Aviso del '+date(val(r,'Fecha aviso')),PERSONA:show(name(r)),REGAREA:get('Region')+' / '+get('Area protegida')+(val(r,'Especifique el area protegida')?' / '+val(r,'Especifique el area protegida'):''),MUNICIPIO:get('Departamento')+' / '+get('Municipio')+(val(r,'Municipio calculado')&&val(r,'Municipio calculado')!==val(r,'Municipio')?' (municipio calculado: '+val(r,'Municipio calculado')+')':''),LUGAR:get('Referencia de ubicacion'),PROPIEDAD:get('Propiedad del terreno')+' / '+get('Tipo de bosque'),CONTEXTO:'Forma de aviso: '+get('Forma de aviso')+'. El incidente se clasificó en la boleta como '+get('Tipo de incendio')+'. Técnica de extinción registrada: '+get('Tecnicas de extincion')+'. Participación institucional y comunitaria: '+show(inst)+(instOtro?' (otros: '+instOtro+')':'')+'.',AVISO:stamp('aviso'),TIERRA:stamp('llegada medios terrestres'),CONTROL:stamp('control'),LIQUIDACION:stamp('liquidacion'),AEREOS:get('Llegaron medios aereos')+(val(r,'Fecha llegada medios aereos')||val(r,'Hora llegada medios aereos')?' · '+stamp('llegada medios aereos'):''),CRONOLOGIA:chronology.join('; ')+'. Los intervalos corresponden a hitos registrados, no al inicio efectivo del fuego.',TOTAL:ha('Superficie total ha')+(total!==null?' ('+fmt(total*10000)+' m²)':''),PLANTACION:ha('Area plantacion ha'),NATURAL:ha('Area bosque natural ha'),PENDIENTE:num('Pendiente porcentaje')!==null?fmt(num('Pendiente porcentaje'))+' %':get('Pendiente porcentaje'),TOPOGRAFIA:get('Topografia'),VEGETACION:get('Tipo de vegetacion'),CAUSA:'Causa consignada: '+show(causa)+(otro?' · Otra causa: '+otro:'')+'. Se conserva como reporte de campo, no como determinación pericial. '+(causa.toLowerCase().includes('desconocida')&&otro?'Se registró además una causa adicional; verificar la clasificación. ':'')+surface,OBS:obs?'Observación original: «'+obs+'»':'No se consignaron observaciones de campo.',COORDENADAS:'Latitud: '+get('Y')+' | Longitud: '+get('X'),MAPA_ESTADO:map.ok?'Figura 1. Imagen satelital de referencia. Fuente: '+map.credit+'. Escala aproximada. El marcador representa el punto registrado, no el perímetro quemado.':'Mapa satelital no disponible: '+map.reason+'.',RECOMENDACION:'Se recomienda verificar la superficie mediante delimitación georreferenciada, evaluar la severidad de afectación y documentar la recuperación de la vegetación. Cotejar los hitos de atención y las causas reportadas con los respaldos operativos antes de cerrar el incidente.'+(chronology.some(x=>x.includes('inconsistencia'))?' Priorizar la revisión de las fechas y horas inconsistentes.':''),TRAZA:'Fuente: docs/datos/base5_datos.csv · Registro '+(r.__fila_csv||'sin número')+' · ObjectID '+get('ObjectID')+' · GlobalID '+get('GlobalID')+'. Creación: '+get('CreationDate')+'. Edición: '+get('EditDate')+'. Los intervalos y la equivalencia de superficie son cálculos derivados; los datos faltantes no se estimaron.'};
  }
  let ready, templateBytes;
  async function fetchTimed(url, ms=18000){const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),ms);try{const res=await fetch(url,{signal:ac.signal});if(!res.ok)throw Error('HTTP '+res.status);return {blob:await res.blob()};}finally{clearTimeout(timer);}}
  async function setup(){
    if(!ready)ready=(async()=>{if(!global.JSZip){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=asset.href;s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar JSZip'));document.head.append(s);});}if(!global.JSZip)throw Error('JSZip no está disponible');const r=await fetchTimed(template.href);templateBytes=await r.blob.arrayBuffer();})();
    try{await ready;}catch(e){ready=null;throw e;}
  }
  async function satellite(r,session){
    const c=coords(r);if(!c)return {ok:false,reason:'coordenadas ausentes o a revisar'};
    if(!session.maps)return {ok:false,reason:'generación sin mapa seleccionada'};
    let bitmap;
    try{
      const R=6378137, rad=Math.PI/180, x=R*c.lon*rad,y=R*Math.log(Math.tan(Math.PI/4+c.lat*rad/2)), w=900,h=480, span=1400/Math.cos(c.lat*rad), vh=span*h/w;
      const qs=new URLSearchParams({bbox:[x-span/2,y-vh/2,x+span/2,y+vh/2].join(','),bboxSR:'3857',imageSR:'3857',size:`${w},${h}`,format:'png32',transparent:'false',f:'image'});
      const errors=[];let credit='';
      for(const service of services){
        try{
          const {blob}=await fetchTimed(service+'/export?'+qs);
          if(!blob.type.startsWith('image/'))throw Error('Respuesta no es imagen: '+(await blob.text()).slice(0,180));
          bitmap=await createImageBitmap(blob);
          if(bitmap.width!==w||bitmap.height!==h){bitmap.close();bitmap=null;throw Error('Dimensiones inesperadas');}
          if(!session.credits[service]){
            try{const meta=JSON.parse(await (await fetchTimed(service+'?f=json',5000)).blob.text());session.credits[service]=String(meta.copyrightText||'').trim();}catch(e){console.warn('Metadatos Esri:',e);}
          }
          credit=session.credits[service]||'Esri World Imagery; atribución detallada: '+service;
          break;
        }catch(e){errors.push(new URL(service).hostname+': '+(e.name==='AbortError'?'tiempo de espera agotado':e.message));}
      }
      if(!bitmap)throw Error(errors.join(' | '));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();bitmap=null;
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(12,12,48,76);ctx.fillStyle='#111';ctx.font='bold 18px serif';ctx.textAlign='center';ctx.fillText('N',36,32);ctx.beginPath();ctx.moveTo(36,40);ctx.lineTo(23,72);ctx.lineTo(36,65);ctx.lineTo(49,72);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.arc(w/2,h/2,10,0,Math.PI*2);ctx.fillStyle='#d00000';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
      const scale=200*w/1400;ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(12,h-50,scale+28,38);ctx.fillStyle='#111';ctx.fillRect(26,h-31,scale,4);ctx.font='16px serif';ctx.textAlign='left';ctx.fillText('0',26,h-13);ctx.textAlign='right';ctx.fillText('200 m',26+scale,h-13);
      const png=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(Error('No se pudo codificar mapa')),'image/png'));
      return {ok:true,bytes:new Uint8Array(await png.arrayBuffer()),credit:credit};
    }catch(e){if(bitmap)bitmap.close();console.warn('Mapa satelital:',e);return {ok:false,reason:e.message||'error de conexión'};}
  }
  async function build(r,map){const zip=await global.JSZip.loadAsync(templateBytes),f=fields(r,map);let doc=await zip.file('word/document.xml').async('string');doc=doc.replace(/\{\{([A-Z_]+)\}\}/g,(_,k)=>{if(!(k in f))throw Error('Campo de plantilla desconocido: '+k);return xml(f[k]);});if(map.ok)zip.file('word/media/image2.png',map.bytes);else doc=doc.replace(/<w:p(?:\s[^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<w:drawing>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g,p=>p.includes('MAPA_INCENDIO')?'':p);zip.file('word/document.xml',doc);return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});}
  function filename(r,i){return `Informe_Incendio_${safe(name(r))}_${dateKey(val(r,'Fecha aviso'))||'Sin_fecha'}_registro_${r.__fila_csv||i+1}.docx`;}
  function download(bytes,filename,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  let busy=false;
  async function run(rows,{maps=true,individual=false,progress=()=>{}}={}){
    if(busy)throw Error('Ya se está generando una descarga.');if(!rows.length)throw Error('No hay registros para descargar.');if(individual&&rows.length!==1)throw Error('Selecciona exactamente un registro.');busy=true;
    try{progress('Cargando plantilla Word…');await setup();const session={maps,credits:{}},zip=individual?null:new global.JSZip();let missing=0,lastError='';const used=new Set();for(let i=0;i<rows.length;i++){const r=rows[i];progress(`Generando ${i+1} de ${rows.length}…`);const map=await satellite(r,session);if(!map.ok){missing++;lastError=map.reason;}const bytes=await build(r,map);let file=filename(r,i);if(used.has(file))file=file.replace(/\.docx$/,'_'+(i+1)+'.docx');used.add(file);if(individual)download(bytes,file,mime);else zip.file(file,bytes);await new Promise(res=>setTimeout(res,0));}
      if(zip){progress('Comprimiendo informes…');zip.file('RESUMEN.txt',`Informes generados: ${rows.length}\nCon mapa satelital: ${rows.length-missing}\nSin mapa satelital: ${missing}\nCada documento corresponde a un registro.\n`);download(await zip.generateAsync({type:'uint8array',compression:'STORE'}),`Informes_Incendios_${safe(name(rows[0]))}_${rows.length}_registros.zip`,'application/zip');}progress(`Listo: ${rows.length} informe(s); ${missing} sin mapa satelital.${lastError?' Último motivo: '+lastError:''}`);
    }finally{busy=false;}
  }
  // UI compartida: no cambia filtros existentes, permite seleccionar una boleta o todas.
  function mount(host, getRows, getName, options={}){
    if(!host)return;host.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end"><label>Desde (fecha de aviso) <input type="date" data-from></label><label>Hasta <input type="date" data-to></label><label><input type="checkbox" data-map checked> Incluir mapa satelital (consulta externa a Esri)</label></div><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px"><button type="button" data-all class="btn btn-primary" disabled>Descargar todos los informes</button><select data-one aria-label="Seleccionar registro" style="max-width:100%"></select><button type="button" data-single class="btn btn-blue" disabled>Descargar Word individual</button></div><p data-count style="margin:8px 0"></p><p data-status role="status" aria-live="polite" style="margin:8px 0"></p>';
    const el=s=>host.querySelector(s),from=el('[data-from]'),to=el('[data-to]'),one=el('[data-one]'),all=el('[data-all]'),single=el('[data-single]'),status=el('[data-status]');let rows=[],running=false;
    function refresh(){if(running)return;const n=getName();const valid=!from.value||!to.value||from.value<=to.value;rows=n&&valid?getRows().filter(r=>{const d=dateKey(val(r,'Fecha aviso'));return (!from.value||d&&d>=from.value)&&(!to.value||d&&d<=to.value);}):[];all.textContent=n?`Descargar todos los informes de ${n}`:'Descargar todos los informes';all.disabled=!rows.length;single.disabled=!rows.length;one.disabled=!rows.length;one.replaceChildren();rows.forEach((r,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${val(r,'Fecha aviso')||'Sin fecha'} · ${val(r,'Municipio')||'Sin municipio'} · Registro ${r.__fila_csv||i+1}`;one.append(o);});el('[data-count]').textContent=!valid?'El rango de fechas no es válido.':`${rows.length} registro(s) disponibles para descargar`;}
    async function action(individual){if(running)return;running=true;all.disabled=single.disabled=true;try{await run(individual?[rows[Number(one.value)]]:rows.slice(),{individual,maps:el('[data-map]').checked,progress:s=>status.textContent=s});}catch(e){status.textContent='Error: '+e.message;}finally{running=false;refresh();}}
    from.addEventListener('change',refresh);to.addEventListener('change',refresh);all.addEventListener('click',()=>action(false));single.addEventListener('click',()=>action(true));refresh();return refresh;
  }
  global.InformesIncendios={mount,run,dateKey,fields};
  document.addEventListener('DOMContentLoaded',async()=>{const host=document.getElementById('informes-incendios');if(!host)return;const select=document.getElementById('incendios-guarda');try{const response=await fetch(new URL('../../datos/base5_datos.csv',base),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const parsed=global.Papa.parse(await response.text(),{header:true,delimiter:';',skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim()});if(!parsed.data.length)throw Error('CSV vacío');const rows=parsed.data.map((r,i)=>({...r,__fila_csv:i+2}));const canon=n=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();const names=new Map();for(const r of rows){const n=name(r);if(n&&!names.has(canon(n)))names.set(canon(n),n);}for(const [k,n] of [...names].sort((a,b)=>a[1].localeCompare(b[1],'es'))){const o=document.createElement('option');o.value=k;o.textContent=n;select.append(o);}const refresh=mount(host,()=>rows.filter(r=>canon(name(r))===select.value),()=>select.value?names.get(select.value):'');select.addEventListener('change',refresh);}catch(e){host.textContent='No se pudieron cargar los informes: '+e.message;}});
})(window);
