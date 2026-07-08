// touch: trigger a Pages build now that functions/* is a watched build path
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  if (url.hostname === 'moneysteps.pages.dev') {
    return Response.redirect(
      'https://app.morechard.com' + url.pathname + url.search,
      301
    );
  }
  return context.next();
};