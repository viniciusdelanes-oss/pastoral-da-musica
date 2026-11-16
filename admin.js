
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZipReader, BlobReader, BlobWriter } from 'https://esm.sh/@zip.js/zip.js@2.7.57';

const SUPABASE_URL = 'https://gnsohfohcjaolfyxmpsw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_F5WPlc--Rxyxn-YIC1H5VA_q5o6Hc12';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const form = $('musica');
const momentos = [
  'Refrão orante inicial',
  'Entrada',
  'Ato penitencial',
  'Glória',
  'Liturgia da Palavra',
  'Salmo',
  'Aclamação',
  'Ofertório',
  'Santo',
  'Cordeiro de Deus',
  'Comunhão',
  'Final'
];

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
  const importarRepertorio = $('importar-repertorio');

if (importarRepertorio) {
  importarRepertorio.innerHTML = reps.length
    ? reps.map(r => `<option value="${r.id}">${r.data.split('-').reverse().join('/')} · ${r.celebracao}</option>`).join('')
    : '<option value="">Crie uma celebração primeiro</option>';

  importarRepertorio.value = reps.some(r => r.id === selected)
    ? selected
    : (reps[0]?.id || '');
}
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
  await carregarPersonalizacao();
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

$('abrir-noticias').onclick = () => {
  const painel = $('gerenciar-noticias');
  painel.hidden = !painel.hidden;

  if (!painel.hidden) {
    painel.scrollIntoView({ behavior: 'smooth' });
  }
};
// PERSONALIZAÇÃO DO SITE

