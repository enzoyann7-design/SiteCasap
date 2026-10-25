const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Todos os pedidos desta suíte são simulados; ela nunca acessa a planilha real.
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).filter(code => code.trim());

function pagina(fetchSimulado = async () => ({ ok: true, text: async () => '{"ok":true}' })) {
  const valores = {
    nome: 'Pessoa fictícia', whats: '(53) 99999-1234', evento: 'Outro',
    data: '2099-01-01', convidados: '30 a 60 pessoas',
    'orcamento-valor': 'R$ 2.500 a R$ 4.000'
  };
  const elementos = {};
  const pedidos = [];
  const navegacoes = [];
  const avisos = [];
  const temporizadores = new Map();
  const botao = { disabled: false, textContent: 'Enviar pelo WhatsApp' };
  function elemento(id) {
    return elementos[id] ??= {
      value: valores[id] ?? '', textContent: '', min: '', href: '',
      mensagemValidacao: '', atributos: {}, eventos: {},
      classList: {
        valores: new Set(['erro', 'status-envio', 'continuar-whatsapp'].includes(id) ? ['hidden'] : []),
        add(valor) { this.valores.add(valor); },
        remove(valor) { this.valores.delete(valor); },
        contains(valor) { return this.valores.has(valor); }
      },
      setCustomValidity(mensagem) { this.mensagemValidacao = mensagem; },
      setAttribute(nome, valor) { this.atributos[nome] = valor; },
      removeAttribute(nome) { delete this.atributos[nome]; },
      addEventListener(evento, callback) { (this.eventos[evento] ??= []).push(callback); }
    };
  }
  const form = elemento('form');
  form.querySelector = () => botao;
  form.reportValidity = () => Object.keys(valores).every(id => {
    const campo = elemento(id);
    return campo.value && !campo.mensagemValidacao && (id !== 'data' || campo.value >= campo.min);
  });
  const contexto = vm.createContext({
    document: { getElementById: elemento }, tailwind: {},
    Date, URLSearchParams, AbortController, encodeURIComponent,
    fetch: async (url, opcoes) => {
      pedidos.push({ url, opcoes, dados: Object.fromEntries(opcoes.body) });
      return fetchSimulado(url, opcoes);
    },
    window: { location: { assign: url => navegacoes.push(url) } },
    console: { warn: (...args) => avisos.push(args) },
    setTimeout(callback) { const id = temporizadores.size + 1; temporizadores.set(id, callback); return id; },
    clearTimeout(id) { temporizadores.delete(id); }
  });
  for (const codigo of scripts) vm.runInContext(codigo, contexto);
  return {
    elementos, pedidos, navegacoes, avisos, botao, temporizadores,
    enviar: () => form.eventos.submit[0]({ preventDefault() {} }),
    preencher(id, valor) {
      const campo = elemento(id);
      campo.value = valor;
      const evento = { target: campo };
      for (const callback of campo.eventos.input ?? []) callback(evento);
      for (const callback of form.eventos.input ?? []) callback(evento);
    }
  };
}

