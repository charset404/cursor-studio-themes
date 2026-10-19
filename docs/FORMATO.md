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
| `preview` | `preview.png`, 640×360, até 300 KB. |
| `cursors` | Pelo menos 1 par `file` + `role`, com `file` terminando em `.ani` ou `.cur`. |

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
| Tamanho | 32×32 é o padrão; até 256×256 é aceito pelo Windows. |
| Alpha | Canal alpha de 32 bits. Cursor com fundo branco chapado fica inutilizável em tema escuro. |
| Hotspot | Centralizado no ponto de ação (a ponta da seta). |
| Nome | Minúsculas, sem espaços. `normal.ani`, `link.ani`, `busy.ani`. |
| Peso | Até 512 KB por arquivo, 4 MB por tema. |

## Boas práticas

- **Uma versão, uma mudança.** Não edite um tema já publicado sem subir `version`.
- **Preview honesto.** O `preview.png` é o que a pessoa vê antes de baixar; não use
  imagem de outro tema.
- **Licença clara.** Se o tema é adaptação de outro, cite a origem em `homepage`
  e mantenha a licença original.
- **Nada de binário executável.** Um tema só pode conter `.ani`, `.cur`, `.json` e
  `.png`. A validação recusa qualquer outra extensão.
