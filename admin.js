
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://gnsohfohcjaolfyxmpsw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_F5WPlc--Rxyxn-YIC1H5VA_q5o6Hc12';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const form = $('musica');
const momentos = ['Entrada','Ato penitencial','Glória','Salmo','Aclamação','Ofertório','Santo','Cordeiro de Deus','Comunhão','Final'];

form.elements.momento.innerHTML = momentos.map(m => `<option>${m}</option>`).join('');

let reps = [];
let current = null;
let dirty = false;
let busy = false;

const message = (s, error=false) => {
  $('status').textContent = s;
  $('status').classList.toggle('erro', error);
};

async function run(work) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try {
    await work();
  } catch (error) {
    console.error(error);
    message(error.message || 'Não foi possível concluir. Tente novamente.', true);
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

function clear() {
  current = null;
  form.reset();
  dirty = false;
  $('modo').textContent = 'Nova música';
  $('excluir').hidden = true;
}

function discard() {
  return !dirty || confirm('Descartar as alterações que ainda não foram salvas?');
}

async function load(selected = $('repertorios').value) {
  const { data: celebracoes, error } = await supabase
    .from('site_celebracoes')
    .select('*')
    .order('data');

  if (error) throw error;

  const { data: musicas, error: erroMusicas } = await supabase
    .from('site_musicas')
    .select('*');

  if (erroMusicas) throw erroMusicas;

  reps = (celebracoes || []).map(r => ({
    ...r,
    musicas: (musicas || []).filter(m => m.repertorio === r.id)
  }));

  $('repertorios').innerHTML = reps.length
    ? reps.map(r => `<option value="${r.id}">${r.data.split('-').reverse().join('/')} · ${r.celebracao}</option>`).join('')
    : '<option value="">Crie uma celebração para começar</option>';

  if (reps.some(r => r.id === selected)) $('repertorios').value = selected;

  form.dataset.repertorio = $('repertorios').value;
  list();
}

function list() {
  const rep = reps.find(r => r.id === $('repertorios').value);
  $('nova-musica').disabled = !rep;
  $('salvar').disabled = !rep;

  $('lista-musicas').innerHTML = rep?.musicas.length
    ? rep.musicas.map(s => `<button class="we" type="button" data-id="${s.id}"><b>${s.titulo}</b><small>${s.momento}${s.tom ? ' · ' + s.tom : ''}</small></button>`).join('')
    : '<p>Nenhuma música cadastrada nesta celebração.</p>';
}

async function access() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;

  const user = session?.user;
  $('sair').hidden = !user;

  if (!user) {
    $('editor').hidden = true;
    $('acesso').hidden = false;
    $('login').hidden = false;
    $('senha').hidden = true;
    message('Entre com seu e-mail e senha do Supabase.');
    return;
  }

  $('acesso').hidden = true;
  $('editor').hidden = false;
  await load();
  message('Acesso autorizado. Escolha uma celebração para começar.');
}

$('login').onsubmit = e => {
  e.preventDefault();
  run(async () => {
    message('Verificando acesso…');
    const { error } = await supabase.auth.signInWithPassword({
      email: e.target.email.value,
      password: e.target.password.value
    });
    if (error) throw error;
    e.target.password.value = '';
    await access();
  });
};

$('recuperar').onclick = () => run(async () => {
  const email = $('login').email.value;
  if (!email) throw new Error('Digite seu e-mail primeiro.');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + '/admin.html'
  });

  if (error) throw error;
  message('Se a conta estiver cadastrada, você receberá um link para redefinir a senha.');
});

$('senha').onsubmit = e => {
  e.preventDefault();
  run(async () => {
    const password = e.target.password.value;
    if (password !== e.target.confirm.value) throw new Error('As senhas precisam ser iguais.');

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    e.target.reset();
    e.target.hidden = true;
    await access();
  });
};

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    $('login').hidden = true;
    $('senha').hidden = false;
    message('Defina sua nova senha.');
  }
});

$('sair').onclick = () => {
  if (!discard()) return;
  run(async () => {
    await supabase.auth.signOut();
    clear();
    await access();
    message('Você saiu da conta.');
  });
};

