import { StringDecoder } from "node:string_decoder";

export function readPassphraseTwice(input = process.stdin, output = process.stderr) {
  if (!input.isTTY || typeof input.setRawMode !== "function")
    throw Error("El respaldo requiere una terminal interactiva para introducir la frase de cifrado.");

  const labels = [
    "Frase de cifrado (mínimo 16 caracteres; se mostrarán asteriscos): ",
    "Repetí la frase de cifrado: ",
  ];
  const decoder = new StringDecoder("utf8");
  const previousRawMode = Boolean(input.isRaw);
  output.write(labels[0]);

  return new Promise((resolve, reject) => {
    let current = "";
    const values = [];
    let pendingLineFeed = false;
    let finished = false;

    const finish = (error) => {
      if (finished) return;
      finished = true;
      input.off("data", onData);
      input.setRawMode(previousRawMode);
      input.pause();
      if (error) reject(error);
      else resolve(values);
    };

    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (pendingLineFeed) {
          pendingLineFeed = false;
          if (character === "\n") continue;
        }
        if (character === "\u0003") {
          output.write("\n");
          return finish(Error("Respaldo cancelado."));
        }
        if (character === "\r" || character === "\n") {
          pendingLineFeed = character === "\r";
          values.push(current);
          current = "";
          output.write("\n");
          if (values.length === labels.length) return finish();
          output.write(labels[values.length]);
          continue;
        }
        if (character === "\b" || character === "\u007f") {
          if (current.length > 0) {
            current = Array.from(current).slice(0, -1).join("");
            output.write("\b \b");
          }
        } else if (character >= " ") {
          current += character;
          output.write("*");
        }
      }
    };

    input.on("data", onData);
    input.setRawMode(true);
    input.resume();
  });
}
