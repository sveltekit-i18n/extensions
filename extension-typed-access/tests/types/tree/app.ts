import I18n from '@sveltekit-i18n/base';
import typedAccess from '@sveltekit-i18n/extension-typed-access';
import type { Tree } from '@sveltekit-i18n/extension-typed-access';

const parser = { parse: (value: any) => value };

// Typed by the registration, so by the tree typegen registered beside it.
const generated = new I18n({ parser, extensions: [typedAccess] });
// A key the tree was not built from: the keys are grouped here instead.
const grouped = new I18n({ parser, schema: {} as TranslationSchema & { 'zz.extra': never }, extensions: [typedAccess] });

generated.t.common.hi({ name: 'x' });
// @ts-expect-error a required payload
generated.t.common.hi();
generated.t.common.bye();
// @ts-expect-error a message without params takes no payload
generated.t.common.bye({ a: 1 });
generated.t.common.opt();
generated.t.nav.home({ anything: 1 });
generated.t.a();
generated.t.a.b({ x: 1 });
generated.t.a[''].b();
generated.t.list[0]();
generated.t['odd key']();
generated.t.deep.a.b.c.d({ d: 1 });
generated.t.cms.title({ x: 1 });
// @ts-expect-error a literal key keeps its payload under an open namespace
generated.t.cms.title();
generated.t.cms.page();
generated.t.cms.page.body();
generated.t.cms.anything.at.all({ any: 1 });
generated.t.blog.post.intro({ p: 1 });
generated.t.blog.post.other();
generated.t.post({ any: 1 });
generated.t.x.constructor.d();
generated.t.x.prototype();
generated.t.prototype.z();
generated.t.form.name();
generated.t.form.length();
// @ts-expect-error an unknown key
generated.t.common.nope();
// @ts-expect-error an unknown namespace
generated.t.nope();
// @ts-expect-error 'cms' itself is not a key
generated.t.cms();
// @ts-expect-error then is never a node
generated.t.form.then();
// @ts-expect-error a reserved name at the root reads the real t
generated.t.name.first();
// @ts-expect-error a reserved name at the root reads the real t
generated.t.__proto__.y();
// @ts-expect-error then is never a node
generated.t.then.x();
// @ts-expect-error a node that is no key and opens nothing
generated.t.x.constructor();
grouped.t.zz.extra();

// The tree typegen registers types every path as the grouping does.
type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false;
type G = Tree<typeof generated.instance>;
type F = Tree<typeof grouped.instance>;

type Paths = {
  root: Equal<Exclude<keyof G, never>, Exclude<keyof F, 'zz'>>;
  a: Equal<G['a'], F['a']>;
  ab: Equal<G['a']['b'], F['a']['b']>;
  aEmpty: Equal<G['a'][''], F['a']['']>;
  aBind: Equal<G['a']['bind'], F['a']['bind']>;
  aPrototype: Equal<G['a']['prototype'], F['a']['prototype']>;
  common: Equal<G['common'], F['common']>;
  hi: Equal<G['common']['hi'], F['common']['hi']>;
  bye: Equal<G['common']['bye'], F['common']['bye']>;
  opt: Equal<G['common']['opt'], F['common']['opt']>;
  nav: Equal<G['nav'], F['nav']>;
  list: Equal<G['list'], F['list']>;
  odd: Equal<G['odd key'], F['odd key']>;
  deep: Equal<G['deep']['a']['b']['c'], F['deep']['a']['b']['c']>;
  form: Equal<G['form'], F['form']>;
  cms: Equal<G['cms'], F['cms']>;
  cmsTitle: Equal<G['cms']['title'], F['cms']['title']>;
  cmsTitleBelow: Equal<G['cms']['title']['x'], F['cms']['title']['x']>;
  cmsPage: Equal<G['cms']['page'], F['cms']['page']>;
  cmsPageBody: Equal<G['cms']['page']['body'], F['cms']['page']['body']>;
  cmsOther: Equal<G['cms']['other'], F['cms']['other']>;
  cmsBind: Equal<G['cms']['bind'], F['cms']['bind']>;
  blog: Equal<G['blog'], F['blog']>;
  blogPost: Equal<G['blog']['post'], F['blog']['post']>;
  blogPostIntro: Equal<G['blog']['post']['intro'], F['blog']['post']['intro']>;
  post: Equal<G['post'], F['post']>;
  prototype: Equal<G['prototype'], F['prototype']>;
  x: Equal<G['x'], F['x']>;
  xConstructor: Equal<G['x']['constructor'], F['x']['constructor']>;
};

const paths: { [K in keyof Paths]: true } = {} as Paths;
// The grouping is the one that saw the extra key.
const extra: Equal<keyof G, keyof F> = false;

export { extra, paths };
