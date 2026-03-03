/**
 * Singleton OfflineQueue instance shared across the entire app.
 *
 * Import from this module wherever you need to enqueue or process
 * offline operations. Using a singleton ensures consistent queue
 * state and avoids duplicate processing.
 *
 * Usage:
 *   import { globalQueue } from '@/services/globalQueue';
 *   await globalQueue.enqueue('POST', '/transmissions', { content: '...' });
 */
import { OfflineQueue } from '@/services/offlineQueue';

export const globalQueue = new OfflineQueue();
