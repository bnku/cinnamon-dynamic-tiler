import { TilingUseCase } from '../../core/usecases/TilingUseCase';
export declare class UdpDaemon {
    private tilingUseCase;
    private port;
    private host;
    private server;
    constructor(tilingUseCase: TilingUseCase, port?: number, host?: string);
    start(): void;
    stop(): void;
    sendStopSignal(): void;
}
