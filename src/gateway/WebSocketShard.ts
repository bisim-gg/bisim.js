import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { Status } from '../util/Enums.js';

/**
 * Bisim's gateway opcodes.
 */
export enum GatewayOpcodes {
  /** An event (server to client). */
  Dispatch = 0,
  /** Sent first, with the heartbeat interval (server to client). */
  Hello = 1,
  /** Keeps the bot shown online (client to server). */
  Heartbeat = 2,
  /** Answers a heartbeat (server to client). */
  HeartbeatAck = 3,
  /** Joins a server's rooms (client to server). */
  Subscribe = 4,
  /** A stub: Bisim has no resume. */
  Resume = 5,
  /** Says the bot is typing (client to server). */
  Typing = 6,
  /** Sets the bot's presence (client to server). */
  Presence = 7,
  /** The gateway is draining: reconnect now (server to client). */
  Reconnect = 9,
  /** A refused request, for example a subscribe without permission (server to client). */
  Error = 10,
}

/**
 * A gateway frame: `{ op, t, d }`.
 */
export interface GatewayFrame {
  op: GatewayOpcodes | number;
  t?: string;
  d?: any;
}

/**
 * Why a connection attempt failed before the gateway said hello.
 */
export class GatewayConnectError extends Error {
  /**
   * @param message - What happened
   * @param httpStatus - The HTTP status of a refused upgrade
   * @param retryAfter - How long the gateway asked to wait, in seconds
   */
  public constructor(
    message: string,
    public readonly httpStatus: number | null = null,
    public readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'GatewayConnectError';
  }
}

/**
 * The gateway accepts at most 40 frames a second from a client; bisim.js stays well under it.
 */
const FRAMES_PER_SECOND = 25;

/**
 * Close codes bisim.js uses for itself.
 *
 * @internal
 */
export const InternalCloseCodes = {
  /** The heartbeat was not answered. */
  Zombie: 4009,
  /** The gateway asked for a reconnect. */
  Reconnect: 4200,
  /** The client was destroyed. */
  Destroyed: 1000,
} as const;

/**
 * One connection to Bisim's gateway. Bisim has no sharding, so a client has one of these, with id 0.
 */
export class WebSocketShard extends EventEmitter {
  /** Always 0. */
  public readonly id = 0;
  /** The connection's status. */
  public status: Status = Status.Idle;
  /** The heartbeat's round trip time in milliseconds, -1 before the first one. */
  public ping = -1;
  /** When the last heartbeat was sent. */
  public lastPingTimestamp = -1;
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatAcked = true;
  private readonly queue: { frame: string; resolve: () => void }[] = [];
  private queueTimer: NodeJS.Timeout | null = null;
  private windowStart = 0;
  private sentInWindow = 0;
  private readonly WebSocketImpl: typeof WebSocket;

  /**
   * @param WebSocketImpl - The WebSocket class, `ws` by default
   */
  public constructor(WebSocketImpl: typeof WebSocket = WebSocket) {
    super();
    this.WebSocketImpl = WebSocketImpl;
  }

