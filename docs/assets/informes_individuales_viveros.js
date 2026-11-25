/* CONAP | Informes individuales de viveros. No modifica el CSV. */
(function (global) {
  'use strict';
  const base = new URL('../boletas/viveros/', document.currentScript.src);
  const asset = new URL('jszip.min.js', document.currentScript.src);
  const template = new URL('plantilla_informe_individual_viveros.docx', base);
  const services = ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer','https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'];
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const val = (r,k) => String(r[k] ?? '').trim();
  const show = s => s || 'Sin dato (campo vacío)';
  const name = r => val(r,'__guarda') || val(r,'Nombre del guarda recurso');
  const safe = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,100) || 'Sin_dato';
  const xml = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function dateKey(s) {
    let m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/), y,mo,d;
    if(m){[,mo,d,y]=m;} else {m=String(s||'').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return '';[,y,mo,d]=m;}
    const dt=new Date(Date.UTC(+y,+mo-1,+d));
    return dt.getUTCFullYear()===+y && dt.getUTCMonth()===+mo-1 && dt.getUTCDate()===+d ? dt.toISOString().slice(0,10):'';
  }
  function coords(r){const a=val(r,'Y'),b=val(r,'X'),lat=Number(a.replace(',','.')),lon=Number(b.replace(',','.'));return a&&b&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=13.5&&lat<=18.2&&lon>=-92.5&&lon<=-88 ? {lat,lon}:null;}
  function duration(r){
    const parse=s=>{const m=s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);return m&&+m[1]<24&&+m[2]<60?+m[1]*60+ +m[2]:null;};
    const a=parse(val(r,'Hora de inicio de actividades')),b=parse(val(r,'Hora de finalizacion de actividades'));if(a===null||b===null)return 'No calculable';
    const d=b-a;return d>=6&&d<=1200?`${Math.floor(d/60)} h ${d%60} min`:'No calculable (horario a revisar)';
  }
  function fields(r,map){
    const get=k=>show(val(r,k)), c=coords(r), dk=dateKey(val(r,'CreationDate'));
    const labels={riego:'riego',limpieza_areas:'limpieza de áreas',limpieza_plantas:'limpieza de plantas',llenado_bolsas:'llenado de bolsas',trasplante:'trasplante',preparacion_sustrato:'preparación de sustrato',mantenimiento_infraestructura:'mantenimiento de infraestructura',recoleccion_semillas:'recolección de semillas',germinacion:'germinación',otro:'otra actividad'};
    const goals={riego:'mantener la disponibilidad de agua para las plantas',limpieza_areas:'favorecer el orden y mantenimiento de las áreas de trabajo',limpieza_plantas:'contribuir al mantenimiento del material vegetal',llenado_bolsas:'preparar recipientes para la producción forestal',trasplante:'apoyar el establecimiento del material vegetal en recipientes o espacios de cultivo',preparacion_sustrato:'acondicionar el medio de crecimiento',mantenimiento_infraestructura:'favorecer la funcionalidad de las instalaciones',recoleccion_semillas:'obtener material de propagación',germinacion:'apoyar la propagación de plantas'};
    const codes=[...new Set(val(r,'Actividades realizadas').split(/[,;]+/).map(x=>x.trim()).filter(Boolean))], acts=codes.map(x=>labels[x]||x.replace(/_/g,' ')), objectives=codes.map(x=>goals[x]).filter(Boolean), other=val(r,'Especifique otra actividad'), obs=val(r,'Observaciones');
    const f={PERSONA:show(name(r)),REGION:get('Region'),MUNICIPIO:get('Municipio'),AREA:get('Area protegida'),FUERA:get('Especifique area (Fuera de RUMCLA)'),LUGAR:get('Nombre del area y/o lugar del vivero establecido (Barrio, Caserio, Canton, Aldea, etc.)'),APOYO:get('Esta en apoyo a un vivero fuera de su municipio'),APOYO_LUGAR:get('Especifique el municipio o lugar de apoyo'),FECHA:dk?dk.split('-').reverse().join('/'):'Sin fecha',INICIO:get('Hora de inicio de actividades'),FIN:get('Hora de finalizacion de actividades'),DURACION:duration(r),LAT:get('Y'),LON:get('X'),CREACION:get('CreationDate'),MODIFICACION:get('EditDate'),FILA:String(r.__fila_csv||'No disponible'),CODIGOS:get('Actividades realizadas')};
    f.OBJETIVO=objectives.length?'La asistencia técnica se orienta a '+objectives.join('; ')+'. Se trata de la finalidad técnica asociada a las labores reportadas.':'La asistencia se enmarca en el apoyo a viveros forestales; el registro no permite precisar una finalidad técnica adicional.';
    f.DESARROLLO=acts.length?'La boleta consigna las siguientes labores: '+acts.join(', ')+'.':'No se seleccionaron actividades en el campo correspondiente.';
    if(other)f.DESARROLLO+=' En el campo de otra actividad se especificó: '+other+'.';
    f.OBS=obs?'Observación original del guardarecursos: «'+obs+'»':'No se consignaron observaciones de campo.';
    f.RESULTADOS=obs?'Los resultados se limitan a lo descrito en la observación de campo.':'La boleta acredita el registro de la asistencia, pero no aporta un resultado cualitativo adicional ni cantidades verificables.';
    const rec=[];if(codes.includes('recoleccion_semillas'))rec.push('documentar especie, cantidad, procedencia y destino de la semilla');if(codes.some(x=>['trasplante','llenado_bolsas','germinacion'].includes(x)))rec.push('registrar cantidades de material vegetal o recipientes y su seguimiento');if(codes.some(x=>['riego','limpieza_areas','limpieza_plantas','mantenimiento_infraestructura','preparacion_sustrato'].includes(x)))rec.push('precisar las áreas atendidas, insumos y necesidades de mantenimiento');
    f.CONCLUSION='Se recomienda '+(rec.length?rec.join('; '):'detallar las labores, cantidades y necesidades de seguimiento')+'. Las recomendaciones son propuestas técnicas, no acciones ejecutadas.';
    f.GEO=c?'Las coordenadas identifican un punto de referencia, no los límites del vivero.':'Las coordenadas originales están ausentes o fuera del rango geográfico utilizado; no se genera un marcador.';
    f.MAPA_ESTADO=map.ok?'Figura 1. Imagen satelital de referencia. Fuente: '+map.credit+'. Escala aproximada.':'Mapa satelital no disponible: '+map.reason+'.';
    f.CONSULTA=c?'Consulta: https://www.google.com/maps?q='+c.lat+','+c.lon+'&t=k&z=16':'';
    return f;
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
  async function build(r,map){const zip=await global.JSZip.loadAsync(templateBytes),f=fields(r,map);let doc=await zip.file('word/document.xml').async('string');doc=doc.replace(/\{\{([A-Z_]+)\}\}/g,(_,k)=>{if(!(k in f))throw Error('Campo de plantilla desconocido: '+k);return xml(f[k]);});if(map.ok)zip.file('word/media/image2.png',map.bytes);else doc=doc.replace(/<w:p(?:\s[^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<w:drawing>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g,p=>p.includes('MAPA_VIV')?'':p);zip.file('word/document.xml',doc);return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});}
  function filename(r,i){return `Informe_Viveros_${safe(name(r))}_${dateKey(val(r,'CreationDate'))||'Sin_fecha'}_registro_${r.__fila_csv||i+1}.docx`;}
  function download(bytes,filename,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  let busy=false;
  async function run(rows,{maps=true,individual=false,progress=()=>{}}={}){
    if(busy)throw Error('Ya se está generando una descarga.');if(!rows.length)throw Error('No hay registros para descargar.');if(individual&&rows.length!==1)throw Error('Selecciona exactamente un registro.');busy=true;
    try{progress('Cargando plantilla Word…');await setup();const session={maps,credits:{}},zip=individual?null:new global.JSZip();let missing=0,lastError='';const used=new Set();for(let i=0;i<rows.length;i++){const r=rows[i];progress(`Generando ${i+1} de ${rows.length}…`);const map=await satellite(r,session);if(!map.ok){missing++;lastError=map.reason;}const bytes=await build(r,map);let file=filename(r,i);if(used.has(file))file=file.replace(/\.docx$/,'_'+(i+1)+'.docx');used.add(file);if(individual)download(bytes,file,mime);else zip.file(file,bytes);await new Promise(res=>setTimeout(res,0));}
      if(zip){progress('Comprimiendo informes…');zip.file('RESUMEN.txt',`Informes generados: ${rows.length}\nCon mapa satelital: ${rows.length-missing}\nSin mapa satelital: ${missing}\nCada documento corresponde a un registro.\n`);download(await zip.generateAsync({type:'uint8array',compression:'STORE'}),`Informes_Viveros_${safe(name(rows[0]))}_${rows.length}_registros.zip`,'application/zip');}progress(`Listo: ${rows.length} informe(s); ${missing} sin mapa satelital.${lastError?' Último motivo: '+lastError:''}`);
    }finally{busy=false;}
  }
  // UI compartida: no cambia filtros existentes, permite seleccionar una boleta o todas.
  function mount(host, getRows, getName, options={}){
    if(!host)return;host.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end"><label>Desde (fecha de registro) <input type="date" data-from></label><label>Hasta <input type="date" data-to></label><label><input type="checkbox" data-map checked> Incluir mapa satelital (consulta externa a Esri)</label></div><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px"><button type="button" data-all class="btn btn-primary" disabled>Descargar todos los informes</button><select data-one aria-label="Seleccionar registro" style="max-width:100%"></select><button type="button" data-single class="btn btn-blue" disabled>Descargar Word individual</button></div><p data-count style="margin:8px 0"></p><p data-status role="status" aria-live="polite" style="margin:8px 0"></p>';
    const el=s=>host.querySelector(s),from=el('[data-from]'),to=el('[data-to]'),one=el('[data-one]'),all=el('[data-all]'),single=el('[data-single]'),status=el('[data-status]');let rows=[],running=false;
    function refresh(){if(running)return;const n=getName();const valid=!from.value||!to.value||from.value<=to.value;rows=n&&valid?getRows().filter(r=>{const d=dateKey(val(r,'CreationDate'));return (!from.value||d&&d>=from.value)&&(!to.value||d&&d<=to.value);}):[];all.textContent=n?`Descargar todos los informes de ${n}`:'Descargar todos los informes';all.disabled=!rows.length;single.disabled=!rows.length;one.disabled=!rows.length;one.replaceChildren();rows.forEach((r,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${val(r,'CreationDate')||'Sin fecha'} · ${val(r,'Municipio')||'Sin municipio'} · Registro ${r.__fila_csv||i+1}`;one.append(o);});el('[data-count]').textContent=!valid?'El rango de fechas no es válido.':`${rows.length} registro(s) disponibles para descargar`;}
    async function action(individual){if(running)return;running=true;all.disabled=single.disabled=true;try{await run(individual?[rows[Number(one.value)]]:rows.slice(),{individual,maps:el('[data-map]').checked,progress:s=>status.textContent=s});}catch(e){status.textContent='Error: '+e.message;}finally{running=false;refresh();}}
    from.addEventListener('change',refresh);to.addEventListener('change',refresh);all.addEventListener('click',()=>action(false));single.addEventListener('click',()=>action(true));refresh();return refresh;
  }
  global.InformesViveros={mount,run,dateKey,fields};
})(window);
