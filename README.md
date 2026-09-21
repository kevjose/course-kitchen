# Course kitchen

Personal meditation-course produce planner. Static HTML, CSS and JavaScript, deployed at https://course-kitchen.vercel.app/ from `kevjose/course-kitchen`. There is no login or backend. The theme follows the supplied [Hiragana page](https://learn-kana-gamma.vercel.app/hiragana.html).

## September purchase seed

The default kitchen dataset contains one September 16 to 27, 2026 course for 20 candidates and 6 staff. It uses 10 nominal feeding days, with actual meal coverage unconfirmed. It starts as an ongoing course with incomplete purchase coverage. Completing it is an explicit operator action after its end date.

There are 52 purchase lines and 31 ingredient-and-unit combinations. Forty-six lines came from the fruit and vegetable receipts; six produce candidates came from the kitchen-supplies PDF. Ten lines need review. Missing quantities remain unknown. Supporting bills and payment evidence count once. Raw bananas, ripe bananas, ordinary cucumbers and Mangalore cucumbers remain distinct. Pieces, bunches and kilograms are never added together or automatically converted.

The fruit summary says INR 1,216; supporting bills total INR 1,217.55 including INR 0.30 bill rounding. The rounding is not an ingredient cost. The mixed produce receipt reconciles to INR 2,440 and the vegetable receipt to INR 3,050. The INR 23,082 kitchen-supplies total includes pantry items; it is not a produce total, and its full line items have not been reconciled.

Only sanitized quantities, line costs and review notes are shipped. Original documents, payment screenshots, phone numbers, account information and local paths are not included. The shipped seed is public to anyone who can open the site. Subsequent edits remain in that browser.

## Forecast behavior

Reviewed purchase quantities provide a provisional purchase rate per diner-day. Partial coverage and nominal duration can understate a full course's requirement. The dashboard keeps these limitations visible, including on printed drafts. Unreviewed and missing quantities do not contribute rates.

For a completed course with confirmed feeding days and measured inventory, raw kitchen usage is opening stock plus purchases, minus remaining raw stock and avoidable spoilage. Normal preparation loss stays in usage. This does not measure food actually eaten or plate waste.

The first measured course sets an ingredient's rate. Later courses use exponential smoothing with weight `1 - 0.7 ** min(dinerDays / 260, 2)`. A 260 diner-day course receives 30% weight. Small samples influence the estimate less, and the weight is capped at 51%. This is an explicit heuristic, not a model fitted to the kitchen. It assumes a comparable menu and meal pattern.

A shortage with unknown unmet demand preserves observed usage as a lower bound and stays flagged. Later observations cannot silently remove that minimum. Edit the original course with a reviewed unmet amount to resolve it. The minimum does not guarantee sufficient food. Known unmet demand is included before learning.

The shopping proposal multiplies the rate by planned diners and feeding days, adds an editable allowance, subtracts confirmed stock, and rounds up to the ingredient's purchase increment. All arithmetic uses each ingredient's native unit. A completed measured course invalidates older stock checks for the ingredients it records. Backdated courses do not overwrite newer checks. The operator must recheck current inventory before each new plan.

The allowance is a planning choice, not a confidence interval. For 10,000 diners, review kitchen capacity, recipe portions and delivery schedules independently. Browser calculation cost depends on records and ingredients, not diner count.

## Editing and storage

- Add courses, add or review purchase lines, and record completed inventory.
- Add ingredients in kg, pieces or bunches. Set optional manual starting rates and purchase increments.
- Use course metadata to distinguish nominal from confirmed feeding days and partial from complete purchase coverage.
- Synthetic examples remain separate from kitchen data.
- Export version 2 JSON backups. Import accepts version 1 and version 2.
- Existing version 1 browser data migrates without deletion. Untouched empty prototype defaults are replaced by the real seed catalog; existing custom records and stock are retained. Undated legacy stock must be rechecked.
- A seed is added once during initial migration. Importing a backup replaces only the chosen dataset; adding the September seed again is an explicit action and will not overwrite an existing course.
- Corrupt saved data is preserved and saving is blocked until a valid backup is imported. Storage failures leave a visible warning.

Data is stored with localStorage under `course-kitchen-v2`. The old key is retained. Clearing site data removes local edits, so keep exported backups. No automatic synchronization exists.

## Run and validate

Node's built-in test runner is the only test dependency:

```sh
node --test tests/*.test.cjs
node --check public/app.js
node --check public/data.js
python3 -m http.server 8781 --bind 127.0.0.1 --directory public
```

Open http://127.0.0.1:8781/ in Chrome. Serve the directory rather than opening the HTML as a file, since asset links are rooted at `/`.

Automated checks cover inventory reconciliation, shortage lower bounds, cold starts, sample weights, quantities in different units, seed deduplication, input validation and legacy migration. Browser checks cover the seeded course, scaling, purchase review, persistence, future completion rejection and inventory updates. These checks verify behavior, not empirical forecast accuracy.

## Deploy

Vercel imports the personal GitHub repository. Framework is Other, output directory is `public`, and there is no build or install step. The configuration is in `vercel.json`.

## Model references

[Simple exponential smoothing](https://otexts.com/fpp3/ses.html) describes the method and its assumptions. Once real completed courses are available, use [chronological forecast evaluation](https://otexts.com/fpp3/tscv.html) to compare smoothing with a pooled rate and the previous comparable course. Choose the method and allowance from observed errors, shortages and excess quantities.
