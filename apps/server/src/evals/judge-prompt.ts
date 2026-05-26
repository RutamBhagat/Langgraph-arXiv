const HALLUCINATION_PROMPT = `You are an expert data labeler evaluating model outputs for hallucinations. Your task is to assign a score from 1 to 10 based on how factually supported the model output is by the provided input context.

CRITICALLY, you must carefully compare the output against the input context and reference outputs, if available, before assigning a score.

<Rubric>
A response without hallucinations:
- Contains only verifiable facts that are directly supported by the input context
- Makes no unsupported claims or assumptions
- Does not add speculative, inferred, or imagined details
- Maintains perfect accuracy in dates, numbers, names, entities, and specific details
- Appropriately indicates uncertainty when information is incomplete
</Rubric>

<Scoring>
Assign a score from 1 to 10 based only on factual accuracy and support from the input context:

1 = The output is almost entirely hallucinated, unsupported, or contradictory to the input. Or if the output is empty or null.
2 = The output contains many major hallucinations or serious contradictions.
3 = The output contains several unsupported or incorrect claims that substantially affect accuracy.
4 = The output contains multiple hallucinations, including at least one important factual error.
5 = The output is mixed: some claims are supported, but several claims are unsupported, speculative, or inaccurate.
6 = The output is mostly supported, but includes minor hallucinations or unsupported details.
7 = The output is generally accurate, with one or two small unsupported or questionable claims.
8 = The output is well-supported, with only very minor unsupported wording or harmless overstatement.
9 = The output is fully accurate and supported, with no meaningful hallucinations.
10 = The output contains only facts directly supported by the input context, with perfect factual accuracy and appropriate uncertainty where needed.
</Scoring>

<Instructions>
For the given example:
1. Read the input context thoroughly.
2. Identify all factual claims made in the output.
3. Cross-reference each claim with the input context.
4. Use the reference outputs, if available, only to help identify possible hallucinations.
5. Note any unsupported, speculative, or contradictory information.
6. Consider both the severity and quantity of hallucinations.
7. Assign a score from 1 to 10 using the Scoring rubric.
8. Return only the structured evaluator fields: score_0_to_10 and reasoning.
</Instructions>

<Reminder>
Focus solely on factual accuracy and support from the input context. Do not consider style, grammar, formatting, helpfulness, or completeness except where they affect factual accuracy.

A shorter response that stays fully grounded should score higher than a longer response with unsupported claims.
</Reminder>

Please evaluate the following example:

<input>
{{inputs}}
</input>

<output>
{{outputs}}
</output>

<reference_outputs>
{{reference_outputs}}
</reference_outputs>
`;

export const EVAL_PROMPT = {
  hallucination: HALLUCINATION_PROMPT,
} as const;
