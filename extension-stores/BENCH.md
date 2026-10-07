# Benchmark

What `npm run bench` measured on `@sveltekit-i18n/extension-stores` 3.2.0, written by the release that published it. A pull request compares its branch with its base in a comment; this file keeps the figures of each release beside its code.

Node v24.21.0, linux x64; times are medians of 11 processes, each the median of its rounds, and heap held is the median of as many processes again, each giving one reading per row. A spread leaves out a quarter of a row's samples, rounded down, at each end. Sizes include the extension's dependencies and leave out its peers.
It runs on @sveltekit-i18n/base 3.3.0, svelte 5.56.9, typescript 5.9.3.
Dependencies: none.

## Counts

Calls, emissions and checker instantiations: the same on every machine. A pull request that grows one fails its benchmark job unless it carries the `bench-accepted:extension-stores` label.

| Row | Value |
| --- | ---: |
| emissions to a subscriber of each store, per locale switch | 2 calls |
| emissions to a subscriber of each store, per addTranslations() to the active locale | 5 calls |
| emissions to a subscriber of each store, per locale switch through the locale store | 2 calls |

## Sizes

Bytes of a browser bundle, the dependencies included and the peers left out: the same on every machine.

| Row | Value |
| --- | ---: |
| browser bundle, minified | 1,221 B |
| browser bundle, minified and gzipped | 548 B |

## Times

Microseconds and milliseconds, of one machine at one time: compare them only with figures measured beside them.

| Row | Median | Spread |
| --- | ---: | --- |
| stores(instance), a new instance | 6 µs | 5.78 µs to 6.17 µs |
| subscribe and unsubscribe, the t store | 0.173 µs | 0.149 µs to 0.193 µs |
| get(), the t store | 0.0259 µs | 0.0135 µs to 0.0325 µs |
| setLocale() reaching 100 subscribers of the t store | 0.0538 ms | 0.0473 ms to 0.0561 ms |

## Heap

Bytes of the JavaScript heap an extension holds, the same on every run of one Node version, to a fraction of a byte.

| Row | Median | Spread |
| --- | ---: | --- |
| JS heap held per subscription to the t store, after it ended, over 100,000 | 0 B/subscription | 0 B/subscription |
| JS heap held per instance wrapped, tracked and dropped, over 5,000 | 0 B/instance | 0 B/instance |
