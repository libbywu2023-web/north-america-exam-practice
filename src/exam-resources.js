export function safeResourceUrl(value) {
 try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export async function resourceAdmin(request, env, examId, resourceId, json) {
 const db=env.DB, method=request.method;
 if(method==='GET' && !resourceId) return json({items:(await db.prepare('SELECT * FROM exam_resources WHERE exam_id=? ORDER BY sort_order,id').bind(examId).all()).results});
 if(method==='DELETE' && resourceId){await db.prepare('DELETE FROM exam_resources WHERE id=? AND exam_id=?').bind(resourceId,examId).run();return json({success:true});}
 if((method==='POST'&&!resourceId)||(method==='PUT'&&resourceId)){
  const b=await request.json().catch(()=>null); if(!b) return json({error:'Invalid body'},400);
  const title=String(b.title||'').trim(), org=String(b.organization||'').trim(), url=safeResourceUrl(b.url), lang=String(b.language_code||'en'), order=Number(b.sort_order||0);
  if(!title||!org||!url||title.length>200||org.length>120||url.length>2048||!['en','fr','zh-CN','zh-TW'].includes(lang)||!Number.isSafeInteger(order)) return json({error:'Valid title, organization, HTTPS URL, language and order required.'},400);
  const values=[title,org,url,lang,order,b.is_published===true?1:0];
  if(resourceId) await db.prepare('UPDATE exam_resources SET title=?,organization=?,url=?,language_code=?,sort_order=?,is_published=? WHERE id=? AND exam_id=?').bind(...values,resourceId,examId).run();
  else await db.prepare('INSERT INTO exam_resources(title,organization,url,language_code,sort_order,is_published,exam_id) VALUES(?,?,?,?,?,?,?)').bind(...values,examId).run();
  return json({success:true});
 }
 return json({error:'Method not allowed'},405);
}
