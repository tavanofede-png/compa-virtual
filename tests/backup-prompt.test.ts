import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { readPassphraseTwice } from "../scripts/backup-prompt.mjs";

class FakeTerminal extends EventEmitter {
  isTTY = true;
  isRaw = false;
  setRawMode(value: boolean) { this.isRaw = value; }
  resume() { return this; }
  pause() { return this; }
}

describe("backup passphrase prompt", () => {
  it("accepts two identical phrases pasted together with Windows line endings", async () => {
    const input = new FakeTerminal();
    let displayed = "";
    const output = { write: (value: string) => { displayed += value; } };
    const result = readPassphraseTwice(input, output);
    input.emit("data", Buffer.from("una frase secreta muy larga\r\nuna frase secreta muy larga\r\n"));
    expect(await result).toEqual(["una frase secreta muy larga", "una frase secreta muy larga"]);
    expect(displayed).not.toContain("una frase secreta");
    expect(displayed).toContain("*");
    expect(input.isRaw).toBe(false);
  });

  it("keeps accented characters intact when UTF-8 bytes and line endings arrive separately", async () => {
    const input = new FakeTerminal();
    const output = { write: (_value: string) => {} };
    const result = readPassphraseTwice(input, output);
    const bytes = Buffer.from("contraseña para Kusiy\r\ncontraseña para Kusiy\r\n");
    for (const byte of bytes) input.emit("data", Buffer.from([byte]));
    expect(await result).toEqual(["contraseña para Kusiy", "contraseña para Kusiy"]);
  });
});
