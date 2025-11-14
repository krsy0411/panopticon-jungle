import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private responseTimes: number[] = [];
  private requestCount = 0;
  private errorCount = 0;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    this.requestCount++;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.responseTimes.push(duration);
          if (this.responseTimes.length > 1000) this.responseTimes.shift();
        },
        error: () => {
          this.errorCount++;
        },
      }),
    );
  }

  getMetrics() {
    const avg = this.responseTimes.length
      ? this.responseTimes.reduce((a, b) => a + b, 0) /
        this.responseTimes.length
      : 0;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

    return {
      requests: this.requestCount,
      errors: this.errorCount,
      avgResponseTime: Math.round(avg) + 'ms',
      p95ResponseTime: p95 + 'ms',
    };
  }
}
