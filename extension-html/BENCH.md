# Benchmark

What `npm run bench` measured on `@sveltekit-i18n/extension-html` 3.0.2, written by the release that published it. A pull request compares its branch with its base in a comment; this file keeps the figures of each release beside its code.

Node v24.21.0, linux x64; times are medians of 11 processes, each the median of its rounds, and heap held is the median of as many processes again, each giving one reading per row. A spread leaves out a quarter of a row's samples, rounded down, at each end. Sizes include the extension's dependencies and leave out its peers.
It runs on @sveltekit-i18n/base 3.3.1, svelte 5.56.9, typescript 5.9.3.
Dependencies: parse5 8.0.1.

## Sizes

Bytes of a browser bundle, the dependencies included and the peers left out: the same on every machine.

| Row | Value |
| --- | ---: |
| browser bundle, minified | 158,621 B |
| browser bundle, minified and gzipped | 45,270 B |

## Times

Microseconds and milliseconds, of one machine at one time: compare them only with figures measured beside them.

| Row | Median | Spread |
| --- | ---: | --- |
| server render of &lt;T&gt;, plain text | 12.2 µs | 11.9 µs to 12.9 µs |
| server render of &lt;T&gt;, inline elements and a payload | 36.8 µs | 36.4 µs to 37.8 µs |
| server render of &lt;T&gt;, a list of 10 items | 112 µs | 110 µs to 112 µs |
| server render of &lt;T&gt;, markup it drops and reports | 15.2 µs | 14.7 µs to 15.4 µs |

## Heap

Bytes of the JavaScript heap an extension holds, the same on every run of one Node version, to a fraction of a byte.

| Row | Median | Spread |
| --- | ---: | --- |
| JS heap held per server render of &lt;T&gt;, over 10,000 renders | 0 B/render | 0 B/render |
