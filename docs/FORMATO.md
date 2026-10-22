# Formato de um tema

Um tema é uma **pasta**. Não existe arquivo compactado, instalador nem formato
binário próprio: são os cursores do Windows e um JSON que diz qual é o papel de
cada um.

```
themes/
└── meu-tema/
    ├── theme.json      ← metadados (obrigatório)
    ├── preview.png     ← imagem do cartão (obrigatório)
    └── cursors/
        ├── normal.ani
        ├── link.ani
        └── busy.cur
```

## theme.json

O contrato completo está em [`schema.json`](../themes/schema.json). O mínimo:

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

| Campo | Regra |
| :--- | :--- |
| `slug` | Mesmo nome da pasta. Só minúsculas, números e hífen. Único no registry. |
| `name` | 2 a 48 caracteres. É o que aparece no app. |
| `author` | Seu usuário do GitHub ou nome de exibição. |
| `description` | 10 a 200 caracteres, sem quebra de linha. |
| `version` | `MAIOR.MENOR.CORREÇÃO`. Suba a versão a cada mudança publicada. |
| `license` | Identificador SPDX (`MIT`, `CC-BY-4.0`, `CC-BY-SA-4.0`…). |
| `tags` | Até 6, cada uma com até 20 caracteres. |
| `accent` | Cor `#rrggbb` usada no detalhe do cartão. |
| `size` | Maior lado do maior cursor, em pixels. **1 a 128** neste catálogo. Precisa bater com os arquivos — a validação mede. |
| `category` | Id de uma categoria de `categories.json`. Opcional; ausente ou desconhecido mostra o tema em "Outros". |
| `preview` | `preview.png`, 640×360, até 300 KB. |
| `cursors` | Pelo menos 1 par `file` + `role`, com `file` terminando em `.ani` ou `.cur`. |

## Efeitos

Um efeito de clique é uma **pasta** em `effects/<slug>/`:

```
effects/
└── meu-efeito/
    ├── effect.json     ← metadados (obrigatório)
    ├── preview.png     ← imagem do cartão (obrigatório)
    └── effect.bgra     ← a animação (obrigatório, UM arquivo)
```

### O arquivo `.bgra`

Quadros **quadrados** de 32 bits **BGRA com alpha pré-multiplicado**, um depois do
outro, sem cabeçalho. O arquivo precisa ter exatamente
`frames × lado × lado × 4` bytes. `tools/make-example-effect.py` é a referência
executável do formato.

| Regra | Limite |
| :--- | :--- |
| Lado do quadro | até 128 px, `width == height` |
| Quadros | de 8 a 60 |
| Tamanho do arquivo | até 4 MB |
| Extensões na pasta | só `.bgra`, `.json`, `.png` |

### effect.json

Mesmos campos de um `theme.json` (`slug`, `name`, `author`, `description`,
`version`, `license`, `tags`, `accent`, `category`, `preview`, `links`), sem
`cursors` e `size`, mais:

```json
"effect": { "file": "effect.bgra", "frames": 24, "width": 128, "height": 128 }
```

No `registry.json` o item leva `"kind": "effect"`, o mesmo bloco `effect`,
`"size"` igual ao lado do quadro e `"preview": "effects/<slug>/preview.png"`. O
validador confere que `effect.json` e registry dizem o mesmo e que o arquivo fecha
com os números declarados.

### Vínculos (`links`)

```json
"links": [{ "slug": "example-aurora-click", "relation": "recommends" }]
```

- `relation`: `recommends` (padrão) ou `requires`. Nos dois casos o app só **oferece**
  a instalação.
- Vale entre **tipos diferentes** (cursor ↔ efeito) e para slugs que existem.
- Basta **um** dos lados declarar; o app mostra "Combina com" nos dois.
- Aceita também a forma curta (`"links": ["slug"]`) e o nome antigo `related`.

## Tamanho e classificação

`size` é o **maior lado do maior cursor**, em pixels. O app usa esse número para
mostrar um selo colorido na grade ("Leve · 32×32", "Máximo · 128×128") com
tooltip explicando a classe. O campo é **obrigatório** no catálogo e precisa ser
igual ao tamanho real: a validação abre os cursores e compara.

A classificação **depende do destino** — e as réguas nunca são as mesmas:

| Faixa | Comunidade (este catálogo, teto 128) | Importação local no app (teto 256) |
| :--- | :--- | :--- |
| até 32 px | **Leve** | **Leve** |
| até 64 px | **Médio** | **Médio** |
| até 96 px | **Grande** | **Grande** |
| até 128 px | **Máximo** (o teto) | **Pesado** |
| até 256 px | — não existe na Comunidade | **Ultra** (o teto) |

