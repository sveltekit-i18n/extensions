import { inspect } from 'node:util';

import I18n from '@sveltekit-i18n/base';
import type { Extension } from '@sveltekit-i18n/base';
import stores from '@sveltekit-i18n/extension-stores';
import { flushSync } from 'svelte';
import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import typedAccess, { RESERVED } from '../../src';
import { calls, CONFIG } from '../data';
import { track } from '../effects.svelte';

// The fixture carries no schema: the runtime is exercised untyped, the types in types.spec.ts.
const make = () => typedAccess(new I18n(CONFIG)) as any;

const METHODS = ['loadTranslations', 'loadNamespace', 'setLocale', 'setRoute', 'loadConfig', 'addTranslations', 'invalidate', 'snapshot', 'hydrate', 'destroy'] as const;

describe('the tree', () => {
  it('forwards a call to t with the dotted path and the params as given', () => {
    const out = make();

    calls.length = 0;

    expect(out.t.common.hi()).toBe('Hi');
    expect(out.t.common.hi({ n: 1 }, 'extra')).toBe('Hi');
    expect(out.t('common.hi')).toBe('Hi');
    expect(calls).toEqual([['common.hi', []], ['common.hi', [{ n: 1 }, 'extra']], ['common.hi', []]]);
  });

  it('reaches a key that is also a prefix, a numeric segment and a non-identifier', () => {
    const out = make();

    expect(out.t.a()).toBe('A');
    expect(out.t.a.b()).toBe('AB');
    expect(out.t.list[0]()).toBe('L0');
    expect(out.t['odd key']()).toBe('Odd');
  });

  it('fails soft exactly like the string form', () => {
    const out = make();

    expect(out.t.nope.x()).toBe(out.t('nope.x'));
    expect(out.t.nope.x()).toBe('nope.x');
    expect(out.t.common()).toBe(out.t('common'));
    expect(out.t.common.constructor()).toBe('common.constructor');
    expect(out.t.a.__proto__()).toBe('a.__proto__');
    expect(Reflect.get(out.t.a, 'hasOwnProperty')()).toBe('a.hasOwnProperty');
  });

  it('reads the real t for a reserved name at the root only', () => {
    const out = make();
    const raw = out.instance.t;

    for (const name of ['name', 'length', 'call', 'apply', 'bind', 'toString', 'constructor', 'valueOf']) {
      expect(out.t[name]).toBe(raw[name]);
    }

    expect(out.t.call(null, 'common.hi')).toBe('Hi');
    expect(out.t.bind(null)('common.hi')).toBe('Hi');
    expect(() => out.t.caller).toThrow(TypeError);
    expect(out.t('name.x')).toBe('reserved-x');
    expect(out.t.common.name()).toBe('Name');
    expect(out.t.form.name()).toBe('FN');
    expect(typeof out.t.form.length).toBe('function');
    expect(out.t.form.call()).toBe('form.call');
    expect(out.t.prototype.x()).toBe('prototype.x');
  });

  it('reserves every string name a function answers, and then', () => {
    const names = new Set<string>(['then']);

    for (let level: object | null = () => {}; level; level = Object.getPrototypeOf(level) as object | null) {
      for (const key of Reflect.ownKeys(level)) if (typeof key === 'string') names.add(key);
    }

    expect([...RESERVED].sort()).toEqual([...names].sort());
  });

  it('answers then and every symbol with undefined at every level', async () => {
    const out = make();

    for (const level of [out.t, out.t.common, out.t.common.hi]) {
      expect(level.then).toBeUndefined();
      expect(level[Symbol.toPrimitive]).toBeUndefined();
      expect(level[Symbol.iterator]).toBeUndefined();
      expect(level[Symbol.asyncIterator]).toBeUndefined();
      expect(level[Symbol('x')]).toBeUndefined();
      expect(await level).toBe(level);
      expect(await Promise.resolve(level)).toBe(level);
    }

    const node = out.t.common;

    expect(await (async () => node)()).toBe(node);
  });

  it('turns a forgotten call into the missing-key text', () => {
    const out = make();

    expect(String(out.t.common.hi)).toBe('common.hi.toString');
    expect(`${out.t.common.hi}`).toBe('common.hi.toString');
    expect(out.t.common.hi + '').toBe('common.hi.valueOf');
    expect(JSON.stringify({ a: out.t.common })).toBe('{"a":"common.toJSON"}');
    expect(JSON.parse(JSON.stringify(out)).t).toBe('toJSON');
  });

  it('throws on a forgotten call when a miss is no primitive', () => {
    const out = typedAccess(new I18n({ ...CONFIG, fallbackValue: { rich: true } })) as any;

    expect(out.t.nope()).toEqual({ rich: true });
    expect(() => String(out.t.common.hi)).toThrow(TypeError);
  });

  it('answers a function member below the root with a node', () => {
    const out = make();

    expect(out.t.common.hi.call(null, {})).toBe('common.hi.call');
    expect(out.t.common.hi.bind(null)).toBe('common.hi.bind');
    expect(typeof out.t.common.hi.length).toBe('function');
  });

  it('translates nothing when inspected', () => {
    const out = make();

    calls.length = 0;
    inspect(out.t.common.hi);
    inspect(out.t);

    expect(calls).toEqual([]);
  });

  it('writes nothing through the tree', () => {
    const out = make();
    const raw = out.instance.t;

    expect(() => { out.t.common = 1; }).toThrow(TypeError);
    expect(() => { out.t.common.hi = 1; }).toThrow(TypeError);
    expect(() => delete out.t.name).toThrow(TypeError);
    expect(() => Object.preventExtensions(out.t)).toThrow(TypeError);
    expect(() => Object.seal(out.t)).toThrow(TypeError);
    expect(() => Object.setPrototypeOf(out.t, null)).toThrow(TypeError);
    expect(() => { out.t.__proto__ = null; }).toThrow(TypeError);
    expect(() => Object.preventExtensions(out.t.common)).toThrow(TypeError);
    expect(Object.hasOwn(raw, 'common')).toBe(false);
    expect(Object.isExtensible(raw)).toBe(true);
    expect(Object.getPrototypeOf(raw)).toBe(Function.prototype);
    expect(Object.getOwnPropertyDescriptor(raw, 'length')?.configurable).toBe(true);
    expect(out.t.name).toBe(raw.name);
  });
});

