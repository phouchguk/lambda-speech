/* globals console, process, require */

var data, lt, stdin;

stdin = process.openStdin();

data = "";

stdin.on("data", function(chunk) {
  data += chunk;
});

stdin.on("end", function() {
  var lines, res;

  lines = data.split("\n").map(x => x.replace(/\s+$/, "").replace(/"/g, '\\"'));
  res = lines.join("\\n");

  res = res.endsWith("\\n") ? res.substring(0, res.length - 2) : res;

  console.log('"' + res + '"');
});
