import { StringDecoder } from "node:string_decoder";
import { Transform } from "node:stream";

// The local PostgreSQL image does not include the hosted Auth/Storage service schema
// versions or hosted pgmq queue tables. Keep application-owned COPY blocks for the local drill; the encrypted
// original remains untouched for a full restore into another Supabase project.
export function createApplicationDataFilter() {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let inCopy = false;
  let skipping = false;
  let skipped = 0;

  const processLine = (stream, line) => {
    const content = line.replace(/\r?\n$/, "");
    if (inCopy) {
      if (!skipping) stream.push(line);
      if (content === "\\.") {
        inCopy = false;
        skipping = false;
      }
      return;
    }
    if (/^COPY\s+.+\s+FROM\s+stdin;\s*$/i.test(content)) {
      inCopy = true;
      skipping = /^COPY\s+(?:"(?:auth|storage|pgmq)"|(?:auth|storage|pgmq))\./i.test(content);
      if (skipping) skipped++;
      else stream.push(line);
      return;
    }
    // A hosted queue's sequence may not exist locally even after its COPY is omitted.
    if (/^SELECT pg_catalog\.setval\('\"?(?:auth|storage|pgmq)\"?\./i.test(content)) return;
    stream.push(line);
  };

  const filter = new Transform({
    transform(chunk, _encoding, callback) {
      pending += decoder.write(chunk);
      let newline;
      while ((newline = pending.indexOf("\n")) !== -1) {
        processLine(this, pending.slice(0, newline + 1));
        pending = pending.slice(newline + 1);
      }
      callback();
    },
    flush(callback) {
      pending += decoder.end();
      if (pending) processLine(this, pending);
      if (inCopy) return callback(Error("El bloque COPY del respaldo está incompleto."));
      callback();
    },
  });
  filter.skippedPlatformTables = () => skipped;
  return filter;
}
