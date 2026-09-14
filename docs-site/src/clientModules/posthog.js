/**
 * PostHog analytics - same project as morechard.com and app.morechard.com
 * (see marketing/_partials/_head-common.html), tagged with a `site` property
 * so support-docs traffic is filterable separately from app/marketing events.
 *
 * Loaded directly, no consent gate: this site is public documentation with
 * no accounts, no PII, and no child users - unlike the app (which handles
 * children's data and gates analytics behind explicit consent, see
 * app/src/lib/analytics.ts) and the marketing site (which gates behind a
 * cookie banner). Anonymous page-view/search analytics on public docs is
 * standard low-risk practice; this deliberately does not reuse that
 * consent-gated pattern.
 *
 * Docusaurus client modules run once, client-side only, on every page -
 * see https://docusaurus.io/docs/advanced/client#client-modules.
 */

if (typeof window !== 'undefined') {
  !(function (t, e) {
    var o, n, p, r;
    e.__SV ||
      ((window.posthog = e),
      (e._i = []),
      (e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split('.');
          2 == o.length && ((t = t[o[0]]), (e = o[1]));
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }
        ((p = t.createElement('script')).type = 'text/javascript'),
          (p.crossOrigin = 'anonymous'),
          (p.async = !0),
          (p.src = s.api_host + '/static/array.js'),
          (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r);
        var u = e;
        for (
          void 0 !== a ? (u = e[a] = []) : (a = 'posthog'),
            (u.people = u.people || []),
            (u.toString = function (t) {
              var e = 'posthog';
              return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e;
            }),
            (u.people.toString = function () {
              return u.toString(1) + ' (stub)';
            }),
            o =
              'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId'.split(
                ' '
              ),
            n = 0;
          n < o.length;
          n++
        )
          g(u, o[n]);
        e._i.push([i, s, a]);
      }),
      (e.__SV = 1));
  })(document, window.posthog || []);

  posthog.init('phc_zf5uHwc5ZCvCJtxHts6AGaqBPw5x2zLHJFYsL6ftvtj3', {
    api_host: 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    loaded: function (ph) {
      ph.register({ site: 'support-docs' });
    },
  });
}

export default function () {}
