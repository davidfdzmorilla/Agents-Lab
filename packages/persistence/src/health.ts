import type pg from "pg";

/**
 * True if `select 1` answers within timeoutMs, connection included. Never throws;
 * a timed-out or failed client is destroyed instead of returned to the pool.
 */
export async function pingDatabase(
  pool: pg.Pool,
  options: { readonly timeoutMs: number },
): Promise<boolean> {
  let expired = false;
  let client: pg.PoolClient | undefined;
  let released = false;

  const destroy = (): void => {
    if (client !== undefined && !released) {
      released = true;
      client.release(true);
    }
  };

  const attempt = (async (): Promise<boolean> => {
    try {
      const acquired = await pool.connect();
      client = acquired;
      if (expired) {
        destroy();
        return false;
      }
      await acquired.query("select 1");
      if (expired) {
        return false;
      }
      released = true;
      acquired.release();
      return true;
    } catch {
      destroy();
      return false;
    }
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      destroy();
      resolve(false);
    }, options.timeoutMs);
  });

  try {
    return await Promise.race([attempt, deadline]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
