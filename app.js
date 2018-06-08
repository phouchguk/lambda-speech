var SPEECH = (function() {
  var evts = {};

  var core = {},
    dict = null,
    LAMB_num = 0;
  var QUOT = {},
    QUOT_num = 0;
  //var COND = {},
  //  COND_num = 0;
  //var PAIR = {},
  //  PAIR_num = 0;

  var MAC = {};
  //var ARRA = {},
  //  ARRA_num = 0;

  var evaluate = function(s) {
    var bal = balance(s);

    if (bal.left === bal.right) {
      s = preprocessing(s);
      s = eval_special_forms(s);
      s = eval_forms(s);
      s = postprocessing(s);
    }
    return { val: s, bal: bal };
  };

  var eval_special_forms = function(s, flag) {
    while (s !== (s = form_replace(s, "(quote", eval_quote)));
    while (s !== (s = form_replace(s, "(mac", eval_mac)));

    // perform macro expansion
    for (var key in MAC) {
      if (MAC.hasOwnProperty(key)) {
        while (s !== (s = form_replace(s, "(" + key, expand_mac, MAC[key])));
      }
    }

    //while (s !== (s = form_replace(s, "(let", eval_let)));
    //while (s !== (s = form_replace(s, "(when", eval_when)));
    //while (s !== (s = form_replace(s, "(if", eval_if)));
    while (s !== (s = form_replace(s, "(lambda", eval_lambda)));
    while (s !== (s = form_replace(s, "(def", eval_def, flag)));
    return s;
  };

  var eval_forms = function(s) {
    // nested (first rest)
    var regexp = /\(([^\s()]*)(?:[\s]*)([^()]*)\)/g;
    while (s !== (s = s.replace(regexp, eval_form)));
    return s;
  };

  var eval_form = function() {
    var f = arguments[1] || "",
      r = arguments[2] || "";
    return dict.hasOwnProperty(f)
      ? dict[f].apply(null, [r])
      : "[" + f + " " + r + "]";
  };

  var eval_require = function(s) {
    var code, i, pages, pre;

    pages = supertrim(s).split(" ");
    pre = "";

    for (i = 0; i < pages.length; i++) {
      code = localStorage.getItem("ls-" + pages[i]);

      if (code !== null) {
        pre += code;
      }
    }

    return pre;
  };

  var eval_mac = function(s) {
    // (mac name body)
    var index = s.search(/\s/);
    var name = s.substring(0, index).trim();
    var body = s.substring(index).trim();

    MAC[name] = body;

    // to be removed in postprocessing
    return "_MAC_";
  };

  var expand_mac = function(arg, macro) {
    return evaluate("(" + macro + " " + arg + ")").val;
  };

  var eval_quote = function(s) {
    // (quote expressions)
    // s = eval_special_forms( s );
    return quote(s);
  };

  var eval_lambda = function(s) {
    // (lambda (args) body)
    s = eval_special_forms(s);
    var index = s.indexOf(")"),
      argStr = supertrim(s.substring(1, index)),
      args = argStr === "" ? [] : argStr.split(" "),
      body = s.substring(index + 2).trim(),
      name = "_LAMB_" + LAMB_num++,
      reg_args = [];

    for (var i = 0; i < args.length; i++)
      reg_args[i] = new RegExp(args[i], "g");

    dict[name] = function() {
      var valStr = supertrim(arguments[0]);
      var vals = valStr === "" ? [] : valStr.split(" ");

      return (function(bod) {
        var i, isRest, lastIndex;

        //bod = eval_conds(bod, reg_args, vals);
        if (vals.length < args.length) {
          // partial call
          for (i = 0; i < vals.length; i++)
            bod = bod.replace(reg_args[i], vals[i]);

          var _args_ = args.slice(vals.length).join(" ");
          bod = eval_lambda("(" + _args_ + ") " + bod);
        } else if (args.length > 0) {
          lastIndex = args.length - 1;
          isRest = vals.length > args.length && args[lastIndex].startsWith("&");

          // total call
          for (i = 0; i < args.length; i++) {
            if (isRest && i === lastIndex) {
              bod = bod.replace(
                new RegExp(args[i].substring(1), "g"),
                vals.slice(i).join(" ")
              );
            } else {
              bod = bod.replace(reg_args[i], vals[i]);
            }
          }
        }
        return eval_forms(bod);
      })(supertrim(body));
    };
    return name;
  };

  /*
  var eval_conds = function(bod, reg_args, vals) {
    // used in eval_lambda()
    var m = bod.match(/_COND_\d+/);
    if (m == null) {
      return bod;
    } else {
      var name = m[0]; // _COND_n
      var cond = COND[m[0]]; // [bool, one, two]
      var bool = cond[0];
      for (var i = 0; i < vals.length; i++)
        bool = bool.replace(reg_args[i], vals[i]);
      var boolval = eval_forms(bool) === "left" ? cond[1] : cond[2];
      bod = bod.replace(name, boolval);
      bod = eval_conds(bod, reg_args, vals);
      return bod;
    }
  };
  */

  var eval_def = function(s, flag) {
    // (def name body)
    s = eval_special_forms(s, false);
    flag = flag === undefined;
    var index = s.search(/\s/);
    var name = s.substring(0, index).trim();
    var body = s.substring(index).trim();
    if (body.substring(0, 6) === "_LAMB_") {
      dict[name] = dict[body];
    } else {
      body = eval_forms(body);
      dict[name] = function() {
        return body;
      };
    }
    return flag ? "_DEF_" : "";
  };

  /*
  var eval_if = function(s) {
    // (if bool then one else two) - > COND_n
    s = eval_special_forms(s);
    s = supertrim(arguments[0]);
    var index, bool, one, two;
    index = s.indexOf("then");
    bool = s.substring(0, index).trim();
    s = s.substring(index);
    index = s.indexOf("else");
    one = s.substring(5, index).trim();
    s = s.substring(index);
    two = s.substring(5).trim();
    var name = "_COND_" + COND_num++;
    COND[name] = [bool, one, two];
    return name;
  };

  var eval_when = function(s) {
    // syntaxic sugar (when bool then one else two with args)
    // -> (((bool args) (pair one two)) args)
    // use pair,left,right,nil,nil?
    s = eval_special_forms(s);
    s = supertrim(arguments[0]);
    var index, bool, one, two, args;
    index = s.indexOf("then");
    bool = s.substring(0, index).trim();
    s = s.substring(index);
    index = s.indexOf("else");
    one = s.substring(5, index).trim();
    s = s.substring(index);
    index = s.indexOf("with");
    if (index !== -1) {
      two = s.substring(5, index).trim();
      s = s.substring(index + 5);
      args = s;
    } else {
      two = s.substring(index + 5).trim();
      args = "";
    }
    bool = eval_lambda("(" + args + ") " + bool);
    one = eval_lambda("(" + args + ") " + one);
    two = eval_lambda("(" + args + ") " + two);
    return (
      "(((" +
      bool +
      " " +
      args +
      ") (pair " +
      one +
      " " +
      two +
      ")) " +
      args +
      ")"
    );
  };

  var eval_let = function(s) {
    // syntaxic sugar (let ( (arg val) ...) body)
    // -> ((lambda (args) body) vals)
    s = eval_special_forms(s);
    s = supertrim(s);
    var varvals = catch_form("(", s);
    var body = supertrim(s.replace(varvals, ""));
    varvals = varvals.substring(1, varvals.length - 1);
    var avv = [],
      i = 0;
    while (true) {
      avv[i] = catch_form("(", varvals);
      if (avv[i] === "none") break;
      varvals = varvals.replace(avv[i], "");
      i++;
    }
    for (var one = "", two = "", i = 0; i < avv.length - 1; i++) {
      var index = avv[i].indexOf(" ");
      one += avv[i].substring(1, index) + " ";
      two += avv[i].substring(index + 1, avv[i].length - 1) + " ";
    }
    return "((lambda (" + one + ") " + body + ") " + two + ")";
  };
  */

  ////
  var form_replace = function(str, sym, func, flag) {
    sym += " ";
    var s = catch_form(sym, str);
    return s === "none" ? str : str.replace(sym + s + ")", func(s, flag));
  };
  var catch_form = function(symbol, str) {
    var start = str.indexOf(symbol);
    if (start == -1) return "none";
    var d1, d2;
    if (symbol === "(") {
      // {:x v} in let
      d1 = 0;
      d2 = 1;
    } else {
      // (symbol ...)
      d1 = symbol.length;
      d2 = 0;
    }
    var nb = 1,
      index = start;
    while (nb > 0) {
      index++;
      if (str.charAt(index) == "(") nb++;
      else if (str.charAt(index) == ")") nb--;
    }
    return str.substring(start + d1, index + d2);
  };
  ////
  var balance = function(s) {
    var strt = s.match(/\(/g),
      stop = s.match(/\)/g);

    strt = strt ? strt.length : 0;
    stop = stop ? stop.length : 0;
    return { left: strt, right: stop };
  };
  var supertrim = function(s) {
    return s.trim().replace(/\s+/g, " ");
  };
  var quote = function(s) {
    // (quote x) -> _QUOT_n
    var name = "_QUOT_" + QUOT_num++;
    QUOT[name] = s;
    return name;
  };
  var unquote = function(s) {
    // _QUOT_n -> x
    var ss = QUOT[s]; //
    return ss.charAt(0) !== "_"
      ? ss // from (quote x)
      : "(" + ss.substring(1) + ")"; // from '(x)
  };

  /*
  var cond_display = function(s) {
    var bot = COND[s];
    var bool = eval_forms(bot[0]);
    return eval_forms(bool === "left" ? bot[1] : bot[2]);
  };
  */

  var preprocessing = function(s) {
    LAMB_num = 0;
    QUOT_num = 0;
    //COND_num = 0;
    //PAIR_num = 0;
    //ARRA_num = 0;

    if (s.startsWith("(require")) {
      s = form_replace(s, "(require", eval_require);
    }

    s = s.replace(/'\(/g, "(quote _"); // '(x) -> (quote _x)
    return s;
  };
  var postprocessing = function(s) {
    s = s.replace(/_QUOT_\d+/g, unquote);

    // remove mac/def leftovers
    s = s.replace(/(_MAC_|_DEF_)\s*/g, "");

    //s = s.replace(/(_COND_\d+?)/g, cond_display);
    LAMB_num = 0;
    QUOT_num = 0;
    //COND_num = 0;
    //PAIR_num = 0;
    //ARRA_num = 0;

    return s;
  };

  //// DICTIONARY

  core["lib"] = function() {
    var str = "",
      index = 0;
    for (var key in dict) {
      if (dict.hasOwnProperty(key) && key.substring(0, 6) !== "_LAMB_") {
        str += key + ", ";
        index++;
      }
    }
    return "DICT: [" + index + "] [" + str.substring(0, str.length - 2) + "]";
  };

  core["el-val"] = function() {
    var id = arguments[0].trim();

    return document.getElementById(id).value;
  };

  core["inner-html!"] = function() {
    var args = supertrim(arguments[0]).split(" ");
    var innards = args.slice(1).join(" ");

    document.getElementById(args[0]).innerHTML = innards;

    return innards;
  };

  core["clear-timeout!"] = function() {
    var to = arguments[0].trim();
    clearTimeout(to);

    return "_DEF_";
  };

  core["set-timeout!"] = function() {
    var args = supertrim(arguments[0]).split(" ");
    var fn = args[0];
    var time = parseFloat(args[1]);
    var cbArgs = args.slice(2).join(" ");

    return setTimeout(function() {
      // evaluated for side-effects only
      evaluate("(" + fn + " " + cbArgs + ")");
    }, time);
  };

  core["listen!"] = function() {
    var args = supertrim(arguments[0]).split(" ");

    var cb = function(e) {
      var code;

      code = SPEECH.evaluate(
        "(" +
          args[2] +
          " " +
          (args[0] === "click" ? e.target.id : e.key) +
          " " +
          args.slice(3).join(" ") +
          ")"
      );

      if (code.val === "cdr") {
        e.preventDefault();
      }
    };

    if (args[1] === "body") {
      document.body.addEventListener(args[0], cb);
    } else {
      document.getElementById(args[1]).addEventListener(args[0], cb);
    }

    evts[args[0]].push({
      id: args[1],
      fn: args[2]
    });

    return "_DEF_";
  };

  core["reset!"] = function() {
    var el, id;

    id = arguments[0].trim();
    el = document.getElementById(id);

    el.reset();

    return "_DEF_";
  };

  core["toggle!"] = function() {
    var el, id;

    id = arguments[0].trim();
    el = document.getElementById(id);

    if (el.style.display === "none") {
      el.style.display = "";
    } else {
      el.style.display = "none";
    }

    return "_DEF_";
  };

  core["log!"] = function() {
    var msg = arguments[0].trim();
    console.log(msg);

    return msg;
  };

  // we can't insert tb content into the code stream so need to evaluate direct from element value
  core["eval-el-val"] = function() {
    var id, res;

    var id = arguments[0].trim();
    res = evaluate(document.getElementById(id).value);

    return res.val;
  };

  core["sw-status"] = function() {
    return swStatus;
  };

  core["get-url-hash"] = function() {
    return window.location.hash.substr(1);
  };

  core["get-time"] = function() {
    return new Date().getTime();
  };

  //// LOCAL STORAGE
  core["ls-item-exists?"] = function() {
    var key = arguments[0].trim();

    return localStorage.getItem(key) === null ? "cdr" : "car";
  };

  core["ls-get-item"] = function() {
    var key = arguments[0].trim();

    return localStorage.getItem(key);
  };

  core["ls-remove-item!"] = function() {
    var key = arguments[0].trim();
    localStorage.removeItem(key);

    return "_DEF_";
  };

  core["ls-set-item!"] = function() {
    var args = supertrim(arguments[0]).split(" ");
    localStorage.setItem(args[0], args.slice(1).join(" "));

    return "_DEF_";
  };

  //// LOGIC

  core["not"] = function() {
    return arguments[0].trim() === "car" ? "cdr" : "car";
  };

  //// MATHS

  core["+"] = function() {
    var a = supertrim(arguments[0]).split(" ");
    for (var r = 0, i = 0; i < a.length; i++) {
      r += Number(a[i]);
    }
    return r;
  };
  core["*"] = function() {
    var a = supertrim(arguments[0]).split(" ");
    for (var r = 1, i = 0; i < a.length; i++) {
      r *= a[i];
    }
    return r;
  };
  core["-"] = function() {
    var a = supertrim(arguments[0]).split(" ");
    var r = a[0];
    if (a.length === 1) {
      r = -r;
    } else {
      for (var i = 1; i < a.length; i++) {
        r -= a[i];
      }
    }
    return r;
  };
  core["/"] = function() {
    var a = supertrim(arguments[0]).split(" ");
    var r = a[0];
    if (a.length === 1) {
      r = 1 / r;
    } else {
      for (var i = 1; i < a.length; i++) {
        r /= a[i];
      }
    }
    return r;
  };
  core["%"] = function() {
    var a = supertrim(arguments[0]).split(" ");
    return Number(a[0]) % Number(a[1]);
  };
  ////
  core["<"] = function() {
    var a = supertrim(arguments[0]).split(" ");
    var x = Number(a[0]),
      y = Number(a[1]);
    return x < y ? "car" : "cdr";
  };
  core["="] = function() {
    var a = supertrim(arguments[0]).split(" ");
    return a[0] === a[1] ? "car" : "cdr";
  };

  var mathtags = [
    "abs",
    "acos",
    "asin",
    "atan",
    "ceil",
    "cos",
    "exp",
    "floor",
    "pow",
    "log",
    "random",
    "round",
    "sin",
    "sqrt",
    "tan",
    "min",
    "max"
  ];
  for (var i = 0; i < mathtags.length; i++) {
    core[mathtags[i]] = (function(tag) {
      return function() {
        return tag.apply(null, supertrim(arguments[0]).split(" "));
      };
    })(Math[mathtags[i]]);
  }
  core["PI"] = function() {
    return Math.PI;
  };
  core["E"] = function() {
    return Math.E;
  };

  /*
  //// PAIRS

  dict["pair"] = function() {
    // (pair 12 34)
    var a = supertrim(arguments[0]).split(" "); // [12,34]
    var name = "_PAIR_" + PAIR_num++;
    PAIR[name] = a;
    return name;
  };
  dict["pair?"] = function() {
    // (pair? xx)
    var a = arguments[0].trim(); // xx
    return a.substring(0, 6) === "_PAIR_" ? "left" : "right";
  };
  dict["nil?"] = function() {
    // (nil? xx)
    var a = arguments[0].trim(); // xx
    return a === "nil" ? "left" : "right";
  };

  dict["left"] = function() {
    // (left _PAIR_n)
    var a = arguments[0].trim(); // _PAIR_n
    return a.substring(0, 6) === "_PAIR_" ? PAIR[a][0] : a;
  };
  dict["right"] = function() {
    // (left _PAIR_n)
    var a = arguments[0].trim(); // _PAIR_n
    return a.substring(0, 6) === "_PAIR_" ? PAIR[a][1] : a;
  };

  //// ARRAYS

  dict["#.new"] = function() {
    // (#.new 12 34 56)
    var a = supertrim(arguments[0]).split(" ");
    var name = "_ARRA_" + ARRA_num++;
    ARRA[name] = a;
    return name;
  };
  dict["#.array?"] = function() {
    // (#.array? a)
    var a = arguments[0].trim();
    a = ARRA[a];
    return Array.isArray(a) ? "left" : "right";
  };
  dict["#.disp"] = function() {
    // (#.disp arr)
    var a = arguments[0].trim();
    a = ARRA[a];
    return Array.isArray(a) ? JSON.stringify(a) : a;
  };
  dict["#.length"] = function() {
    // (#.length a)
    var a = arguments[0].trim();
    a = ARRA[a];
    return a.length;
  };
  dict["#.empty?"] = function() {
    // (#.empty? a)
    var a = arguments[0].trim();
    a = ARRA[a];
    return a.length === 0 ? "left" : "right";
  };

  dict["#.first"] = function() {
    // (#.first a)
    var a = arguments[0].trim();
    a = ARRA[a];
    return Array.isArray(a) ? a[0] : a;
  };
  dict["#.last"] = function() {
    // (#.last a)
    var a = arguments[0].trim();
    a = ARRA[a];
    return Array.isArray(a) ? a[a.length - 1] : a;
  };

  dict["#.rest"] = function() {
    // (#.rest a)
    var a = arguments[0].trim();
    a = ARRA[a];
    var name = "_ARRA_" + ARRA_num++;
    ARRA[name] = Array.isArray(a) ? a.slice(1) : a;
    return name;
  };
  dict["#.get"] = function() {
    // (#.get a i)
    var a = supertrim(arguments[0]).split(" ");
    var val = ARRA[a[0]][a[1]];
    return val !== undefined ? val : "undefined";
  };

  // HTML

  var htmltags = [
    "div",
    "span",
    "a",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "table",
    "tr",
    "td",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "b",
    "i",
    "u",
    "center",
    "br",
    "hr",
    "blockquote",
    "sup",
    "sub",
    "del",
    "code",
    "img",
    "pre",
    "textarea",
    "canvas",
    "audio",
    "video",
    "source",
    "select",
    "option",
    "object",
    "svg",
    "line",
    "rect",
    "circle",
    "ellipse",
    "polygon",
    "polyline",
    "path",
    "text",
    "g",
    "mpath",
    "use",
    "textPath",
    "pattern",
    "image",
    "clipPath",
    "defs",
    "animate",
    "set",
    "animateMotion",
    "animateTransform",
    "title",
    "desc"
  ];
  for (var i = 0; i < htmltags.length; i++) {
    dict[htmltags[i]] = (function(tag) {
      return function() {
        var s = arguments[0].trim();
        var m = s.match(/(_QUOT_\d+?)/);
        var html;
        if (m !== null) {
          var att = m[0];
          var body = s.replace(att, "");
          html = "{" + tag + " {@ " + unquote(att) + "}" + body + "}";
        } else {
          html = "{" + tag + " " + s + "}";
        }
        return LAMBDATALK.eval_forms(html);
      };
    })(htmltags[i]);
  }

  dict["bigfac"] = function() {
    // require lib_BN
    var fac = function(n) {
      if (n.compare(0) === 0) return 1;
      else return n.multiply(fac(n.subtract(1)));
    };
    var n = new BigNumber(arguments[0], BN_DEC);
    return fac(n);
  };

  // more to come ...

  //// DICTIONARY end
  */

  /*
  var evtListen = function(t) {
    return function(e) {
      var code, i, id;

      if (!evts[t]) {
        return;
      }

      for (i = 0; i < evts[t].length; i++) {
        id = evts[t][i].id.substring(1);

        if (
          (evts[t][i].id.startsWith("#") && e.target.id === id) ||
          (evts[t][i].id.startsWith(".") &&
            e.target.className.split(" ").indexOf(id) > -1)
        ) {
          code = SPEECH.evaluate(
            "(" +
              evts[t][i].fn +
              " " +
              (t === "click" ? e.target.id : e.key) +
              " " +
              evts[t][i].args +
              ")"
          );

          if (code.val === "cdr") {
            console.log(e.target);
            e.preventDefault();
          }
        }
      }
    };
  };
  */

  return {
    evaluate: evaluate,

    reset: function() {
      var evtNames;

      evtNames = ["click", "keydown", "keyup"];

      for (var i = 0; i < evtNames.length; i++) {
        evts[evtNames[i]] = [];
      }

      dict = Object.assign({}, core);
    },

    supertrim: supertrim
  };
})(); // end SPEECH

var codeForm, codeEl;
var lastCode = "";
var name = "default";

var refresh = function(e) {
  var text = codeEl.value;

  if (text === lastCode) {
    return;
  }

  lastCode = text;
  var t0 = new Date().getTime();

  SPEECH.reset();
  var code = SPEECH.evaluate(text);

  var t1 = new Date().getTime();
  document.getElementById("infos").innerHTML =
    "(" +
    code.bal.left +
    "|" +
    code.bal.right +
    ") | " +
    "[" +
    (t1 - t0) +
    "ms]";

  if (code.bal.left === code.bal.right) {
    document.getElementById("view").innerHTML = code.val;
    localStorage.setItem("ls-" + name, text);
  }
};

var coreCode =
  "(def cons\n (lambda (:x :y :z)\n   (:z :x :y)))\n\n(def car\n (lambda (:z)\n   (:z (lambda (:x :y) :x))))\n\n(def cdr\n (lambda (:z)\n  (:z (lambda (:x :y) :y))))\n\n(def nil\n (lambda (:f :x) :x))\n\n(def nil?\n (lambda (:n)\n   (:n (lambda (:x) cdr) car)))";

var init = function() {
  var code, core, res;

  SPEECH.reset();

  code =
    "(def console-toggle\n (lambda (:key)\n   (((= ` :key)\n           (cons\n                 (lambda () (toggle! code))\n                  (lambda ()))))))\n\n(def refresh\n (lambda (_)\n   (inner-html! view (eval-el-val code))))\n\n(def stop-console-key\n (lambda (:key)\n   (not (= ` :key))))\n\n(listen! keydown code stop-console-key)\n(listen! keyup code refresh)\n(listen! keyup body console-toggle)";

  res = SPEECH.evaluate(coreCode + code);
};

var initOld = function() {
  codeForm = document.getElementById("code-form");
  codeEl = document.getElementById("code");

  codeForm.style.display = "none";

  codeEl.addEventListener("keydown", function(e) {
    if (e.key === "`" || e.key === "§") {
      e.preventDefault();
    }
  });

  codeEl.addEventListener("keyup", refresh);

  document.body.addEventListener("keyup", function(e) {
    if (!(e.key === "`" || e.key === "§")) {
      return;
    }

    if (codeForm.style.display === "none") {
      codeForm.style.display = "";
      codeEl.focus();
    } else {
      codeEl.blur();
      codeForm.style.display = "none";
    }
  });

  load();
};

// load different code for every 'page'
var load = function() {
  var code, hashName;

  codeForm.reset();

  lastCode = "";
  hashName = window.location.hash.substr(1);

  if (hashName === "") {
    name = "default";
  } else {
    name = hashName;
  }

  code = localStorage.getItem("ls-" + name);

  if (code === null) {
    if (name === "default") {
      code =
        '(require bootstrap-helper)\n\n<h1>\'(&lambda; speech)</h1>\n\n<p>Go to the <a href="http://lambdaway.free.fr/workshop/?view=lambdaspeech">official \'(&lambda; speech) site</a>.</p>\n<p class="text-muted">Press ` or § to view console.</p>\n<p>You can create a new page by appending #pagename to the url.</p>\n\n(+ 1 2 3 4 5)\n\n(def my-pair\n (cons Hello World))\n\n<p>(cdr (my-pair))</p>\n\n(def sw-icon\n (icon thumbs-(((= ok (sw-status))\n                (cons\n                                                               (lambda () up success)\n                                                                (lambda () down danger))))))\n\n<p id="test">Service worker: (sw-icon) (sw-status)</p>\n<p>Go to <a href="#test">test page</a>.</p>\n\n((lambda (:x :y) <p><b>:x</b> :y<sup>\'(1)</sup> :y<sup>\'(2)</sup></p>) this is a lot of arguments)\n((lambda (:x &:y) <p><b>:x</b> :y<sup>\'(1)</sup> :y<sup>\'(2)</sup>) this is a lot of arguments)\n\n(mac let\n (lambda (innards)\n   (+ 1 2 3)))\n\n(let ((x 5) (y 7))\n  (* x y))\n\n(def called-later\n (lambda (&:x)\n   (log! I was called after 3 seconds)\n    (inner-html! test :x)))\n\n(def t/o (set-timeout! called-later 3000 (icon time success) Element contents updated.))\n\n\'(clear-timeout! (t/o))';

      localStorage.setItem("ls-core", coreCode);

      localStorage.setItem(
        "ls-bootstrap-helper",
        '(def icon\n (lambda (:name :class) <span class="glyphicon glyphicon-:name text-:class"></span>))'
      );

      localStorage.setItem(
        "ls-test",
        '<h1>Test page</h1>\n<p>This is the test page. Go back to <a href="#">home</a>.</p>\n<p><a href="#newpage">This page</a> doesn\'t exist yet. But if you click the link it will be created.</p>'
      );
    } else {
      code = "<h1>" + name + "</h1>\n<p>This is a new '" + name + "' page.</p>";
    }

    localStorage.setItem("ls-" + name, code);
  }

  codeEl.innerHTML = code;

  refresh();
};

var swStatus = "checking";

if ("serviceWorker" in navigator) {
  // enable offline working
  window.addEventListener("load", function() {
    navigator.serviceWorker.register("./sw.js").then(
      function(registration) {
        // Registration was successful
        swStatus = "ok";
      },
      function(err) {
        // registration failed :(
        swStatus = "ServiceWorker registration failed: " + err;
      }
    );
  });
} else {
  swStatus = "unavailable";
}

document.addEventListener("DOMContentLoaded", init);
//window.addEventListener("hashchange", load);
