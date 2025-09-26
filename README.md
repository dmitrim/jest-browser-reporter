# Jest Browser Reporter

A beautiful browser-based test results reporter for Jest Lite.

## Installation

```bash
npm install jest-browser-reporter
```

## Usage
### ES Modules
```javascript
import { createReporter } from 'jest-browser-reporter';

const reporter = createReporter({
  containerId: 'test-results'
});

// After running tests
reporter.render(testResults);
```

```html
<script src="https://unpkg.com/jest-browser-reporter"></script>
<script>
const reporter = JestBrowserReporter.createReporter();
reporter.render(testResults);
</script>
```

## API

### createReporter(options)
Creates a new reporter instance.

Options:

- containerId: ID of the container element (default: 'test-results')

Methods:
- render(results): Renders test results
- update(results): Updates with new results
- clear(): Clears all results


### Usage in your project

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>DocSol API Tests</title>
    <!-- your scripts -->
</head>
<body>
    <a href="javascript:history.back()" class="back-link">&larr; Back</a>

    <div id="test-results">
        <div class="test-summary" id="test-summary"></div>
        <table class="test-table">
            <thead>
                <tr>
                    <th width="100px">Status</th>
                    <th>Test</th>
                    <th width="100px">Duration</th>
                </tr>
            </thead>
            <tbody id="test-results-body"></tbody>
        </table>
    </div>

    <script type="module">
        import { createReporter } from './dist/index.esm.js';
        import './tests_to_run.ts';

        const reporter = createReporter();

        run().then((results) => {
            reporter.render(results);
            console.log('Test results:', results);
        });
    </script>
</body>
</html>
```