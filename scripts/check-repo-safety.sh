#!/usr/bin/env bash
set -euo pipefail

violations=()

while IFS= read -r file; do
  case "$file" in
    .env|.env.local|.env.development|.env.production|.env.test|.env.*)
      if [ "$file" != ".env.example" ]; then
        violations+=("$file")
      fi
      ;;
  esac

  case "$file" in
    dist/*|build/*|site/*|coverage/*|node_modules/*|\
    *.db|*.db-shm|*.db-wal|\
    *.sqlite|*.sqlite3|*.sqlite-shm|*.sqlite-wal|*.sqlite-journal|\
    *.idb|*.ldb|\
    *.localstorage|*.localstorage-journal|\
    */IndexedDB/*|*/Local\ Storage/*|*/Session\ Storage/*|*/databases/*)
      violations+=("$file")
      ;;
  esac
done < <(git ls-files)

if ((${#violations[@]} > 0)); then
  echo "Repository safety check failed. Disallowed tracked files detected:" >&2
  printf ' - %s\n' "${violations[@]}" >&2
  echo "Remove these from git history/index before pushing." >&2
  exit 1
fi

echo "Repository safety check passed: no local/user-data artifacts are tracked."