  /**
   * Opens the connection and resolves when the gateway says hello.
   *
   * @param url - The gateway URL with the pass
   * @param timeout - How long to wait for hello, in milliseconds
   * @internal
   */
  public connect(url: string, timeout = 30_000): Promise<number> {
    this.cleanupSocket();
    this.status = Status.Connecting;
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new this.WebSocketImpl(url, { handshakeTimeout: timeout });
      this.ws = ws;
      const timer = setTimeout(() => fail(new GatewayConnectError('The gateway did not say hello in time')), timeout);
      timer.unref?.();
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cleanupSocket();
        this.status = Status.Disconnected;
        reject(error);
      };
      ws.on('unexpected-response', (_request, response) => {
        const retryAfter = Number(response.headers['retry-after']);
        fail(new GatewayConnectError(`The gateway refused the connection (${response.statusCode})`, response.statusCode ?? null, Number.isFinite(retryAfter) ? retryAfter : null));
      });
      ws.on('error', (error) => {
        if (!settled) fail(error);
        else this.emit('error', error);
      });
      ws.on('close', (code, reason) => {
        if (!settled) {
          fail(new GatewayConnectError(`The gateway closed the connection before hello (${code})`));
          return;
        }
        if (this.ws !== ws) return;
        this.stopHeartbeat();
        this.ws = null;
        this.status = Status.Disconnected;
        this.emit('close', code, reason.toString());
      });
      ws.on('message', (raw) => {
        let frame: GatewayFrame;
        try {
          frame = JSON.parse(raw.toString()) as GatewayFrame;
        } catch {
          return;
        }
        if (frame.op === GatewayOpcodes.Hello && !settled) {
          settled = true;
          clearTimeout(timer);
          this.status = Status.Nearly;
          const interval = Number(frame.d?.heartbeatIntervalMs) || 30_000;
          this.startHeartbeat(interval);
          this.emit('frame', frame);
          resolve(interval);
          return;
        }
        this.onFrame(frame);
      });
    });
  }

  private onFrame(frame: GatewayFrame): void {
    if (frame.op === GatewayOpcodes.HeartbeatAck) {
      this.heartbeatAcked = true;
      if (this.lastPingTimestamp > 0) this.ping = Date.now() - this.lastPingTimestamp;
    }
    this.emit('frame', frame);
  }

  private startHeartbeat(interval: number): void {
    this.stopHeartbeat();
    this.heartbeatAcked = true;
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.heartbeatAcked) {
        this.emit('debug', 'The last heartbeat was not answered: the connection is dead, reconnecting');
        this.close(InternalCloseCodes.Zombie, 'Heartbeat not answered');
        return;
      }
      this.sendHeartbeat();
    }, interval);
    this.heartbeatTimer.unref?.();
  }

  private sendHeartbeat(): void {
    this.heartbeatAcked = false;
    this.lastPingTimestamp = Date.now();
    this.sendNow(JSON.stringify({ op: GatewayOpcodes.Heartbeat }));
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /**
   * Whether the socket is open.
   */
  public get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Sends a frame, paced so the gateway's flood limit is never reached.
   *
   * @param frame - The frame
   */
  public send(frame: GatewayFrame): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ frame: JSON.stringify(frame), resolve });
      this.drain();
    });
  }

  private drain(): void {
    if (this.queueTimer) return;
    while (this.queue.length) {
      const now = Date.now();
      if (now - this.windowStart >= 1_000) {
        this.windowStart = now;
        this.sentInWindow = 0;
      }
      if (this.sentInWindow >= FRAMES_PER_SECOND - 2) {
        this.queueTimer = setTimeout(() => {
          this.queueTimer = null;
          this.drain();
        }, 1_000 - (now - this.windowStart) + 5);
        this.queueTimer.unref?.();
        return;
      }
      const item = this.queue.shift()!;
      this.sendNow(item.frame);
      item.resolve();
    }
  }

  private sendNow(frame: string): void {
    const now = Date.now();
    if (now - this.windowStart >= 1_000) {
      this.windowStart = now;
      this.sentInWindow = 0;
    }
    this.sentInWindow++;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(frame);
  }

  /**
   * Closes the connection.
   *
   * @param code - The WebSocket close code to send
   * @param reason - The reason
   */
  public close(code: number = InternalCloseCodes.Destroyed, reason = ''): void {
    const ws = this.ws;
    this.stopHeartbeat();
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try {
        ws.close(code, reason);
      } catch {
        ws.terminate();
      }
      const killer = setTimeout(() => ws.terminate(), 5_000);
      killer.unref?.();
    }
  }

  /**
   * Drops everything waiting to be sent.
   *
   * @internal
   */
  public clearQueue(): void {
    for (const item of this.queue.splice(0)) item.resolve();
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = null;
  }

  private cleanupSocket(): void {
    this.stopHeartbeat();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.removeAllListeners('message');
      ws.on('error', () => undefined);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.terminate();
    }
  }

  /**
   * Closes the connection for good.
   *
   * @internal
   */
  public destroy(): void {
    this.clearQueue();
    const ws = this.ws;
    this.close(InternalCloseCodes.Destroyed, 'Client destroyed');
    this.ws = null;
    if (ws) {
      ws.removeAllListeners();
      ws.on('error', () => undefined);
    }
    this.status = Status.Disconnected;
  }
}
