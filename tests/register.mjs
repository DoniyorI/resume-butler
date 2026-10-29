import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const source = new URL("../src/", import.meta.url);
const extension = new URL("../extension/", import.meta.url);

// Match Next's @/ alias and server-only boundary while testing the real modules.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const path = fileURLToPath(new URL(specifier.slice(2), source));
      const candidate = [path, `${path}.js`, `${path}.jsx`].find(existsSync);
      if (candidate) return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith("next/") && error.code === "ERR_MODULE_NOT_FOUND") {
        return nextResolve(`${specifier}.js`, context);
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if ((url.startsWith(source.href) || url.startsWith(extension.href)) && new URL(url).pathname.endsWith(".js")) {
      return { format: "module", source: readFileSync(new URL(url), "utf8"), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
