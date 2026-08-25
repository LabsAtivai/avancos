#!/usr/bin/env python3
"""
Gerador de gráficos para o sistema de relatórios Ativa.ai
Chamado pelo NestJS via child_process — recebe JSON via stdin, retorna PNG via stdout
"""
import sys, json, base64, os, traceback
from io import BytesIO

# Debug: print Python version and available packages to stderr
print(f"Python {sys.version}", file=sys.stderr)
print(f"PATH: {os.environ.get('PATH', 'N/A')}", file=sys.stderr)

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.gridspec import GridSpec
    print(f"matplotlib {matplotlib.__version__} OK", file=sys.stderr)
except ImportError as e:
    print(f"ERRO: matplotlib não encontrado: {e}", file=sys.stderr)
    sys.exit(1)

try:
    from PIL import Image
    print("PIL OK", file=sys.stderr)
except ImportError as e:
    print(f"ERRO: PIL não encontrado: {e}", file=sys.stderr)
    sys.exit(1)

CORES = [
    '#0f5ba6','#1e88e5','#42a5f5','#90caf9',
    '#e53935','#ef9a9a','#43a047','#a5d6a7',
    '#fb8c00','#ffcc80','#8e24aa','#ce93d8',
    '#00897b','#80cbc4','#f4511e','#ffab91',
    '#757575','#bdbdbd','#3949ab','#9fa8da',
]

def gerar_chart(dados, titulo, col_label, W=1008, H=263):
    dpi = 150
    fig = plt.figure(figsize=(W/dpi, H/dpi), dpi=dpi)
    fig.patch.set_alpha(0)

    gs = GridSpec(1, 2, figure=fig,
                  left=0.01, right=0.99, top=0.88, bottom=0.03,
                  wspace=0.05, width_ratios=[0.44, 0.56])

    total = sum(d['valor'] for d in dados)
    top   = dados[:15]

    # ── Tabela ──────────────────────────────────────────────────────────
    ax_t = fig.add_subplot(gs[0, 0])
    ax_t.axis('off')
    ax_t.set_xlim(0, 1)
    ax_t.set_ylim(0, 1)

    ax_t.text(0, 1.0, titulo, fontsize=7.5, fontweight='bold',
              transform=ax_t.transAxes, va='top')
    ax_t.text(0, 0.92, col_label, fontsize=5.5, color='#666',
              transform=ax_t.transAxes, va='top', style='italic')

    n = len(top)
    row_h = 0.84 / max(n, 1)
    for i, d in enumerate(top):
        nome = d['label']
        cnt  = d['valor']
        y    = 0.90 - (i + 1) * row_h
        pct  = cnt / total * 100
        cor  = CORES[i % len(CORES)]

        ax_t.add_patch(mpatches.Circle(
            (0.007, y + row_h * 0.35), 0.009,
            color=cor, transform=ax_t.transAxes, clip_on=False))

        nome_s = nome[:42] + '\u2026' if len(nome) > 42 else nome
        ax_t.text(0.022, y + row_h * 0.35, nome_s,
                  fontsize=5.2, transform=ax_t.transAxes,
                  va='center', color='#1a1a1a')
        ax_t.text(0.90, y + row_h * 0.35, str(cnt),
                  fontsize=5.2, ha='right',
                  transform=ax_t.transAxes, va='center', color='#444')
        ax_t.text(0.99, y + row_h * 0.35, f'{pct:.2f}%',
                  fontsize=5.2, ha='right',
                  transform=ax_t.transAxes, va='center', color='#888')

    # ── Pizza ────────────────────────────────────────────────────────────
    ax_p = fig.add_subplot(gs[0, 1])
    values = [d['valor'] for d in top]
    labels = [d['label'][:24] + '\u2026' if len(d['label']) > 24 else d['label'] for d in top]
    cores  = [CORES[i % len(CORES)] for i in range(len(top))]

    wedges, _, autotexts = ax_p.pie(
        values, labels=None, colors=cores,
        autopct=lambda p: f'{p:.1f}%' if p >= 4.5 else '',
        pctdistance=0.75, startangle=90,
        wedgeprops=dict(linewidth=0.6, edgecolor='white'),
    )
    for at in autotexts:
        at.set_fontsize(4.8)
        at.set_color('white')
        at.set_fontweight('bold')

    ax_p.legend(wedges, labels, loc='center left',
                bbox_to_anchor=(0.88, 0.5), fontsize=4.2,
                frameon=False, ncol=1, handlelength=0.7, labelspacing=0.25)

    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=dpi, transparent=True,
                bbox_inches='tight', pad_inches=0.01)
    plt.close(fig)
    buf.seek(0)

    img = Image.open(buf).convert('RGBA')
    img = img.resize((W, H), Image.LANCZOS)
    out = BytesIO()
    img.save(out, format='PNG')
    return out.getvalue()

if __name__ == '__main__':
    try:
        raw = sys.stdin.read()
        print(f"Input recebido: {len(raw)} chars", file=sys.stderr)
        payload = json.loads(raw)
        png = gerar_chart(
            payload['dados'],
            payload['titulo'],
            payload['colLabel'],
            payload.get('width', 1008),
            payload.get('height', 263),
        )
        print(f"PNG gerado: {len(png)} bytes", file=sys.stderr)
        sys.stdout.buffer.write(base64.b64encode(png))
    except Exception as e:
        print(f"ERRO na execução: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
