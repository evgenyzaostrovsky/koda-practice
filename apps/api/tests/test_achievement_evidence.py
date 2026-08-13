import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from app.achievement_evidence import achievement_evidence


def test_extracts_methods_loops_and_real_call_chain():
    evidence = achievement_evidence(
        "result = df.dropna().groupby('city')['sales'].sum()",
        "result = df.groupby('city')['sales'].sum()",
    )
    assert evidence["methods"] == ["dropna", "groupby", "sum"]
    assert evidence["hasLoop"] is False
    assert evidence["chainDepth"] >= 3


def test_detects_loop_structurally_not_from_text():
    assert achievement_evidence("# for is only a comment\nresult = df.sum()", "result = df.sum()")["hasLoop"] is False
    assert achievement_evidence("result = [x for x in values]", "result = values")["hasLoop"] is True


def test_alternative_strategy_requires_material_structural_difference():
    reference = "result = df.groupby('city')['sales'].sum()"
    formatting_only = "result=df.groupby(\"city\")[\"sales\"].sum()"
    alternative = "result = df.pivot_table(index='city', values='sales', aggfunc='sum')['sales']"
    assert achievement_evidence(formatting_only, reference)["alternativeStrategy"] is False
    assert achievement_evidence(alternative, reference)["alternativeStrategy"] is True
