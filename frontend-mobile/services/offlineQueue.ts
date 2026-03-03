import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AxiosInstance } from 'axios';

const QUEUE_STORAGE_KEY = 'idel_offline_queue';
const MAX_RETRIES = 5;

/** A single queued operation waiting to be sent to the server */
interface QueuedOperation {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: unknown;
  retries: number;
  createdAt: number;
}

/**
 * FIFO offline queue persisted in AsyncStorage (not WatermelonDB).
 *
 * Uses AsyncStorage because the queue must work before the database
 * is initialized. Operations are processed in order, retried up to
 * MAX_RETRIES times, and removed on success or when retries are exhausted.
 *
 * Usage:
 *   const queue = new OfflineQueue();
 *   await queue.enqueue('POST', '/transmissions', { content: '...' });
 *   // Later, when back online:
 *   await queue.processQueue(apiClient);
 */
export class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private loaded = false;

  /** Loads the queue from AsyncStorage if not already loaded */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored) as QueuedOperation[];
      }
    } catch {
      this.queue = [];
    }
    this.loaded = true;
  }

  /** Persists the current queue state to AsyncStorage */
  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Persistence failure is logged but does not throw.
      // The in-memory queue is still valid for the current session.
    }
  }

  /** Updates the syncStore's pending operations count */
  private async updatePendingCount(): Promise<void> {
    try {
      const { useSyncStore } = await import('@/stores/syncStore');
      useSyncStore.getState().setPendingOpsCount(this.queue.length);
    } catch {
      // Non-critical
    }
  }

  /**
   * Adds an operation to the end of the queue.
   * Persists to AsyncStorage and updates the pending ops counter.
   */
  async enqueue(
    method: QueuedOperation['method'],
    url: string,
    data?: unknown,
  ): Promise<void> {
    await this.ensureLoaded();

    const operation: QueuedOperation = {
      id: generateId(),
      method,
      url,
      data,
      retries: 0,
      createdAt: Date.now(),
    };

    this.queue.push(operation);
    await this.persist();

    try {
      const { useSyncStore } = await import('@/stores/syncStore');
      useSyncStore.getState().incrementPendingOps();
    } catch {
      // Non-critical
    }
  }

  /**
   * Processes all pending operations in FIFO order.
   * Each operation is attempted with the provided API client.
   * On success, the operation is removed from the queue.
   * On failure, the retry counter is incremented. Operations that
   * exceed MAX_RETRIES are discarded.
   */
  async processQueue(apiClient: AxiosInstance): Promise<void> {
    await this.ensureLoaded();

    if (this.queue.length === 0) {
      return;
    }

    // Process a snapshot of the current queue (new items added during
    // processing will be handled in the next cycle)
    const toProcess = [...this.queue];
    const remaining: QueuedOperation[] = [];

    for (const operation of toProcess) {
      try {
        await apiClient.request({
          method: operation.method,
          url: operation.url,
          data: operation.data,
        });

        // Success - operation is not added to remaining
        try {
          const { useSyncStore } = await import('@/stores/syncStore');
          useSyncStore.getState().decrementPendingOps();
        } catch {
          // Non-critical
        }
      } catch {
        // Failure - increment retry count
        operation.retries += 1;

        if (operation.retries < MAX_RETRIES) {
          remaining.push(operation);
        } else {
          // Max retries exceeded - discard the operation
          try {
            const { useSyncStore } = await import('@/stores/syncStore');
            useSyncStore.getState().decrementPendingOps();
          } catch {
            // Non-critical
          }
        }
      }
    }

    // Add any new operations that were enqueued during processing
    const newOps = this.queue.slice(toProcess.length);
    this.queue = [...remaining, ...newOps];
    await this.persist();
    await this.updatePendingCount();
  }

  /** Returns the number of operations in the queue */
  async getLength(): Promise<number> {
    await this.ensureLoaded();
    return this.queue.length;
  }

  /** Clears all operations from the queue and resets pending ops count */
  async clear(): Promise<void> {
    this.queue = [];
    this.loaded = true;
    await this.persist();
    await this.updatePendingCount();
  }
}

/**
 * Generates a simple unique ID for queue operations.
 * Uses timestamp + random suffix to avoid collisions.
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}
