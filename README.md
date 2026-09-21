# Course kitchen

Open `public/index.html` in a browser. No build, login, API key, or application backend is needed. The font uses Google Fonts when available; the dashboard also works with system fonts.

The dashboard starts with 20 diners over 10 days. Both values are editable, up to 10,000 diners. Its colors and typography follow the supplied [Hiragana theme](https://learn-kana-gamma.vercel.app/hiragana.html).

## What you can do

- Plan quantities for eight example fruits and vegetables.
- Adjust usable stock, starting quantities, purchase increments, and the extra allowance.
- Inspect six synthetic course histories with different attendance and durations.
- Record and edit completed courses, then see the forecast recalculate.
- Switch to Your records to start an empty history. Example records never train that history.
- Print the shopping list and export or import a JSON backup.

The example records are invented to demonstrate plausible kitchen accounting. They are not verified procurement data or dietary guidance. Starting quantities need the cook's review against the actual menu.

## Forecasting choice

For a recurring menu, simple exponential smoothing is a reasonable baseline. This version uses an update weight of 0.3. That choice has not been fitted or validated on real kitchen records.

For each ingredient, calculate raw kitchen usage as opening stock plus purchases, minus remaining raw stock and avoidable spoilage. Normal preparation loss stays in kitchen usage. Divide by actual diners and course days to obtain kg per diner per day. If attendance varies, enter the average daily headcount.

Update the previous estimated rate with 70% of its previous value and 30% of the latest measured rate. Each course receives the same update weight after normalization. Records are processed by course end date, so editing an earlier course recalculates later estimates.

Multiply the rate by the planned diners and days, add the chosen percentage allowance, subtract usable stock, and round up to the purchase increment. Never buy a negative quantity.

Purchase-only records cannot establish usage and do not train the forecast. An unknown shortage also stays out of training. If the cook records an estimate of unmet demand, add that to measured usage before updating the rate. Review shortages even when the numeric rate stays unchanged.

The prototype does not measure plate waste, model recipes, handle multiple menus, estimate calibrated uncertainty, or schedule deliveries. It forecasts raw kitchen usage for one recurring menu. A large jump in attendance needs a review of batch yields, waste, and delivery capacity.

For a full version, derive the starting quantities from recipes and planned servings. Keep histories separate for different menus. After collecting real courses, compare smoothing against a fixed recipe estimate and a simple historical average using chronological backtests. Choose the method and buffer using measured error, shortages, and waste. Synthetic examples cannot establish which method is best.

Sources: [Simple exponential smoothing](https://otexts.com/fpp3/ses.html), [chronological forecast evaluation](https://otexts.com/fpp3/tscv.html).

## Frontend-only storage

This version uses localStorage. It saves records in the same browser and site origin, not inside the HTML file. Clearing site data removes those records. Export a backup for transfer or recovery. Storage behavior for a double-clicked file varies by browser; use a stable local or hosted URL for regular use.

Ten thousand diners changes the quantities, not the number of database records or the complexity of the forecast. A backend is unnecessary for one operator on one device. For a larger collection of course records, IndexedDB provides structured browser storage without a backend. Automatic remote backups and syncing between devices would need a remote storage service.

Sources: [Browser localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

## Local preview

Run this command from the repository root, then open http://127.0.0.1:8765.

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory public
```

This is a static preview server. All calculations and record storage run in the browser.

## Deploy

Import the GitHub repository into Vercel. Select Other as the framework. No build command or install command is needed. The output directory is `public`, as specified in `vercel.json`.

## Checked in the browser

Verified scaling from 20 to 10,000 diners, separation of sample and kitchen histories, rejection of inconsistent inventory, a lower forecast after increased leftovers, persistence after reload, and restoration of the original sample record. The sample banana shortage is excluded from learning. These checks validate the app's behavior, not its forecast accuracy on real courses.
