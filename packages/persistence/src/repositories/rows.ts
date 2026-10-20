// INSERT ... RETURNING and UPDATE ... RETURNING on a matched row always yield one row; this narrows the type.
export function requireRow<T>(row: T | undefined): T {
  if (row === undefined) throw new TypeError("statement returned no row");
  return row;
}
