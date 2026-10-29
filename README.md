# Casapueblo Eventos Laranjal

Landing page de captação de orçamentos para o **Casapueblo**, espaço de eventos no Laranjal, Pelotas - RS. O visitante preenche um formulário curto, os dados são gravados em uma planilha do Google, o gestor recebe um aviso por e-mail e o cliente é levado ao WhatsApp com a mensagem já pronta.

**Site no ar:** https://casapueblolaranjal.eventslaranjal.workers.dev

## Como funciona

```
Visitante preenche o formulário
        │
        ▼
Site valida os campos e envia os dados ──► Google Apps Script
        │                                        │
        │                                        ├─► grava na planilha (Google Sheets)
        │                                        └─► avisa o gestor por e-mail
        ▼
Abre o WhatsApp com a mensagem formatada
```

## O que já está pronto

- Página única, responsiva (mobile-first), com identidade visual branca, laranja e terracota
- Cabeçalho com logo, galeria com 6 fotos, 4 diferenciais e 3 depoimentos de clientes
- Formulário com nome, WhatsApp (com máscara), tipo de evento, data, estimativa de convidados e orçamento
- Selo de segurança contratual, mapa com a localização exata e botão flutuante do WhatsApp
- Gravação automática dos leads em planilha e aviso por e-mail a cada novo contato
- Rastreamento de origem do lead por links com UTM (Instagram, WhatsApp, Google etc.)
- Aviso de privacidade abaixo do botão de envio e página de **Política de Privacidade** (LGPD)
- Ficha no Google Meu Negócio apontando para o site
- Código comentado em português, pensado para aprendizado

## Tecnologias

- HTML5, JavaScript puro e [Tailwind CSS](https://tailwindcss.com) (carregado por CDN)
- Google Apps Script e Google Sheets para o armazenamento dos leads
- Hospedagem no Cloudflare (Workers com arquivos estáticos), com publicação automática a cada alteração no GitHub

## Estrutura do repositório

```
index.html                  # página inteira: layout, estilos e lógica do formulário
politica-privacidade.html   # política de privacidade (o nome do arquivo não pode mudar)
fotos/                      # logo.png e salao-1.jpg ... salao-6.jpg
README.md
```

## Como atualizar o site

1. No GitHub, abra o repositório e clique em **Add file → Upload files**.
2. Arraste o arquivo novo (por exemplo, o `index.html`) e confirme a substituição.
3. Clique em **Commit changes**.
4. Em cerca de 1 minuto o Cloudflare publica a versão nova. Confira em aba anônima.

## Configuração

No início do bloco de JavaScript do `index.html`:

| Constante | Para que serve |
|---|---|
| `NUMERO_WHATSAPP` | Número que recebe as mensagens (55 + DDD + número) |
| `ENDPOINT_PLANILHA` | Endereço da implantação do Google Apps Script |
| `ESPERA_MAXIMA_MS` | Tempo máximo de espera pela confirmação do Google |

A planilha usa as colunas: Data | Nome | WhatsApp | Tipo de evento | Data do evento | Convidados | Orçamento | Origem | Campanha. O script do Apps Script fica fora do repositório; o acesso da implantação precisa estar como **Qualquer pessoa**. Para mudar o e-mail que recebe os avisos, edite `EMAIL_AVISO` no script e reimplante pelo lápis (Nova versão), para o link não mudar.

### Links com origem (UTM)

Use um link por canal de divulgação para saber de onde vêm os clientes:

```
https://casapueblolaranjal.eventslaranjal.workers.dev/?utm_source=instagram&utm_medium=bio
https://casapueblolaranjal.eventslaranjal.workers.dev/?utm_source=whatsapp&utm_medium=status
https://casapueblolaranjal.eventslaranjal.workers.dev/?utm_source=google&utm_medium=meunegocio
```
