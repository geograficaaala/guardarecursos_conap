/* CONAP | Informes individuales de consumos. No modifica el CSV. */
(function (global) {
  'use strict';
  const base = new URL('../boletas/consumo_forestal/', document.currentScript.src);
  const asset = new URL('jszip.min.js', document.currentScript.src);
  const template = new URL('plantilla_informe_individual_consumo.docx', base);
  const services = ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer','https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'];
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const val = (r,k) => String(r[k] ?? '').trim();
  const show = s => s || 'Sin dato (campo vacío)';
  const name = r => val(r,'__guarda') || val(r,'Nombre del guardarecursos');
  const safe = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,100) || 'Sin_dato';
  const xml = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function dateKey(s) {
    let m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/), y,mo,d;
    if(m){[,mo,d,y]=m;} else {m=String(s||'').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return '';[,y,mo,d]=m;}
    const dt=new Date(Date.UTC(+y,+mo-1,+d));
    return dt.getUTCFullYear()===+y && dt.getUTCMonth()===+mo-1 && dt.getUTCDate()===+d ? dt.toISOString().slice(0,10):'';
  }
  function coords(r){const a=val(r,'Y'),b=val(r,'X'),lat=Number(a.replace(',','.')),lon=Number(b.replace(',','.'));return a&&b&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=13.5&&lat<=18.2&&lon>=-92.5&&lon<=-88 ? {lat,lon}:null;}
  const species = [['Pino','Pinus pseudostrobus','pino'],['Cipres','Cupressus lusitanica','cipres'],['Aliso','Alnus jorullensis','aliso'],['Encino','Quercus sp','encino'],['Palo Blanco','Vernonia patens','palo_blanco'],['Cajete','Heliocarpus donnellsmithii','cajete'],['Madron','Arbutus xalapensis','madron'],['Mano de mono','Oreopanax xalapensis','mano_de_mono'],['Matilisguate','Tabebuia rosea','matilisguate'],['Aguacate','Persea americana','aguacate'],['Casuarina','Casuarina equisetifolia','casuarina'],['Otro','','otro']];
  const qty = x => {const s=String(x??'').trim();const n=Number(s);return s&&Number.isSafeInteger(n)&&n>=0?n:null;};
  const fmt = n=>n===null?'Sin dato válido':String(n);
  function speciesRows(r){const codes=val(r,'Especies a talar').toLowerCase().split(/[,;]+/).map(x=>x.trim());const rows=species.map(([n,scient,code])=>({n:code==='otro'?(val(r,'Especifique otra especie')||'Otra especie'):n,scient:scient||'No consignado',code,q:qty(val(r,'Cantidad de '+n+(scient?' ('+scient+')':'')))})).filter(x=>x.q>0||codes.includes(x.code));for(const code of codes.filter(Boolean))if(!species.some(x=>x[2]===code))rows.push({n:code,scient:'No consignado',q:null});return rows;}
  function fields(r,map){const get=k=>show(val(r,k)),c=coords(r),dk=dateKey(val(r,'Fecha')),date=dk?dk.split('-').reverse().join('/'):'Sin fecha válida', total=qty(val(r,'Cantidad total de arboles a talar')), rows=speciesRows(r),sum=rows.reduce((a,x)=>a+(x.q??0),0),complete=rows.length>0&&rows.every(x=>x.q!==null),obs=val(r,'Observaciones');
  const f={SUBTITULO:'AC297 · Registro del '+date,PERSONA:show(name(r)),USUARIO:get('Nombre del usuario'),REGMUN:get('Region')+' / '+get('Municipio'),AREA:get('Area protegida'),LUGAR:get('Referencia de ubicacion'),FECHAHORA:date+' · '+get('Hora'),APOYO:get('Esta atendiendo un consumo fuera de su municipio de intervencion cedido por otro guardarecurso?'),LAT:get('Y'),LON:get('X'),REFERENCIA:get('Referencia de ubicacion')+' / '+get('Municipio'),TOTAL:fmt(total),FACTOR:'10 árboles por árbol',META:total===null?'No calculable':String(total*10)+' árboles',SUMA:rows.some(x=>x.q!==null)?String(sum):'Sin dato',PORC_TOTAL:complete&&sum>0?'100 %':'No calculable'};
  f.CONTEXTO='La boleta documenta una atención de consumo forestal familiar. El registro sirve para caracterizar la solicitud y orientar la evaluación técnica del aprovechamiento; no acredita por sí solo la autorización ni la ejecución del corte.';
  const ranked=rows.filter(x=>x.q>0).sort((a,b)=>b.q-a.q);const leaders=ranked.filter(x=>x.q===ranked[0]?.q);f.ANALISIS='Se identificaron '+rows.length+' categoría(s) de especies en los campos del formulario.'+(leaders.length?' La mayor cantidad consignada corresponde a '+leaders.map(x=>x.n).join(' y ')+'.':'')+' '+(!complete?'El desglose está incompleto; no se asignan cantidades faltantes a ninguna especie.':total===null?'No existe un total declarado válido para contrastar el desglose.':sum===total?'El desglose coincide con el total declarado.':'El desglose ('+sum+') difiere del total declarado ('+total+'); se recomienda revisar la boleta.')+' Los nombres científicos corresponden a las categorías del formulario.';
  f.OBS=obs?'Observación original: «'+obs+'»':'No se consignaron observaciones de campo.';
  f.MAPA_ESTADO=map.ok?'Figura 1. Imagen satelital de referencia. Fuente: '+map.credit+'. Escala aproximada. El marcador representa el punto registrado, no los límites del aprovechamiento.':'Mapa satelital no disponible: '+map.reason+'.';
  f.CONSULTA=c?'Consulta: https://www.google.com/maps?q='+c.lat+','+c.lon+'&t=k&z=16':'Las coordenadas no permiten ubicar un punto válido dentro del rango utilizado para Guatemala.';
  f.REFORESTACION=total===null?'No se estima una meta sin un total válido.':'La meta estimada aplica el criterio de la plantilla general AC297 ('+total+' × 10). Está condicionada a la confirmación de los árboles autorizados y no acredita siembra ni compromiso formal.';
  f.RECOMENDACION='Se recomienda verificar la autorización, registrar el DAP y la altura aprovechable para calcular volumen, documentar el destino del producto y dar seguimiento a la reposición mediante registro de especies, sitio y supervivencia.';
  f.TRAZA='Fuente: docs/datos/base3_datos.csv. Creación: '+get('CreationDate')+'. Edición: '+get('EditDate')+'. Especies originales: '+get('Especies a talar')+'. Otra especie: '+get('Especifique otra especie')+'. Guardarecurso cedente: '+get('Nombre del guardarecurso')+'. Municipio del cedente: '+get('Municipio del guardarecurso')+'.';
  return f;}
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
  async function build(r,map){const zip=await global.JSZip.loadAsync(templateBytes),f=fields(r,map);let doc=await zip.file('word/document.xml').async('string');const rows=speciesRows(r),sum=rows.reduce((a,x)=>a+(x.q??0),0),complete=rows.length>0&&rows.every(x=>x.q!==null);doc=doc.replace(/<w:tr(?:\s[^>]*)?>(?:(?!<\/w:tr>)[\s\S])*?<\/w:tr>/g,tr=>{if(!tr.includes('{{ESP_NOMBRE}}'))return tr;return (rows.length?rows:[{n:'Sin especies consignadas',scient:'—',q:null}]).map(x=>tr.replace(/\{\{ESP_([A-Z]+)\}\}/g,(_,k)=>xml(({NOMBRE:x.n,CIENTIFICO:x.scient,CANTIDAD:fmt(x.q),PORCENTAJE:complete&&sum>0?(x.q/sum*100).toFixed(2)+' %':'—'})[k]))).join('');});doc=doc.replace(/\{\{([A-Z_]+)\}\}/g,(_,k)=>{if(!(k in f))throw Error('Campo de plantilla desconocido: '+k);return xml(f[k]);});if(map.ok)zip.file('word/media/image2.png',map.bytes);else doc=doc.replace(/<w:p(?:\s[^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<w:drawing>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g,p=>p.includes('MAPA_CONSUMO')?'':p);zip.file('word/document.xml',doc);return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});}
  function filename(r,i){return `Informe_Consumos_${safe(name(r))}_${dateKey(val(r,'Fecha'))||'Sin_fecha'}_registro_${r.__fila_csv||i+1}.docx`;}
  function download(bytes,filename,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  let busy=false;
  async function run(rows,{maps=true,individual=false,progress=()=>{}}={}){
    if(busy)throw Error('Ya se está generando una descarga.');if(!rows.length)throw Error('No hay registros para descargar.');if(individual&&rows.length!==1)throw Error('Selecciona exactamente un registro.');busy=true;
    try{progress('Cargando plantilla Word…');await setup();const session={maps,credits:{}},zip=individual?null:new global.JSZip();let missing=0,lastError='';const used=new Set();for(let i=0;i<rows.length;i++){const r=rows[i];progress(`Generando ${i+1} de ${rows.length}…`);const map=await satellite(r,session);if(!map.ok){missing++;lastError=map.reason;}const bytes=await build(r,map);let file=filename(r,i);if(used.has(file))file=file.replace(/\.docx$/,'_'+(i+1)+'.docx');used.add(file);if(individual)download(bytes,file,mime);else zip.file(file,bytes);await new Promise(res=>setTimeout(res,0));}
      if(zip){progress('Comprimiendo informes…');zip.file('RESUMEN.txt',`Informes generados: ${rows.length}\nCon mapa satelital: ${rows.length-missing}\nSin mapa satelital: ${missing}\nCada documento corresponde a un registro.\n`);download(await zip.generateAsync({type:'uint8array',compression:'STORE'}),`Informes_Consumos_${safe(name(rows[0]))}_${rows.length}_registros.zip`,'application/zip');}progress(`Listo: ${rows.length} informe(s); ${missing} sin mapa satelital.${lastError?' Último motivo: '+lastError:''}`);
    }finally{busy=false;}
  }
  // UI compartida: no cambia filtros existentes, permite seleccionar una boleta o todas.
  function mount(host, getRows, getName, options={}){
    if(!host)return;host.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end"><label>Desde (fecha de atención) <input type="date" data-from></label><label>Hasta <input type="date" data-to></label><label><input type="checkbox" data-map checked> Incluir mapa satelital (consulta externa a Esri)</label></div><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px"><button type="button" data-all class="btn btn-primary" disabled>Descargar todos los informes</button><select data-one aria-label="Seleccionar registro" style="max-width:100%"></select><button type="button" data-single class="btn btn-blue" disabled>Descargar Word individual</button></div><p data-count style="margin:8px 0"></p><p data-status role="status" aria-live="polite" style="margin:8px 0"></p>';
    const el=s=>host.querySelector(s),from=el('[data-from]'),to=el('[data-to]'),one=el('[data-one]'),all=el('[data-all]'),single=el('[data-single]'),status=el('[data-status]');let rows=[],running=false;
    function refresh(){if(running)return;const n=getName();const valid=!from.value||!to.value||from.value<=to.value;rows=n&&valid?getRows().filter(r=>{const d=dateKey(val(r,'Fecha'));return (!from.value||d&&d>=from.value)&&(!to.value||d&&d<=to.value);}):[];all.textContent=n?`Descargar todos los informes de ${n}`:'Descargar todos los informes';all.disabled=!rows.length;single.disabled=!rows.length;one.disabled=!rows.length;one.replaceChildren();rows.forEach((r,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${val(r,'Fecha')||'Sin fecha'} · ${val(r,'Municipio')||'Sin municipio'} · Registro ${r.__fila_csv||i+1}`;one.append(o);});el('[data-count]').textContent=!valid?'El rango de fechas no es válido.':`${rows.length} registro(s) disponibles para descargar`;}
    async function action(individual){if(running)return;running=true;all.disabled=single.disabled=true;try{await run(individual?[rows[Number(one.value)]]:rows.slice(),{individual,maps:el('[data-map]').checked,progress:s=>status.textContent=s});}catch(e){status.textContent='Error: '+e.message;}finally{running=false;refresh();}}
    from.addEventListener('change',refresh);to.addEventListener('change',refresh);all.addEventListener('click',()=>action(false));single.addEventListener('click',()=>action(true));refresh();return refresh;
  }
  global.InformesConsumos={mount,run,dateKey,fields,speciesRows};
  document.addEventListener('DOMContentLoaded',async()=>{const host=document.getElementById('informes-consumos');if(!host)return;const select=document.getElementById('consumos-guarda');try{const response=await fetch(new URL('../../datos/base3_datos.csv',base),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const parsed=global.Papa.parse(await response.text(),{header:true,delimiter:';',skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim()});if(!parsed.data.length)throw Error('CSV vacío');const rows=parsed.data.map((r,i)=>({...r,__fila_csv:i+2}));const canon=n=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();const names=new Map();for(const r of rows){const n=name(r);if(n&&!names.has(canon(n)))names.set(canon(n),n);}for(const [k,n] of [...names].sort((a,b)=>a[1].localeCompare(b[1],'es'))){const o=document.createElement('option');o.value=k;o.textContent=n;select.append(o);}const refresh=mount(host,()=>rows.filter(r=>canon(name(r))===select.value),()=>select.value?names.get(select.value):'');select.addEventListener('change',refresh);}catch(e){host.textContent='No se pudieron cargar los informes: '+e.message;}});
})(window);