describe('the surface', () => {
  it('forwards every member of the core, and adds only instance', () => {
    const i18n = new I18n(CONFIG);
    const out = typedAccess(i18n) as any;
    const core = [...Object.keys(i18n), ...Object.getOwnPropertyNames(Object.getPrototypeOf(i18n))]
      .filter((key) => key !== 'constructor');

    expect(Object.keys(out).sort()).toEqual([...new Set([...core, 'instance'])].sort());
    expect(out.instance).toBe(i18n);

    for (const method of METHODS) expect(out[method]).toBe((i18n as any)[method]);
  });

  it('reads every member from the instance as it changes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const loader = vi.fn(async () => {
      await gate;

      return { hi: 'Hallo' };
    });
    const i18n = new I18n({ ...CONFIG, preprocess: 'full', loaders: [{ locale: 'de', namespace: 'common', loader }] });
    const out = typedAccess(i18n) as any;
    const loading = track(() => out.loading);
    const locale = track(() => out.locale);

    expect(out.initialized).toBe(true);
    expect(out.locales).toEqual(['de', 'en', 'cs']);
    expect(out.l('cs', 'common.hi')).toBe('Ahoj');

    // The assignment alone starts the load; the call below joins it.
    out.locale = 'de';
    flushSync();

    expect(out.loading).toBe(true);
    expect(out.locale).toBe('en');

    release();
    await i18n.setLocale('de');
    flushSync();

    expect(loader).toHaveBeenCalledOnce();
    expect(out.locale).toBe('de');
    expect(out.t.common.hi()).toBe('Hallo');
    expect(loading.values).toEqual([false, true, false]);
    expect(locale.values).toEqual(['en', 'de']);

    const translations = out.translations;
    const l = out.l;

    out.addTranslations({ de: { 'common.bye': 'Tschüss' }, fr: { 'common.hi': 'Salut' } });

    expect(out.l).not.toBe(l);
    expect(out.l).toBe(i18n.l);
    expect(out.l('fr', 'common.hi')).toBe('Salut');
    expect(out.locales).toContain('fr');
    expect(out.translations).not.toBe(translations);
    expect(out.translations).toBe(i18n.translations);
    expect(out.rawTranslations).toBe(i18n.rawTranslations);
    expect(out.translations.de['common.bye']).toBe('Tschüss');
    expect(out.rawTranslations.de['common.bye']).toBe('Tschüss');

    loading.destroy();
    locale.destroy();
  });

  it('reads initialized from the instance once it is configured', async () => {
    const out = typedAccess(new I18n()) as any;

    expect(out.initialized).toBe(false);

    await out.loadConfig(CONFIG);

    expect(out.initialized).toBe(true);
    expect(out.locales).toEqual(['en', 'cs']);
  });

  it('works on destructured methods', async () => {
    const out = make();
    const { setLocale, instance } = out;

    await setLocale('cs');

    expect(instance.locale).toBe('cs');
  });

  it('throws on assigning a read', () => {
    const out = make();

    for (const name of ['t', 'l', 'locales', 'loading', 'initialized', 'translations', 'rawTranslations']) {
      expect(() => { out[name] = undefined; }).toThrow(TypeError);
    }
  });

  it('memoizes per instance and hands its own output back', () => {
    const i18n = new I18n(CONFIG);
    const out = typedAccess(i18n);

    expect(typedAccess(i18n)).toBe(out);
    expect(typedAccess(out)).toBe(out);
    expect(typedAccess(new I18n(CONFIG))).not.toBe(out);

    const piped = new I18n({ ...CONFIG, extensions: [typedAccess] });

    expect(typedAccess(piped.instance)).toBe(piped);

    const twice = new I18n({ ...CONFIG, extensions: [typedAccess, typedAccess] });

    expect((twice.instance as any).instance).toBeUndefined();
    expect(typedAccess(twice.instance)).toBe(twice);
  });

  it('keeps the identity of t while the instance keeps its own', async () => {
    const out = make();
    const first = out.t;

    expect(out.t).toBe(first);

    await out.setLocale('cs');

    expect(out.t).not.toBe(first);
    expect(first.common.hi()).toBe('Ahoj');
  });

  it('copies a method an extension before it patched', () => {
    const patch: Extension.T<any, any> = (i18n) => {
      const { loadConfig } = i18n;

      i18n.loadConfig = (config: any) => loadConfig(config);

      return i18n;
    };
    const out = new I18n({ ...CONFIG, extensions: [patch, typedAccess] }) as any;

    expect(Object.hasOwn(out.instance, 'loadConfig')).toBe(true);
    expect(out.loadConfig).toBe(out.instance.loadConfig);
  });

  it('refuses what is no instance, such as the stores surface', () => {
    expect(() => new I18n({ ...CONFIG, extensions: [stores, typedAccess] })).toThrow(/`typedAccess` takes an instance/);
    expect(() => typedAccess({} as any)).toThrow(/`typedAccess` takes an instance/);
  });

  it('forwards none of what an extension before it added', () => {
    const add: Extension.T<any, any> = (i18n) => Object.assign(i18n, { extra: 1 });
    const out = new I18n({ ...CONFIG, extensions: [add, typedAccess] }) as any;

    expect(out.instance.extra).toBe(1);
    expect(out.extra).toBeUndefined();
  });
});

