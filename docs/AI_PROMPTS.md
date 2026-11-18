# How AI was used

This was built with Claude Code (an AI coding agent) working in the repository, directed step by step by a human who read the plan, approved or redirected each step, and decided what was in and out of scope. This page records the instructions that steered it, the method it followed, and, because correctness mattered more than speed, the mistakes that were caught and how.

The prompts below are the human's own words, shortened where long. The agent's replies are not reproduced: the commit history and `IMPLEMENTATION_PLAN.md` are the record of what it did.

## Standing instructions

Set before the work began (the human's global preferences for the agent):

- **Discuss before implementing.** For anything non-trivial, present the approach and wait for agreement. Plan first, code second. Lay out options when there are real trade-offs.
- **Clean code.** Small, well-named units; match the surrounding style; call out refactoring separately from feature work.
- **Comments must earn their place.** Explain *why*, intent, edge cases and gotchas. No comments that restate the code. Ruby uses RDoc.

## The prompts that shaped the project

| Prompt (human) | What it led to |
|---|---|
| "I have added the PLAN.MD file first have a look" | The assessment brief was read and summarised before anything else was proposed. |
| "and what about employee question and answer point ... be able to answer questions about how the org pays people" | The "answer questions" half of the brief became its own design: a trusted query engine first, curated questions, and only then an optional free-text layer. It also produced a list of the questions an HR manager would actually ask. |
| "first lets make a detailed plan in the current directory ... the problems we are going to tackle beforehand ... each functionality we will go commit by commit ... Starting with BE ... It should contain all the rules that assessment demands" | `IMPLEMENTATION_PLAN.md`: problems settled up front, the assessment rules mapped to steps, and one commit per step, backend first. |
| "I think we should cater ... Soft delete too, what if emp left company" | Termination and soft delete were designed as two separate things (someone who left versus a record that should not exist), with rehire and restore. |
| "use bootstrap for UI no complexity up-front" | Bootstrap instead of a heavier component library; the host was left undecided and the design was kept free of any particular one. |
| "do not direct commit unless I see the code" | Each step was written, shown and approved before it was committed. |
| "I want to hold the csv for now rest complete everything" / "do not do Phase B-4 ... we are holding it not dropping" | CSV export and the pay-analytics phase were put **on hold**, marked as such in the plan, and not built. |
| "have you updated the plan too?" | A check of the plan against reality, which found it had fallen behind (see below). |
| "lets complete everything and commit without asking, just do the development part not deployment" | The remaining development steps were committed directly; deployment and the on-hold items were left alone. |

## Method, per step

1. **Propose** the design and the decisions it needs, and wait for the human's answer.
2. **Write the code and the tests together**, in small units.
3. **Run everything**: tests, linters, type check, build.
4. **Try to break it.** For the behaviours that matter, deliberately break the code (remove a check, send the wrong unit, skip a reset) and confirm the right tests turn red, then restore it. A test that has never failed has not been shown to test anything.
5. **Use the real thing.** Run the app against the seeded 10,000 employees in a browser, and call the real API, rather than trusting mocks alone.
6. **Report honestly**: what was built, what was checked, what was not, then commit.

## Where the AI was wrong, and how it was caught

Listing these is deliberate; they are the evidence that the checks above did real work.

- **Process.** The B0 and B1 commits were made before the human had seen the code. The human objected; the rule above followed.
- **An incorrect "all green".** A summary said the linter passed when its output reported 44 offenses (spacing in a new test file). Found by reading the output again before continuing; the work it belonged to was then put on hold.
- **Flaky tests of its own.** Three tests asserted on a hook's error state straight after a rejected call, before the screen had updated, and one failed in two of three runs. Another asserted that a fading alert vanished instantly. Found by running the suite repeatedly; fixed by waiting for the state. Every later change was run several times to catch the same thing.
- **A test that passed for the wrong reason.** A test checked that a job title select "looked reset" after a department change. A select whose value matches no option *displays* its first option, so the test passed even with the reset removed. Found by the mutation step; replaced by a test that submits and requires a job title.
- **A real bug found by a test.** "Clear filters" left the old text in the search box, because the box was remounted before the URL had updated. Fixed by letting the box follow outside changes without overwriting what is being typed, and each half of that is covered by a test that was seen to fail.
- **A real bug found in the browser.** After clearing the country, a salary sort stayed in the URL and would have returned silently when a country was chosen again.
- **A wrong statement about the API.** The agent said the API refuses both the `hire` and `rehire` reasons for a salary change. Checking the real API showed only `hire` is refused; `rehire` is accepted and the UI simply does not offer it. The API document and a code comment were corrected. The sentence remains in one commit message, which was not rewritten.
- **A wrong example in the docs.** An example response captured in development showed Rails' debug page with stack traces, not the shape a deployed app returns. It was replaced with the production shape, which a request spec verifies, and the difference is stated in the document.
- **A false claim in a draft.** A draft of the design notes credited the browser with finding a bug that a component test had actually found. Caught on re-reading, before it was committed.
- **A shell slip.** A stray `cat > file` blocked waiting for input and had already emptied `Layout.tsx`. Noticed at once, restored from git, and the intended edit redone.
- **A plan that drifted.** The human asked whether the plan had been updated. It had not: dependent steps were not marked on hold, and decisions made while building lived only in commit messages. Fixed in a new section of the plan that lists each departure from it.
- **A faulty assumption while debugging.** Investigating one unexpected salary record, the agent assumed new records had ids above the seed's count, which was wrong after repeated seeding. It went to the request log instead, which showed the record came from a request the agent had not made. Most likely the human was testing the app at the same time, but that was never confirmed. The record was left alone and reported.

## What this does not claim

The AI wrote the code, but the human chose what to build, what to hold back, and when something was good enough to commit. The AI's confidence was never treated as evidence: tests, deliberate failures, the real API and a real browser were.
