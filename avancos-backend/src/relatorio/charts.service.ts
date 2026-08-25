import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';

export interface ChartDado {
  label: string;
  valor: number;
}

@Injectable()
export class ChartsService {

  private scriptPath = path.join(__dirname, 'gerar_chart.py');

  /**
   * Gera PNG de pizza + tabela via Python/matplotlib
   * Suporte total a UTF-8/acentos sem dependência de fontes do sistema
   */
  async gerarPizzaComTabela(
    dados: ChartDado[],
    titulo: string,
    labelColuna: string,
    largura = 1008,
    altura = 263,
  ): Promise<Buffer> {
    const payload = JSON.stringify({
      dados,
      titulo,
      colLabel: labelColuna,
      width:    largura,
      height:   altura,
    });

    return new Promise<Buffer>((resolve) => {
      const child = spawn('python3', [this.scriptPath], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      child.on('close', (code: number) => {
        const stderr = Buffer.concat(stderrChunks).toString();
        const stdout = Buffer.concat(stdoutChunks);

        if (stderr) console.log('[ChartsService] Python:', stderr.trim().slice(0, 300));

        if (code !== 0 || stdout.length === 0) {
          console.error('[ChartsService] Python falhou, code:', code);
          resolve(Buffer.alloc(0));
          return;
        }
        resolve(Buffer.from(stdout.toString(), 'base64'));
      });

      child.on('error', (e: Error) => {
        console.error('[ChartsService] spawn error:', e.message);
        resolve(Buffer.alloc(0));
      });

      // Envia JSON via stdin e fecha
      child.stdin.write(payload, 'utf8');
      child.stdin.end();
    });
  }
}