describe('reactivity', () => {
  it('re-runs an effect reading a leaf, a destructured leaf and the string form', async () => {
    const out = make();
    const { t } = out;
    const leaf = track(() => out.t.common.hi());
    const destructured = track(() => t.common.hi());
    const stringForm = track(() => out.t('common.hi'));

    await out.setLocale('cs');
    flushSync();

    expect(leaf.values).toEqual(['Hi', 'Ahoj']);
    expect(destructured.values).toEqual(['Hi', 'Ahoj']);
    expect(stringForm.values).toEqual(['Hi', 'Ahoj']);

    leaf.destroy();
    destructured.destroy();
    stringForm.destroy();
  });

  it('re-runs an effect that holds t without calling it', async () => {
    const out = make();
    const held = track(() => out.t);

    await out.setLocale('cs');
    flushSync();

    expect(held.values).toHaveLength(2);
    expect(held.values[1]).not.toBe(held.values[0]);

    held.destroy();
  });

  it('composes with extension-stores after it', async () => {
    const out = new I18n({ ...CONFIG, extensions: [typedAccess, stores] }) as any;
    const seen: string[] = [];
    const stop = out.t.subscribe((t: any) => { seen.push(t.common.hi()); });

    await Promise.resolve();
    await out.setLocale('cs');
    flushSync();

    expect(seen[0]).toBe('Hi');
    expect(seen.at(-1)).toBe('Ahoj');
    expect(get<any>(out.t).a.b()).toBe('AB-cs');
    expect(typeof out.loadNamespace).toBe('function');
    expect(typeof out.hydrate).toBe('function');
    expect(out.instance.instance).toBeDefined();

    stop();
  });
});
