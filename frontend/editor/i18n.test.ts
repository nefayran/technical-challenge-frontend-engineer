import { describe, expect, test } from "bun:test";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});
if (typeof navigator === "undefined" || navigator.language === undefined) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { language: "ja-JP" },
  });
}

const { LOCALES, locale, setLocale, t } = await import("./i18n.ts");

describe("t()", () => {
  test("resolves keys in the active locale", () => {
    setLocale("en");
    expect(t("sidebar.levels")).toBe("Levels");
    setLocale("ru");
    expect(t("sidebar.levels")).toBe("Уровни");
    setLocale("ja");
    expect(t("sidebar.levels")).toBe("レベル一覧");
  });

  test("interpolates parameters", () => {
    setLocale("en");
    expect(t("status.title", { id: "abc", version: 4 })).toBe(
      "Level abc · server version 4",
    );
  });

  test("leaves unknown placeholders literal", () => {
    setLocale("en");
    expect(t("status.title", { id: "abc" })).toContain("{version}");
  });

  test("falls back to english, then to the key itself", () => {
    setLocale("ru");
    expect(t("no.such.key")).toBe("no.such.key");
  });

  test("every locale defines the same key set", async () => {
    setLocale("en");
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("./i18n.ts", import.meta.url), "utf-8");
    const dicts = [...source.matchAll(/const (en|ru|ja): Dict = \{([\s\S]*?)\n\};/g)];
    expect(dicts.length).toBe(3);
    const keySets = dicts.map(
      ([, , body]) => new Set([...body!.matchAll(/"([^"]+)":/g)].map((m) => m[1])),
    );
    for (const keys of keySets.slice(1)) {
      expect([...keys].sort()).toEqual([...keySets[0]!].sort());
    }
  });
});

describe("setLocale", () => {
  test("persists the choice", () => {
    setLocale("ja");
    expect(store.get("maze-editor-locale")).toBe("ja");
    expect(locale.value).toBe("ja");
  });

  test("locale list is the supported trio", () => {
    expect([...LOCALES]).toEqual(["en", "ru", "ja"]);
  });
});
