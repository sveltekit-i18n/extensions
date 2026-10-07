# Benchmark

What `npm run bench` measured on `@sveltekit-i18n/extension-typed-access` 3.0.1, written by the release that published it. A pull request compares its branch with its base in a comment; this file keeps the figures of each release beside its code.

Node v24.21.0, linux x64; times are medians of 11 processes, each the median of its rounds, and heap held is the median of as many processes again, each giving one reading per row. A spread leaves out a quarter of a row's samples, rounded down, at each end. Sizes include the extension's dependencies and leave out its peers.
It runs on @sveltekit-i18n/base 3.3.1, svelte 5.57.1, typescript 5.9.3.
Dependencies: none.

## Counts

Calls, emissions and checker instantiations: the same on every machine. A pull request that grows one fails its benchmark job unless it carries the `bench-accepted:extension-typed-access` label.

| Row | Value |
| --- | ---: |
| instantiations, the first call through the tree (flat keys, 1,000 keys, keys grouped by the extension) | 68,041 instantiations |
| instantiations, a later call (flat keys, 1,000 keys, keys grouped by the extension) | 123 instantiations |
| instantiations, the first call through the tree (flat keys, 1,000 keys, the levels typegen registers) | 8,825 instantiations |
| instantiations, a later call (flat keys, 1,000 keys, the levels typegen registers) | 119 instantiations |
| instantiations, the first call through the tree (flat keys, 10,000 keys, keys grouped by the extension) | 626,041 instantiations |
| instantiations, a later call (flat keys, 10,000 keys, keys grouped by the extension) | 123 instantiations |
| instantiations, the first call through the tree (flat keys, 10,000 keys, the levels typegen registers) | 35,825 instantiations |
| instantiations, a later call (flat keys, 10,000 keys, the levels typegen registers) | 119 instantiations |
| instantiations, the first call through the tree (namespaces of 10 keys, 1,000 keys, keys grouped by the extension) | 63,418 instantiations |
| instantiations, a later call (namespaces of 10 keys, 1,000 keys, keys grouped by the extension) | 340 instantiations |
| instantiations, the first call through the tree (namespaces of 10 keys, 1,000 keys, the levels typegen registers) | 6,502 instantiations |
| instantiations, a later call (namespaces of 10 keys, 1,000 keys, the levels typegen registers) | 324 instantiations |
| instantiations, the first call through the tree (namespaces of 10 keys, 10,000 keys, keys grouped by the extension) | 572,818 instantiations |
| instantiations, a later call (namespaces of 10 keys, 10,000 keys, keys grouped by the extension) | 340 instantiations |
| instantiations, the first call through the tree (namespaces of 10 keys, 10,000 keys, the levels typegen registers) | 9,202 instantiations |
| instantiations, a later call (namespaces of 10 keys, 10,000 keys, the levels typegen registers) | 324 instantiations |
| instantiations, the first call through the tree (one namespace, 1,000 keys, keys grouped by the extension) | 98,461 instantiations |
| instantiations, a later call (one namespace, 1,000 keys, keys grouped by the extension) | 123 instantiations |
| instantiations, the first call through the tree (one namespace, 1,000 keys, the levels typegen registers) | 9,175 instantiations |
| instantiations, a later call (one namespace, 1,000 keys, the levels typegen registers) | 119 instantiations |
| instantiations, the first call through the tree (one namespace, 10,000 keys, keys grouped by the extension) | 926,461 instantiations |
| instantiations, a later call (one namespace, 10,000 keys, keys grouped by the extension) | 123 instantiations |
| instantiations, the first call through the tree (one namespace, 10,000 keys, the levels typegen registers) | 36,175 instantiations |
| instantiations, a later call (one namespace, 10,000 keys, the levels typegen registers) | 119 instantiations |

## Sizes

Bytes of a browser bundle, the dependencies included and the peers left out: the same on every machine.

| Row | Value |
| --- | ---: |
| browser bundle, minified | 1,443 B |
| browser bundle, minified and gzipped | 784 B |

## Times

Microseconds and milliseconds, of one machine at one time: compare them only with figures measured beside them.

| Row | Median | Spread |
| --- | ---: | --- |
| t(key) through the output, a key of 3 segments | 0.0447 µs | 0.0355 µs to 0.0612 µs |
| t.a(), a member path of 1 segment | 0.127 µs | 0.111 µs to 0.147 µs |
| t.a.b.c(), a member path of 3 segments | 0.238 µs | 0.235 µs to 0.241 µs |
| t.a.b.c.d.e.f(), a member path of 6 segments | 0.462 µs | 0.457 µs to 0.464 µs |
| typedAccess(instance), a new instance | 1.06 µs | 1.04 µs to 1.12 µs |

## Heap

Bytes of the JavaScript heap an extension holds, the same on every run of one Node version, to a fraction of a byte.

| Row | Median | Spread |
| --- | ---: | --- |
| JS heap held per call of a member path of 6 segments, over 100,000 calls | 0 B/call | 0 B/call |
| JS heap held per instance wrapped and dropped, over 10,000 instances | 0 B/instance | 0 B/instance |
