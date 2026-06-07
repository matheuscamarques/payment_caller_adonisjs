/**
 * SingleFlight coalesces concurrent executions of an asynchronous operation
 * with the same key.
 *
 * If a call is already in progress, additional callers will block and wait for the
 * same promise to resolve, rather than initiating duplicate work (e.g. database reads/writes
 * or external HTTP requests).
 */
export class SingleFlight<T> {
  private promises = new Map<string, Promise<T>>()

  async do(key: string, fn: () => Promise<T>): Promise<T> {
    const activePromise = this.promises.get(key)
    if (activePromise) {
      return activePromise
    }

    // Run the operation and remove it from the map once completed (success or failure)
    const promise = fn().finally(() => {
      this.promises.delete(key)
    })

    this.promises.set(key, promise)
    return promise
  }
}
