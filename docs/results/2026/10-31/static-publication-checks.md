# Static publication checks

31 October 2026. Alvaro explicitly approved the exact 72-case scope and temporary
CI with “I approve. You choose.” The original approved source is
`6f28d775053359d332c17104d5df6a508cd365b5`. Product code remains unchanged.

## Initial execution and diagnostic repair

[Run 41180778501](https://github.com/alvarovillalbaa/clero/actions/runs/41180778501),
job `124477588633`, used Node 24.21.0 on Ubuntu 24.04. Its 72 actual cases produced
**71 passes, 1 failure, zero cancellation/skip/TODO**, no timeout, successful
source guards, an empty fixture directory and verified removal of its owned
temporary root. The first dispatch attempt failed to connect; two readbacks
showed zero runs before retry. Exactly one run resulted from that retry.

The original controller discarded TAP diagnostics after cleanup and logged only
case names/counts. The controller was corrected to log bounded failure details
(16 KiB total) before cleanup, with all failure/source/time/ownership guards
preserved. [Run 41180979671](https://github.com/alvarovillalbaa/clero/actions/runs/41180979671),
job `124478147900`, reran the same original source and reproduced **71/72**.
It identifies the sole failure as the publication escaping case, line 96.

The assertion's regex scanned quoted metadata values as attribute names.
For example, safely escaped source text `onerror=` inside a quoted Open Graph
title was incorrectly classified as an event-handler attribute. The product's
escaping was correct. The assertion now scans the closed generated tag grammar
while excluding quoted values; positive escaping checks remain, and controls
require real quoted/unquoted event and style attributes to be detected. No
case name/count, production HTML or security boundary was changed. No check is
disabled or made optional.

## Repaired-source verification

The [new source seal](static-publication-checks-source.json) binds the corrected
test, the improved inactive controller, documentation and unchanged product
inputs. The exact same 72-case run completed on repaired source
`7c9648d34954d0fb0eda712b33f10b2c14230d4b`.
All attempts are sequential executions of the single temporary workflow job;
there is no broader suite, installation, server, browser, database, account,
model/provider call or paid enrollment. Each test process is capped at 120
seconds. The final retry's runner ceiling is reduced to four minutes to keep
the observed initial 10-second and diagnostic 22-second jobs plus that ceiling
inside the approved five-minute aggregate runner budget.

## Final result and cleanup

[Run 41181319286](https://github.com/alvarovillalbaa/clero/actions/runs/41181319286),
job `124479128438`, is **successful: 72 tests, 72 passes, zero failure,
cancellation, skip or TODO**. Its workflow definition is
`802bbe1b3e0a1a25c856ec6fccb2435477a00c69`; checkout and both source guards bind
the repaired source above. All 72 observed unique case names match the seal.
The child exited zero without a signal, timeout or log-cap stop. The fixture
directory was empty and the exact owned temporary root was removed.

The original and diagnostic jobs took 10 and 22 seconds; the passing job took
10 seconds. Aggregate active job time is **42 seconds**, inside five minutes.
The controller's fixture process ceilings and output caps were preserved.
The temporary workflow is disabled and removed after terminal job readback.
The final receipt commit changes only results and retires that workflow; all
34 repaired non-results source inputs remain identical to the passing source.
See [sanitized machine-readable evidence](static-publication-checks.json).

The result proves this exact domain/renderer/routes/HTML-producer/CLI fixture
scope, not browser rendering, actual device storage/clipboard, public access,
indexing or full reference-product/portfolio completion. No browser result is
claimed. Original source `6f28d77` remains accurately recorded as 71/72 rather
than relabelled green; the application runtime inputs are unchanged by the fix.

No local product import, authored test execution, fixture build or installation
occurred; the local Storage Guard failure remains respected.