const formSite = $('form-site');
async function enviarImagens(formulario) {
  for (const input of formulario.querySelectorAll('input[type="file"][data-upload]')) {
    const file = input.files[0];
    if (!file) continue;

    if (!file.type.startsWith('image/')) {
      throw new Error('Selecione um arquivo de imagem válido.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('A imagem deve ter no máximo 5 MB.');
    }

    const extensao = file.name.split('.').pop().toLowerCase();
    const caminho = `${crypto.randomUUID()}.${extensao}`;

    const { error } = await supabase.storage
      .from('site-assets')
      .upload(caminho, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from('site-assets')
      .getPublicUrl(caminho);

    formulario.elements[input.dataset.upload].value = data.publicUrl;
    input.value = '';
  }
}
let configuracaoSiteId = null;

async function carregarPersonalizacao() {
  const { data, error } = await supabase
    .from('site_configuracoes')
    .select('id, valor')
    .eq('chave', 'conteudo_site')
    .maybeSingle();

  if (error) throw error;

  configuracaoSiteId = data?.id || null;
  const valores = data?.valor || {};

  for (const campo of formSite.elements) {
    if (campo.name && valores[campo.name] !== undefined) {
      campo.value = valores[campo.name] ?? '';
    }
  }
}

formSite.onsubmit = e => {
  e.preventDefault();

  run(async () => {
    message('Salvando personalizações…');
await enviarImagens(formSite);
    const valores = Object.fromEntries(new FormData(formSite));

    let resultado;

    if (configuracaoSiteId) {
      resultado = await supabase
        .from('site_configuracoes')
        .update({
          valor: valores,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', configuracaoSiteId);
    } else {
      resultado = await supabase
        .from('site_configuracoes')
        .insert({
          chave: 'conteudo_site',
          valor: valores
        })
        .select('id')
        .single();

      if (!resultado.error) {
        configuracaoSiteId = resultado.data.id;
      }
    }

    if (resultado.error) throw resultado.error;

    message('Personalizações salvas com sucesso.');
  });
};
// GERENCIAMENTO DE NOTÍCIAS

const formNoticia = $('form-noticia');

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caractere]);
}

async function carregarNoticias() {
  const { data, error } = await supabase
    .from('site_noticias')
    .select('*')
    .order('ordem', { ascending: true })
    .order('data_publicacao', { ascending: false });

  if (error) throw error;

  $('lista-noticias').innerHTML = data.length
    ? data.map(n => `
      <div class="panel" style="margin-bottom:12px">
        <strong>${escaparHTML(n.titulo)}</strong>
        <p>${escaparHTML(n.data_publicacao || '')} · ${escaparHTML(n.tamanho)} · ${n.publicado ? 'Publicado' : 'Rascunho'}</p>
        <button class="btn secondary" type="button" data-editar-noticia="${n.id}">Editar</button>
        <button class="btn perigo" type="button" data-excluir-noticia="${n.id}">Excluir</button>
      </div>
    `).join('')
    : '<p>Nenhuma notícia cadastrada ainda.</p>';
}

$('abrir-noticias').addEventListener('click', () => {
  run(async () => {
    await carregarNoticias();
  });
});

formNoticia.onsubmit = e => {
  e.preventDefault();

  run(async () => {
    await enviarImagens(formNoticia);
    const body = Object.fromEntries(new FormData(formNoticia));

    const registro = {
      titulo: body.titulo,
      subtitulo: body.subtitulo || '',
      conteudo: body.conteudo || '',
      imagem_capa: body.imagem_capa || '',
      data_publicacao: body.data_publicacao || null,
      tamanho: body.tamanho,
      ordem: Number(body.ordem) || 0,
      publicado: formNoticia.elements.publicado.checked
    };

    let resultado;

    if (body.id) {
      resultado = await supabase
        .from('site_noticias')
        .update(registro)
        .eq('id', body.id);
    } else {
      resultado = await supabase
        .from('site_noticias')
        .insert(registro);
    }

    if (resultado.error) throw resultado.error;

    formNoticia.reset();
    formNoticia.elements.id.value = '';
    await carregarNoticias();
    message('Notícia salva com sucesso.');
  });
};

$('lista-noticias').onclick = e => {
  const editar = e.target.closest('[data-editar-noticia]');
  const excluir = e.target.closest('[data-excluir-noticia]');

  if (editar) {
    run(async () => {
      const { data, error } = await supabase
        .from('site_noticias')
        .select('*')
        .eq('id', editar.dataset.editarNoticia)
        .single();

      if (error) throw error;

      for (const campo of [
        'id', 'titulo', 'subtitulo', 'conteudo',
        'imagem_capa', 'data_publicacao',
        'tamanho', 'ordem'
      ]) {
        formNoticia.elements[campo].value = data[campo] ?? '';
      }

      formNoticia.elements.publicado.checked = data.publicado;
      formNoticia.scrollIntoView({ behavior: 'smooth' });
      message('Editando notícia. Faça as alterações e salve.');
    });
  }

  if (excluir && confirm('Deseja excluir esta notícia?')) {
    run(async () => {
      const { error } = await supabase
        .from('site_noticias')
        .delete()
        .eq('id', excluir.dataset.excluirNoticia);

      if (error) throw error;

      await carregarNoticias();
      message('Notícia excluída.');
    });
  }
};

formNoticia.onreset = () => {
  setTimeout(() => {
    formNoticia.elements.id.value = '';
  }, 0);
};

access().catch(error => {
  console.error(error);
  message('Erro ao verificar acesso: ' + error.message, true);
});

$('analisar-zip').onclick = () => run(async () => {
  function identificarMomento(nome) {
  const texto = nome.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (texto.includes('ENTRADA')) return 'Entrada';
if (texto.includes('OFEREND') || texto.includes('OFERT')) return 'Ofertório';
  if (texto.includes('COMUNHAO')) return 'Comunhão';
  if (texto.includes('SALMO')) return 'Salmo';
  if (texto.includes('ALELUIA') || texto.includes('ACLAMACAO')) return 'Aclamação';
  if (texto.includes('SANTO')) return 'Santo';
  if (texto.includes('CORDEIRO')) return 'Cordeiro de Deus';
  if (texto.includes('GLORIA')) return 'Glória';
  if (texto.includes('PENITENCIAL')) return 'Ato penitencial';

  return 'Liturgia da Palavra';
}
const arquivos = document.getElementById('arquivos-zip').files;
  if (!arquivos.length) {
    throw new Error('Selecione pelo menos um arquivo ZIP.');
  }

  const resultado = $('resultado-importacao');
  resultado.textContent = 'Analisando arquivos...';

  let relatorio = [];
  let totalAudios = 0;
  let totalPDFs = 0;
  let totalPares = 0;

  for (const zip of arquivos) {
    const reader = new ZipReader(new BlobReader(zip));

    try {
      const entradas = await reader.getEntries();
      const grupos = new Map();

      for (const entrada of entradas) {
        if (entrada.directory) continue;

        const nome = entrada.filename.split('/').pop();
        const tituloArquivo = nome
  .replace(/\.[^.]+$/, '')
  .replace(/^\s*\d+[\s._-]*/, '')
  .trim();
        const extensao = nome.split('.').pop().toLowerCase();

        if (!['mp3','m4a','wav','ogg','pdf'].includes(extensao)) {
          continue;
        }

     const correspondencia = nome.match(/(\d+)/);

if (!correspondencia) continue;

const titulo = correspondencia[1].padStart(2, '0');

      if (!grupos.has(titulo)) {
grupos.set(titulo, { audios: [], pdfs: [], tituloArquivo: '' });
        if (tituloArquivo && !grupos.get(titulo).tituloArquivo) {
  grupos.get(titulo).tituloArquivo = tituloArquivo;
}
}

if (extensao === 'pdf') {
  grupos.get(titulo).pdfs.push(nome);
  totalPDFs++;
} else {
  grupos.get(titulo).audios.push(nome);
  totalAudios++;
}
      }

   let pares = 0;
let semAudio = 0;
let semPDF = 0;

let detalhes = [];

for (const [numero, item] of grupos.entries()) {
  if (item.audios.length > 1 || item.pdfs.length > 1) {
    detalhes.push(
      `Nº ${numero} - DUPLICIDADE: CONFERIR MANUALMENTE\n` +
      `Áudios: ${item.audios.join(', ') || 'Nenhum'}\n` +
      `PDFs: ${item.pdfs.join(', ') || 'Nenhum'}`
    );
  } else if (item.audios.length === 1 && item.pdfs.length === 1) {
    pares++;
    detalhes.push(
      `Nº ${numero} - ${item.tituloArquivo || 'SEM TÍTULO'} - PAR ENCONTRADO\n` +
      `Áudio: ${item.audios[0]}\nPDF: ${item.pdfs[0]}`
    );
  } else if (item.pdfs.length === 1) {
    semAudio++;
    detalhes.push(
     `Nº ${numero} - ${item.tituloArquivo || 'SEM TÍTULO'} - PDF SEM ÁUDIO\nPDF: ${item.pdfs[0]}`
    );
  } else if (item.audios.length === 1) {
    semPDF++;
    detalhes.push(
    `Nº ${numero} - ${item.tituloArquivo || 'SEM TÍTULO'} - ÁUDIO SEM PDF\nÁudio: ${item.audios[0]}`
    );
  }
}
      totalPares += pares;

     relatorio.push(
  `${zip.name}\n` +
  `Músicas identificadas: ${grupos.size}\n` +
  `Pares de áudio e PDF: ${pares}\n` +
  `PDFs sem áudio: ${semAudio}\n` +
  `Áudios sem PDF: ${semPDF}\n\n` +
  detalhes.join('\n\n')
);
    } finally {
      await reader.close();
    }
  }

  resultado.textContent =
    relatorio.join('\n\n') +
    `\n\nTOTAL DE PARES: ${totalPares}` +
    `\nTOTAL DE ÁUDIOS: ${totalAudios}` +
    `\nTOTAL DE PDFs: ${totalPDFs}`;
});
