async function dump() {
  const text = await (await fetch(`https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT`)).text();
  const m = text.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if(m) {
    const e = JSON.parse(m[1]).props.pageProps.state.data.entity;
    console.log(Object.keys(e));
    console.log('subtitle:', e.subtitle);
    console.log('coverArt:', e.coverArt);
  }
}
dump();
