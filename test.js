const { runMorpheus } = require('./interp.js');
const cases = {
  hello: `sovereign main() {\n    print("Hello, world!")\n}`,
  vars: `sovereign main() {\n    let greeting \u2190 "Hello"\n    let target \u2190 "Morpheus"\n    print(greeting ++ " " ++ target)\n}`,
  funcs: `sovereign add(a, b) {\n    signal a + b\n}\nsovereign main() {\n    let result \u2190 add(2, 3)\n    print(result)\n}`,
  cond: `sovereign classify(x) {\n    when x > 10 {\n        signal "big"\n    }\n    dream {\n        signal "small"\n    }\n}\nsovereign main() {\n    print(classify(100))\n    print(classify(5))\n}`,
  loops: `sovereign count_down(n) {\n    let i \u2190 n\n    loop i > 0 {\n        print(i)\n        let i \u2190 i - 1\n    }\n}\nsovereign main() {\n    count_down(3)\n}`,
  heal: `sovereign safe_divide(a, b) {\n    heal on "ZeroDivisionError" {\n        signal a / b\n    }\n    dream {\n        signal 0\n    }\n}\nsovereign main() {\n    print(safe_divide(10, 2))\n    print(safe_divide(10, 0))\n}`,
  weave: `sovereign heavy(n) {\n    let acc \u2190 0\n    let i \u2190 0\n    loop i < n {\n        let acc \u2190 acc + i\n        let i \u2190 i + 1\n    }\n    signal acc\n}\nsovereign main() {\n    let results \u2190 weave {\n        heavy(5)\n        heavy(5)\n    }\n    print(len(results))\n    print(results[0])\n}`,
  prophesy: `sovereign revenue_forecast() {\n    signal prophesy {\n        random_norm(100000, 20000)\n    } with samples: 5000, confidence: 0.95\n}\nsovereign main() {\n    let forecast \u2190 revenue_forecast()\n    print(forecast)\n}`,
};
for (const [name, src] of Object.entries(cases)) {
  const r = runMorpheus(src);
  console.log('== ' + name + ' ==');
  console.log(r.error ? 'ERROR: ' + r.error : r.output);
  console.log('');
}

// --- app surface: modules, I/O, argv ---
console.log('== import ==');
console.log(runMorpheus('import "util.morph"\nsovereign main() {\n    print(add2(20))\n}', {
  modules: { 'util.morph': 'sovereign add2(x) {\n    signal x + 2\n}' },
}).output);
console.log('');

console.log('== io + argv ==');
let written = null;
const io = runMorpheus('sovereign main(args) {\n    print(argv()[0] ++ " / " ++ args[0])\n    write_file("out.txt", "hi " ++ "morph")\n    print(read_file("in.txt"))\n}', {
  argv: ['alpha'],
  readFile: () => 'from-disk',
  writeFile: (p, t) => { written = t; },
});
console.log(io.error ? 'ERROR: ' + io.error : io.output + ' | wrote: ' + written);
console.log('');
