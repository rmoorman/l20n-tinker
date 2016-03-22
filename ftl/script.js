$(function() {

  var config = {
    escapeHtml: true,
    lang: 'en-US',
  };

  function toEntries([entries, curSection], entry) {
    if (entry.type === 'Section') {
      return [entries, entry.name];
    }

    if (curSection && !entry.ns) {
      entry.ns = curSection;
    }

    return [
      Object.assign(entries, {
        [getId(entry)]: entry
      }),
      curSection
    ];
  }

  function getId(entry) {
    return entry.ns ?
      `${entry.ns}/${entry.id}` :
      entry.id;
  }


  /* L20n */

  function update() {
    $("#errors").empty();
    $("#output").empty();

    var args;

    try {
      args = JSON.parse(context.getValue());
    } catch (e) {}

    var code = source.getValue();
    try {
      var ast = L20n.FTLASTParser.parseResource(code);
    } catch(e) {
      logUnexpected(e);
    }

    ast._errors.forEach(e => {
      $("#errors").append(
        "<dt>" + e.name + " in line " + e._pos.row + ", column " + e._pos.col +"</dt>" +
        "<dd>" + escapeHtml(e.description) + "</dd>" +
        "<dd><pre>" + prettyContext(e.context, e.offset) + "</pre></dd>"
      );
    });

    const anots = ast._errors.map(e => ({
      type: 'error',
      text: e.message,
      row: e._pos.row - 1,
      column: e._pos.col,
    }));

    source.getSession().setAnnotations(anots);

    var [entities] = ast.body
      .filter(entry => entry.type === 'Entity' || entry.type === 'Section')
      .reduce(toEntries, [{}, null]);

    var lang = { code: config.lang };
    var ctx = new L20n.MockContext(entities);

    for (var entry of ast.body) {
      if (entry.type === 'Comment') {
        continue;
      }

      if (entry.type === 'JunkEntry') {
        $("#output").append(
          "<div><dt><code class='disabled'>JunkEntry</code></dt>" +
          "<dd><pre>" + escapeHtml(entry.content, true) + "</pre></dd></div>"
        );
        continue;
      }

      if (entry.type === 'Entity') {
        try {
          var result = L20n.format(ctx, lang, args, entry);
          $("#output").append(
            "<div><dt><code>" + getId(entry) + "</code></dt>" +
            "<dd>" + escapeHtml(result[1]) + "</dd></div>"
          );
          result[0].forEach(e => {
            $("#errors").append(
              "<dt>" + e.name + " in entity <code>" + getId(entry) + "</code></dt>" +
              "<dd>" + escapeHtml(e.message) + "</dd>"
            );
          });
        } catch(e) {
          logUnexpected(e);
        }
      }
    }
  }

  /* ACE */

  var source = ace.edit("source");
  source.setBehavioursEnabled(false);
  source.setShowPrintMargin(false);
  source.setDisplayIndentGuides(false);
  source.getSession().setUseWrapMode(true);
  source.getSession().setOption("useWorker", false);
  source.setTheme("ace/theme/solarized_light");
  source.getSession().setMode("ace/mode/properties");
  source.getSession().on('change', update);

  var context = ace.edit("context");
  context.setShowPrintMargin(false);
  context.setHighlightActiveLine(false);
  context.setHighlightGutterLine(false);
  context.setHighlightSelectedWord(false);
  context.getSession().setMode("ace/mode/json");
  context.getSession().on('change', update);


  /* Errors */

  function noop() { }
  function logUnexpected(e) {
    $("#errors").append(
      "<dt>" + e.name + "</dt><dd>" + escapeHtml(e.message) + "</dd>"
    );
  }

  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };

  function replaceHtml(char) {
    return entityMap[char];
  }

  function escapeHtml(str, force) {
    return str && (config.escapeHtml || force) ?
      str.replace(/[&<>"'\/]/g, replaceHtml) : str;
  }

  function prettyContext(content, offset) {
    const [ before, char, after ] = [
      content.substring(0, offset),
      content.substring(offset, offset + 1),
      content.substring(offset + 1)
    ].map(part => escapeHtml(part, true));

    const hilite = char === '\n' ?
      ' \n' : char;

    return `${before}<em>${hilite}</em>${after}`;
  }


  /* Linkify */

  function utf8_to_b64(str) {
      return window.btoa(unescape(encodeURIComponent(str)));
  }

  function b64_to_utf8(str) {
      return decodeURIComponent(escape(window.atob(str)));
  }

  function linkify() {
    var state = {
      source: source.getValue(),
      context: context.getValue(),
      config: config
    };
    return window.location.href.split("#")[0] + '#' +
      utf8_to_b64(JSON.stringify(state));
  }


  /* Main Code */

  var hash = window.location.hash.slice(1) || defaultHash;
  var state = JSON.parse(b64_to_utf8(hash));
  context.setValue(state.context);
  source.setValue(state.source);
  if (state.config) {
    config = state.config;
  }
  source.clearSelection();
  source.gotoLine(0);
  context.clearSelection();

  $('#share').popover({
    placement: 'bottom',
    html: true,
    title: 'Share URL',
    content: '<input id="share-url" type="text">',
  }).click(function() {
    $('#share-url').val(linkify()).focus().select();
    $(this).popover('toggle');
  });

  $('#escape-html').click(function() {
    config.escapeHtml = !config.escapeHtml;
    update();
  });

  $('#lang').change(function(evt) {
    config.lang = $(this).val();
    update();
  });

  window.addEventListener("resize", update);
});
