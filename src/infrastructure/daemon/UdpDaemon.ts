import * as dgram from 'dgram';
import { TilingUseCase } from '../../core/usecases/TilingUseCase';
import { Direction } from '../../core/types';

export class UdpDaemon {
  private server: dgram.Socket | null = null;

  constructor(
    private tilingUseCase: TilingUseCase,
    private port: number = 12345,
    private host: string = '127.0.0.1'
  ) {}

  public start(): void {
    this.server = dgram.createSocket('udp4');

    this.server.on('listening', () => {
      const address = this.server!.address();
      console.log(`Dynamic Tiler Daemon successfully started on ${address.address}:${address.port}`);
    });

    this.server.on('message', (msg) => {
      const messageStr = msg.toString().trim();

      try {
        if (messageStr.startsWith('tile ')) {
          const direction = messageStr.substring(5) as Direction;
          console.log(`[Daemon] Received tile command: ${direction}`);
          this.tilingUseCase.tile(direction);
        } else if (messageStr.startsWith('shift ')) {
          const subDir = messageStr.substring(6);
          const direction = `shift-${subDir}` as Direction;
          console.log(`[Daemon] Received shift command: ${direction}`);
          this.tilingUseCase.tile(direction);
        } else if (messageStr === 'restore') {
          console.log('[Daemon] Received restore command');
          this.tilingUseCase.restore();
        } else if (messageStr === 'clear') {
          console.log('[Daemon] Received clear command');
          this.tilingUseCase.clearCache();
        } else if (messageStr === 'stop') {
          console.log('[Daemon] Stopping daemon as requested...');
          this.stop();
          process.exit(0);
        }
      } catch (error: any) {
        console.error(`[Daemon Error] Failed to process message "${messageStr}":`, error.message);
      }
    });

    this.server.on('error', (err) => {
      console.error('[Daemon Error] Server error:', err.message);
      this.stop();
      process.exit(1);
    });

    this.server.bind(this.port, this.host);
  }

  public stop(): void {
    if (this.server) {
      try {
        this.server.close();
      } catch {
        // Игнорируем
      }
      this.server = null;
    }
  }

  public sendStopSignal(): void {
    const client = dgram.createSocket('udp4');
    client.send('stop', this.port, this.host, (err) => {
      client.close();
      if (err) {
        console.error('Error sending stop signal to daemon:', err.message);
        process.exit(1);
      }
      console.log('Stop signal sent to daemon.');
      process.exit(0);
    });
  }
}
