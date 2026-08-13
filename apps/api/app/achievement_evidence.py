"""Conservative, structural evidence for achievement rules.

This module never decides whether an achievement is unlocked.  It only derives
facts from Python's AST after the normal task tests have passed.  The client
achievement evaluator remains the single place that combines domain events.
"""

from __future__ import annotations

import ast
from typing import Any


def _tree(code: str) -> ast.AST | None:
    try:
        return ast.parse(code)
    except (SyntaxError, ValueError):
        return None


def _call_name(node: ast.Call) -> str | None:
    function = node.func
    if isinstance(function, ast.Attribute):
        return function.attr
    if isinstance(function, ast.Name):
        return function.id
    return None


def _chain_depth(node: ast.AST) -> int:
    if not isinstance(node, ast.Call):
        return 0

    def receiver_calls(value: ast.AST) -> int:
        if isinstance(value, ast.Call):
            receiver = value.func.value if isinstance(value.func, ast.Attribute) else None
            return 1 + (receiver_calls(receiver) if receiver is not None else 0)
        if isinstance(value, (ast.Attribute, ast.Subscript)):
            return receiver_calls(value.value)
        return 0

    receiver = node.func.value if isinstance(node.func, ast.Attribute) else None
    return 1 + (receiver_calls(receiver) if receiver is not None else 0)


def _facts(tree: ast.AST | None) -> dict[str, Any]:
    if tree is None:
        return {
            "methods": [],
            "hasLoop": False,
            "chainDepth": 0,
            "shape": "",
        }
    calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)]
    methods = sorted({name for node in calls if (name := _call_name(node))})
    # ast.dump without source positions is stable across formatting and variable
    # whitespace, while retaining operation and pipeline structure.
    shape = ast.dump(tree, annotate_fields=True, include_attributes=False)
    return {
        "methods": methods,
        "hasLoop": any(
            isinstance(node, (ast.For, ast.AsyncFor, ast.While, ast.comprehension))
            for node in ast.walk(tree)
        ),
        "chainDepth": max((_chain_depth(node) for node in calls), default=0),
        "shape": shape,
    }


def achievement_evidence(code: str, reference_code: str) -> dict[str, Any]:
    """Return conservative facts; false negatives are preferred to false positives."""

    user = _facts(_tree(code))
    reference = _facts(_tree(reference_code))
    reference_methods = set(reference["methods"])
    user_methods = set(user["methods"])
    structurally_different = bool(
        user["shape"]
        and reference["shape"]
        and user["shape"] != reference["shape"]
        and (
            user_methods != reference_methods
            or user["chainDepth"] != reference["chainDepth"]
        )
    )
    return {
        "methods": user["methods"],
        "hasLoop": user["hasLoop"],
        "chainDepth": user["chainDepth"],
        "referenceChainDepth": reference["chainDepth"],
        "alternativeStrategy": structurally_different,
    }