Por isso um tema 128×128 é "Máximo" no catálogo e apenas "Pesado" quando
importado localmente. O `size` do catálogo nunca pode passar de 128; o app, na
importação manual, aceita até 256 — são réguas diferentes de propósito.

## Categorias

A lista de categorias é fechada e vem de [`categories.json`](../categories.json), na
raiz do repositório. Cada entrada tem `id`, `label`, `accent`, `cover` e
`description`, e a imagem fica em `categories/<id>.jpg` (640×360, até 120 KB).

- O tema escolhe uma categoria existente pelo `id`.
- Categoria nova **não** entra por pull request: exige imagem e card, feitos pelo
  mantenedor do catálogo.
- `id` não muda depois de publicado — os temas apontam para ele.
- Tema com `category` ausente ou com id que não existe é publicado em "Outros";
  a validação recusa o id desconhecido antes disso.

## Os 17 papéis do Windows

`role` precisa ser exatamente um destes valores:

| Papel | Nomes reconhecidos pelo app |
| :--- | :--- |
| `Arrow` | `normal`, `arrow` |
| `Help` | `help`, `question` |
| `AppStarting` | `working`, `appstarting`, `progress` |
| `Wait` | `busy`, `wait`, `loading` |
| `Crosshair` | `precision`, `crosshair`, `cell`, `cross` |
| `IBeam` | `text`, `ibeam`, `vertical-text` |
| `NWPen` | `handwriting`, `nwpen`, `pen` |
| `No` | `unavailable`, `no`, `not-allowed`, `forbidden` |
| `SizeNS` | `vertical`, `sizens`, `row-resize`, `ns-resize` |
| `SizeWE` | `horizontal`, `sizewe`, `col-resize`, `ew-resize` |
| `SizeNWSE` | `diagonal1`, `sizenwse`, `nwse-resize` |
| `SizeNESW` | `diagonal2`, `sizenesw`, `nesw-resize` |
| `SizeAll` | `move`, `sizeall`, `grab`, `grabbing`, `all-scroll` |
| `UpArrow` | `alternate`, `uparrow`, `copy`, `alias` |
| `Hand` | `link`, `hand`, `pointer` |
| `Pin` | `location`, `pin`, `crosshair-location` |
| `Person` | `person` |

Se o seu pack tem nomes que não estão nessa lista, o app ainda tenta encaixá-los
no papel mais próximo e **avisa na tela** que o encaixe é aproximado. Mas o ideal
é nomear os arquivos por papel — assim ninguém precisa adivinhar.

## Requisitos dos arquivos de cursor

| Item | Regra |
| :--- | :--- |
| Formatos | `.ani` (animado) ou `.cur` (estático). `.png` e `.svg` não são cursores do Windows. |
| Conteúdo | O arquivo precisa ser um `.cur`/`.ani` de verdade: diretório dentro do arquivo, RIFF/`ACON` íntegro, offsets válidos. A validação recusa extensão renomeada. |
| Tamanho | 32×32 é o padrão; **até 128×128** na Comunidade. 256×256 existe na importação local do app, não aqui. |
| Quadros | Até **60** quadros por `.ani`. |
| Alpha | Canal alpha de 32 bits. Cursor com fundo branco chapado fica inutilizável em tema escuro. |
| Hotspot | Centralizado no ponto de ação (a ponta da seta). |
| Nome | Minúsculas, sem espaços. `normal.ani`, `link.ani`, `busy.ani`. |
| Peso | Até **4 MB por arquivo** e **32 MB por tema**. |

> [!IMPORTANT]
> Estes são os limites da **Comunidade**. A importação local do Cursor Studio tem
> outra régua (256×256, 120 quadros, 16 MB por arquivo, 128 MB por tema) — as duas
> nunca são iguais. Um tema que passa aqui também passa lá; o contrário não vale.

## Boas práticas

- **Uma versão, uma mudança.** Não edite um tema já publicado sem subir `version`.
- **Preview honesto.** O `preview.png` é o que a pessoa vê antes de baixar; não use
  imagem de outro tema.
- **Licença clara.** Se o tema é adaptação de outro, cite a origem em `homepage`
  e mantenha a licença original.
- **Nada de binário executável.** Um tema só pode conter `.ani`, `.cur`, `.json` e
  `.png`. A validação recusa qualquer outra extensão.
