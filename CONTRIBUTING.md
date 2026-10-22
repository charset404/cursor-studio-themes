# Como contribuir

Obrigado por querer publicar um tema. O caminho é curto: **uma pasta, um JSON e
um Pull Request**. A validação automática confere o formato antes de qualquer
pessoa revisar.

## Antes de começar

- O tema precisa ser **seu** ou de domínio público/compatível. Adaptação de tema
  alheio? Cite a origem em `homepage` e mantenha a licença original.
- Nada de conteúdo ofensivo, marcas registradas de terceiros ou cursores
  ilegíveis (fundo branco chapado, sem alpha).
- Um Pull Request por tema. Facilita a revisão e o histórico.

## Passo a passo

### 1. Fork e clone

```bash
git clone https://github.com/<voce>/cursor-studio-themes
cd cursor-studio-themes
```

### 2. Crie a pasta do tema

Copie o exemplo — ele já vem com a estrutura certa:

```bash
cp -r themes/example-aurora themes/meu-tema
```

O `slug` é o nome da pasta: **minúsculas, números e hífen**, sem acento.
`meu-tema` está certo; `Meu Tema` e `meu_tema` não estão.

### 3. Coloque seus cursores

Coloque os arquivos em `themes/meu-tema/cursors/`, sempre em minúsculas:

```
themes/meu-tema/cursors/
├── normal.ani    → Arrow
├── link.ani      → Hand
├── busy.ani      → Wait
└── ...
```

Use os nomes de papel da [tabela do formato](docs/FORMATO.md#os-17-papéis-do-windows)
sempre que puder. O app consegue encaixar nomes parecidos, mas nomear por papel
evita aproximações na tela do usuário.

### 4. Ajuste os metadados

Edite `themes/meu-tema/theme.json`:

```json
{
  "slug": "meu-tema",
  "name": "Meu Tema",
  "author": "seu-usuario",
  "description": "Uma frase curta sobre o visual do tema.",
  "version": "1.0.0",
  "license": "MIT",
  "tags": ["escuro", "minimalista"],
  "accent": "#7c9cff",
  "size": 32,
  "preview": "preview.png",
  "cursors": [
    { "file": "normal.ani", "role": "Arrow" },
    { "file": "link.ani", "role": "Hand" }
  ]
}
```

O `size` é o **maior lado do maior cursor**, em pixels (32, 64, 96 ou 128). Ele
precisa bater com os arquivos: a validação mede e recusa se estiver diferente.
O teto da Comunidade é **128×128**; a importação local do app vai além, mas o
catálogo não.

Troque também `themes/meu-tema/preview.png` por uma imagem sua: **640×360**, até
300 KB. É o que a pessoa vê antes de baixar.

### 5. Adicione ao índice

Em `registry.json`, inclua o tema na lista `themes` (mesmos dados do `theme.json`,
com `slug` igual ao da pasta e o mesmo `size`):

```json
{
  "slug": "meu-tema",
  "name": "Meu Tema",
  "author": "seu-usuario",
  "description": "Uma frase curta sobre o visual do tema.",
  "version": "1.0.0",
  "license": "MIT",
  "tags": ["escuro", "minimalista"],
  "accent": "#7c9cff",
  "size": 32,
  "preview": "themes/meu-tema/preview.png",
  "cursors": [
    { "file": "cursors/normal.ani", "role": "Arrow" },
    { "file": "cursors/link.ani", "role": "Hand" }
  ]
}
```

> [!NOTE]
> No `registry.json` o caminho do cursor começa a partir da pasta do tema
> (`cursors/normal.ani`); no `theme.json` é só o nome do arquivo (`normal.ani`).

### 6. Valide

```bash
node tools/validate.mjs
```

```text
✓ 1 tema(s) válido(s), 1 pasta(s) conferida(s).
```

Se aparecer algo, o erro diz o arquivo e a regra. O mesmo comando roda na CI,
então **PR que passa na validação está com o formato garantido**.

### 7. Abra o Pull Request

Título no formato `tema: Nome do Tema`. Preencha o checklist do template — ele
lista exatamente o que a revisão vai olhar.

## Publicar um efeito de clique

1. Copie `effects/example-aurora-click` para `effects/<seu-slug>/`.
2. Gere o `effect.bgra` (veja `tools/make-example-effect.py`): quadros quadrados
   BGRA pré-multiplicados, até 128 px, de 8 a 60 quadros, até 4 MB.
3. Ajuste `effect.json` e `preview.png` (640×360, até 300 KB).
4. Adicione o item ao `registry.json` com `"kind": "effect"` (copie o exemplo —
   `effect`, `size` e `version` precisam bater com o `effect.json`).
5. Se combina com um tema de cursor, declare `links` (opcional) e rode
   `node tools/readme.mjs` para atualizar a tabela do README.
6. `node tools/validate.mjs` precisa passar. Abra o Pull Request.

## Checklist de revisão

- [ ] `node tools/validate.mjs` passa
- [ ] O `preview.png` corresponde ao tema (não é imagem de outro)
- [ ] Todos os cursores têm alpha; nenhum tem fundo branco chapado
- [ ] Os papéis fazem sentido (a seta é `Arrow`, a mão é `Hand`…)
- [ ] A licença é compatível e está declarada
- [ ] O tema está no `registry.json` e o `name` bate nos dois arquivos
- [ ] O `size` bate nos dois JSONs **e** com o maior cursor (até 128×128)
- [ ] Nenhum `.ani` passa de 60 quadros; nenhum arquivo passa de 4 MB e o tema de 32 MB
- [ ] `version` é `1.0.0` (ou maior, se for atualização)

## Atualizando um tema já publicado

1. Suba `version` no `theme.json` **e** no `registry.json`.
2. Troque ou adicione os arquivos em `cursors/`.
3. Rode a validação.
4. Abra o PR explicando o que mudou.

Mudanças de visual sem subir a versão fazem o app achar que o tema está velho
quando não está — por isso a versão vem antes de qualquer outra coisa.

## Dúvidas

Abra uma [issue](https://github.com/charset404/cursor-studio-themes/issues/new/choose)
usando o template de "Dúvida" ou o de "Proposta de tema". Para problemas no app em
si, o lugar é o [repositório do Cursor Studio](https://github.com/charset404/cursor-studio).
## Categoria

Todo tema pode declarar `"category": "<id>"` no `theme.json`, usando um id que já
exista em [`categories.json`](../categories.json). Categoria nova não é aceita por
pull request: a criação passa pelo mantenedor, que produz a imagem e o card. Tema
sem categoria, ou com categoria inexistente, é publicado em "Outros" — e a
validação do CI recusa o id desconhecido.
