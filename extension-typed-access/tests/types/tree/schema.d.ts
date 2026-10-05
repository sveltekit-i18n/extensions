// What `@sveltekit-i18n/typegen` writes for these keys, its banner and doc comments left out:
// a global script, no import or export. Regenerate it when typegen's format changes.

interface TranslationSchema {
  '__proto__.y': never;
  'a': never;
  'a..b': never;
  'a.b': {
    x: number;
  };
  'blog.post.intro': {
    p: unknown;
  };
  'cms.page.body': never;
  'cms.title': {
    x: unknown;
  };
  'common.bye': never;
  'common.hi': {
    name: unknown;
  };
  'common.opt': {
    count?: number;
  };
  'deep.a.b.c.d': {
    d: unknown;
  };
  'form.length': never;
  'form.name': never;
  'form.then': never;
  'list.0': never;
  'name.first': never;
  'nav.home': any;
  'odd key': never;
  'prototype.z': never;
  'then.x': never;
  'x.constructor.d': never;
  'x.prototype': never;
  [key: `blog.post.${string}`]: any;
  [key: `cms.${string}`]: any;
  'post': any;
}

declare namespace SvelteKitI18n {
  interface Register {
    schema: TranslationSchema;
    tree: {
      keys:
        | '__proto__.y'
        | 'a'
        | 'a..b'
        | 'a.b'
        | 'blog.post.intro'
        | 'cms.page.body'
        | 'cms.title'
        | 'common.bye'
        | 'common.hi'
        | 'common.opt'
        | 'deep.a.b.c.d'
        | 'form.length'
        | 'form.name'
        | 'form.then'
        | 'list.0'
        | 'name.first'
        | 'nav.home'
        | 'odd key'
        | 'prototype.z'
        | 'then.x'
        | 'x.constructor.d'
        | 'x.prototype'
        | 'post';
      patterns:
        | `blog.post.${string}`
        | `cms.${string}`;
      next: Typegen.Kfeef4812.Level0;
    };
  }
  namespace Typegen.Kfeef4812 {
    interface Level0 {
      '__proto__': { next: Level1 };
      'a': { key: 'a'; next: Level2 };
      'blog': { next: Level4 };
      'cms': { open: true; next: Level6 };
      'common': { next: Level8 };
      'deep': { next: Level9 };
      'form': { next: Level13 };
      'list': { next: Level14 };
      'name': { next: Level15 };
      'nav': { next: Level16 };
      'odd key': { key: 'odd key' };
      'post': { key: 'post' };
      'prototype': { next: Level17 };
      'then': { next: Level18 };
      'x': { next: Level19 };
    }
    interface Level1 {
      'y': { key: '__proto__.y' };
    }
    interface Level2 {
      '': { next: Level3 };
      'b': { key: 'a.b' };
    }
    interface Level3 {
      'b': { key: 'a..b' };
    }
    interface Level4 {
      'post': { open: true; next: Level5 };
    }
    interface Level5 {
      'intro': { key: 'blog.post.intro' };
    }
    interface Level6 {
      'page': { key: 'cms.page'; next: Level7 };
      'title': { key: 'cms.title' };
    }
    interface Level7 {
      'body': { key: 'cms.page.body' };
    }
    interface Level8 {
      'bye': { key: 'common.bye' };
      'hi': { key: 'common.hi' };
      'opt': { key: 'common.opt' };
    }
    interface Level9 {
      'a': { next: Level10 };
    }
    interface Level10 {
      'b': { next: Level11 };
    }
    interface Level11 {
      'c': { next: Level12 };
    }
    interface Level12 {
      'd': { key: 'deep.a.b.c.d' };
    }
    interface Level13 {
      'length': { key: 'form.length' };
      'name': { key: 'form.name' };
      'then': { key: 'form.then' };
    }
    interface Level14 {
      '0': { key: 'list.0' };
    }
    interface Level15 {
      'first': { key: 'name.first' };
    }
    interface Level16 {
      'home': { key: 'nav.home' };
    }
    interface Level17 {
      'z': { key: 'prototype.z' };
    }
    interface Level18 {
      'x': { key: 'then.x' };
    }
    interface Level19 {
      'constructor': { next: Level20 };
      'prototype': { key: 'x.prototype' };
    }
    interface Level20 {
      'd': { key: 'x.constructor.d' };
    }
  }
}
