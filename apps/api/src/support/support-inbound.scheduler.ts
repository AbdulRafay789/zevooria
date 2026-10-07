import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { isSupportInboundPollingEnabled } from './support-inbound-polling';
import { SupportInboundService } from './support-inbound.service';

const DEFAULT_POLL_MS = 60_000;

/**
 * Polls S3 for inbound support emails every 60s (configurable).
 * Overlapping runs are skipped while a previous poll is active.
 */
@Injectable()
export class SupportInboundScheduler implements OnModuleInit {
  private readonly logger = new Logger(SupportInboundScheduler.name);
  private running = false;

  constructor(private readonly inbound: SupportInboundService) {}

  onModuleInit(): void {
    if (!isSupportInboundPollingEnabled()) {
      this.logger.log(
        'Support inbound polling disabled (set SUPPORT_INBOUND_POLLING_ENABLED=true to enable; defaults off when EMAIL_PROVIDER=console)',
      );
    }
  }

  @Interval(DEFAULT_POLL_MS)
  async handleInterval(): Promise<void> {
    if (!isSupportInboundPollingEnabled()) {
      return;
    }
    if (this.running) {
      this.logger.warn(
        'Support inbound poll skipped — previous run still active',
      );
      return;
    }
    this.running = true;
    try {
      await this.inbound.pollOnce();
    } catch (error: unknown) {
      this.logger.error(
        `Support inbound poll crashed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
