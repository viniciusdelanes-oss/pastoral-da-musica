import { login, logout, getUser, handleAuthCallback, acceptInvite, updateUser, requestPasswordRecovery, refreshSession } from '/vendor/identity.js';
const $ = id => document.getElementById(id);
const form = $('musica');
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const momentos = ['Entrada','Ato penitencial','Glória','Salmo','Aclamação','Ofertório','Santo','Cordeiro de Deus','Comunhão','Final'];
form.elements.momento.innerHTML = momentos.map(m=>`<option>${esc(m)}</option>`).join('');
let reps = [], current = null, invite = null, dirty = false, busy = false;
const message = (s, error=false) => { $('status').textContent=s; $('status').classList.toggle('erro',error); };
async function api(path, options={}) {
  await getUser(); await refreshSession();
  const response = await fetch(path, { ...options, headers:{...(options.body && typeof options.body==='string' ? {'Content-Type':'application/json'} : {}),...options.headers}, cache:'no-store' });
  const body=await response.json();
  if(!response.ok) throw new Error(body.error || 'Não foi possível concluir.');
  return body;
}
async function run(work) {
  if(busy)return;busy=true;
  const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{await work()}catch(error){message(error.name==='AuthError' ? 'Não foi possível autenticar. Confira seus dados ou solicite um novo link de acesso.' : error.message||'Não foi possível concluir. Tente novamente.',true)}finally{busy=false;buttons.forEach(b=>b.disabled=false)}
}
function discard() { return !dirty || confirm('Descartar as alterações que ainda não foram salvas?'); }
function clear() { current=null;form.reset();dirty=false;$('modo').textContent='Nova música';$('excluir').hidden=true; }
function list() {
  const rep=reps.find(r=>r.id===$('repertorios').value);
  $('nova-musica').disabled=!rep;$('salvar').disabled=!rep;
  $('lista-musicas').innerHTML=rep?.musicas.length ? rep.musicas.map(s=>`<button class="we" type="button" data-id="${esc(s.id)}"><b>${esc(s.titulo)}</b><small>${esc(s.momento)}${s.tom?' · '+esc(s.tom):''}</small></button>`).join(''):'<p>Nenhuma música cadastrada nesta celebração.</p>';
}
async function load(selected=$('repertorios').value) {
  reps=await api('/api/repertorios');
  $('repertorios').innerHTML=reps.length?reps.map(r=>`<option value="${esc(r.id)}">${esc(r.data.split('-').reverse().join('/'))} · ${esc(r.celebracao)}</option>`).join(''):'<option value="">Crie uma celebração para começar</option>';
  if(reps.some(r=>r.id===selected))$('repertorios').value=selected;
  form.dataset.repertorio=$('repertorios').value;
  list();
}
async function access() {
  const user=await getUser();
  $('sair').hidden=!user;
  if(!user){$('editor').hidden=true;$('acesso').hidden=false;$('login').hidden=false;message('Entre para editar as músicas.');return}
  await api('/api/admin');
  $('acesso').hidden=true;$('editor').hidden=false;
  await load();message('Acesso autorizado. Escolha uma celebração para começar.');
}
$('login').onsubmit=e=>{e.preventDefault();run(async()=>{message('Entrando…');await login(e.target.email.value,e.target.password.value);e.target.password.value='';await access()})};
$('recuperar').onclick=()=>run(async()=>{const email=$('login').email;if(!email.reportValidity()||!email.value)return;await requestPasswordRecovery(email.value);message('Se a conta estiver cadastrada, você receberá um link para redefinir a senha.')});
$('senha').onsubmit=e=>{e.preventDefault();run(async()=>{const password=e.target.password.value;if(password!==e.target.confirm.value)throw new Error('As senhas precisam ser iguais.');if(invite)await acceptInvite(invite,password);else await updateUser({password});invite=null;e.target.reset();e.target.hidden=true;await access()})};
$('sair').onclick=()=>{if(!discard())return;run(async()=>{await logout();clear();$('editor').hidden=true;await access();message('Você saiu da conta.')})};
form.addEventListener('input',()=>dirty=true);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
$('repertorios').onchange=async e=>{if(!discard()){e.target.value=form.dataset.repertorio||e.target.value;return}clear();form.dataset.repertorio=e.target.value;list()};
$('nova-musica').onclick=$('cancelar').onclick=()=>{if(discard()){clear();form.elements.titulo.focus()}};
$('recarregar').onclick=()=>{if(!discard())return;run(async()=>{await load();clear();message('Lista atualizada.')})};
$('lista-musicas').onclick=e=>{
  const button=e.target.closest('[data-id]');if(!button||!discard())return;
  current=reps.flatMap(r=>r.musicas).find(s=>s.id===button.dataset.id);if(!current)return;
  form.reset();for(const key of ['titulo','momento','tom','letra','cifraTexto','audio','cifra','partitura']){if(key==='momento'&&!momentos.includes(current[key]))form.elements.momento.add(new Option(current[key],current[key]));form.elements[key].value=current[key]||''}
  dirty=false;$('modo').textContent='Editar música';$('excluir').hidden=false;form.scrollIntoView({behavior:'smooth'});form.elements.titulo.focus();
};
$('celebracao').onsubmit=e=>{e.preventDefault();if(!discard())return;run(async()=>{const body=Object.fromEntries(new FormData(e.target));const result=await api('/api/repertorios',{method:'POST',body:JSON.stringify(body)});await load(result.id);clear();e.target.reset();message('Celebração criada. Agora adicione as músicas.')})};
form.onsubmit=e=>{
  e.preventDefault();run(async()=>{
    if(!$('repertorios').value)throw new Error('Crie ou selecione uma celebração.');
    message('Enviando arquivos e salvando a música…');
    // Reutiliza links de envios já concluídos se houver falha em outro campo.
    for(const input of form.querySelectorAll('[data-upload]')){
      const file=input.files[0];if(!file)continue;
      const ext=file.name.split('.').pop().toLowerCase();
      const allowed=input.dataset.upload==='audio'?['mp3','m4a','wav','ogg']:['pdf'];
      if(!allowed.includes(ext))throw new Error('Formato inválido no campo '+input.dataset.upload+'.');
      if(file.size>(ext==='pdf'?10:20)*1024*1024)throw new Error('Arquivo acima do limite indicado.');
      const result=await api('/api/arquivos?ext='+ext,{method:'POST',body:file,headers:{'Content-Type':'application/octet-stream'}});
      form.elements[input.dataset.upload].value=result.url;input.value='';
    }
    const body=Object.fromEntries(new FormData(form));
    body.repertorio=$('repertorios').value;body.nova=!current;body.versao=current?.versao;
    const result=await api('/api/musicas/'+(current?.id||crypto.randomUUID()),{method:'PUT',body:JSON.stringify(body)});
    current=result;dirty=false;$('modo').textContent='Editar música';$('excluir').hidden=false;
    await load(body.repertorio);message('Música salva e publicada no site.');
  });
};
$('excluir').onclick=()=>{if(!current||!confirm('Excluir esta música do repertório? Essa ação não pode ser desfeita.'))return;run(async()=>{await api(`/api/musicas/${current.id}?versao=${current.versao}`,{method:'DELETE'});clear();await load();message('Música excluída do repertório.')})};
try{
  const callback=await handleAuthCallback();
  if(callback?.type==='invite'||callback?.type==='recovery'){
    invite=callback.token;$('login').hidden=true;$('senha').hidden=false;message('Defina sua senha para continuar.');
  }else await access();
}catch(error){message('Não foi possível verificar seu acesso. Entre novamente ou solicite um novo convite se o link expirou.',true)}
