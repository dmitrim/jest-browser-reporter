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
    <!-- your scripts -->
</head>
<body>
    <div id="root"></div>

    <script type="module">
        import { setupJestLiteGlobals } from 'jest-browser-reporter';
        setupJestLiteGlobals();
    </script>

    <script type="module">
        import './tests_to_run.ts';
        import { JestBrowserReporter } from 'jest-browser-reporter';
        const reporter = new JestBrowserReporter({
            container: document.getElementById('root'),
            showBackLink: true
        });

        // Run tests asynchronously and render results
        run().then((results) => {
            console.log('Raw test results:', results);
            reporter.render(results);            
        });

    </script>
</body>
</html>
```