form.addEventListener('input', () => dirty = true);

window.addEventListener('beforeunload', e => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

$('repertorios').onchange = e => {
  if (!discard()) {
    e.target.value = form.dataset.repertorio || e.target.value;
    return;
  }
  clear();
  form.dataset.repertorio = e.target.value;
  list();
};

$('nova-musica').onclick = $('cancelar').onclick = () => {
  if (discard()) {
    clear();
    form.elements.titulo.focus();
  }
};

$('recarregar').onclick = () => {
  if (!discard()) return;
  run(async () => {
    await load();
    clear();
    message('Lista atualizada.');
  });
};

$('lista-musicas').onclick = e => {
  const button = e.target.closest('[data-id]');
  if (!button || !discard()) return;

  current = reps.flatMap(r => r.musicas).find(s => s.id === button.dataset.id);
  if (!current) return;

  form.reset();

  for (const key of ['titulo','momento','tom','letra','cifraTexto','audio','cifra','partitura']) {
    const value = key === 'cifraTexto' ? current.cifra_texto : current[key];
    if (key === 'momento' && !momentos.includes(value)) {
      form.elements.momento.add(new Option(value, value));
    }
    form.elements[key].value = value || '';
  }

  dirty = false;
  $('modo').textContent = 'Editar música';
  $('excluir').hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
};

$('celebracao').onsubmit = e => {
  e.preventDefault();
  if (!discard()) return;

  run(async () => {
    const body = Object.fromEntries(new FormData(e.target));
    const { error } = await supabase.from('site_celebracoes').insert(body);
    if (error) throw error;

    await load();
    clear();
    e.target.reset();
    message('Celebração criada com sucesso.');
  });
};

form.onsubmit = e => {
  e.preventDefault();

  run(async () => {
    const repertorio = $('repertorios').value;
    if (!repertorio) throw new Error('Crie ou selecione uma celebração.');

    message('Salvando música e arquivos…');

    for (const input of form.querySelectorAll('[data-upload]')) {
      const file = input.files[0];
      if (!file) continue;

      const ext = file.name.split('.').pop().toLowerCase();
      const allowed = input.dataset.upload === 'audio'
        ? ['mp3','m4a','wav','ogg']
        : ['pdf'];

      if (!allowed.includes(ext)) throw new Error('Formato de arquivo inválido.');
      if (file.size > (ext === 'pdf' ? 10 : 20) * 1024 * 1024) {
        throw new Error('O arquivo ultrapassa o limite permitido.');
      }

      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('musicas').upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage.from('musicas').getPublicUrl(path);
      form.elements[input.dataset.upload].value = data.publicUrl;
      input.value = '';
    }

    const body = Object.fromEntries(new FormData(form));

    const registro = {
      repertorio,
      titulo: body.titulo,
      momento: body.momento,
      tom: body.tom || '',
      letra: body.letra || '',
      cifra_texto: body.cifraTexto || '',
      audio: body.audio || '',
      cifra: body.cifra || '',
      partitura: body.partitura || ''
    };

    let result;

    if (current) {
      result = await supabase.from('site_musicas').update(registro).eq('id', current.id);
    } else {
      result = await supabase.from('site_musicas').insert(registro);
    }

    if (result.error) throw result.error;

    dirty = false;
    await load(repertorio);
    clear();
    message('Música salva e publicada no site.');
  });
};

$('excluir').onclick = () => {
  if (!current || !confirm('Excluir esta música? Esta ação não pode ser desfeita.')) return;

  run(async () => {
    const { error } = await supabase.from('site_musicas').delete().eq('id', current.id);
    if (error) throw error;

    clear();
    await load();
    message('Música excluída.');
  });
};
$('abrir-personalizacao').onclick = () => {
  const painel = $('personalizar-site');
  painel.hidden = !painel.hidden;

  if (!painel.hidden) {
    painel.scrollIntoView({ behavior: 'smooth' });
  }
};
access().catch(error => {
  console.error(error);
  message('Erro ao verificar acesso: ' + error.message, true);
});