test('valida o formulário, o envio confirmado e as falhas sem acessar a planilha real', async t => {
  await t.test('recusa data passada antes de enviar', async () => {
    const p = pagina();
    p.preencher('data', '2020-01-01');
    await p.enviar();
    assert.match(p.elementos.data.mensagemValidacao, /data futura/);
    assert.equal(p.pedidos.length, 0);
    assert.equal(p.navegacoes.length, 0);
  });

  await t.test('recusa nome em branco e limpa a mensagem quando o usuário corrige', async () => {
    const p = pagina();
    p.preencher('nome', '   ');
    await p.enviar();
    assert.equal(p.pedidos.length, 0);
    p.preencher('nome', ' Pessoa fictícia ');
    await p.enviar();
    assert.equal(p.pedidos[0].dados.nome, 'Pessoa fictícia');
  });

  await t.test('preserva número com +55 e só navega depois da confirmação', async () => {
    let confirmar;
    const p = pagina(() => new Promise(resolve => { confirmar = resolve; }));
    p.preencher('whats', '+55 (53) 99999-1234');
    assert.equal(p.elementos.whats.value, '(53) 99999-1234');
    const envio = p.enviar();
    assert.equal(p.botao.disabled, true);
    assert.equal(p.navegacoes.length, 0);
    assert.equal(p.pedidos[0].dados.whatsapp, '(53) 99999-1234');
    assert.equal(p.pedidos[0].dados.dataEvento, '01/01/2099');
    assert.equal(p.pedidos[0].opcoes.mode, 'cors');
    assert.equal(p.pedidos[0].opcoes.credentials, 'omit');
    confirmar({ ok: true, text: async () => '{"result":"success","row":2}' });
    await envio;
    assert.equal(p.navegacoes.length, 1);
    assert.ok(p.navegacoes[0].startsWith('https://wa.me/5553991041249?text='));
    assert.match(decodeURIComponent(p.navegacoes[0]), /WhatsApp:\* \(53\) 99999-1234/);
    assert.equal(p.temporizadores.size, 0);
  });

  await t.test('aceita telefone com 10 dígitos e DDD 55 sem remover o DDD', async () => {
    const p = pagina();
    p.preencher('whats', '(55) 3333-1234');
    assert.equal(p.elementos.whats.value, '(55) 3333-1234');
    await p.enviar();
    assert.equal(p.pedidos[0].dados.whatsapp, '(55) 3333-1234');
  });

  await t.test('recusa número incompleto ou longo sem truncar dígitos', async () => {
    const p = pagina();
    p.preencher('whats', '539999');
    await p.enviar();
    assert.equal(p.pedidos.length, 0);
    p.preencher('whats', '12345678901234');
    assert.equal(p.elementos.whats.value, '12345678901234');
    await p.enviar();
    assert.equal(p.pedidos.length, 0);
  });

  await t.test('impede clique duplo e reabertura não envia os mesmos dados novamente', async () => {
    let confirmar;
    const p = pagina(() => new Promise(resolve => { confirmar = resolve; }));
    const envio = p.enviar();
    await p.enviar();
    assert.equal(p.pedidos.length, 1);
    confirmar({ ok: true, text: async () => '{"ok":true}' });
    await envio;
    await p.enviar();
    assert.equal(p.pedidos.length, 1);
    assert.equal(p.navegacoes.length, 2);
    assert.equal(p.botao.textContent, 'Abrir WhatsApp');
  });

  for (const [caso, resposta] of [
    ['HTTP 401', async () => ({ ok: false, status: 401 })],
    ['falha de rede ou CORS', async () => { throw new TypeError('Failed to fetch'); }],
    ['HTML em vez de confirmação', async () => ({ ok: true, text: async () => '<html>Login</html>' })],
    ['erro informado pelo servidor', async () => ({ ok: true, text: async () => '{"ok":false}' })]
  ]) {
    await t.test(`informa ${caso}, libera o botão e oferece WhatsApp sem afirmar sucesso`, async () => {
      const p = pagina(resposta);
      await p.enviar();
      assert.equal(p.avisos.length, 1);
      assert.equal(p.navegacoes.length, 0);
      assert.equal(p.elementos.erro.classList.contains('hidden'), false);
      assert.match(p.elementos.erro.textContent, /Não foi possível confirmar/);
      assert.equal(p.elementos['continuar-whatsapp'].classList.contains('hidden'), false);
      assert.ok(p.elementos['continuar-whatsapp'].href.startsWith('https://wa.me/'));
      assert.equal(p.botao.disabled, false);
      assert.equal(p.temporizadores.size, 0);
    });
  }

  await t.test('encerra a espera ao atingir o limite sem reenviar automaticamente', async () => {
    const p = pagina((url, opcoes) => new Promise((resolve, reject) => {
      opcoes.signal.addEventListener('abort', () => reject(new Error('AbortError')));
    }));
    const envio = p.enviar();
    [...p.temporizadores.values()][0]();
    await envio;
    assert.equal(p.pedidos.length, 1);
    assert.equal(p.navegacoes.length, 0);
    assert.equal(p.botao.disabled, false);
    assert.match(p.elementos.erro.textContent, /Não foi possível confirmar/);
  });
});
