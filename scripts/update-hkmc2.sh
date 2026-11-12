#!/usr/bin/env bash
# Rebuild the bundled compiler from the upstream hkmc2 branch.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/vendor/mlscript"
RUNTIME="$ROOT/runtime"
ADAPTER="$ROOT/tools/NotebookCompiler.scala"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required." >&2
  exit 1
fi
if ! command -v sbt >/dev/null 2>&1; then
  echo "sbt is required to rebuild hkmc2. Install sbt, then run this script again." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to bootstrap the hkmc2 standard library." >&2
  exit 1
fi

if [[ ! -d "$VENDOR/.git" ]]; then
  mkdir -p "$(dirname "$VENDOR")"
  git clone --depth 1 --branch hkmc2 https://github.com/hkust-taco/mlscript.git "$VENDOR"
else
  git -C "$VENDOR" fetch --depth 1 origin hkmc2
  git -C "$VENDOR" checkout --force hkmc2
  git -C "$VENDOR" reset --hard origin/hkmc2
fi

cp "$ADAPTER" "$VENDOR/hkmc2/js/src/main/scala/hkmc2/NotebookCompiler.scala"
(
  cd "$VENDOR"
  sbt -batch -Dsbt.supershell=false "hkmc2JS/fastLinkJS"
)

BUNDLE="$(find "$VENDOR/hkmc2/js/target" -type f -name MLscript.mjs -print -quit)"
if [[ -z "$BUNDLE" ]]; then
  echo "Could not find MLscript.mjs after hkmc2JS/fastLinkJS." >&2
  exit 1
fi

rm -rf "$RUNTIME/compiler" "$RUNTIME/std"
mkdir -p "$RUNTIME/compiler" "$RUNTIME/std"
cp "$BUNDLE" "$RUNTIME/compiler/MLscript.mjs"
cp "$VENDOR/hkmc2/shared/src/test/mlscript/decls/Prelude.mls" "$RUNTIME/std/"
for source in StrOps Option Stack Iter LazyArray Rendering Runtime Predef Term; do
  cp "$VENDOR/hkmc2/shared/src/test/mlscript-compile/${source}.mls" "$RUNTIME/std/"
done
cp "$VENDOR/hkmc2/shared/src/test/mlscript-compile/RuntimeJS.mjs" "$RUNTIME/std/"

node "$ROOT/scripts/bootstrap_stdlib.mjs" "$ROOT"

COMMIT="$(git -C "$VENDOR" rev-parse --short HEAD)"
DATE="$(git -C "$VENDOR" log -1 --format=%cs)"
cat > "$RUNTIME/VERSION.md" <<EOF
# Bundled hkmc2 runtime

- compiler/MLscript.mjs is a Scala.js build (sbt hkmc2JS/fastLinkJS) of
  https://github.com/hkust-taco/mlscript, branch hkmc2, commit $COMMIT ($DATE).
- It includes the local adapter at tools/NotebookCompiler.scala.
- std/ contains matching hkmc2 declarations, sources, and generated runtime modules.
EOF

echo "Updated hkmc2 runtime to $COMMIT. Run: npm test && npm run package"
