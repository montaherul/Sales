// Infrastructure: Background Job Queue & Worker
// Prevents HTTP request timeouts for heavy operations (Monthly Export, Bulk Import, Drive Sync)

import { logger } from '@/shared/logger';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface BackgroundJob<TData = any, TResult = any> {
  id: string;
  type: string;
  status: JobStatus;
  data: TData;
  result?: TResult;
  error?: string;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
}

type JobHandler<TData = any, TResult = any> = (job: BackgroundJob<TData, TResult>) => Promise<TResult>;

class JobQueue {
  private jobs: Map<string, BackgroundJob> = new Map();
  private handlers: Map<string, JobHandler> = new Map();

  /**
   * Registers a worker handler for a specific job type.
   */
  public registerHandler<TData, TResult>(type: string, handler: JobHandler<TData, TResult>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /**
   * Enqueues a job for background processing.
   */
  public async enqueue<TData, TResult>(
    type: string,
    data: TData,
    createdBy: string = 'system'
  ): Promise<BackgroundJob<TData, TResult>> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job: BackgroundJob<TData, TResult> = {
      id,
      type,
      status: 'PENDING',
      data,
      progress: 0,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    this.jobs.set(id, job);
    logger.info(`Job enqueued: ${id} (${type})`, 'JobQueue');

    // Run asynchronously without blocking caller
    queueMicrotask(() => {
      this.processJob(id);
    });

    return job;
  }

  /**
   * Gets job status by ID.
   */
  public getJob(id: string): BackgroundJob | undefined {
    return this.jobs.get(id);
  }

  private async processJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'FAILED';
      job.error = `No registered handler for job type '${job.type}'`;
      logger.error(job.error, undefined, 'JobQueue');
      return;
    }

    try {
      job.status = 'PROCESSING';
      job.startedAt = new Date().toISOString();
      job.progress = 20;

      const result = await handler(job);

      job.status = 'COMPLETED';
      job.result = result;
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      logger.info(`Job completed: ${id} (${job.type})`, 'JobQueue');
    } catch (err: any) {
      job.status = 'FAILED';
      job.error = err?.message || 'Job execution failed';
      job.completedAt = new Date().toISOString();
      logger.error(`Job failed: ${id} (${job.type})`, err, 'JobQueue');
    }
  }
}

export const jobQueue = new JobQueue();
