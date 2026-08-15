"""Enforces Rules.md 'Layering is absolute': domain/ imports nothing from
api/, infra/, or FastAPI. This is the single most important structural
rule in the backend — the old backend's instability came from skipping it.
"""

import ast
from pathlib import Path

DOMAIN_DIR = Path(__file__).parent.parent.parent / "app" / "domain"
FORBIDDEN_PREFIXES = ("app.api", "app.infra", "fastapi", "starlette")


def _imported_modules(source: str) -> list[str]:
    tree = ast.parse(source)
    modules: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
    return modules


def test_domain_has_no_forbidden_imports() -> None:
    violations: list[str] = []
    for path in DOMAIN_DIR.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        for module in _imported_modules(source):
            if module.startswith(FORBIDDEN_PREFIXES):
                violations.append(f"{path.relative_to(DOMAIN_DIR.parent.parent)}: imports {module}")
    assert not violations, "domain/ must not import api/, infra/, or FastAPI:\n" + "\n".join(
        violations
    )
