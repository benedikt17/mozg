import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";

const paths = [
  "src/prototype/knowledge/knowledge-annotations.ts",
  "src/prototype/knowledge/knowledge-annotations-runtime.tsx",
] as const;

describe("Knowledge annotation formatting probe", () => {
  it("prints exact Prettier diff", () => {
    for (const [index, path] of paths.entries()) {
      const extension = path.endsWith(".tsx") ? ".tsx" : ".ts";
      const temporaryPath = `/tmp/knowledge-annotation-${index}${extension}`;
      writeFileSync(temporaryPath, readFileSync(path, "utf8"), "utf8");
      execFileSync("pnpm", ["exec", "prettier", "--write", temporaryPath]);
      const diff = spawnSync("diff", ["-u", path, temporaryPath], {
        encoding: "utf8",
      });
      console.log(`KNOWLEDGE_ANNOTATION_DIFF_${index}\n${diff.stdout}`);
    }
  });
});
