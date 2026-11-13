import assert from "node:assert/strict";
import { test } from "node:test";

const { decodeEntities, htmlToText } = await import("@/server/watchlist/htmlText");

test("named and numeric entities decode, invalid code points are dropped", () => {
  assert.equal(decodeEntities("Tom &amp; Jerry &lt;3 &quot;q&quot; &apos;a&apos; &ndash; &mdash; &hellip;"), `Tom & Jerry <3 "q" 'a' – — …`);
  assert.equal(decodeEntities("&rsquo;&lsquo;&rdquo;&ldquo;&bull;&middot;&copy;&reg;&trade;&nbsp;|"), "’‘”“•·©®™ |");
  assert.equal(decodeEntities("&#65;&#x42;&#X43; &#128512;"), "ABC \u{1F600}");
  assert.equal(decodeEntities("a&#0;b&#1;c&#x7f;d&#xD800;e&#x110000;f&#x9;g"), "abcdef\tg");
  assert.equal(decodeEntities("&unknown; & &amp &#; &#x; AT&T"), "&unknown; & &amp &#; &#x; AT&T");
  assert.equal(decodeEntities(null), "");
});

test("entities decode once: an encoded entity stays an entity", () => {
  assert.equal(decodeEntities("&amp;lt;"), "&lt;");
  assert.equal(htmlToText("<p>&amp;lt;script&amp;gt;</p>"), "&lt;script&gt;");
});

test("lists become '- ' lines and block elements get their own lines", () => {
  const html = "<h2>Requirements</h2><ul><li>Python</li><li>SQL &amp; Postgres</li></ul><p>Apply today.</p>Tail";
  assert.equal(htmlToText(html), "Requirements\n- Python\n- SQL & Postgres\n\nApply today.\n\nTail");
  assert.equal(htmlToText("<p>One</p><p>Two</p>"), "One\n\nTwo");
  assert.equal(htmlToText("Line<br>break<br/>again"), "Line\nbreak\nagain");
  assert.equal(htmlToText("<div>a</div><section>b</section><blockquote>c</blockquote><table><tr><td>x</td></tr></table>"), "a\n\nb\n\nc\n\nx");
  assert.equal(htmlToText("<ol><li>First<ul><li>Nested</li></ul></li></ol>"), "- First\n- Nested");
});

test("script and style elements are removed with their content, other tags dropped", () => {
  const html = '<style>p{color:red}</style>Hi <SCRIPT type="x">alert("<b>")</SCRIPT>there <a href="https://x.test" onclick="evil()">link</a><img src=x onerror=evil()><!-- hidden -->!';
  assert.equal(htmlToText(html), "Hi there link!");
  assert.equal(htmlToText("keep<script>never closed and more"), "keep");
  assert.equal(htmlToText("keep<!-- never closed >"), "keep");
});

test("an encoded script tag stays text and is not decoded again", () => {
  const out = htmlToText("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.equal(out, "<script>alert(1)</script>"); // plain characters in the text, not an element we pass on as HTML
  // Greenhouse: decode once (escaped HTML becomes HTML), then strip. An escaped script is removed...
  assert.equal(htmlToText(decodeEntities("&lt;p&gt;Hi&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;")), "Hi");
  // ...and a double-encoded one ends as literal characters in plain text: it was never an element,
  // and nothing decodes the output again.
  assert.equal(htmlToText(decodeEntities("&lt;p&gt;Hi&lt;/p&gt;&amp;lt;script&amp;gt;x&amp;lt;/script&amp;gt;")), "Hi\n\n<script>x</script>");
});

test("numeric entities and a stray '<' in text", () => {
  assert.equal(htmlToText("5 &lt; 6 and 3 < 4 &#38; &#x26; done"), "5 < 6 and 3 < 4 & & done");
  assert.equal(htmlToText("a<b"), "a<b");
});

test("whitespace collapses and output is capped", () => {
  assert.equal(htmlToText("<p>  a \t\n  b  </p>\n\n\n\n<p>c</p>"), "a b\n\nc");
  assert.equal(htmlToText("<li></li><li>x</li>"), "- x");
  const long = htmlToText(`<p>${"word ".repeat(10000)}</p>`);
  assert.equal(long.length <= 20000, true);
  assert.equal(htmlToText("abcdef", { max: 3 }), "abc");
  assert.equal(htmlToText(""), "");
  assert.equal(htmlToText(undefined), "");
});

test("adversarial input stays linear", () => {
  const MB = 1_000_000;
  const cases = {
    lessThans: "<".repeat(MB),
    lessThanThenGt: "<".repeat(MB) + ">",
    unclosedTags: "<a ".repeat(MB / 3),
    openTags: "<p>".repeat(MB / 3),
    ampersands: "&".repeat(MB),
    ampersandRuns: "&#x".repeat(MB / 3),
    comments: "<!--".repeat(MB / 4),
    scripts: "<script>".repeat(MB / 8),
    scriptsClosedWrong: "<script></scrip>".repeat(MB / 16),
    closers: "</".repeat(MB / 2),
    alternating: "<a>x".repeat(MB / 4),
    spaces: " ".repeat(MB) + "x",
    newlines: "\n".repeat(MB) + "x",
  };
  for (const [name, input] of Object.entries(cases)) {
    const started = performance.now();
    htmlToText(input);
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 1500, `${name} took ${Math.round(elapsed)} ms`);
  }
});
